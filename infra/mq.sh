#!/usr/bin/env bash
# On-demand Amazon MQ (RabbitMQ) broker for Maji ya Umma.
#
# A broker is billed every hour it exists, used or not (mq.m7g.medium, about
# $0.15/hour in eu-west-1). So it's created for a session and deleted after,
# and every broker gets an automatic deletion time as a safety net.
#
#   infra/mq.sh up [hours]       create it (default: deletes itself after 3 hours)
#   infra/mq.sh extend <hours>   move the automatic deletion to <hours> from now
#   infra/mq.sh status           is one running, since when, cost so far, deletion time
#   infra/mq.sh down             delete it now
#   infra/mq.sh url              print AMQP_URL (contains the password) for Render
set -euo pipefail
cd "$(dirname "$0")/.."
source infra/_env.sh
RATE=0.1524 # USD per hour, mq.m7g.medium single-instance, eu-west-1

delete_at() { date -u -d "+$1 hours" +%Y-%m-%dT%H:%M:%S; }

amqp_url() {
  local id endpoint
  id=$(stack_output "$MQ_STACK" BrokerId)
  # The broker lists several endpoints (an HTTPS one first); pick the AMQP one.
  endpoint=$(awsr mq describe-broker --broker-id "$id" \
    --query "BrokerInstances[0].Endpoints[?starts_with(@, 'amqps://')] | [0]" --output text)
  [[ "$endpoint" == amqps://* ]] || die "broker has no amqps:// endpoint (got: $endpoint)"
  # amqps://b-xxxx.mq.eu-west-1.on.aws:5671 → amqps://user:pass@b-xxxx...:5671
  echo "${endpoint/amqps:\/\//amqps://$(env_get MQ_USERNAME):$(env_get MQ_PASSWORD)@}"
}

case "${1:-status}" in
  up)
    hours="${2:-3}"
    role=$(stack_output "$DATA_STACK" MqAutoDeleteRoleArn)
    [ -n "$role" ] && [ "$role" != "None" ] || die "deploy the data stack first: infra/data.sh deploy"
    [ -n "$(env_get MQ_USERNAME)" ] || env_set MQ_USERNAME maji
    [ -n "$(env_get MQ_PASSWORD)" ] || env_set MQ_PASSWORD "$(openssl rand -hex 16)"
    at=$(delete_at "$hours")
    echo "Creating the broker: takes about 15-20 minutes, costs about \$$RATE/hour."
    echo "It deletes itself at $at UTC (extend with: infra/mq.sh extend <hours>)."
    awsr cloudformation deploy --stack-name "$MQ_STACK" --template-file infra/mq.yaml --no-fail-on-empty-changeset \
      --parameter-overrides Username="$(env_get MQ_USERNAME)" Password="$(env_get MQ_PASSWORD)" \
        AutoDeleteAt="$at" AutoDeleteRoleArn="$role"
    env_set AMQP_URL "$(amqp_url)"
    echo "Broker ready. Backend/.env now points at it (restart the API and worker)."
    echo "For Render, set AMQP_URL to the output of: infra/mq.sh url"
    ;;
  extend)
    [ -n "${2:-}" ] || die "usage: infra/mq.sh extend <hours>"
    at=$(delete_at "$2")
    awsr cloudformation deploy --stack-name "$MQ_STACK" --template-file infra/mq.yaml --parameter-overrides AutoDeleteAt="$at"
    echo "The broker now deletes itself at $at UTC."
    ;;
  status)
    status=$(awsr cloudformation describe-stacks --stack-name "$MQ_STACK" --query 'Stacks[0].StackStatus' --output text 2>/dev/null) \
      || { echo "No broker exists (costing \$0)."; exit 0; }
    created=$(awsr cloudformation describe-stacks --stack-name "$MQ_STACK" --query 'Stacks[0].CreationTime' --output text)
    hours=$(python3 -c "import datetime as d,sys; c=d.datetime.fromisoformat(sys.argv[1].replace('Z','+00:00')); print(f'{(d.datetime.now(d.timezone.utc)-c).total_seconds()/3600:.1f}')" "$created")
    echo "Broker stack: $status, created $created (${hours} h ago, about \$$(python3 -c "print(f'{$hours*$RATE:.2f}')") so far)"
    echo "Deletes itself at: $(stack_output "$MQ_STACK" AutoDeleteAt) UTC"
    ;;
  url)
    amqp_url
    ;;
  down)
    awsr cloudformation describe-stacks --stack-name "$MQ_STACK" >/dev/null 2>&1 || { echo "No broker exists."; exit 0; }
    echo "Deleting the broker (a few minutes)..."
    awsr cloudformation delete-stack --stack-name "$MQ_STACK"
    awsr cloudformation wait stack-delete-complete --stack-name "$MQ_STACK"
    env_set AMQP_URL "$LOCAL_AMQP_URL"
    echo "Deleted; it costs nothing now. Backend/.env points back at local RabbitMQ."
    ;;
  *)
    sed -n '2,13p' "$0"; exit 1 ;;
esac
