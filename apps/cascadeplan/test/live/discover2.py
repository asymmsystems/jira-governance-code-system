# Copyright (c) 2026 Asymm Systems. All rights reserved.
#
# @author Fahim Farook
"""Discovery 2. Asymm Systems. @author Fahim Farook"""
from playwright.sync_api import sync_playwright
from live_common import open_browser, SITE, OUT
with sync_playwright() as p:
    b, ctx = open_browser(p)
    pg = ctx.new_page()
    pg.goto(SITE + '/browse/DEMO-1', wait_until='domcontentloaded', timeout=60000)
    pg.wait_for_timeout(3000)
    info = pg.evaluate("fetch('/rest/api/3/project/DEMO').then(r => r.json()).then(j => ({type: j.projectTypeKey, style: j.style, simplified: j.simplified, id: j.id}))")
    print('project', info)
    t = info['type']
    pg.goto(f"{SITE}/jira/{t}/projects/DEMO", wait_until='domcontentloaded', timeout=60000)
    pg.wait_for_timeout(9000)
    print('url', pg.url)
    links = pg.evaluate("[...document.querySelectorAll('a')].filter(a => /apps\\//.test(a.href) || /cascade|planshift|planner/i.test(a.textContent)).map(a => a.textContent.trim() + ' | ' + a.href)")
    print('links', links[:15])
    pg.screenshot(path=str(OUT / 'L0-demo-project.png'))
    b.close()
