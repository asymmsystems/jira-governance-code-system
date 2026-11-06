"""Lists LSP's project roles and the user's groups, and shows Jira's answer to a role-restricted comment. Reads only
(the comment is not created when Jira refuses it; if it is created, it is deleted again at once).
Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
from playwright.sync_api import sync_playwright
from ls_live import open_browser, rest, SITE
with sync_playwright() as p:
    b, ctx = open_browser(p)
    pg = ctx.new_page()
    pg.goto(SITE + '/jira/your-work', wait_until='domcontentloaded', timeout=120000)
    roles = rest(pg, 'GET', '/rest/api/3/project/LSP/role')['json'] or {}
    print('roles', sorted(roles.keys()))
    me = rest(pg, 'GET', '/rest/api/3/myself?expand=groups')['json']
    print('groups', [g['name'] for g in me['groups']['items']])
    body = {'type': 'doc', 'version': 1, 'content': [{'type': 'paragraph', 'content': [{'type': 'text', 'text': 'x'}]}]}
    r = rest(pg, 'POST', '/rest/api/3/issue/LSP-5/comment', {'body': body, 'visibility': {'type': 'role', 'value': 'Administrators'}})
    print('role answer', r['status'], r['json'])
    if r['status'] == 201:
        print('deleted', rest(pg, 'DELETE', f"/rest/api/3/issue/LSP-5/comment/{r['json']['id']}")['status'])
    b.close()
