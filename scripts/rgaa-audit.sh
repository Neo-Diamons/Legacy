#!/usr/bin/env bash
# Usage: scripts/rgaa-audit.sh [URLS] [REFERENTIAL] [LEVEL]
#   URLS         comma-separated list of public pages (page audit, no login).
#                default (empty): scenario audit of the local app — login/register/privacy pages
#                signed out, then /, /projects, /projects/<id>, /profile and /privacy signed in
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
APP_URL="http://localhost"
APP_COMPOSE=(sudo docker compose -f "$APP_COMPOSE_FILE")
ASQA_URL="http://localhost:8081"
WEBAPP_URL="http://localhost:8080"
STARTUP_TIMEOUT=180
AUDIT_TIMEOUT=300
ASQA_USER="admin@asqatasun.org"
ASQA_PASS="myAsqaPassword"

AUDIT_EMAIL="rgaa-audit@example.test"
AUDIT_PASSWORD="rgaa-audit-password"
SCENARIO_BASE="http://host.docker.internal" # must match "url" in rgaa-scenario.side.json

if [ -n "${1:-}" ]; then
  MODE=page
  IFS=',' read -r -a TARGET_URLS <<< "$1"
else
  MODE=scenario
  TARGET_URLS=("${SCENARIO_BASE}/")
fi
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

# Local docker secret read by the backend (JWT_SECRET_FILE); generated once, never committed.
JWT_SECRET_PATH="${SCRIPT_DIR}/../secrets/jwt_secret.txt"
if [ ! -s "$JWT_SECRET_PATH" ]; then
  mkdir -p "$(dirname "$JWT_SECRET_PATH")"
  openssl rand -hex 32 > "$JWT_SECRET_PATH"
fi

# Signs the audit account up (or in) through the app API, then makes sure it owns a project with a task,
# so the signed-in pages and /projects/<id> have real content. Sets PROJECT_ID.
seed_app_data() {
  local creds token body status
  creds="$(jq -n --arg e "$AUDIT_EMAIL" --arg p "$AUDIT_PASSWORD" '{email: $e, password: $p}')"
  body="$(jq -n --arg e "$AUDIT_EMAIL" --arg p "$AUDIT_PASSWORD" \
    '{name: "RGAA audit", email: $e, password: $p, acceptPrivacyPolicy: true}')"
  status="$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d "$body" "${APP_URL}/auth/register")"
  case "$status" in
    201 | 409) ;;
    *) die "registering ${AUDIT_EMAIL} returned HTTP ${status} — is the backend up and /auth proxied by the frontend?" ;;
  esac
  token="$(curl -sf -X POST -H 'Content-Type: application/json' -d "$creds" "${APP_URL}/auth/login" | jq -r '.token // empty')" \
    || die "login as ${AUDIT_EMAIL} failed — the account exists with another password? delete it or reset the database"
  [ -n "$token" ] || die "login as ${AUDIT_EMAIL} returned no token"

  local auth=(-H "Authorization: Bearer ${token}" -H 'Content-Type: application/json')
  PROJECT_ID="$(curl -sf "${auth[@]}" "${APP_URL}/projects" | jq -r '.[0].id // empty')" || die "listing projects failed"
  if [ -z "$PROJECT_ID" ]; then
    PROJECT_ID="$(curl -sf "${auth[@]}" -X POST -d '{"name":"Projet audit RGAA","color":"#198754"}' "${APP_URL}/projects" | jq -r '.id')" \
      || die "creating the audit project failed"
  fi
  if [ "$(curl -sf "${auth[@]}" "${APP_URL}/items" | jq 'length')" = "0" ]; then
    curl -sf "${auth[@]}" -X POST -o /dev/null \
      -d "$(jq -n --arg p "$PROJECT_ID" '{name: "Tâche audit RGAA", description: "Tâche de démonstration", priority: "medium", projectId: $p}')" \
      "${APP_URL}/items" || die "creating the audit task failed"
  fi
}

# The scenario (Selenium IDE format) lives in rgaa-scenario.side.json; `echo audit` steps make Asqatasun capture the page.
scenario_json() {
  sed -e "s|__AUDIT_EMAIL__|${AUDIT_EMAIL}|g" \
    -e "s|__AUDIT_PASSWORD__|${AUDIT_PASSWORD}|g" \
    -e "s|__PROJECT_ID__|${PROJECT_ID}|g" \
    "${SCRIPT_DIR}/rgaa-scenario.side.json"
}

command -v jq >/dev/null || die "jq is required (install it: pacman -S jq / apt install jq)"

if [[ "${TARGET_URLS[0]}" == *host.docker.internal* ]]; then
  echo "==> Target is the local app — rebuilding and starting it"
  "${APP_COMPOSE[@]}" up -d --build --wait
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

if [ "$MODE" = scenario ]; then
  echo "==> Seeding the app with the audit account (${AUDIT_EMAIL})"
  seed_app_data
  echo "==> Launching scenario audit (signed out, then signed in)"
  AUDIT_PAYLOAD="$(jq -n \
    --arg scenario "$(scenario_json)" \
    --arg referential "$REFERENTIAL" \
    --arg level "$LEVEL" \
    --arg contractId "$CONTRACT_ID" \
    '{name: "Legacy signed-in audit", scenario: $scenario, referential: $referential, level: $level, contractId: ($contractId | tonumber)}')"
  AUDIT_ID="$(api POST "/api/v0/audit/scenario/run" -H 'Content-Type: application/json' -d "$AUDIT_PAYLOAD")"
else
  echo "==> Launching page audit on: ${TARGET_URLS[*]}"
  URLS_JSON="$(printf '%s\n' "${TARGET_URLS[@]}" | jq -R . | jq -s .)"
  AUDIT_PAYLOAD="$(jq -n \
    --argjson urls "$URLS_JSON" \
    --arg referential "$REFERENTIAL" \
    --arg level "$LEVEL" \
    --arg contractId "$CONTRACT_ID" \
    '{urls: $urls, referential: $referential, level: $level, contractId: ($contractId | tonumber)}')"
  AUDIT_ID="$(api POST "/api/v0/audit/page/run" -H 'Content-Type: application/json' -d "$AUDIT_PAYLOAD")"
fi
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

if [ "$MODE" = scenario ]; then
  echo "    Signed-out pages: / (login), / (register form), /privacy"
  echo "    Signed-in pages (${AUDIT_EMAIL} / ${AUDIT_PASSWORD}): /, /projects, /projects/${PROJECT_ID}, /profile, /privacy"
elif [[ "${TARGET_URLS[0]}" == *host.docker.internal* ]]; then
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
