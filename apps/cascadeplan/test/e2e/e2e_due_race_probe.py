"""C3 harness check: a due date changed in Jira while the planner is open stops a move of that bar.

DEMO-40's due date is changed in the fake Jira behind the planner's back. A drag of DEMO-40 is then
refused with "changed in Jira a moment ago", and nothing is written to Jira.

Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import json
import sys
from playwright.sync_api import sync_playwright
from e2e import serve, wait_rows, drag_bar, jira_writes, CHROME

srv = serve()
base = f'http://127.0.0.1:{srv.server_address[1]}/index.html'
out = {}
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, headless=True, args=['--no-sandbox'])
    pg = b.new_context(viewport={'width': 1600, 'height': 900}).new_page()
    pg.goto(base); pg.evaluate('localStorage.clear()'); pg.reload(); wait_rows(pg); pg.wait_for_timeout(500)
    pg.evaluate("""(() => { const d = JSON.parse(localStorage.getItem('__harness_jira_due') || '{}');
      d['DEMO-40'] = '2026-12-31'; localStorage.setItem('__harness_jira_due', JSON.stringify(d)); })()""")
    n = len(jira_writes(pg))
    w = pg.locator('.bar-hit[data-task-id="DEMO-40"]').bounding_box()['width']
    drag_bar(pg, 'DEMO-40', w / 5 * 7)
    pg.wait_for_timeout(800)
    out['writes'] = jira_writes(pg)[n:]
    out['flags'] = pg.evaluate("[...document.querySelectorAll('.flag, [role=alert]')].map(f => f.textContent.trim())")
    b.close()
srv.shutdown()
ok = out['writes'] == [] and any('changed in Jira a moment ago (now 2026-12-31)' in f for f in out['flags'])
print(('PASS' if ok else 'FAIL') + ' C3 a due date changed in Jira stops the move: ' + json.dumps(out)[:400])
sys.exit(0 if ok else 1)
