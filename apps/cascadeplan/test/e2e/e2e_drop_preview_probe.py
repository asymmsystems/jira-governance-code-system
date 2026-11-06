# Copyright (c) 2026 Asymm Systems. All rights reserved.
#
# @author Fahim Farook
"""Merge review H2 harness check: the drop preview line lists every Jira due date the drop writes.

For each drag the probe holds the bar, reads the preview line (#writePreview), releases, and compares
the "<key> due <date>" entries of the line with the due dates the fake Jira received:
  1. DEMO-28, a sub-task of DEMO-26, three weeks later: the parent's roll-up grows, so the parent's
     successors cascade and DEMO-26's due date follows (DEC-6).
  2. DEMO-26, a parent, one week later: its sub-tasks move as a block, with the cascade outside it.
Each drag is undone after the check.
"""
import json
import pathlib
import re
import sys
from playwright.sync_api import sync_playwright
from e2e import serve, wait_rows, bar_dates, jira_writes, CHROME

OUT = pathlib.Path(__file__).resolve().parent / 'results-review'


def hold_drag(pg, key, dx):
    box = pg.locator(f'.bar-hit[data-task-id="{key}"]').bounding_box()
    x, y = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
    pg.mouse.move(x, y)
    pg.mouse.down()
    for i in range(1, 11):
        pg.mouse.move(x + dx * i / 10, y)
    pg.wait_for_timeout(300)
    text = pg.evaluate("(document.getElementById('writePreview') || {}).textContent || ''")
    pg.mouse.up()
    pg.wait_for_timeout(1500)
    return text


def listed(text):
    return sorted(re.findall(r'([A-Z]+-\d+) due (\d{4}-\d{2}-\d{2})', text))


def written(writes):
    out = []
    for w in writes:
        m = re.match(r'PUT \S*/issue/([A-Z]+-\d+) (.*)$', w)
        if m and '"duedate"' in m.group(2):
            out.append((m.group(1), re.search(r'"duedate":"([0-9-]+)"', m.group(2)).group(1)))
    return sorted(set(out))


def day_width(pg, key):
    s, e = bar_dates(pg, key)
    from datetime import date
    days = (date.fromisoformat(e) - date.fromisoformat(s)).days + 1
    return pg.locator(f'.bar-hit[data-task-id="{key}"]').bounding_box()['width'] / days


srv = serve()
base = f'http://127.0.0.1:{srv.server_address[1]}/index.html'
results = {}
ok = True
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, headless=True, args=['--no-sandbox'])
    pg = b.new_context(viewport={'width': 1600, 'height': 900}).new_page()
    pg.goto(base); pg.evaluate('localStorage.clear()'); pg.reload(); wait_rows(pg); pg.wait_for_timeout(500)
    for name, key, weeks in (('sub-task', 'DEMO-28', 3), ('block', 'DEMO-26', 1)):
        px = day_width(pg, key) * 7 * weeks
        w0 = len(jira_writes(pg))
        text = hold_drag(pg, key, px)
        got = written(jira_writes(pg)[w0:])
        want = listed(text)
        same = bool(got) and got == want
        ok = ok and same
        results[name] = {'preview': text, 'listed': want, 'written': got, 'same': same}
        pg.screenshot(path=str(OUT / f'H2-drop-preview-{name}.png'))
        pg.keyboard.press('Control+z'); pg.wait_for_timeout(2000)
    b.close()
srv.shutdown()
print(('PASS' if ok else 'FAIL') + ' H2 the drop preview lists exactly the due dates the drop writes: ' + json.dumps(results))
sys.exit(0 if ok else 1)
