"""Live ADR-009 check on the development site, project DEMO, Main Plan: open "Baseline", freeze a
baseline named "Live check <time>", read the status, the scope table and the version list, and
export the baseline as CSV. Writes only the baseline keys of DEMO's Main Plan.

Needs CASCADEPLAN_LIVE_COOKIES (see live_common.py).

Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import json
import time

from playwright.sync_api import sync_playwright

from live_common import open_browser, SITE, OUT, planner_frame

URL = SITE + '/jira/servicedesk/projects/DEMO/apps/cac8499e-e92e-4ba6-95cc-af398b1be791/5dfcdd60-51aa-4ea9-a5e2-c94d7e294677'
out = {}
with sync_playwright() as p:
    b, ctx = open_browser(p)
    pg = ctx.new_page()
    pg.goto(URL, wait_until="domcontentloaded", timeout=150000)
    f = planner_frame(pg, 150000)
    f.wait_for_function("document.querySelectorAll('#ganttBody tr.task-row').length > 0", timeout=90000)
    pg.wait_for_timeout(3000)
    out['status_before'] = f.inner_text('#btnBaseline')
    f.click('#btnBaseline')
    pg.wait_for_timeout(4000)
    name = f'Live check {time.strftime("%H%M")}'
    f.fill('#baselinePanel input[aria-label="Baseline name"]', name)
    f.locator('#baselinePanel button', has_text='Freeze the plan as a baseline').click()
    pg.wait_for_timeout(9000)
    out['flags'] = f.evaluate("[...document.querySelectorAll('.flag')].map(x => x.textContent.trim())")[-2:]
    out['status_after'] = f.inner_text('#btnBaseline')
    out['versions'] = f.evaluate("[...document.querySelectorAll('#baselinePanel .baseline-version span')].map(s => s.textContent)")[:3]
    out['scope_text'] = f.evaluate("(document.querySelector('#baselinePanel section p') || {}).textContent || ''")
    try:
        with pg.expect_download(timeout=20000) as d:
            f.locator('#baselinePanel button', has_text='Export CSV').first.click()
        out['csv_head'] = open(d.value.path(), encoding='utf-8').read().split('\n')[:3]
    except Exception as e:  # a sandboxed frame may block downloads; the panel then shows the text
        pg.wait_for_timeout(3000)
        out['csv_download'] = f'no download: {type(e).__name__}'
        out['csv_text_head'] = f.evaluate("((document.querySelector('#baselinePanel textarea[readonly]') || {}).value || '').split('\\n').slice(0, 3)")
    pg.screenshot(path=str(OUT / 'ADR009-live-baseline.png'))
    b.close()
print(json.dumps(out, indent=1))
