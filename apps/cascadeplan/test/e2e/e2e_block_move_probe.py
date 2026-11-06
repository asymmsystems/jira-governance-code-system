"""N-05 harness check: dragging a parent bar moves its sub-tasks as one block (ADR-003).

DEMO-26 (task) has sub-tasks DEMO-28 and DEMO-31, both not started. Dragging the DEMO-26 bar one
week later must move both sub-tasks by 7 days, write their due dates, write DEMO-26's due date
(the new roll-up end, DEC-6), and list those writes in the Changes panel. One Ctrl+Z restores
both sub-tasks.

Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import datetime
import pathlib
import sys
from playwright.sync_api import sync_playwright
from e2e import serve, wait_rows, shown, bar_dates, jira_writes, drag_bar, CHROME

OUT = pathlib.Path(__file__).resolve().parent / 'results-review'


def plus(iso, days):
    return (datetime.date.fromisoformat(iso) + datetime.timedelta(days=days)).isoformat()


srv = serve()
base = f'http://127.0.0.1:{srv.server_address[1]}/index.html'
out = {}
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, headless=True, args=['--no-sandbox'])
    pg = b.new_context(viewport={'width': 1600, 'height': 900}).new_page()
    pg.goto(base); pg.evaluate('localStorage.clear()'); pg.reload(); wait_rows(pg); pg.wait_for_timeout(500)
    before = {k: shown(pg, 'default', k) for k in ('DEMO-28', 'DEMO-31')}
    parent_before = bar_dates(pg, 'DEMO-26')
    span_days = (datetime.date.fromisoformat(parent_before[1]) - datetime.date.fromisoformat(parent_before[0])).days + 1
    width = pg.locator('.bar-hit[data-task-id="DEMO-26"]').bounding_box()['width']
    w0 = len(jira_writes(pg))
    drag_bar(pg, 'DEMO-26', width / span_days * 7)
    pg.wait_for_timeout(800)
    after = {k: shown(pg, 'default', k) for k in ('DEMO-28', 'DEMO-31')}
    out['moved'] = {k: (before[k]['startDate'], after[k]['startDate']) for k in before}
    out['parent'] = (parent_before, bar_dates(pg, 'DEMO-26'))
    writes = jira_writes(pg)[w0:]
    out['due_writes'] = sorted(w.split(' ')[1].rsplit('/', 1)[-1] for w in writes if w.startswith('PUT') and '"duedate"' in w)
    out['changes'] = pg.evaluate("[...document.querySelectorAll('#changesBody tr')].map(r => r.children[0] && r.children[0].textContent.trim())")
    out['flags'] = pg.evaluate("[...document.querySelectorAll('.flag')].map(f => f.textContent.trim())")
    pg.screenshot(path=str(OUT / 'N05-block-move.png'))
    pg.keyboard.press('Control+z'); pg.wait_for_timeout(2000)
    undone = {k: shown(pg, 'default', k) for k in ('DEMO-28', 'DEMO-31')}
    out['after_undo'] = {k: undone[k]['startDate'] for k in undone}
    b.close()
srv.shutdown()
ok = (all(a == plus(bf, 7) for bf, a in out['moved'].values())
      and out['parent'][1] == (plus(out['parent'][0][0], 7), plus(out['parent'][0][1], 7))
      and out['due_writes'] == ['DEMO-26', 'DEMO-28', 'DEMO-31']
      and all(out['after_undo'][k] == before[k]['startDate'] for k in before))
print(('PASS' if ok else 'FAIL') + f' N-05 a parent drag moves its block, writes the due dates, one undo: {out}')
sys.exit(0 if ok else 1)
