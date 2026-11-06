#!/bin/bash
R=/home/fahimfarookme/Documents/projects/jira-governance/.tmp/cache/merge-review/ledgerseal-followups-3/repo
cd $R/packages/asymm-jira-ui && npm ci --no-audit --no-fund >/dev/null 2>&1; echo "ui npm ci $?"
cd $R/apps/ledgerseal && npm ci --no-audit --no-fund >/dev/null 2>&1; echo "app npm ci $?"
npx --no-install tsc --noEmit; echo "tsc $?"
npm test -- --coverage 2>&1 | grep -E "^Tests:|^Test Suites:|^All files"; echo "test ${PIPESTATUS[0]}"
npm run build >/dev/null 2>&1; echo "build $?"
npm audit --omit=dev --audit-level=high >/dev/null 2>&1; echo "audit $?"
forge lint 2>&1 | tail -2; echo "lint $?"
cd $R/tools/verifier && node --test 2>&1 | grep -E "^# (pass|fail)"
cd $R && git status --short
