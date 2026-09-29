#!/usr/bin/env bash
# Usage: scripts/rgaa-audit.sh [URLS] [REFERENTIAL] [LEVEL]
#   URLS         comma-separated list. default: the app's 3 routes (/, /projects, /profile)
#   REFERENTIAL  default: RGAA_4_0  (this server's Referential enum: RGAA_4_0 | RGAA_3_0 | ACCESSIWEB_2_2 | SEO)
#   LEVEL        default: AA        (this server's Level enum: A | AA | AAA)
# Env:
#   RGAA_MIN_MARK  if set, exit 1 when the audit mark (/100) is below it
#   RGAA_MAX_FAILED  if set, exit 1 when failed criteria exceed it

set -euo pipefail

SCRIPT_DIR="$(dirname "$0")"
COMPOSE_FILE="${SCRIPT_DIR}/../compose.asqatasun.yaml"
APP_COMPOSE_FILE="${SCRIPT_DIR}/../compose.yml"
COMPOSE=(sudo docker compose -p asqatasun -f "$COMPOSE_FILE")
APP_COMPOSE=(sudo docker compose -f "$APP_COMPOSE_FILE")
ASQA_URL="http://localhost:8081"
WEBAPP_URL="http://localhost:8080"
STARTUP_TIMEOUT=180
AUDIT_TIMEOUT=300
ASQA_USER="admin@asqatasun.org"
ASQA_PASS="myAsqaPassword"

DEFAULT_URLS="http://host.docker.internal/,http://host.docker.internal/projects,http://host.docker.internal/profile"
IFS=',' read -r -a TARGET_URLS <<< "${1:-$DEFAULT_URLS}"
REFERENTIAL="${2:-RGAA_4_0}"
LEVEL="${3:-AA}"

die() {
  echo "ERROR: $*" >&2
  exit 1
}

api() {
  local method="$1" path="$2"
  shift 2
  local tmp status
  tmp="$(mktemp)"
  status="$(curl -s -o "$tmp" -w '%{http_code}' -u "${ASQA_USER}:${ASQA_PASS}" -X "$method" "$@" "${ASQA_URL}${path}")" \
    || { rm -f "$tmp"; die "curl failed reaching ${ASQA_URL}${path} — is the stack up?"; }
  if [ "${status:0:1}" != "2" ]; then
    echo "--- response body ---" >&2
    cat "$tmp" >&2
    echo "---------------------" >&2
    rm -f "$tmp"
    die "${method} ${path} returned HTTP ${status}"
  fi
  cat "$tmp"
  rm -f "$tmp"
}

field() {
  local query="$1" input
  input="$(cat)"
  if ! jq -e "$query" <<<"$input" >/dev/null 2>&1; then
    echo "--- unexpected payload ---" >&2
    echo "$input" >&2
    echo "--------------------------" >&2
    die "expected field '${query}' not found in response above"
  fi
  jq -r "$query" <<<"$input"
}

command -v jq >/dev/null || die "jq is required (install it: pacman -S jq / apt install jq)"

if [[ "${TARGET_URLS[0]}" == *host.docker.internal* ]]; then
  echo "==> Target is the local app — rebuilding and starting it"
  "${APP_COMPOSE[@]}" up -d --build
fi

echo "==> Starting Asqatasun stack"
"${COMPOSE[@]}" up -d

echo "==> Waiting for asqatasun-server to accept requests (timeout: ${STARTUP_TIMEOUT}s)"
elapsed=0
until code="$(curl -s -o /dev/null -w '%{http_code}' -u "${ASQA_USER}:${ASQA_PASS}" "${ASQA_URL}/api/v0/contract?username=${ASQA_USER}")" \
  && [[ "$code" =~ ^(200|401|403)$ ]]; do
  if [ "$elapsed" -ge "$STARTUP_TIMEOUT" ]; then
    echo "asqatasun-server did not come up within ${STARTUP_TIMEOUT}s (last HTTP code: ${code:-none}). Logs:" >&2
    "${COMPOSE[@]}" logs --tail=50 asqatasun-server asqatasun-db >&2
    die "startup timed out"
  fi
  sleep 3
  elapsed=$((elapsed + 3))
done
[ "$code" = "200" ] || die "authentication failed against ${ASQA_URL} (HTTP ${code}) — check ASQA_USER/ASQA_PASS still match this image's seed credentials"

CONTRACT_LABEL="Legacy"
echo "==> Resolving contract '${CONTRACT_LABEL}' for ${ASQA_USER}"
CONTRACT_ID="$(api GET "/api/v0/contract?username=${ASQA_USER}" | jq -r "[.[] | select(.label==\"${CONTRACT_LABEL}\")][0].id // empty")"

if [ -z "$CONTRACT_ID" ]; then
  echo "==> No '${CONTRACT_LABEL}' contract found, provisioning one"

  if ! USER_ID="$("${COMPOSE[@]}" exec -T asqatasun-db \
    mariadb -u asqatasunDatabaseUserLogin -pasqatasunDatabaseUserP4ssword asqatasun \
    -N -B -e "SELECT Id_User FROM USERS WHERE Email1 = '${ASQA_USER}' LIMIT 1;" 2>/tmp/rgaa-db-err)"; then
    cat /tmp/rgaa-db-err >&2
    die "DB lookup for ${ASQA_USER} failed — is asqatasun-db healthy? (see error above)"
  fi
  [ -n "$USER_ID" ] || die "no user row found for ${ASQA_USER} — check the seed credentials still match this Asqatasun image version"

  BEGIN_DATE="$(date -u +%Y-%m-%dT00:00:00.000+0000)"
  END_DATE="$(date -u -d '+10 years' +%Y-%m-%dT00:00:00.000+0000)"
  CONTRACT_PAYLOAD="$(jq -n \
    --arg userId "$USER_ID" \
    --arg label "$CONTRACT_LABEL" \
    --arg beginDate "$BEGIN_DATE" \
    --arg endDate "$END_DATE" \
    --arg referential "$REFERENTIAL" \
    '{userId: ($userId | tonumber), label: $label, beginDate: $beginDate, endDate: $endDate, functionalities: ["PAGES"], options: {}, referentials: [$referential]}')"

  CONTRACT_ID="$(api PUT "/api/v0/contract" -H 'Content-Type: application/json' -d "$CONTRACT_PAYLOAD")"
  [[ "$CONTRACT_ID" =~ ^[0-9]+$ ]] || die "expected a numeric contract id, got: ${CONTRACT_ID}"
  echo "==> Created contract id ${CONTRACT_ID}"
else
  echo "==> Using existing contract id ${CONTRACT_ID}"
fi

for url in "${TARGET_URLS[@]}"; do
  echo "==> Checking ${url} is reachable from the audit browser (timeout: 60s)"
  elapsed=0
  until "${COMPOSE[@]}" exec -T asqatasun-selenium curl -sf -o /dev/null -m 5 "$url"; do
    if [ "$elapsed" -ge 60 ]; then
      die "${url} is not reachable from inside the asqatasun-selenium container. \
Is the target app running? (docker ps --filter name=legacy). \
If targeting the host app via host.docker.internal, confirm it's published on the host (compose.yml) \
and not just bound to a container-internal network."
    fi
    sleep 3
    elapsed=$((elapsed + 3))
  done
done

echo "==> Launching page audit on: ${TARGET_URLS[*]}"
URLS_JSON="$(printf '%s\n' "${TARGET_URLS[@]}" | jq -R . | jq -s .)"
AUDIT_PAYLOAD="$(jq -n \
  --argjson urls "$URLS_JSON" \
  --arg referential "$REFERENTIAL" \
  --arg level "$LEVEL" \
  --arg contractId "$CONTRACT_ID" \
  '{urls: $urls, referential: $referential, level: $level, contractId: ($contractId | tonumber)}')"
AUDIT_ID="$(api POST "/api/v0/audit/page/run" -H 'Content-Type: application/json' -d "$AUDIT_PAYLOAD")"
[[ "$AUDIT_ID" =~ ^[0-9]+$ ]] || die "expected a numeric audit id, got: ${AUDIT_ID}"

audit_status() {
  "${COMPOSE[@]}" exec -T asqatasun-db \
    mariadb -u asqatasunDatabaseUserLogin -pasqatasunDatabaseUserP4ssword asqatasun \
    -N -B -e "SELECT Status FROM AUDIT WHERE Id_Audit = ${AUDIT_ID};"
}

echo "==> Audit id ${AUDIT_ID} running, polling for completion (timeout: ${AUDIT_TIMEOUT}s)"
elapsed=0
while true; do
  STATUS="$(audit_status)"
  [ -n "$STATUS" ] || die "audit ${AUDIT_ID} vanished from the DB — check asqatasun-server logs"
  case "$STATUS" in
    COMPLETED) break ;;
    ERROR)
      echo "==> Audit ${AUDIT_ID} crashed. Selenium/server logs:" >&2
      "${COMPOSE[@]}" logs --tail=50 asqatasun-server >&2
      die "audit ${AUDIT_ID} ended in ERROR — usually means the target URL wasn't actually renderable (check it loads a real page, not just a TCP-level response)"
      ;;
  esac
  if [ "$elapsed" -ge "$AUDIT_TIMEOUT" ]; then
    die "audit ${AUDIT_ID} still '${STATUS}' after ${AUDIT_TIMEOUT}s, giving up"
  fi
  echo "    status: ${STATUS}"
  sleep 5
  elapsed=$((elapsed + 5))
done

RESULT="$(api GET "/api/v0/audit/${AUDIT_ID}")"
GRADE="$(jq -r '.subject.grade' <<<"$RESULT")"
MARK="$(jq -r '.subject.mark' <<<"$RESULT")"
NB_PAGES="$(jq -r '.subject.nbOfPages' <<<"$RESULT")"
FAILED="$(jq -r '.subject.repartitionBySolutionType[] | select(.type=="FAILED") | .number' <<<"$RESULT")"
NEED_INFO="$(jq -r '.subject.repartitionBySolutionType[] | select(.type=="NEED_MORE_INFO") | .number' <<<"$RESULT")"

echo "==> Result"
echo "    Pages audited: ${NB_PAGES}"
echo "    Grade: ${GRADE}  (${MARK}/100)"
echo "    Failed: ${FAILED}   Needs manual review: ${NEED_INFO}"
echo "    Detailed report: ${WEBAPP_URL} — log in and open audit #${AUDIT_ID} under 'My audits'"

if [[ "${TARGET_URLS[0]}" == *host.docker.internal* ]]; then
  echo "    App pages you can open yourself:"
  for url in "${TARGET_URLS[@]}"; do
    echo "      ${url/host.docker.internal/localhost}"
  done
fi

if [ -n "${RGAA_MIN_MARK:-}" ] && awk -v m="$MARK" -v t="$RGAA_MIN_MARK" 'BEGIN { exit !(m < t) }'; then
  die "mark ${MARK} is below RGAA_MIN_MARK ${RGAA_MIN_MARK}"
fi
if [ -n "${RGAA_MAX_FAILED:-}" ] && [ "$FAILED" -gt "$RGAA_MAX_FAILED" ]; then
  die "${FAILED} failed criteria exceed RGAA_MAX_FAILED ${RGAA_MAX_FAILED}"
fi
