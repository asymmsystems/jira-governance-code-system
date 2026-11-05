"""MK-09 harness check: the planner needs no inline styles.

Build the page with CP_STRICT_CSP=1 python3 build_site.py (style-src 'self', no 'unsafe-inline').
The script opens the main views, popovers and dialogs, and fails when the browser refused any style.
With a folder argument it also saves a screenshot of each state there, so a run on the old build
(normal mode) and a run on the new build (strict mode) can be compared pixel by pixel.

Usage: python3 e2e_csp_probe.py [screenshot-folder]

Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import json
import pathlib
import sys
from playwright.sync_api import sync_playwright
from e2e import serve, wait_rows, CHROME

shots = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else None
if shots:
    shots.mkdir(parents=True, exist_ok=True)
srv = serve()
base = f'http://127.0.0.1:{srv.server_address[1]}/index.html'
LINKS = [{'id': '7001', 'pred': 'DEMO-26', 'succ': 'DEMO-40'}, {'id': '7002', 'pred': 'DEMO-29', 'succ': 'DEMO-40'}]
states = []


def snap(pg, name):
    states.append(name)
    pg.mouse.move(2, 890)
    pg.wait_for_timeout(500)
    if shots:
        pg.screenshot(path=str(shots / f'{len(states):02d}-{name}.png'))


def close_all(pg):
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    pg.mouse.click(1590, 890); pg.wait_for_timeout(300)


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, headless=True, args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 1600, 'height': 900})
    # A fixed clock, so both runs draw the same today line.
    ctx.add_init_script("""(() => { const T = Date.parse('2026-11-05T10:00:00Z'); const D = Date;
      class FD extends D { constructor(...a) { if (a.length === 0) { super(T); } else { super(...a); } } static now() { return T; } }
      window.Date = FD; })();""")
    pg = ctx.new_page()
    pg.goto(base); pg.evaluate('localStorage.clear()')
    pg.evaluate(f"localStorage.setItem('__harness_jira_links', JSON.stringify({json.dumps(LINKS)}))")
    pg.reload(); wait_rows(pg); pg.wait_for_timeout(1000)
    snap(pg, 'timeline')

    pg.click('#planSelectorBtn'); pg.wait_for_timeout(400); snap(pg, 'plans'); pg.click('#btnClosePlansPopover')
    pg.click('#btnManageColumns'); pg.wait_for_timeout(400); snap(pg, 'columns'); pg.click('#btnCloseColPopover')
    pg.locator('.th-col-menu-btn').first.click(); pg.wait_for_timeout(400); snap(pg, 'column-menu'); close_all(pg)

    pg.click('#toggleBacklogBtn'); pg.wait_for_timeout(500); snap(pg, 'backlog'); pg.click('#closeTrayBtn'); pg.wait_for_timeout(300)

    row = pg.locator('#ganttBody tr.task-row[data-task-id="DEMO-26"]')
    row.hover(); row.locator('.row-more-actions-btn').first.click(force=True); pg.wait_for_timeout(300)
    snap(pg, 'row-menu')
    pg.locator('.quick-menu-item[data-action="edit"]').first.click(); pg.wait_for_timeout(600)
    snap(pg, 'task-dialog')
    pg.locator('#taskDetailModal .modal-body').evaluate('e => e.scrollTop = e.scrollHeight'); pg.wait_for_timeout(300)
    snap(pg, 'task-dialog-bottom')
    pg.click('#btnCancelTaskDetail'); pg.wait_for_timeout(300)

    pg.click('#newTaskBtn'); pg.wait_for_timeout(400); snap(pg, 'create-task'); pg.click('#btnCancelCreateTask')
    pg.click('#newEpicBtn'); pg.wait_for_timeout(400); snap(pg, 'create-epic'); pg.click('#btnCancelCreateEpic')

    badge = pg.locator('#depLinksLayer .dep-link-badge').first
    if badge.count():
        badge.click(); pg.wait_for_timeout(500); snap(pg, 'link-editor'); pg.click('#btnCancelDepEdit')

    hit = pg.locator('.bar-hit[data-task-id="DEMO-31"]')
    box = hit.bounding_box()
    pg.mouse.click(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2, button='right'); pg.wait_for_timeout(500)
    snap(pg, 'progress-picker'); pg.click('#btnCancelProgressPicker')
    pg.mouse.move(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2); pg.wait_for_timeout(700)
    states.append('bar-hover')
    if shots:
        pg.screenshot(path=str(shots / f'{len(states):02d}-bar-hover.png'))

    chip = pg.locator('.td-target-cell').first
    if chip.count():
        chip.click(); pg.wait_for_timeout(400); snap(pg, 'target-picker'); close_all(pg)
    res = pg.locator('.resource-chip-btn').first
    if res.count():
        res.click(); pg.wait_for_timeout(400); snap(pg, 'resource-picker'); close_all(pg)

    pg.select_option('#viewSwitcher', 'table'); pg.wait_for_timeout(600); snap(pg, 'table-view')
    pg.select_option('#viewSwitcher', 'utilization'); pg.wait_for_timeout(600); snap(pg, 'utilization')
    pg.select_option('#viewSwitcher', 'timeline'); pg.wait_for_timeout(600)

    violations = pg.evaluate('window.__cspViolations || null')
    b.close()
srv.shutdown()

strict = violations is not None
ok = strict and len(violations) == 0
print(('PASS' if ok else ('FAIL' if strict else 'INFO')) + f' MK-09 no inline styles under style-src self: states={len(states)} '
      + f'strict={strict} violations={len(violations or [])} ' + json.dumps(sorted(set(v[:160] for v in (violations or [])))[:12]))
sys.exit(0 if ok or not strict else 1)
