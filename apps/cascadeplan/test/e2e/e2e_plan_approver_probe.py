"""BL-2 step 8 harness check: a user who is not a plan approver sees no clone, rename or delete
buttons and a disabled create form, and can still switch plans. An approver sees the buttons.

Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import sys
from playwright.sync_api import sync_playwright
from e2e import serve, wait_rows, CHROME

srv = serve()
base = f'http://127.0.0.1:{srv.server_address[1]}/index.html'
results = {}
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, headless=True, args=['--no-sandbox'])
    pg = b.new_context(viewport={'width': 1600, 'height': 900}).new_page()
    for who, flag in (('approver', '0'), ('non-approver', '1')):
        pg.goto(base); pg.evaluate('localStorage.clear()')
        pg.evaluate(f"localStorage.setItem('__harness_not_approver', '{flag}')")
        pg.reload(); wait_rows(pg); pg.wait_for_timeout(500)
        pg.click('#planSelectorBtn'); pg.wait_for_timeout(300)
        results[who] = pg.evaluate("""({
          actionButtons: document.querySelectorAll('#plansListContainer .plan-item-actions button').length,
          createDisabled: document.getElementById('btnCreatePlan').disabled,
          rows: document.querySelectorAll('#plansListContainer .plan-item-row').length })""")
    b.close()
srv.shutdown()
ok = (results['approver']['actionButtons'] > 0 and not results['approver']['createDisabled']
      and results['non-approver']['actionButtons'] == 0 and results['non-approver']['createDisabled']
      and results['non-approver']['rows'] > 0)
print(('PASS' if ok else 'FAIL') + f' BL-2 step 8 plan management only for approvers: {results}')
sys.exit(0 if ok else 1)
