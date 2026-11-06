"""F-27 harness check: a plan approver narrows the open plan with a JQL filter.

In the plan list, the approver types a filter and saves it. The plan then shows only the matching
work items, and the field keeps the filter after a reload. A filter Jira refuses shows Jira's message
and keeps the old filter. Saving an empty filter shows the whole project again. A user who is not a
plan approver sees the filter but cannot change it.

Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import sys
from playwright.sync_api import sync_playwright
from e2e import serve, wait_rows, row_keys, CHROME

srv = serve()
base = f'http://127.0.0.1:{srv.server_address[1]}/index.html'
out = {}
flags = "[...document.querySelectorAll('.flag')].map(f => f.textContent.trim())"
FILTER = 'key in (DEMO-1, DEMO-9)'


def save(pg, text):
    # The button toggles the plan list; open it only when it is closed.
    if not pg.is_visible('#planJqlInput'):
        pg.click('#planSelectorBtn'); pg.wait_for_timeout(300)
    pg.fill('#planJqlInput', text)
    pg.click('#btnSavePlanJql')
    pg.wait_for_timeout(1200)


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, headless=True, args=['--no-sandbox'])
    pg = b.new_context(viewport={'width': 1600, 'height': 900}).new_page()
    pg.goto(base); pg.evaluate('localStorage.clear()')
    pg.reload(); wait_rows(pg); pg.wait_for_timeout(500)
    out['rows_before'] = sorted(set(row_keys(pg)))

    save(pg, FILTER)
    wait_rows(pg)
    out['flag_saved'] = pg.evaluate(flags)[-1:]
    out['rows_filtered'] = sorted(set(row_keys(pg)))
    pg.reload(); wait_rows(pg); pg.wait_for_timeout(500)
    out['field_after_reload'] = pg.input_value('#planJqlInput')
    out['rows_after_reload'] = sorted(set(row_keys(pg)))

    save(pg, 'nofield = 1')
    out['flag_refused'] = pg.evaluate(flags)[-1:]
    out['stored_after_refusal'] = pg.evaluate("JSON.parse(localStorage.getItem('__harness_kvs'))['cp:10000:settings'].jqlFilter")

    save(pg, 'key in (DEMO-1) OR (project = OTHER')
    out['flag_unbalanced'] = pg.evaluate(flags)[-1:]

    pg.evaluate("localStorage.setItem('__harness_not_approver', '1')")
    pg.reload(); wait_rows(pg); pg.wait_for_timeout(800)
    pg.click('#planSelectorBtn'); pg.wait_for_timeout(300)
    out['reader_readonly'] = pg.evaluate("document.getElementById('planJqlInput').readOnly")
    out['reader_button_hidden'] = pg.evaluate("document.getElementById('btnSavePlanJql').hidden")
    out['reader_sees_filter'] = pg.input_value('#planJqlInput')
    pg.evaluate("localStorage.removeItem('__harness_not_approver')")
    pg.reload(); wait_rows(pg); pg.wait_for_timeout(800)

    save(pg, '')
    wait_rows(pg)
    out['flag_cleared'] = pg.evaluate(flags)[-1:]
    out['rows_cleared'] = sorted(set(row_keys(pg)))
    b.close()
srv.shutdown()

ok = (set(out['rows_filtered']) <= {'DEMO-1', 'DEMO-9'} and 'DEMO-9' in out['rows_filtered']
      and len(out['rows_before']) > len(out['rows_filtered'])
      and out['flag_saved'] and 'About 2 work items match' in out['flag_saved'][0]
      and out['field_after_reload'] == FILTER and out['rows_after_reload'] == out['rows_filtered']
      and out['flag_refused'] and 'nofield' in out['flag_refused'][0] and out['stored_after_refusal'] == FILTER
      and out['flag_unbalanced'] and 'parenthesis' in out['flag_unbalanced'][0]
      and out['reader_readonly'] is True and out['reader_button_hidden'] is True and out['reader_sees_filter'] == FILTER
      and out['flag_cleared'] and 'whole project' in out['flag_cleared'][0] and out['rows_cleared'] == out['rows_before'])
print(('PASS' if ok else 'FAIL') + f' F-27 plan JQL filter: {out}')
sys.exit(0 if ok else 1)
