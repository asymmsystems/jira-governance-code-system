#!/bin/sh
# Runs tsc and jest for FourRealities in the build worktree on the host.
# Copyright (c) 2026 Asymm Systems. All rights reserved. @author Fahim Farook
W=/home/fahimfarookme/Documents/projects/jira-governance/repository/code/jira-governance-code-system/apps/fourrealities
if command -v flatpak-spawn >/dev/null 2>&1; then
  flatpak-spawn --host bash -c "cd $W && npx tsc --noEmit -p . && echo TSC_OK; npx jest $* 2>&1"
else
  cd "$W" && npx tsc --noEmit -p . && echo TSC_OK && npx jest "$@" 2>&1
fi
