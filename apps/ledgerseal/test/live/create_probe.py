"""Creates a LedgerSeal probe task in LSP and prints its key (a live write; deleted again by delete_probe.py).
Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
from playwright.sync_api import sync_playwright
from ls_live import open_browser, rest, SITE
with sync_playwright() as p:
    b, ctx = open_browser(p)
    pg = ctx.new_page()
    pg.goto(SITE + '/jira/your-work', wait_until='domcontentloaded', timeout=120000)
    r = rest(pg, 'POST', '/rest/api/3/issue', {'fields': {'project': {'key': 'LSP'}, 'issuetype': {'name': 'Task'},
        'summary': '[LS-PROBE] LedgerSeal deleted-issue cleanup check, delete after test'}})
    print('created', r['status'], (r['json'] or {}).get('key'), (r['json'] or {}).get('id'))
    b.close()
