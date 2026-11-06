"""ADR-009 harness check: freeze a baseline, see the scope change in the status, request approval,
and export the baseline as CSV.

As a plan approver: open "Baseline", freeze "Sprint 7". The status reads "on scope". Drag DEMO-40 one
week later: the status shows the later end. Request approval of the scope: the request is listed;
the requester's own "Accept" is refused. Export CSV: a file with the SHA-256 digest is downloaded.

Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import json
import sys
from playwright.sync_api import sync_playwright
from e2e import serve, wait_rows, drag_bar, CHROME

srv = serve()
base = f'http://127.0.0.1:{srv.server_address[1]}/index.html'
out = {}
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, headless=True, args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 1600, 'height': 900}, accept_downloads=True)
    pg = ctx.new_page()
    pg.goto(base); pg.evaluate('localStorage.clear()'); pg.reload(); wait_rows(pg); pg.wait_for_timeout(800)
    out['status_before'] = pg.inner_text('#btnBaseline')
    pg.click('#btnBaseline'); pg.wait_for_timeout(800)
    pg.fill('#baselinePanel input[aria-label="Baseline name"]', 'Sprint 7')
    pg.locator('#baselinePanel button', has_text='Freeze the plan as a baseline').click()
    pg.wait_for_timeout(1200)
    out['status_frozen'] = pg.inner_text('#btnBaseline')
    pg.click('#btnCloseBaseline')
    w = pg.locator('.bar-hit[data-task-id="DEMO-40"]').bounding_box()['width']
    drag_bar(pg, 'DEMO-40', w / 5 * 7)
    pg.wait_for_timeout(800)
    out['status_after_move'] = pg.inner_text('#btnBaseline')
    pg.click('#btnBaseline'); pg.wait_for_timeout(1200)
    out['delta_rows'] = pg.evaluate("[...document.querySelectorAll('#baselinePanel tbody tr')].map(r => r.children[0].textContent + ' ' + r.children[1].textContent)")
    pg.fill('#baselinePanel textarea[aria-label="Reason for the scope change"]', 'Release notes slipped a week')
    pg.locator('#baselinePanel button', has_text='Request approval of this scope').click()
    pg.wait_for_timeout(1200)
    out['requests'] = pg.evaluate("[...document.querySelectorAll('#baselinePanel .baseline-shift span')].map(s => s.textContent)")
    pg.locator('#baselinePanel button', has_text='Accept').first.click()
    pg.wait_for_timeout(800)
    out['own_accept'] = pg.evaluate("[...document.querySelectorAll('.flag')].map(f => f.textContent.trim())")[-1:]
    with pg.expect_download() as d:
        pg.locator('#baselinePanel button', has_text='Export CSV').first.click()
    path = d.value.path()
    out['csv_head'] = open(path, encoding='utf-8').read().split('\n')[:3]
    b.close()
srv.shutdown()
ok = (out['status_before'] == 'Baseline: none' and out['status_frozen'] == 'Baseline: Sprint 7 · on scope'
      and '1 later' in out['status_after_move'] and any(r.startswith('changed DEMO-40') for r in out['delta_rows'])
      and any('Release notes slipped a week' in r and 'Waiting.' in r for r in out['requests'])
      and any('person who made it' in f for f in out['own_accept'])
      and out['csv_head'][0].startswith('# Sprint 7, frozen ') and 'SHA-256 ' in out['csv_head'][0]
      and out['csv_head'][1] == 'issue_id,issue_key,estimate_hours,start,end,done')
print(('PASS' if ok else 'FAIL') + ' ADR-009 freeze, status, scope delta, request, own review refused, CSV export: ' + json.dumps(out))
sys.exit(0 if ok else 1)
