"""Deletes the DefinitionGuard probe issues in PAY. The signed-in Jira admin is not in PAY's
Administrators role (no Delete issues there), so it is added to the role for the deletion and
removed again afterwards; the role's actors are printed before and after.
Usage: python3 cleanup.py PAY-22 PAY-23 ...

Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import sys
from playwright.sync_api import sync_playwright
from dg_live import open_browser, rest, SITE

with sync_playwright() as p:
    b, ctx = open_browser(p)
    pg = ctx.new_page()
    pg.goto(SITE + '/rest/api/3/myself', wait_until='domcontentloaded')
    st, me = rest(pg, 'GET', '/rest/api/3/myself')
    st, roles = rest(pg, 'GET', '/rest/api/3/project/PAY/role')
    role_id = roles['Administrators'].rstrip('/').split('/')[-1]
    st, role = rest(pg, 'GET', f'/rest/api/3/project/PAY/role/{role_id}')
    before = [(a.get('type'), a.get('displayName')) for a in role.get('actors', [])]
    print('Administrators before:', before)
    already = any(a.get('actorUser', {}).get('accountId') == me['accountId'] for a in role.get('actors', []))
    if not already:
        st, _ = rest(pg, 'POST', f'/rest/api/3/project/PAY/role/{role_id}', {'user': [me['accountId']]})
        print('added to Administrators:', st)
    try:
        for key in sys.argv[1:]:
            st, _ = rest(pg, 'DELETE', f'/rest/api/3/issue/{key}')
            print('deleted', key, st)
    finally:
        if not already:
            st, _ = rest(pg, 'DELETE', f'/rest/api/3/project/PAY/role/{role_id}?user={me["accountId"]}')
            print('removed from Administrators:', st)
        st, role = rest(pg, 'GET', f'/rest/api/3/project/PAY/role/{role_id}')
        print('Administrators after:', [(a.get('type'), a.get('displayName')) for a in role.get('actors', [])])
    b.close()
