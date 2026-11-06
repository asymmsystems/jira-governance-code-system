"""C7 harness check: a create whose answer is lost, made again with the same values, creates one Jira issue.

The resolver of "Create sub-task in Jira" runs and Jira creates the sub-task, but the answer never
reaches the planner (the harness switch __harness_lose_answer). The planner says the result is unknown
and that the same request is safe. The user clicks the same button again with the same summary: the
server finds the sub-task by its create id, and Jira gets no second create.

Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import json
import sys
from playwright.sync_api import sync_playwright
from e2e import serve, wait_rows, jira_writes, CHROME

srv = serve()
base = f'http://127.0.0.1:{srv.server_address[1]}/index.html'
out = {}
flags = "[...document.querySelectorAll('.flag')].map(f => f.textContent.trim())"
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, headless=True, args=['--no-sandbox'])
    pg = b.new_context(viewport={'width': 1600, 'height': 900}).new_page()
    pg.goto(base); pg.evaluate('localStorage.clear()'); pg.reload(); wait_rows(pg); pg.wait_for_timeout(500)
    w0 = len(jira_writes(pg))
    row = pg.locator('#ganttBody tr.task-row[data-task-id="DEMO-26"]')
    row.hover()
    row.locator('.row-more-actions-btn').first.click(force=True)
    pg.locator('.quick-menu-item[data-action="edit"]').first.click()
    pg.wait_for_timeout(500)

    pg.evaluate("localStorage.setItem('__harness_lose_answer', 'addSubtaskToTask')")
    pg.fill('#newSubtaskSummary', 'Check the refund rules')
    pg.fill('#newSubtaskHours', '')
    pg.click('#btnAddSubtaskBtn')
    pg.wait_for_timeout(1500)
    out['unknown_message'] = pg.evaluate("document.body.innerText.includes('will not create the work item twice')")
    out['creates_after_first'] = len([w for w in jira_writes(pg)[w0:] if w.startswith('POST /rest/api/3/issue ')])

    # The same request again: the dialog may have kept or cleared the field, so it is filled again.
    if not pg.is_visible('#newSubtaskSummary'):
        row.hover()
        row.locator('.row-more-actions-btn').first.click(force=True)
        pg.locator('.quick-menu-item[data-action="edit"]').first.click()
        pg.wait_for_timeout(500)
    pg.fill('#newSubtaskSummary', 'Check the refund rules')
    pg.fill('#newSubtaskHours', '')
    pg.click('#btnAddSubtaskBtn')
    pg.wait_for_timeout(1500)
    creates = [w for w in jira_writes(pg)[w0:] if w.startswith('POST /rest/api/3/issue ')]
    out['creates_total'] = len(creates)
    out['create_has_id'] = bool(creates) and any(p.get('key') == 'cascadeplan.create' for p in json.loads(creates[0].split(' ', 2)[2]).get('properties', []))
    out['flags'] = pg.evaluate(flags)[-2:]
    b.close()
srv.shutdown()
ok = (out['unknown_message'] and out['creates_after_first'] == 1 and out['creates_total'] == 1 and out['create_has_id'])
print(('PASS' if ok else 'FAIL') + ' C7 a create made again after a lost answer creates one issue: ' + json.dumps(out))
sys.exit(0 if ok else 1)
