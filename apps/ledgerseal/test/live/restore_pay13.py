"""Restores what the LedgerSeal live check changed on PAY-13: description (empty), summary, and three comments.
Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
from playwright.sync_api import sync_playwright
from ls_live import open_browser, rest, SITE
with sync_playwright() as p:
    b, ctx = open_browser(p)
    pg = ctx.new_page()
    pg.goto(SITE + '/jira/your-work', wait_until='domcontentloaded', timeout=120000)
    print('fields', rest(pg, 'PUT', '/rest/api/3/issue/PAY-13', {'fields': {'summary': 'Manual review queue for flagged orders', 'description': None}})['status'])
    for cid in ('10039', '10040', '10041'):
        print('delete comment', cid, rest(pg, 'DELETE', f'/rest/api/3/issue/PAY-13/comment/{cid}')['status'])
    f = rest(pg, 'GET', '/rest/api/3/issue/PAY-13?fields=summary,description,comment')['json']['fields']
    print('now', f['summary'], f['description'], f['comment']['total'])
    b.close()
