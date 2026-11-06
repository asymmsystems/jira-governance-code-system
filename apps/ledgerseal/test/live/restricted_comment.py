"""F-06 live check on the probe issue LSP-5: adds a comment restricted to a group, reads the panel as the
signed-in user (who is in the role), then deletes the comment again. Prints the comment id and what the panel shows.
Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
from playwright.sync_api import sync_playwright
from ls_live import open_browser, rest, SITE, OUT
from ls_panel import open_issue

with sync_playwright() as p:
    b, ctx = open_browser(p, 2300, 1300, 1.0)
    pg = ctx.new_page()
    pg.goto(SITE + '/jira/your-work', wait_until='domcontentloaded', timeout=120000)
    # The signed-in user is not in a project role of LSP, but is in this group
    group = 'jira-admins-asymmsystems'
    body = {'type': 'doc', 'version': 1, 'content': [{'type': 'paragraph', 'content': [{'type': 'text', 'text': 'LedgerSeal live check: restricted comment'}]}]}
    c = rest(pg, 'POST', '/rest/api/3/issue/LSP-5/comment', {'body': body, 'visibility': {'type': 'group', 'value': group}})
    cid = (c['json'] or {}).get('id')
    print('restricted comment', c['status'], cid, 'group', group, c['json'] if c['status'] != 201 else '')
    try:
        open_issue(pg, 'LSP-5')
        pg.wait_for_timeout(3000)
        txt = pg.locator('body').inner_text()
        i = txt.find('Changed items')
        part = txt[i:txt.find('Certificate', i)] if i >= 0 else ''
        print('panel changed items:', ' | '.join(l for l in part.split('\n') if l.strip())[:600])
        print('restricted text visible in panel:', 'restricted comment' in part)
        pg.screenshot(path=str(OUT / 'restricted-LSP-5.png'))
    finally:
        if cid:
            print('deleted', rest(pg, 'DELETE', f'/rest/api/3/issue/LSP-5/comment/{cid}')['status'])
    b.close()
