"""N-07 harness check: sub-task rows show their epic as read-only text, with no epic picker.

Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import sys
from playwright.sync_api import sync_playwright
from e2e import serve, wait_rows, CHROME

srv = serve()
base = f'http://127.0.0.1:{srv.server_address[1]}/index.html'
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, headless=True, args=['--no-sandbox'])
    pg = b.new_context(viewport={'width': 1600, 'height': 900}).new_page()
    pg.goto(base); pg.evaluate('localStorage.clear()'); pg.reload(); wait_rows(pg)
    rows = pg.evaluate("""[...document.querySelectorAll('#ganttBody tr.task-row')].map(r => ({
      key: r.dataset.taskId || r.getAttribute('data-task-id') || (r.querySelector('[data-task-id]') || {}).dataset?.taskId,
      picker: !!r.querySelector('.epic-link-chip'), inherited: !!r.querySelector('.epic-inherited') }))""")
    b.close()
srv.shutdown()
subtasks = [r for r in rows if r['key'] in ('DEMO-30', 'DEMO-29', 'DEMO-28', 'DEMO-31')]
standard = [r for r in rows if r['key'] in ('DEMO-9', 'DEMO-26', 'DEMO-40')]
ok = bool(subtasks) and all(not r['picker'] for r in subtasks) and all(r['picker'] for r in standard)
print(('PASS' if ok else 'FAIL') + f" N-07 sub-task rows have no epic picker: subtasks {subtasks} standard {standard}")
sys.exit(0 if ok else 1)
