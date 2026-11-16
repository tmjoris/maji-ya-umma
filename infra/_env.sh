# Shared helpers for infra/*.sh (sourced, not run).
REGION="${AWS_REGION:-eu-west-1}"
DATA_STACK="${DATA_STACK:-maji-ya-umma-data}"
MQ_STACK="${MQ_STACK:-maji-ya-umma-mq}"
ENV_FILE="${ENV_FILE:-Backend/.env}"
LOCAL_AMQP_URL="amqp://guest:guest@localhost:5672"

awsr() { aws --region "$REGION" "$@"; }
die() { echo "error: $*" >&2; exit 1; }

# Value of KEY in Backend/.env, or empty. Never fails (the scripts run with set -e).
env_get() { grep -E "^$1=" "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- || true; }

# Sets KEY=value in Backend/.env, replacing an existing (or commented-out) line.
env_set() {
  python3 - "$ENV_FILE" "$1" "$2" <<'PY'
import re, sys
path, key, value = sys.argv[1:]
try:
    lines = open(path).read().splitlines()
except FileNotFoundError:
    lines = []
pattern = re.compile(rf"^#?\s*{re.escape(key)}=")
for i, line in enumerate(lines):
    if pattern.match(line):
        lines[i] = f"{key}={value}"
        break
else:
    lines.append(f"{key}={value}")
open(path, "w").write("\n".join(lines) + "\n")
PY
}

stack_output() {
  awsr cloudformation describe-stacks --stack-name "$1" \
    --query "Stacks[0].Outputs[?OutputKey=='$2'].OutputValue" --output text 2>/dev/null
}
