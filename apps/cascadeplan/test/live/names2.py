# Copyright (c) 2026 Asymm Systems. All rights reserved.
#
# @author Fahim Farook
"""Live: app name in Administration and Developer Console (read only). Asymm Systems. @author Fahim Farook"""
import json
from playwright.sync_api import sync_playwright
from live_common import open_browser, SITE, OUT
out = {}
with sync_playwright() as p:
    b, ctx = open_browser(p)
    pg = ctx.new_page()
    pg.goto(SITE + '/plugins/servlet/upm', wait_until='domcontentloaded', timeout=60000)
    pg.wait_for_timeout(6000)
    try:
        with pg.expect_navigation(timeout=30000):
            pg.get_by_text('Take me there').click()
    except Exception as e:
        out['nav_err'] = str(e)[:200]
    pg.wait_for_timeout(12000)
    out['admin_url'] = pg.url
    body = pg.evaluate("document.body.innerText")
    out['admin_hits'] = [l for l in body.splitlines() if any(x in l.lower() for x in ('planshift', 'cascadeplan', 'cascade'))][:10]
    pg.screenshot(path=str(OUT / 'L7-connected-apps.png'))
    pg.goto('https://developer.atlassian.com/console/myapps/cac8499e-e92e-4ba6-95cc-af398b1be791/overview', wait_until='domcontentloaded', timeout=60000)
    pg.wait_for_timeout(12000)
    out['console_url'] = pg.url
    body = pg.evaluate("document.body.innerText")
    out['console_hits'] = [l for l in body.splitlines() if any(x in l.lower() for x in ('planshift', 'cascadeplan', 'cascade'))][:10]
    pg.screenshot(path=str(OUT / 'L8-developer-console.png'))
    b.close()
print(json.dumps(out, indent=1))
(OUT.parent / 'L7-L8-names.json').write_text(json.dumps(out, indent=1))
