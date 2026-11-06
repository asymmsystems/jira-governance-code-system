#!/bin/sh
# Runs the loop-engine graders for CascadePlan.
# Copyright (c) 2026 Asymm Systems. All rights reserved. @author Fahim Farook
R=/home/fahimfarookme/Documents/projects/jira-governance/repository/code/jira-governance-code-system
PY="python3"
if command -v flatpak-spawn >/dev/null 2>&1; then
  PY="flatpak-spawn --host python3"
fi
for g in grade_tdd grade_security grade_ui; do
  printf '%s: ' $g
  $PY $R/loop-engine/graders/$g.py $R/apps/planshift | python3 -c "import sys,json; d=json.load(sys.stdin); print('PASS' if d['passed'] else 'FAIL', d.get('branch_coverage',''), '; '.join(f[:160] for f in d['failures']))"
done
