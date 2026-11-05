"""Marketplace screenshots of CascadePlan (BL-7 step 4), from the "Payments Platform" (PAY) project.

Each screenshot shows only the planner (the app's own frame), at 1840 x 900 px: 1472 x 720 CSS px
captured at a device pixel ratio of 1.25. Compact columns give the
timeline most of the width. Usage: python3 marketplace_shots.py [state ...]; the states are listed
in STATES. Output: docs/marketplace/assets/cascadeplan/<NN>-<state>.png.

Writes in PAY only, where a state says so (the baseline state freezes a baseline).
Needs CASCADEPLAN_LIVE_COOKIES (see live_common.py).

Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import pathlib
import sys

from PIL import Image
from playwright.sync_api import sync_playwright

from live_common import cookies, SITE, CHROME, planner_frame

URL = SITE + '/jira/software/projects/PAY/apps/cac8499e-e92e-4ba6-95cc-af398b1be791/5dfcdd60-51aa-4ea9-a5e2-c94d7e294677'
ASSETS = pathlib.Path(__file__).resolve().parents[4] / 'docs' / 'marketplace' / 'assets' / 'cascadeplan'
W, H, DPR = 1472, 720, 1.25
TASK_COL_PX = 330  # wide enough for the summaries in Compact view
START_WEEK = '12-Oct'


def open_planner(p):
    b = p.chromium.launch(executable_path=CHROME, headless=True, args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 1560, 'height': 1100}, device_scale_factor=DPR, bypass_csp=True)
    ctx.add_cookies(cookies())
    pg = ctx.new_page()
    pg.goto(URL, wait_until='domcontentloaded', timeout=150000)
    f = planner_frame(pg, 150000)
    f.wait_for_function("document.querySelectorAll('#ganttBody tr.task-row').length > 0", timeout=90000)
    pg.wait_for_timeout(3000)
    # Compact view is a saved plan setting: turn it on only when other columns still show.
    if f.evaluate("document.querySelectorAll('#ganttHeaderRow th[data-col-key]').length") > 1 or f.locator('#ganttHeaderRow th', has_text='Resource').count():
        f.click('#btnCompactColumns')
        pg.wait_for_timeout(2500)
    widen_task_column(pg, f)
    show_from(pg, f, START_WEEK)
    return b, pg, f


def widen_task_column(pg, f):
    """Drags the Task column's own resizer, once, until the column is TASK_COL_PX wide."""
    th = f.locator('#ganttHeaderRow th', has_text='Task').first
    width = th.bounding_box()['width']
    if abs(width - TASK_COL_PX) < 8:
        return
    r = th.locator('.col-resizer').first.bounding_box()
    x, y = r['x'] + r['width'] / 2, r['y'] + r['height'] / 2
    pg.mouse.move(x, y)
    pg.mouse.down()
    for k in range(1, 11):
        pg.mouse.move(x + (TASK_COL_PX - width) * k / 10, y)
        pg.wait_for_timeout(30)
    pg.mouse.up()
    pg.wait_for_timeout(2500)


def show_from(pg, f, label):
    """Scrolls the timeline so the week with this header label is the first one shown."""
    f.evaluate("""(label) => {
      const cell = [...document.querySelectorAll('.time-cell')].find(c => c.textContent.trim() === label);
      const w = document.getElementById('ganttWrapper');
      if (cell && w) { w.scrollLeft = parseFloat(cell.style.left) || cell.offsetLeft; w.dispatchEvent(new Event('scroll')); }
    }""", label)
    pg.wait_for_timeout(1200)


def frame_box(f):
    return f.frame_element().bounding_box()


def shoot(pg, f, name, top_offset=0):
    box = frame_box(f)
    path = ASSETS / f'{name}.png'
    pg.screenshot(path=str(path), clip={'x': box['x'], 'y': box['y'] + top_offset, 'width': W, 'height': H})
    im = Image.open(path)
    if im.size != (1840, 900):
        im.resize((1840, 900), Image.LANCZOS).save(path)
    print('wrote', path.name, Image.open(path).size)


def calm(pg, f=None):
    pg.mouse.move(5, 5)
    if f is not None:
        f.evaluate("document.activeElement && document.activeElement.blur && document.activeElement.blur()")
    pg.wait_for_timeout(600)


def bar_box(f, key):
    return f.locator(f'.bar-hit[data-task-id="{key}"]').first.bounding_box()


def scroll_weeks(f, pg, earlier):
    for _ in range(earlier):
        f.click('#btnScrollEarlier')
        pg.wait_for_timeout(400)


STATES = {}


def state(fn):
    STATES[fn.__name__] = fn
    return fn


@state
def timeline(pg, f):
    calm(pg, f)
    shoot(pg, f, '01-timeline')


@state
def why(pg, f):
    """'Why this date?' for PAY-12: it waits for PAY-11 to reach 30%."""
    row = f.locator('#ganttBody tr.task-row[data-task-id="PAY-12"]').first
    row.hover()
    pg.wait_for_timeout(400)
    row.locator('.why-date-btn').first.click(force=True)
    f.wait_for_selector('#whyPopup:not([hidden])', timeout=20000)
    pg.mouse.move(5, 5)
    pg.wait_for_timeout(800)
    shoot(pg, f, '02-why-this-date')


@state
def move_preview(pg, f):
    """Holds a one-week drag of PAY-7 (a story with sub-tasks) to show the preview of every Jira change,
    then returns the pointer to where it started before releasing, so nothing is saved."""
    calm(pg, f)
    bx = bar_box(f, 'PAY-7')
    day = f.evaluate("(() => { const c = [...document.querySelectorAll('.time-cell')].slice(0, 2).map(e => parseFloat(e.style.left)); return (c[1] - c[0]) / 7; })()")
    x, y = bx['x'] + bx['width'] * 0.35, bx['y'] + bx['height'] / 2
    pg.mouse.move(x, y)
    pg.mouse.down()
    for k in range(1, 13):
        pg.mouse.move(x + day * 7 * k / 12, y)
        pg.wait_for_timeout(40)
    pg.wait_for_timeout(900)
    shoot(pg, f, '03-move-preview')
    for k in range(11, -1, -1):
        pg.mouse.move(x + day * 7 * k / 12, y)
        pg.wait_for_timeout(30)
    pg.mouse.up()
    pg.wait_for_timeout(2000)


@state
def baseline(pg, f):
    """Freezes 'Sprint 23 commitment' (once), changes the scope in Jira, and shows the baseline panel.
    Writes in PAY: the baseline, a new task PAY-18 and the estimate of PAY-13 (40 h to 48 h)."""
    status = f.inner_text('#btnBaseline')
    if 'none' in status:
        f.click('#btnBaseline')
        f.wait_for_selector('input[aria-label="Baseline name"]', timeout=20000)
        f.fill('input[aria-label="Baseline name"]', 'Sprint 23 commitment')
        f.locator('button', has_text='Freeze the plan as a baseline').first.click()
        pg.wait_for_timeout(8000)
        pg.evaluate("""async () => {
          const h = { 'Content-Type': 'application/json' };
          const me = (await (await fetch('/rest/api/3/myself')).json()).accountId;
          await fetch('/rest/api/3/issue/PAY-13', { method: 'PUT', headers: h, body: JSON.stringify({ fields: { timetracking: { originalEstimate: '48h' } } }) });
          const r = await fetch('/rest/api/3/issue', { method: 'POST', headers: h, body: JSON.stringify({ fields: { project: { key: 'PAY' },
            summary: 'Chargeback notifications', issuetype: { name: 'Task' }, parent: { key: 'PAY-2' }, duedate: '2026-12-11',
            assignee: { accountId: me }, timetracking: { originalEstimate: '16h' } } }) });
          const key = (await r.json()).key;
          await fetch('/rest/api/3/issue/' + key + '/properties/cascadeplan.dates', { method: 'PUT', headers: h, body: JSON.stringify({ startDate: '2026-11-30', endDate: '2026-12-11', v: 1 }) });
        }""")
        pg.reload(wait_until='domcontentloaded')
        f = planner_frame(pg, 150000)
        f.wait_for_function("document.querySelectorAll('#ganttBody tr.task-row').length > 0", timeout=90000)
        pg.wait_for_timeout(4000)
        show_from(pg, f, START_WEEK)
    f.click('#btnBaseline')
    f.wait_for_selector('#baselinePanel:not([hidden])', timeout=20000)
    pg.wait_for_timeout(5000)
    pg.mouse.move(5, 5)
    shoot(pg, f, '04-baseline')


@state
def link_editor(pg, f):
    """The editor of the PAY-11 to PAY-12 link (its 30% label clicked), then cancelled."""
    calm(pg, f)
    badge = f.locator('#depLinksLayer .dep-link-badge[data-pred="PAY-11"][data-succ="PAY-12"]').first
    badge.click()
    f.wait_for_selector('#depEditPopover:not([hidden])', timeout=20000)
    pg.mouse.move(5, 5)
    pg.wait_for_timeout(800)
    # The editor opens under the link; the crop moves down just enough to show all of it.
    pop = f.locator('#depEditPopover').bounding_box()
    offset = max(0, pop['y'] + pop['height'] + 12 - frame_box(f)['y'] - H)
    shoot(pg, f, '05-link-editor', top_offset=offset)
    f.click('#btnCancelDepEdit')


if __name__ == '__main__':
    wanted = sys.argv[1:] or list(STATES)
    with sync_playwright() as p:
        for name in wanted:
            b, pg, f = open_planner(p)
            STATES[name](pg, f)
            b.close()
