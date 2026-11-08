"""CP-2 harness check: a change made in the link editor offers Undo, and Ctrl+Z restores the link.

In the page, with one Jira "Blocks" link DEMO-26 -> DEMO-40 (finish to start): the link label is
clicked, the percent set to 50 and saved. The message offers Undo, and Ctrl+Z sets the percent back
to 100. Then Remove Link deletes the Jira link; the message offers Undo, and Ctrl+Z creates the link
again at 100%.

Usage, from apps/cascadeplan/test/e2e, after python3 build_site.py:  python3 e2e_link_undo_probe.py

Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import json
import sys
from playwright.sync_api import sync_playwright
from e2e import serve, wait_rows, CHROME

srv = serve()
base = f'http://127.0.0.1:{srv.server_address[1]}/index.html'
START = [{'id': '7001', 'pred': 'DEMO-26', 'succ': 'DEMO-40'}]
LINKS = "JSON.parse(localStorage.getItem('__harness_jira_links') || '[]').map(l => [l.pred, l.succ])"
PERCENTS = "(JSON.parse(localStorage.getItem('__harness_jira_props') || '{}')['DEMO-40'] || {})['cascadeplan.links']"
FLAGS = "[...document.querySelectorAll('.flag')].map(f => f.textContent.trim())"
BADGE = '#depLinksLayer .dep-link-badge[data-succ="DEMO-40"][data-pred="DEMO-26"]'
out = {}


def open_editor(pg):
    pg.reload(); wait_rows(pg); pg.wait_for_timeout(800)
    pg.locator(BADGE).first.click(); pg.wait_for_timeout(400)


def undo(pg):
    pg.mouse.click(800, 20)
    pg.keyboard.press('Control+z'); pg.wait_for_timeout(2000)


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, headless=True, args=['--no-sandbox'])
    pg = b.new_context(viewport={'width': 1600, 'height': 900}).new_page()
    pg.goto(base); pg.evaluate('localStorage.clear()')
    pg.evaluate(f"localStorage.setItem('__harness_jira_links', JSON.stringify({json.dumps(START)}))")
    open_editor(pg)
    pg.fill('#depEditTrigger', '50'); pg.click('#btnSaveDepEdit'); pg.wait_for_timeout(2000)
    out['saved'] = pg.evaluate(PERCENTS)
    out['save_flags'] = pg.evaluate(FLAGS)
    undo(pg)
    out['after_undo'] = pg.evaluate(PERCENTS)
    open_editor(pg)
    pg.click('#btnRemoveDepLink'); pg.wait_for_timeout(2000)
    out['removed'] = pg.evaluate(LINKS)
    out['remove_flags'] = pg.evaluate(FLAGS)
    undo(pg)
    out['links_after_undo'] = pg.evaluate(LINKS)
    out['percents_after_undo'] = pg.evaluate(PERCENTS)
    b.close()
srv.shutdown()

ok = (out['saved'] == {'v': 1, 'links': {'26': 50}}
      and any(f.startswith('Linked DEMO-40 to DEMO-26 at 50%') and 'Undo' in f for f in out['save_flags'])
      and out['after_undo'] == {'v': 1, 'links': {'26': 100}}
      and out['removed'] == []
      and any(f.startswith('Removed the link from DEMO-26 to DEMO-40') and 'Undo' in f for f in out['remove_flags'])
      and out['links_after_undo'] == [['DEMO-26', 'DEMO-40']]
      and out['percents_after_undo'] == {'v': 1, 'links': {'26': 100}})
print(('PASS' if ok else 'FAIL') + ' CP-2 link editor changes offer Undo: ' + json.dumps(out))
sys.exit(0 if ok else 1)
