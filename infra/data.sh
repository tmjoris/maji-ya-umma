#!/usr/bin/env bash
# Always-on AWS resources for Maji ya Umma (infra/data.yaml): the DynamoDB
# table (inside the free tier), the backend's IAM user, and the role used to
# auto-delete the on-demand broker. Costs $0 at this app's size.
#
#   infra/data.sh deploy   create/update the stack and point Backend/.env at the table
#   infra/data.sh keys     create an access key for the backend user and store it in
#                          Backend/.env (never printed); --rotate replaces an existing one
set -euo pipefail
cd "$(dirname "$0")/.."
source infra/_env.sh

case "${1:-}" in
  deploy)
    awsr cloudformation deploy --stack-name "$DATA_STACK" --template-file infra/data.yaml \
      --capabilities CAPABILITY_NAMED_IAM --no-fail-on-empty-changeset
    env_set DYNAMODB_TABLE "$(stack_output "$DATA_STACK" TableName)"
    env_set AWS_REGION "$REGION"
    echo "Data stack ready; table: $(env_get DYNAMODB_TABLE)"
    ;;
  keys)
    user=$(stack_output "$DATA_STACK" BackendUserName)
    [ -n "$user" ] && [ "$user" != "None" ] || die "deploy the data stack first: infra/data.sh deploy"
    if [ -n "$(env_get AWS_ACCESS_KEY_ID)" ] && [ "${2:-}" != "--rotate" ]; then
      die "Backend/.env already has an access key; use 'infra/data.sh keys --rotate' to replace it"
    fi
    old="$(env_get AWS_ACCESS_KEY_ID)"
    read -r id secret < <(awsr iam create-access-key --user-name "$user" \
      --query 'AccessKey.[AccessKeyId,SecretAccessKey]' --output text)
    env_set AWS_ACCESS_KEY_ID "$id"
    env_set AWS_SECRET_ACCESS_KEY "$secret"
    if [ -n "$old" ] && [ "$old" != "$id" ]; then awsr iam delete-access-key --user-name "$user" --access-key-id "$old"; fi
    echo "Access key for $user stored in Backend/.env (copy the two AWS_* values into Render's environment)."
    ;;
  *)
    sed -n '2,9p' "$0"; exit 1 ;;
esac
