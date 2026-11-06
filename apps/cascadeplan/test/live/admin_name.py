# Copyright (c) 2026 Asymm Systems. All rights reserved.
#
# @author Fahim Farook
"""Live: admin page and app names shown by Jira. Asymm Systems. @author Fahim Farook"""
import json
from playwright.sync_api import sync_playwright
from live_common import open_browser, SITE, OUT
out = {}
with sync_playwright() as p:
    b, ctx = open_browser(p)
    pg = ctx.new_page()
    pg.goto(SITE + '/jira/settings/apps/cac8499e-e92e-4ba6-95cc-af398b1be791/5dfcdd60-51aa-4ea9-a5e2-c94d7e294677', wait_until='domcontentloaded', timeout=60000)
    pg.wait_for_timeout(12000)
    out['admin_url'] = pg.url
    out['admin_texts'] = [f.evaluate("document.body ? document.body.innerText.slice(0, 600) : ''") for f in pg.frames if 'atlassian-dev.net' in (f.url or '')]
    out['admin_sidebar_hits'] = pg.evaluate("[...document.querySelectorAll('a,span,div')].map(e => e.childElementCount === 0 ? e.textContent.trim() : '').filter(t => /cascadeplan|planshift/i.test(t)).slice(0, 20)")
    pg.screenshot(path=str(OUT / 'L5-admin-page.png'))
    pg.goto(SITE + '/plugins/servlet/upm', wait_until='domcontentloaded', timeout=60000)
    pg.wait_for_timeout(12000)
    out['upm_url'] = pg.url
    out['upm_hits'] = pg.evaluate("[...document.querySelectorAll('*')].map(e => e.childElementCount === 0 ? e.textContent.trim() : '').filter(t => /cascadeplan|planshift/i.test(t)).slice(0, 20)")
    for f in pg.frames:
        try:
            out.setdefault('upm_frame_hits', []).extend(f.evaluate("[...document.querySelectorAll('*')].map(e => e.childElementCount === 0 ? e.textContent.trim() : '').filter(t => /cascadeplan|planshift/i.test(t)).slice(0, 20)"))
        except Exception:
            pass
    pg.screenshot(path=str(OUT / 'L6-manage-apps.png'), full_page=True)
    b.close()
print(json.dumps(out, indent=1)[:3000])
(OUT.parent / 'L5-L6-admin-name.json').write_text(json.dumps(out, indent=1))
