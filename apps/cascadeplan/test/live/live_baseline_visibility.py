# Copyright (c) 2026 Asymm Systems. All rights reserved.
#
# @author Fahim Farook
"""Live M1 check on the development site, project PAY: baseline items outside the user's live read are
checked with Jira's permission check as the user (Browse projects). The check narrows the PAY Main Plan
to one issue with a JQL filter, so every other baseline item is outside the live read; a user who can
browse them all must still get every item in the CSV export, and no item may be left out. The filter is
cleared at the end.

Usage: python3 live_baseline_visibility.py. Changes only the PAY Main Plan's filter (set and cleared).
Needs CASCADEPLAN_LIVE_COOKIES (see live_common.py).
"""
import json
import sys

from playwright.sync_api import sync_playwright

from live_common import open_browser, SITE, OUT, planner_frame

URL = SITE + '/jira/software/projects/PAY/apps/cac8499e-e92e-4ba6-95cc-af398b1be791/5dfcdd60-51aa-4ea9-a5e2-c94d7e294677'
out = {}


def load(pg):
    pg.goto(URL, wait_until='domcontentloaded', timeout=150000)
    f = planner_frame(pg, 150000)
    f.wait_for_function("document.querySelectorAll('#ganttBody tr.task-row').length > 0", timeout=90000)
    pg.wait_for_timeout(3000)
    return f


def export_csv(pg, f):
    f.click('#btnBaseline'); pg.wait_for_timeout(2500)
    with pg.expect_download(timeout=30000) as d:
        f.locator('#baselinePanel button', has_text='Export CSV').first.click()
    text = open(d.value.path(), encoding='utf-8').read()
    f.click('#btnBaseline'); pg.wait_for_timeout(800)
    return text


def save_filter(pg, f, text):
    if not f.is_visible('#planJqlInput'):
        f.click('#planSelectorBtn'); pg.wait_for_timeout(800)
    f.fill('#planJqlInput', text)
    f.click('#btnSavePlanJql')
    pg.wait_for_timeout(6000)


with sync_playwright() as p:
    b, ctx = open_browser(p)
    pg = ctx.new_page()
    f = load(pg)
    out['filter_before'] = f.input_value('#planJqlInput')
    out['status_before'] = f.inner_text('#btnBaseline')
    full = export_csv(pg, f)
    out['items_full'] = len([l for l in full.splitlines() if l and not l.startswith('#') and not l.startswith('issue_id')])
    save_filter(pg, f, 'key = PAY-7')
    f = load(pg)
    out['rows_filtered'] = f.evaluate("document.querySelectorAll('#ganttBody tr.task-row').length")
    out['status_filtered'] = f.inner_text('#btnBaseline')
    narrow = export_csv(pg, f)
    out['items_filtered_plan'] = len([l for l in narrow.splitlines() if l and not l.startswith('#') and not l.startswith('issue_id')])
    out['left_out_line'] = [l for l in narrow.splitlines() if 'left out' in l]
    save_filter(pg, f, out['filter_before'])
    f = load(pg)
    out['filter_after'] = f.input_value('#planJqlInput')
    out['status_after'] = f.inner_text('#btnBaseline')
    pg.screenshot(path=str(OUT / 'M1-live-baseline.png'))
    b.close()
ok = (out['items_full'] > 1 and out['items_filtered_plan'] == out['items_full'] and not out['left_out_line']
      and out['filter_after'] == out['filter_before'] and out['status_after'] == out['status_before'])
print(('PASS' if ok else 'FAIL') + ' M1 live: ' + json.dumps(out, indent=1))
sys.exit(0 if ok else 1)
