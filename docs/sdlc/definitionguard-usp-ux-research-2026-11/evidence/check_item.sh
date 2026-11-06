#!/bin/sh
# Copyright (c) 2026 Asymm Systems. All rights reserved.
# @author Fahim Farook
#
# Section 11.2 checks for one backlog item. Run on the host:
#   flatpak-spawn --host sh docs/sdlc/definitionguard-usp-ux-research-2026-11/evidence/check_item.sh <base-ref>
# <base-ref>: the commit before this item (changed files = diff against it, plus uncommitted).
W=/home/fahimfarookme/Documents/projects/jira-governance/repository/code/jira-governance-code-system
A=$W/apps/definitionguard
BASE=${1:-HEAD}
cd "$A" || exit 2
echo "== tsc"; timeout 300 npx tsc --noEmit; echo "tsc exit $?"
echo "== jest"; timeout 400 npx jest --coverage 2>&1 | grep -E "Tests:|Test Suites:|✕|threshold|All files" ; echo "jest done"
echo "== per-file branch (changed src files)"
CHANGED=$( (git -C "$W" diff --name-only "$BASE" -- apps/definitionguard/src; git -C "$W" ls-files --others --exclude-standard apps/definitionguard/src) | sort -u | grep -E '\.tsx?$' | grep -v '/frontend/')
python3 -I - "$A/coverage/coverage-summary.json" $CHANGED <<'EOF'
import json, sys, os
summ = json.load(open(sys.argv[1]))
bad = 0
for rel in sys.argv[2:]:
    p = os.path.join('/home/fahimfarookme/Documents/projects/jira-governance/repository/code/jira-governance-code-system', rel)
    e = summ.get(p)
    if not e:
        print(f"  {rel}: not in coverage (no executable code or excluded)"); continue
    b = e['branches']['pct']; flag = 'OK' if b >= 90 else 'BELOW 90'
    if b < 90: bad += 1
    print(f"  {rel}: branches {b}% {flag}")
print("per-file result:", "PASS" if bad == 0 else f"FAIL ({bad})")
EOF
echo "== graders"
cd "$W"
for g in grade_tdd grade_security grade_ui; do python3 loop-engine/graders/$g.py apps/definitionguard | python3 -c "import json,sys; d=json.load(sys.stdin); print('  $g', d['passed'], d.get('failures'))"; done
echo "== em dash in changed files"
(git diff --name-only "$BASE"; git ls-files --others --exclude-standard) | sort -u | while read f; do [ -f "$f" ] && c=$(grep -cP '\x{2014}' "$f") && [ "$c" != "0" ] && echo "  EM DASH: $f $c"; done; echo "  em dash scan done"
