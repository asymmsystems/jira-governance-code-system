"""Live N-02 check on the development site, project DEMO: clone the Main Plan from the plan list,
check that the clone opens with no unfinished state, then delete the clone. Records the duration of
every plan resolver call (real KVS), and the plan list before and after.

Writes only the plan data of project DEMO: one new plan, deleted at the end. Needs
CASCADEPLAN_LIVE_COOKIES (see live_common.py).

Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import json
import time

from playwright.sync_api import sync_playwright

from live_common import open_browser, SITE, OUT, planner_frame

URL = SITE + '/jira/servicedesk/projects/DEMO/apps/cac8499e-e92e-4ba6-95cc-af398b1be791/5dfcdd60-51aa-4ea9-a5e2-c94d7e294677'
NAMES = ('createProjectPlan', 'continuePlanCopy', 'deleteProjectPlan', 'continuePlanDelete')
log = {'calls': []}


def on_finished(req):
    if 'graphql' not in req.url:
        return
    try:
        body = (req.post_data_buffer or b'').decode('utf-8', 'replace')
    except Exception:
        return
    name = next((n for n in NAMES if n in body), None)
    if name:
        t = req.timing
        log['calls'].append({'fn': name, 'ms': round(t['responseEnd'] - t['requestStart']) if t.get('responseEnd', -1) > 0 else None})


def plan_names(f):
    return f.evaluate("[...document.querySelectorAll('#plansListContainer .plan-item-row .plan-item-name')].map(e => e.textContent)")


with sync_playwright() as p:
    b, ctx = open_browser(p)
    pg = ctx.new_page()
    pg.on('requestfinished', on_finished)
    pg.goto(URL, wait_until='domcontentloaded', timeout=60000)
    f = planner_frame(pg, 90000)
    f.wait_for_function("document.querySelectorAll('#ganttBody tr.task-row').length > 0", timeout=90000)
    pg.wait_for_timeout(2500)
    f.click('#planSelectorBtn'); pg.wait_for_timeout(800)
    log['plans_before'] = plan_names(f)
    main_row = f.locator('#plansListContainer .plan-item-row', has_text='Main Plan').first
    t0 = time.time()
    main_row.locator('button[title="Duplicate / Clone this plan"]').click()
    f.wait_for_function("document.getElementById('planSelectorLabel').textContent.includes('(Copy)')", timeout=120000)
    log['clone_seconds'] = round(time.time() - t0, 1)
    f.wait_for_function("document.querySelectorAll('#ganttBody tr.task-row').length > 0", timeout=90000)
    pg.wait_for_timeout(2000)
    log['clone_label'] = f.inner_text('#planSelectorLabel')
    log['clone_rows'] = f.evaluate("document.querySelectorAll('#ganttBody tr.task-row').length")
    pg.screenshot(path=str(OUT / 'N02-clone-open.png'))
    f.click('#planSelectorBtn'); pg.wait_for_timeout(800)
    log['plans_with_clone'] = plan_names(f)
    log['unfinished_notes'] = f.evaluate("document.querySelectorAll('#plansListContainer .plan-item-note').length")
    row = f.locator('#plansListContainer .plan-item-row', has_text='(Copy)').first
    t0 = time.time()
    row.locator('button[title="Delete plan"]').click()
    row.locator('button[title="Delete plan"]').click()
    f.wait_for_function("document.getElementById('planSelectorLabel').textContent.includes('Main Plan')", timeout=120000)
    pg.wait_for_timeout(3000)
    log['delete_seconds'] = round(time.time() - t0, 1)
    f.click('#planSelectorBtn'); pg.wait_for_timeout(800)
    log['plans_after'] = plan_names(f)
    pg.screenshot(path=str(OUT / 'N02-after-delete.png'))
    b.close()
print(json.dumps(log, indent=1))
