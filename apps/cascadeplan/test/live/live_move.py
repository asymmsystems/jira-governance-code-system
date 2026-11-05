"""Live L2: one-week drag of DEMO-29, bar length before/optimistic/response/reload; then drag back.
Asymm Systems. @author Fahim Farook"""
import json, sys
from playwright.sync_api import sync_playwright
from live_common import open_browser, SITE, OUT, planner_frame
URL = SITE + '/jira/servicedesk/projects/DEMO/apps/cac8499e-e92e-4ba6-95cc-af398b1be791/5dfcdd60-51aa-4ea9-a5e2-c94d7e294677'
KEY = sys.argv[1] if len(sys.argv) > 1 else 'DEMO-29'
DAYS = int(sys.argv[2]) if len(sys.argv) > 2 else 7
TAG = sys.argv[3] if len(sys.argv) > 3 else 'L2'
log = {}

def load(pg):
    pg.goto(URL, wait_until='domcontentloaded', timeout=60000)
    f = planner_frame(pg, 90000)
    f.wait_for_function("document.querySelectorAll('#ganttBody tr.task-row').length > 0", timeout=90000)
    pg.wait_for_timeout(2500)
    return f

def bar(f):
    b = f.locator(f'.bar-hit[data-task-id="{KEY}"]').bounding_box()
    return b

def jira(pg):
    return pg.evaluate(f"fetch('/rest/api/3/issue/{KEY}?fields=duedate&expand=changelog').then(r => r.json()).then(j => ({{due: j.fields.duedate, hist: j.changelog.histories.slice(-3).map(h => ({{at: h.created, by: h.author && h.author.displayName, items: h.items.map(i => i.field + ':' + i.fromString + '->' + i.toString)}}))}}))")

with sync_playwright() as p:
    b, ctx = open_browser(p)
    pg = ctx.new_page()
    f = load(pg)
    log['jira_before'] = jira(pg)
    bx = bar(f)
    log['width_before'] = round(bx['width'], 1)
    week_px = None
    # Day width from the week header: Week zoom, 7 days per column.
    cols = f.evaluate("[...document.querySelectorAll('canvas')].length")
    hdr = f.evaluate("(() => { const c = document.querySelector('td.timeline-track-cell'); return c ? c.getBoundingClientRect().width : null; })()")
    log['track_width'] = hdr
    aria_before = f.locator(f'.bar-hit[data-task-id="{KEY}"]').get_attribute('aria-label')
    log['aria_before'] = aria_before
    pg.screenshot(path=str(OUT / f'{TAG}a-before.png'))
    # px per day from the bar: aria-label has its dates
    import re, datetime
    m = re.findall(r'(\d{4}-\d{2}-\d{2})', aria_before or '')
    days = (datetime.date.fromisoformat(m[1]) - datetime.date.fromisoformat(m[0])).days + 1 if len(m) >= 2 else 5
    dx = bx['width'] / days * DAYS
    x, y = bx['x'] + bx['width'] / 2, bx['y'] + bx['height'] / 2
    pg.mouse.move(x, y); pg.mouse.down()
    for i in range(1, 13):
        pg.mouse.move(x + dx * i / 12, y); pg.wait_for_timeout(30)
    pg.mouse.up()
    pg.wait_for_timeout(300)
    log['width_optimistic'] = round(bar(f)['width'], 1)
    log['aria_optimistic'] = f.locator(f'.bar-hit[data-task-id="{KEY}"]').get_attribute('aria-label')
    pg.screenshot(path=str(OUT / f'{TAG}b-optimistic.png'))
    pg.wait_for_timeout(9000)
    log['width_after_response'] = round(bar(f)['width'], 1)
    log['aria_after_response'] = f.locator(f'.bar-hit[data-task-id="{KEY}"]').get_attribute('aria-label')
    log['flags'] = f.evaluate("[...document.querySelectorAll('.flag')].map(x => x.textContent.trim())")
    pg.screenshot(path=str(OUT / f'{TAG}c-after-response.png'))
    f.click('#btnChanges'); pg.wait_for_timeout(500)
    log['changes'] = f.evaluate("[...document.querySelectorAll('#changesBody tr')].map(r => [...r.children].map(c => c.textContent.trim()).join(' | '))")
    pg.screenshot(path=str(OUT / f'{TAG}d-changes-panel.png'))
    log['jira_after'] = jira(pg)
    f = load(pg)
    log['width_after_reload'] = round(bar(f)['width'], 1)
    log['aria_after_reload'] = f.locator(f'.bar-hit[data-task-id="{KEY}"]').get_attribute('aria-label')
    pg.screenshot(path=str(OUT / f'{TAG}e-after-reload.png'))
    b.close()
print(json.dumps(log, indent=1))
(OUT.parent / f'{TAG}-{KEY}.json').write_text(json.dumps(log, indent=1))
