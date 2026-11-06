"""Smoke check of DefinitionGuard 7 (Browse check, issue property scope) on the development site.
Creates one PAY probe Task, loads the panel, ticks one evidence item (property write), loads the
history, and deletes nothing (cleanup.py deletes the probe). Results: DG_LIVE_OUT/perm-smoke.json.

Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import json
import sys
sys.path.insert(0, sys.argv[1])
from playwright.sync_api import sync_playwright
from dg_live import open_browser, rest, save, SITE, OUT, open_issue, ensure_panel, item_checkbox, panel_error, wait_quiet, expand_history

TESTS = 'Unit and integration tests pass in CI'
results = {}

def record(name, ok, detail=''):
    results[name] = {'ok': bool(ok), 'detail': detail}
    print(('PASS ' if ok else 'FAIL ') + name, '|', str(detail)[:300])

with sync_playwright() as p:
    b, ctx = open_browser(p)
    pg = ctx.new_page()
    pg.goto(SITE + '/rest/api/3/myself', wait_until='domcontentloaded')
    fields = {'project': {'key': 'PAY'}, 'issuetype': {'name': 'Task'}, 'summary': 'DG probe Q3: DefinitionGuard live check, delete after test'}
    st, res = rest(pg, 'POST', '/rest/api/3/issue', {'fields': fields})
    print(st, str(res)[:400])
    key = res['key']
    print('created', key, st)
    results['probe'] = key
    open_issue(pg, key)
    ensure_panel(pg)
    body = pg.locator('body').inner_text()
    record('panel loads its checklist (Browse granted)', TESTS in body and panel_error(pg) == '', panel_error(pg))
    pg.screenshot(path=str(OUT / 'perm-smoke-panel.png'))
    item_checkbox(pg, TESTS).click()
    pg.wait_for_timeout(1500)
    pg.locator('input[placeholder="https://..."]').first.fill('https://ci.example.com/payments/build/7001')
    pg.wait_for_timeout(800)
    pg.get_by_role('button', name='Save and tick').first.click()
    wait_quiet(pg)
    record('tick saved', panel_error(pg) == '', panel_error(pg))
    st, prop = rest(pg, 'GET', f'/rest/api/3/issue/{key}/properties/definitionguard-dod')
    value = prop.get('value', {}) if isinstance(prop, dict) else {}
    record('issue property written with write:issue.property:jira', st == 200 and value.get('mandatoryCompleted') == 1 and bool(value.get('sig')), f"{st} {json.dumps(value)[:200]}")
    expand_history(pg)
    body = pg.locator('body').inner_text()
    record('history loads, chain intact', 'chain intact' in body, body[body.find('History checked'):][:120])
    pg.screenshot(path=str(OUT / 'perm-smoke-history.png'))
    save('perm-smoke.json', results)
    b.close()
