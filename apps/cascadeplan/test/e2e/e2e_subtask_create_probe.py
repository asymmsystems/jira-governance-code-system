"""F-23 / BL-3 harness check: "Create sub-task in Jira" with an empty estimate creates a real Jira
sub-task under the parent with no estimate, and stores nothing in the plan.

Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import json
import sys
from playwright.sync_api import sync_playwright
from e2e import serve, wait_rows, kvs, record, jira_writes, CHROME

srv = serve()
base = f'http://127.0.0.1:{srv.server_address[1]}/index.html'
out = {}
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, headless=True, args=['--no-sandbox'])
    pg = b.new_context(viewport={'width': 1600, 'height': 900}).new_page()
    pg.goto(base); pg.evaluate('localStorage.clear()'); pg.reload(); wait_rows(pg); pg.wait_for_timeout(500)
    before = record(kvs(pg), 'default', 'DEMO-26')
    w0 = len(jira_writes(pg))
    row = pg.locator('#ganttBody tr.task-row[data-task-id="DEMO-26"]')
    row.hover()
    row.locator('.row-more-actions-btn').first.click(force=True)
    pg.locator('.quick-menu-item[data-action="edit"]').first.click()
    pg.wait_for_timeout(500)
    pg.fill('#newSubtaskSummary', 'Write the migration note')
    pg.fill('#newSubtaskHours', '')
    pg.click('#btnAddSubtaskBtn')
    pg.wait_for_timeout(1500)
    creates = [w for w in jira_writes(pg)[w0:] if w.startswith('POST /rest/api/3/issue ')]
    out['creates'] = [json.loads(w.split(' ', 2)[2])['fields'] for w in creates]
    after = record(kvs(pg), 'default', 'DEMO-26')
    out['record_unchanged'] = (before or {}).get('version') == (after or {}).get('version')
    out['flags'] = pg.evaluate("[...document.querySelectorAll('.flag')].map(f => f.textContent.trim())")
    b.close()
srv.shutdown()
ok = (len(out['creates']) == 1 and out['creates'][0].get('parent') == {'key': 'DEMO-26'}
      and out['creates'][0].get('summary') == 'Write the migration note' and 'timetracking' not in out['creates'][0]
      and out['record_unchanged'])
print(('PASS' if ok else 'FAIL') + ' F-23 a sub-task with an empty estimate is a Jira sub-task with no estimate: ' + json.dumps(out))
sys.exit(0 if ok else 1)
