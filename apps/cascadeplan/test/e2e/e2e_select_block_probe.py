"""ADR-003 section 7 harness check: a multi-select move with a parent and one of its sub-tasks moves
each issue once. DEMO-26 (task) and its sub-task DEMO-28 are selected with Ctrl+click and moved by
7 days: DEMO-28 and DEMO-31 must each move 7 days, not 14.

Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import datetime
import sys
from playwright.sync_api import sync_playwright
from e2e import serve, wait_rows, shown, CHROME


def plus(iso, days):
    return (datetime.date.fromisoformat(iso) + datetime.timedelta(days=days)).isoformat()


srv = serve()
base = f'http://127.0.0.1:{srv.server_address[1]}/index.html'
out = {}
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, headless=True, args=['--no-sandbox'])
    pg = b.new_context(viewport={'width': 1600, 'height': 900}).new_page()
    pg.goto(base); pg.evaluate('localStorage.clear()'); pg.reload(); wait_rows(pg); pg.wait_for_timeout(500)
    before = {k: shown(pg, 'default', k)['startDate'] for k in ('DEMO-28', 'DEMO-31')}
    for key in ('DEMO-26', 'DEMO-28'):
        pg.locator(f'#ganttBody tr.task-row[data-task-id="{key}"] td').nth(1).click(modifiers=['Control'])
    pg.wait_for_timeout(300)
    out['selected'] = pg.evaluate("[...document.querySelectorAll('#ganttBody tr.is-selected')].map(r => r.dataset.taskId)")
    pg.fill('#selDays', '7')
    pg.click('#btnSelMove')
    pg.wait_for_timeout(2500)
    after = {k: shown(pg, 'default', k)['startDate'] for k in ('DEMO-28', 'DEMO-31')}
    out['moved'] = {k: (before[k], after[k]) for k in before}
    b.close()
srv.shutdown()
ok = sorted(out['selected']) == ['DEMO-26', 'DEMO-28'] and all(a == plus(bf, 7) for bf, a in out['moved'].values())
print(('PASS' if ok else 'FAIL') + f' ADR-003 multi-select: each issue moves once: {out}')
sys.exit(0 if ok else 1)
