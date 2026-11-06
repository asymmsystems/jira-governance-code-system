"""Discovery: PAY issues, the signed-in user's permissions, LSP transitions. Reads only.
Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
from playwright.sync_api import sync_playwright
from ls_live import open_browser, rest, SITE

with sync_playwright() as p:
    b, ctx = open_browser(p)
    pg = ctx.new_page()
    pg.goto(SITE + '/jira/your-work', wait_until='domcontentloaded', timeout=120000)
    me = rest(pg, 'GET', '/rest/api/3/myself')
    print('me', me['status'], (me['json'] or {}).get('accountId', '')[:6] + '...')
    for proj in ('PAY', 'LSP'):
        r = rest(pg, 'GET', f'/rest/api/3/search/jql?jql=project%3D{proj}%20ORDER%20BY%20key&maxResults=40&fields=summary,issuetype,status')
        issues = (r['json'] or {}).get('issues', [])
        print(proj, r['status'], len(issues))
        for i in issues:
            print('  ', i['key'], i['id'], i['fields']['issuetype']['name'], '|', i['fields']['status']['name'], '|', i['fields']['summary'][:60])
        perm = rest(pg, 'GET', f'/rest/api/3/mypermissions?projectKey={proj}&permissions=ADMINISTER_PROJECTS,EDIT_ISSUES,TRANSITION_ISSUES')
        print('  perms', {k: v['havePermission'] for k, v in (perm['json'] or {}).get('permissions', {}).items()})
    for key in ('LSP-3', 'PAY-1'):
        t = rest(pg, 'GET', f'/rest/api/3/issue/{key}/transitions?expand=transitions.fields')
        for tr in (t['json'] or {}).get('transitions', []):
            print(key, 'transition', tr['id'], tr['name'], '->', tr['to']['name'], 'screen' if tr.get('hasScreen') else '', list((tr.get('fields') or {}).keys()))
        prop = rest(pg, 'GET', f'/rest/api/3/issue/{key}/properties/ledgerseal-cert')
        print(key, 'property', prop['status'], sorted(((prop['json'] or {}).get('value') or {}).keys()))
    b.close()
