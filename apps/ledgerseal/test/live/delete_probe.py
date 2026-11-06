"""Deletes a probe issue this live check created. Usage: python3 delete_probe.py KEY
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
    summary = rest(pg, 'GET', f'/rest/api/3/issue/{sys.argv[1]}?fields=summary')['json']['fields']['summary']
    if not summary.startswith('[LS-PROBE] LedgerSeal deleted-issue cleanup check'):
        sys.exit('not the probe issue: ' + summary)
    print('deleted', rest(pg, 'DELETE', f'/rest/api/3/issue/{sys.argv[1]}')['status'])
    b.close()
