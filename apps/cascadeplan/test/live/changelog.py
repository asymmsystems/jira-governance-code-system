# Copyright (c) 2026 Asymm Systems. All rights reserved.
#
# @author Fahim Farook
"""Print the full Jira changelog (duedate items) of given issues. Asymm Systems. @author Fahim Farook"""
import json, sys
from playwright.sync_api import sync_playwright
from live_common import open_browser, SITE
with sync_playwright() as p:
    b, ctx = open_browser(p)
    pg = ctx.new_page()
    pg.goto(SITE + '/rest/api/3/myself', wait_until='domcontentloaded')
    for key in sys.argv[1:]:
        r = pg.evaluate(f"fetch('/rest/api/3/issue/{key}/changelog?maxResults=100').then(r => r.json()).then(j => ({{total: j.total, rows: j.values.map(h => h.created + ' ' + (h.author && h.author.displayName) + ' ' + h.items.map(i => i.field + ':' + i.fromString + '->' + i.toString).join('; '))}}))")
        print(key, 'total', r['total'])
        for row in r['rows'][-12:]:
            print('  ', row)
    b.close()
