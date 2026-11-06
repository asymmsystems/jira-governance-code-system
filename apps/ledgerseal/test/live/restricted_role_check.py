"""F-06 live check with a role-restricted comment on LSP-5. Temporarily adds the signed-in user to the LSP project
role Administrators (they are not in it), posts a comment restricted to that role, reads the LedgerSeal panel, then
deletes the comment and removes the user from the role again. Prints every step.
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
    me = rest(pg, 'GET', '/rest/api/3/myself')['json']['accountId']
    roles = rest(pg, 'GET', '/rest/api/3/project/LSP/role')['json']
    role_id = roles['Administrators'].rstrip('/').split('/')[-1]
    before = rest(pg, 'GET', f'/rest/api/3/project/LSP/role/{role_id}')['json']
    was_member = any(a.get('actorUser', {}).get('accountId') == me for a in before.get('actors', []))
    print('role id', role_id, 'member before:', was_member)
    added = False
    cid = None
    try:
        if not was_member:
            r = rest(pg, 'POST', f'/rest/api/3/project/LSP/role/{role_id}', {'user': [me]})
            added = r['status'] == 200
            print('added to role', r['status'])
        body = {'type': 'doc', 'version': 1, 'content': [{'type': 'paragraph', 'content': [{'type': 'text', 'text': 'LedgerSeal live check: role-restricted comment'}]}]}
        c = rest(pg, 'POST', '/rest/api/3/issue/LSP-5/comment', {'body': body, 'visibility': {'type': 'role', 'value': 'Administrators'}})
        cid = (c['json'] or {}).get('id')
        print('restricted comment', c['status'], cid)
        open_issue(pg, 'LSP-5')
        pg.wait_for_timeout(3000)
        txt = pg.locator('body').inner_text()
        i = txt.find('Changed items')
        part = txt[i:txt.find('Certificate', i)] if i >= 0 else ''
        print('panel changed items:', ' | '.join(l for l in part.split('\n') if l.strip())[:700])
        print('panel has a Comment added row:', 'Comment added' in part, '| restricted text shown:', 'role-restricted comment' in part)
        pg.screenshot(path=str(OUT / 'restricted-role-LSP-5.png'))
    finally:
        if cid:
            print('deleted comment', rest(pg, 'DELETE', f'/rest/api/3/issue/LSP-5/comment/{cid}')['status'])
        if added:
            print('removed from role', rest(pg, 'DELETE', f'/rest/api/3/project/LSP/role/{role_id}?user={me}')['status'])
        after = rest(pg, 'GET', f'/rest/api/3/project/LSP/role/{role_id}')['json']
        print('member after:', any(a.get('actorUser', {}).get('accountId') == me for a in after.get('actors', [])))
    b.close()
