"""Prints the ledgerseal-cert property summary of issues. Reads only. Usage: python3 prop.py KEY...
Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import sys
from playwright.sync_api import sync_playwright
from ls_live import open_browser, rest, SITE
with sync_playwright() as p:
    b, ctx = open_browser(p)
    pg = ctx.new_page()
    pg.goto(SITE + '/jira/your-work', wait_until='domcontentloaded', timeout=120000)
    for key in sys.argv[1:]:
        r = rest(pg, 'GET', f'/rest/api/3/issue/{key}/properties/ledgerseal-cert')
        v = (r['json'] or {}).get('value') or {}
        print(key, r['status'], v.get('schemaVersion'), v.get('status'), 'accountId' if 'sealedByAccountId' in v else 'no-accountId', v.get('incidentCount'))
    b.close()
