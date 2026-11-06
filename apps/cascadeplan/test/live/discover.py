# Copyright (c) 2026 Asymm Systems. All rights reserved.
#
# @author Fahim Farook
"""Discovery: open DEMO, find the planner page. Asymm Systems. @author Fahim Farook"""
from playwright.sync_api import sync_playwright
from live_common import open_browser, SITE, OUT
with sync_playwright() as p:
    b, ctx = open_browser(p)
    pg = ctx.new_page()
    pg.goto(SITE + '/jira/software/projects/DEMO/boards', wait_until='domcontentloaded', timeout=60000)
    pg.wait_for_timeout(8000)
    print('url', pg.url)
    links = pg.evaluate("[...document.querySelectorAll('a')].filter(a => /cascade|planshift|planner/i.test(a.textContent + a.href)).map(a => a.textContent.trim() + ' | ' + a.href)")
    print('links', links[:10])
    pg.screenshot(path=str(OUT / 'L0-demo-project.png'))
    r = pg.evaluate("fetch('/rest/api/3/myself').then(r => r.status)")
    print('myself status', r)
    b.close()
