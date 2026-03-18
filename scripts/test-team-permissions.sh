#!/bin/bash
# Integration tests for team_permissions hooks.
# Validates role-based access control on teams, member_teams, members, hall_slots.
#
# Usage:
#   export COACH_EMAIL=... COACH_PASS=... ADMIN_EMAIL=... ADMIN_PASS=...
#   export VB_ADMIN_EMAIL=... VB_ADMIN_PASS=... BB_ADMIN_EMAIL=... BB_ADMIN_PASS=...
#   export USER_EMAIL=... USER_PASS=...
#   ./scripts/test-team-permissions.sh

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────
PB_URL="${PB_URL:-https://kscw-api-dev.lucanepa.com}"
AUTH_ENDPOINT="$PB_URL/api/collections/members/auth-with-password"

# ── Colors ────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

# ── Helpers ───────────────────────────────────────────────────────────

log_section() {
  echo ""
  echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
  echo -e "${YELLOW}  $1${NC}"
  echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
}

log_pass() {
  echo -e "  ${GREEN}✓ PASS${NC} [$1] $2"
  PASS_COUNT=$((PASS_COUNT + 1))
}

log_fail() {
  echo -e "  ${RED}✗ FAIL${NC} [$1] $2  (expected $3, got $4)"
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

log_skip() {
  echo -e "  ${CYAN}⊘ SKIP${NC} [$1] $2  ($3)"
  SKIP_COUNT=$((SKIP_COUNT + 1))
}

# Authenticate a user; prints "token|record_id" to stdout.
# Usage: AUTH_RESULT=$(authenticate "email" "password" "label")
#        TOKEN=$(echo "$AUTH_RESULT" | cut -d'|' -f1)
#        RECORD_ID=$(echo "$AUTH_RESULT" | cut -d'|' -f2)
authenticate() {
  local email="$1"
  local password="$2"
  local label="$3"

  local resp
  resp=$(curl -s -w "\n%{http_code}" -X POST "$AUTH_ENDPOINT" \
    -H "Content-Type: application/json" \
    -d "{\"identity\":\"$email\",\"password\":\"$password\"}")

  local http_code
  http_code=$(echo "$resp" | tail -1)
  local body
  body=$(echo "$resp" | sed '$d')

  if [[ "$http_code" != "200" ]]; then
    echo ""
    echo -e "${RED}ERROR: Failed to authenticate $label ($email) — HTTP $http_code${NC}" >&2
    echo -e "${RED}       Response: $body${NC}" >&2
    return 1
  fi

  local token
  token=$(echo "$body" | grep -o '"token":"[^"]*"' | head -1 | cut -d'"' -f4)
  if [[ -z "$token" ]]; then
    echo -e "${RED}ERROR: No token in response for $label${NC}" >&2
    return 1
  fi

  # Extract record ID from auth response
  local record_id
  record_id=$(echo "$body" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

  echo "${token}|${record_id}"
}

# Make an API request and check the HTTP status code.
# Usage: assert_status TEST_NUM DESCRIPTION METHOD URL TOKEN DATA EXPECTED_CODES
# EXPECTED_CODES can be "200" or "401/403" (slash-separated alternatives)
assert_status() {
  local test_num="$1"
  local description="$2"
  local method="$3"
  local url="$4"
  local token="$5"
  local data="$6"
  local expected="$7"

  local curl_args=(-s -o /dev/null -w "%{http_code}" -X "$method" "$url")

  if [[ -n "$token" ]]; then
    curl_args+=(-H "Authorization: Bearer $token")
  fi

  if [[ "$method" == "PATCH" || "$method" == "POST" ]]; then
    curl_args+=(-H "Content-Type: application/json")
    curl_args+=(-d "${data:-{}}")
  fi

  local http_code
  http_code=$(curl "${curl_args[@]}")

  # Check if http_code matches any of the expected codes (split by /)
  local matched=false
  IFS='/' read -ra codes <<< "$expected"
  for code in "${codes[@]}"; do
    if [[ "$http_code" == "$code" ]]; then
      matched=true
      break
    fi
  done

  if $matched; then
    log_pass "$test_num" "$description"
  else
    log_fail "$test_num" "$description" "$expected" "$http_code"
  fi
}

# ── Validate env vars ────────────────────────────────────────────────

missing_vars=()
for var in COACH_EMAIL COACH_PASS ADMIN_EMAIL ADMIN_PASS \
           VB_ADMIN_EMAIL VB_ADMIN_PASS BB_ADMIN_EMAIL BB_ADMIN_PASS \
           USER_EMAIL USER_PASS; do
  if [[ -z "${!var:-}" ]]; then
    missing_vars+=("$var")
  fi
done

if [[ ${#missing_vars[@]} -gt 0 ]]; then
  echo -e "${RED}ERROR: Missing required environment variables:${NC}"
  for v in "${missing_vars[@]}"; do
    echo "  - $v"
  done
  echo ""
  echo "Usage:"
  echo "  export COACH_EMAIL=coach@example.com COACH_PASS=secret ..."
  echo "  $0"
  exit 1
fi

echo -e "${YELLOW}Team Permissions Integration Tests${NC}"
echo -e "PB URL: ${CYAN}$PB_URL${NC}"
echo ""

# ── Authenticate all users ───────────────────────────────────────────
log_section "Authenticating test users"

COACH_AUTH=$(authenticate "$COACH_EMAIL" "$COACH_PASS" "Coach")
COACH_TOKEN=$(echo "$COACH_AUTH" | cut -d'|' -f1)
COACH_ID=$(echo "$COACH_AUTH" | cut -d'|' -f2)
echo -e "  ${GREEN}✓${NC} Coach authenticated (ID: $COACH_ID)"
sleep 4

ADMIN_AUTH=$(authenticate "$ADMIN_EMAIL" "$ADMIN_PASS" "Admin")
ADMIN_TOKEN=$(echo "$ADMIN_AUTH" | cut -d'|' -f1)
echo -e "  ${GREEN}✓${NC} Admin authenticated"
sleep 4

VB_ADMIN_AUTH=$(authenticate "$VB_ADMIN_EMAIL" "$VB_ADMIN_PASS" "VB Admin")
VB_ADMIN_TOKEN=$(echo "$VB_ADMIN_AUTH" | cut -d'|' -f1)
echo -e "  ${GREEN}✓${NC} VB Admin authenticated"
sleep 4

BB_ADMIN_AUTH=$(authenticate "$BB_ADMIN_EMAIL" "$BB_ADMIN_PASS" "BB Admin")
BB_ADMIN_TOKEN=$(echo "$BB_ADMIN_AUTH" | cut -d'|' -f1)
echo -e "  ${GREEN}✓${NC} BB Admin authenticated"
sleep 4

USER_AUTH=$(authenticate "$USER_EMAIL" "$USER_PASS" "Regular User")
USER_TOKEN=$(echo "$USER_AUTH" | cut -d'|' -f1)
echo -e "  ${GREEN}✓${NC} Regular User authenticated"

# ── Data Discovery ───────────────────────────────────────────────────
log_section "Discovering test data"

# Helper to query PB API with admin token
pb_get() {
  curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$PB_URL$1"
}

# Extract first item from a PB list response
jq_first_id() {
  grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4
}

# COACH_ID already extracted from auth response above
echo -e "  COACH_ID: ${CYAN}$COACH_ID${NC}"

# COACH_TEAM: a team where coach is in the coach array
# We search teams and filter by coach containing the COACH_ID
COACH_TEAM=$(pb_get "/api/collections/teams/records?filter=(coach~'$COACH_ID')&perPage=1" | jq_first_id)
if [[ -z "$COACH_TEAM" ]]; then
  echo -e "${RED}WARNING: Could not find a team where coach is $COACH_ID${NC}"
fi
echo -e "  COACH_TEAM: ${CYAN}${COACH_TEAM:-NOT FOUND}${NC}"

# Get COACH_TEAM sport to help find OTHER_TEAM
COACH_TEAM_SPORT=""
if [[ -n "${COACH_TEAM:-}" ]]; then
  COACH_TEAM_SPORT=$(pb_get "/api/collections/teams/records/$COACH_TEAM" \
    | grep -o '"sport":"[^"]*"' | head -1 | cut -d'"' -f4)
  echo -e "  COACH_TEAM sport: ${CYAN}$COACH_TEAM_SPORT${NC}"
fi

# OTHER_TEAM: a team where COACH_ID is NOT coach or team_responsible
OTHER_TEAM=""
ALL_TEAMS_JSON=$(pb_get "/api/collections/teams/records?perPage=100")
# Parse all team IDs from JSON
ALL_TEAM_IDS=$(echo "$ALL_TEAMS_JSON" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

# Get all teams where coach is coach or TR
COACH_TEAMS_JSON=$(curl -s -G "$PB_URL/api/collections/teams/records" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  --data-urlencode "filter=coach~'$COACH_ID' || team_responsible~'$COACH_ID'" \
  --data-urlencode "perPage=100")
COACH_TEAM_IDS=$(echo "$COACH_TEAMS_JSON" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

for tid in $ALL_TEAM_IDS; do
  is_coach_team=false
  for ctid in $COACH_TEAM_IDS; do
    if [[ "$tid" == "$ctid" ]]; then
      is_coach_team=true
      break
    fi
  done
  if ! $is_coach_team; then
    OTHER_TEAM="$tid"
    break
  fi
done
echo -e "  OTHER_TEAM: ${CYAN}${OTHER_TEAM:-NOT FOUND}${NC}"

# VB_TEAM: a team with sport='volleyball'
VB_TEAM=$(pb_get "/api/collections/teams/records?filter=(sport='volleyball')&perPage=1" | jq_first_id)
echo -e "  VB_TEAM: ${CYAN}${VB_TEAM:-NOT FOUND}${NC}"

# BB_TEAM: a team with sport='basketball'
BB_TEAM=$(pb_get "/api/collections/teams/records?filter=(sport='basketball')&perPage=1" | jq_first_id)
echo -e "  BB_TEAM: ${CYAN}${BB_TEAM:-NOT FOUND}${NC}"

# TEAM_MEMBER_ID: a member on the coach's team (not the coach themselves)
TEAM_MEMBER_ID=""
if [[ -n "${COACH_TEAM:-}" ]]; then
  TEAM_MEMBER_ID=$(curl -s -G "$PB_URL/api/collections/member_teams/records" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    --data-urlencode "filter=team='$COACH_TEAM' && member!='$COACH_ID'" \
    --data-urlencode "perPage=1" \
    | grep -o '"member":"[^"]*"' | head -1 | cut -d'"' -f4)
fi
echo -e "  TEAM_MEMBER_ID: ${CYAN}${TEAM_MEMBER_ID:-NOT FOUND}${NC}"

# Save the original position of TEAM_MEMBER_ID for restore
ORIGINAL_POSITION=""
if [[ -n "${TEAM_MEMBER_ID:-}" ]]; then
  MEMBER_JSON=$(pb_get "/api/collections/members/records/$TEAM_MEMBER_ID")
  # Extract position array — stored as JSON array in the record
  ORIGINAL_POSITION=$(echo "$MEMBER_JSON" | grep -o '"position":\[[^]]*\]' | head -1 | sed 's/"position"://')
  if [[ -z "$ORIGINAL_POSITION" ]]; then
    ORIGINAL_POSITION="[]"
  fi
  echo -e "  TEAM_MEMBER original position: ${CYAN}$ORIGINAL_POSITION${NC}"
fi

# OTHER_MEMBER_ID: a member NOT on any of the coach's teams
OTHER_MEMBER_ID=""
if [[ -n "${COACH_TEAM:-}" ]]; then
  # Get all member IDs on coach's teams
  COACH_TEAM_MEMBER_IDS=$(curl -s -G "$PB_URL/api/collections/member_teams/records" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    --data-urlencode "filter=team='$COACH_TEAM'" \
    --data-urlencode "perPage=200" \
    | grep -o '"member":"[^"]*"' | cut -d'"' -f4 | sort -u)

  # Get a member not in that list (and not the coach)
  ALL_MEMBERS_JSON=$(pb_get "/api/collections/members/records?perPage=5")
  ALL_MEMBER_IDS=$(echo "$ALL_MEMBERS_JSON" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

  for mid in $ALL_MEMBER_IDS; do
    if [[ "$mid" == "$COACH_ID" ]]; then continue; fi
    is_on_team=false
    for tmid in $COACH_TEAM_MEMBER_IDS; do
      if [[ "$mid" == "$tmid" ]]; then
        is_on_team=true
        break
      fi
    done
    if ! $is_on_team; then
      OTHER_MEMBER_ID="$mid"
      break
    fi
  done
fi
echo -e "  OTHER_MEMBER_ID: ${CYAN}${OTHER_MEMBER_ID:-NOT FOUND}${NC}"

# HALL_SLOT_ID: any existing hall_slot record
HALL_SLOT_ID=$(pb_get "/api/collections/hall_slots/records?perPage=1" | jq_first_id)
echo -e "  HALL_SLOT_ID: ${CYAN}${HALL_SLOT_ID:-NOT FOUND}${NC}"

# ═══════════════════════════════════════════════════════════════════════
# TEST CASES
# ═══════════════════════════════════════════════════════════════════════

# ── assertTeamAccess: teams ──────────────────────────────────────────
log_section "Team Update/Create/Delete Permissions"

# Test 1: Coach updates own team
if [[ -n "${COACH_TEAM:-}" ]]; then
  assert_status 1 "Coach updates own team" \
    PATCH "$PB_URL/api/collections/teams/records/$COACH_TEAM" \
    "$COACH_TOKEN" '{}' "200"
else
  log_skip 1 "Coach updates own team" "COACH_TEAM not found"
fi

# Test 2: Coach updates other team
if [[ -n "${OTHER_TEAM:-}" ]]; then
  assert_status 2 "Coach updates other team" \
    PATCH "$PB_URL/api/collections/teams/records/$OTHER_TEAM" \
    "$COACH_TOKEN" '{}' "403/404"
else
  log_skip 2 "Coach updates other team" "OTHER_TEAM not found"
fi

# Test 7: vb_admin updates VB team
if [[ -n "${VB_TEAM:-}" ]]; then
  assert_status 7 "vb_admin updates VB team" \
    PATCH "$PB_URL/api/collections/teams/records/$VB_TEAM" \
    "$VB_ADMIN_TOKEN" '{}' "200"
else
  log_skip 7 "vb_admin updates VB team" "VB_TEAM not found"
fi

# Test 8: vb_admin updates BB team
if [[ -n "${BB_TEAM:-}" ]]; then
  assert_status 8 "vb_admin updates BB team" \
    PATCH "$PB_URL/api/collections/teams/records/$BB_TEAM" \
    "$VB_ADMIN_TOKEN" '{}' "403/404"
else
  log_skip 8 "vb_admin updates BB team" "BB_TEAM not found"
fi

# Test 9: bb_admin updates BB team
if [[ -n "${BB_TEAM:-}" ]]; then
  assert_status 9 "bb_admin updates BB team" \
    PATCH "$PB_URL/api/collections/teams/records/$BB_TEAM" \
    "$BB_ADMIN_TOKEN" '{}' "200"
else
  log_skip 9 "bb_admin updates BB team" "BB_TEAM not found"
fi

# Test 10: admin updates any team
if [[ -n "${COACH_TEAM:-}" ]]; then
  assert_status 10 "Admin updates any team" \
    PATCH "$PB_URL/api/collections/teams/records/$COACH_TEAM" \
    "$ADMIN_TOKEN" '{}' "200"
else
  log_skip 10 "Admin updates any team" "COACH_TEAM not found"
fi

# Test 12: Regular user updates team
if [[ -n "${COACH_TEAM:-}" ]]; then
  assert_status 12 "Regular user updates team" \
    PATCH "$PB_URL/api/collections/teams/records/$COACH_TEAM" \
    "$USER_TOKEN" '{}' "403/404"
else
  log_skip 12 "Regular user updates team" "COACH_TEAM not found"
fi

# Test 14: Unauthenticated updates team
if [[ -n "${COACH_TEAM:-}" ]]; then
  assert_status 14 "Unauthenticated updates team" \
    PATCH "$PB_URL/api/collections/teams/records/$COACH_TEAM" \
    "" '{}' "401/403/404"
else
  log_skip 14 "Unauthenticated updates team" "COACH_TEAM not found"
fi

# Test 15: Coach creates team
assert_status 15 "Coach creates team" \
  POST "$PB_URL/api/collections/teams/records" \
  "$COACH_TOKEN" '{"name":"_test_should_be_denied","sport":"volleyball"}' "400/403"

# Test 16: Coach deletes team
if [[ -n "${COACH_TEAM:-}" ]]; then
  assert_status 16 "Coach deletes team" \
    DELETE "$PB_URL/api/collections/teams/records/$COACH_TEAM" \
    "$COACH_TOKEN" '' "403/400"
else
  log_skip 16 "Coach deletes team" "COACH_TEAM not found"
fi

# ── assertTeamAccess: member_teams ───────────────────────────────────
log_section "Member-Teams Permissions"

# Test 4: Coach creates member_teams for other team
if [[ -n "${OTHER_TEAM:-}" ]]; then
  assert_status 4 "Coach creates member_teams for other team" \
    POST "$PB_URL/api/collections/member_teams/records" \
    "$COACH_TOKEN" "{\"member\":\"$COACH_ID\",\"team\":\"$OTHER_TEAM\",\"season\":\"test\"}" "400/403"
else
  log_skip 4 "Coach creates member_teams for other team" "OTHER_TEAM not found"
fi

# ── assertMemberFieldAccess: members ─────────────────────────────────
log_section "Member Field Access Permissions"

# Test 20: User edits own profile (coach editing themselves)
assert_status 20 "User edits own profile" \
  PATCH "$PB_URL/api/collections/members/records/$COACH_ID" \
  "$COACH_TOKEN" '{"language":"german"}' "200"

# Test 21: Coach edits team member position
if [[ -n "${TEAM_MEMBER_ID:-}" ]]; then
  assert_status 21 "Coach edits team member position" \
    PATCH "$PB_URL/api/collections/members/records/$TEAM_MEMBER_ID" \
    "$COACH_TOKEN" '{"position":["libero"]}' "200"

  # Restore original position
  echo -e "  ${CYAN}↻ Restoring original position for $TEAM_MEMBER_ID${NC}"
  curl -s -o /dev/null -X PATCH \
    "$PB_URL/api/collections/members/records/$TEAM_MEMBER_ID" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"position\":$ORIGINAL_POSITION}"
else
  log_skip 21 "Coach edits team member position" "TEAM_MEMBER_ID not found"
fi

# Test 25: Coach edits team member email (restricted)
if [[ -n "${TEAM_MEMBER_ID:-}" ]]; then
  assert_status 25 "Coach edits team member email (restricted)" \
    PATCH "$PB_URL/api/collections/members/records/$TEAM_MEMBER_ID" \
    "$COACH_TOKEN" '{"email":"hacker@test.com"}' "403"
else
  log_skip 25 "Coach edits team member email" "TEAM_MEMBER_ID not found"
fi

# Test 26: Coach edits team member phone (restricted)
if [[ -n "${TEAM_MEMBER_ID:-}" ]]; then
  assert_status 26 "Coach edits team member phone (restricted)" \
    PATCH "$PB_URL/api/collections/members/records/$TEAM_MEMBER_ID" \
    "$COACH_TOKEN" '{"phone":"0000000"}' "403"
else
  log_skip 26 "Coach edits team member phone" "TEAM_MEMBER_ID not found"
fi

# Test 27: Coach edits member NOT on their team
if [[ -n "${OTHER_MEMBER_ID:-}" ]]; then
  assert_status 27 "Coach edits member NOT on their team" \
    PATCH "$PB_URL/api/collections/members/records/$OTHER_MEMBER_ID" \
    "$COACH_TOKEN" '{"position":["libero"]}' "403"
else
  log_skip 27 "Coach edits member NOT on their team" "OTHER_MEMBER_ID not found"
fi

# Test 28: Admin edits any member
assert_status 28 "Admin edits any member" \
  PATCH "$PB_URL/api/collections/members/records/$COACH_ID" \
  "$ADMIN_TOKEN" '{}' "200"

# Test 29: Unauthenticated edits member
assert_status 29 "Unauthenticated edits member" \
  PATCH "$PB_URL/api/collections/members/records/$COACH_ID" \
  "" '{}' "401/403/404"

# ── assertAdminAccess: hall_slots ────────────────────────────────────
log_section "Hall Slots Permissions (Admin-Only)"

# Test 30: Coach creates hall_slot
if [[ -n "${COACH_TEAM:-}" ]]; then
  assert_status 30 "Coach creates hall_slot" \
    POST "$PB_URL/api/collections/hall_slots/records" \
    "$COACH_TOKEN" "{\"hall\":\"test\",\"team\":\"$COACH_TEAM\",\"day_of_week\":0}" "400/403"
else
  log_skip 30 "Coach creates hall_slot" "COACH_TEAM not found"
fi

# Test 31: Coach updates hall_slot
if [[ -n "${HALL_SLOT_ID:-}" ]]; then
  assert_status 31 "Coach updates hall_slot" \
    PATCH "$PB_URL/api/collections/hall_slots/records/$HALL_SLOT_ID" \
    "$COACH_TOKEN" '{}' "400/403/404"
else
  log_skip 31 "Coach updates hall_slot" "HALL_SLOT_ID not found"
fi

# Test 32: Coach deletes hall_slot
if [[ -n "${HALL_SLOT_ID:-}" ]]; then
  assert_status 32 "Coach deletes hall_slot" \
    DELETE "$PB_URL/api/collections/hall_slots/records/$HALL_SLOT_ID" \
    "$COACH_TOKEN" '' "400/403/404"
else
  log_skip 32 "Coach deletes hall_slot" "HALL_SLOT_ID not found"
fi

# Test 36: Admin updates hall_slot
if [[ -n "${HALL_SLOT_ID:-}" ]]; then
  assert_status 36 "Admin updates hall_slot" \
    PATCH "$PB_URL/api/collections/hall_slots/records/$HALL_SLOT_ID" \
    "$ADMIN_TOKEN" '{}' "200"
else
  log_skip 36 "Admin updates hall_slot" "HALL_SLOT_ID not found"
fi

# Test 37: Unauthenticated creates hall_slot
assert_status 37 "Unauthenticated creates hall_slot" \
  POST "$PB_URL/api/collections/hall_slots/records" \
  "" '{}' "400/401/403"

# ═══════════════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════════════

echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  RESULTS${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
TOTAL=$((PASS_COUNT + FAIL_COUNT + SKIP_COUNT))
echo -e "  Total:   $TOTAL"
echo -e "  ${GREEN}Passed:  $PASS_COUNT${NC}"
echo -e "  ${RED}Failed:  $FAIL_COUNT${NC}"
echo -e "  ${CYAN}Skipped: $SKIP_COUNT${NC}"
echo ""

if [[ $FAIL_COUNT -gt 0 ]]; then
  echo -e "${RED}SOME TESTS FAILED${NC}"
  exit 1
else
  echo -e "${GREEN}ALL TESTS PASSED${NC}"
  exit 0
fi
