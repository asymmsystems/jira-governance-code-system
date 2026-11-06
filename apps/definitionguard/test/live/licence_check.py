"""Live check of the inactive licence (BL-4, H-3) on a new probe Task in PAY. Needs the development
install set to --license inactive and the validator on PAY's Done transition.
Usage: python3 licence_check.py

Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import json
from playwright.sync_api import sync_playwright
from dg_live import open_browser, rest, SITE, OUT, open_issue, ensure_panel, item_checkbox, panel_error

with sync_playwright() as p:
    b, ctx = open_browser(p, 1600, 1100)
    pg = ctx.new_page()
    pg.goto(SITE + '/rest/api/3/myself', wait_until='domcontentloaded')
    st, res = rest(pg, 'POST', '/rest/api/3/issue', {'fields': {'project': {'key': 'PAY'}, 'issuetype': {'name': 'Task'}, 'summary': 'DG probe D: licence check, delete after test'}})
    key = res['key']
    print('created', key)
    open_issue(pg, key)
    ensure_panel(pg)
    body = pg.inner_text('body')
    print('panel notice:', 'Licence not active' in body, '| text:', 'moves to Done are not blocked' in body)
    item_checkbox(pg, 'PCI DSS scope impact assessed').click()
    pg.wait_for_timeout(6000)
    print('change refused:', panel_error(pg).replace('\n', ' ')[:200])
    st, res = rest(pg, 'POST', f'/rest/api/3/issue/{key}/transitions', {'transition': {'id': '31'}})
    st2, iss = rest(pg, 'GET', f'/rest/api/3/issue/{key}?fields=status')
    print('incomplete move to Done:', st, iss['fields']['status']['name'])
    (OUT / 'licence-probe.json').write_text(json.dumps({'key': key}))
    pg.screenshot(path=str(OUT / 'licence-panel.png'))
    b.close()
