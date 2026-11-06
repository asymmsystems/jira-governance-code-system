#!/bin/sh
# Runs the loop-engine graders for FourRealities in the build worktree on the host.
# Copyright (c) 2026 Asymm Systems. All rights reserved. @author Fahim Farook
R=/home/fahimfarookme/Documents/projects/jira-governance/repository/code/jira-governance-code-system
for g in grade_tdd grade_security grade_ui; do
  printf '%s: ' $g
  if command -v flatpak-spawn >/dev/null 2>&1; then
    flatpak-spawn --host python3 $R/loop-engine/graders/$g.py $R/apps/fourrealities | python3 -c "import sys,json; d=json.load(sys.stdin); print('PASS' if d['passed'] else 'FAIL', d.get('branch_coverage',''), '; '.join(f[:160] for f in d['failures']))"
  else
    python3 $R/loop-engine/graders/$g.py $R/apps/fourrealities | python3 -c "import sys,json; d=json.load(sys.stdin); print('PASS' if d['passed'] else 'FAIL', d.get('branch_coverage',''), '; '.join(f[:160] for f in d['failures']))"
  fi
done
