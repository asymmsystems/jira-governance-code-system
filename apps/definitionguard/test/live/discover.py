"""Read-only discovery for the DefinitionGuard live checks: PAY issues, PAY workflows and which
projects use them, and which issues on the site carry the definitionguard-dod property.

Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
from playwright.sync_api import sync_playwright
from dg_live import open_browser, rest, save, SITE

with sync_playwright() as p:
    b, ctx = open_browser(p)
    pg = ctx.new_page()
    pg.goto(SITE + '/rest/api/3/myself', wait_until='domcontentloaded')
    st, me = rest(pg, 'GET', '/rest/api/3/myself')
    print('myself', st, me.get('displayName') if isinstance(me, dict) else me)
    st, proj = rest(pg, 'GET', '/rest/api/3/project/search?maxResults=100')
    projects = [(x['key'], x['id'], x.get('style'), x['name']) for x in proj.get('values', [])]
    print('projects', projects)
    st, issues = rest(pg, 'POST', '/rest/api/3/search/jql', {'jql': 'project = PAY ORDER BY key', 'maxResults': 100, 'fields': ['summary', 'issuetype', 'status', 'assignee']})
    rows = [(i['key'], i['id'], i['fields']['issuetype']['name'], i['fields']['status']['name'], i['fields']['status']['statusCategory']['key'], (i['fields'].get('assignee') or {}).get('displayName'), i['fields']['summary']) for i in issues.get('issues', [])]
    for r in rows:
        print(r)
    pay_id = [x[1] for x in projects if x[0] == 'PAY'][0]
    st, wfs = rest(pg, 'GET', f'/rest/api/3/workflows/search?projectId={pay_id}&expand=values.transitions&maxResults=50')
    print('workflows', st, [(w.get('name'), w.get('id')) for w in (wfs.get('values') or [])] if isinstance(wfs, dict) else wfs)
    save('pay-workflows.json', wfs)
    st, scheme = rest(pg, 'GET', f'/rest/api/3/workflowscheme/project?projectId={pay_id}')
    print('scheme', st, scheme)
    # Which issues carry the DefinitionGuard property (the one-time pass would write those again).
    with_prop = []
    token = None
    while True:
        body = {'jql': 'project in (' + ', '.join(x[0] for x in projects) + ') ORDER BY key', 'maxResults': 100, 'fields': ['project']}
        if token:
            body['nextPageToken'] = token
        st, page = rest(pg, 'POST', '/rest/api/3/search/jql', body)
        for i in page.get('issues', []):
            s2, props = rest(pg, 'GET', f"/rest/api/3/issue/{i['id']}/properties")
            if isinstance(props, dict) and any(k['key'] == 'definitionguard-dod' for k in props.get('keys', [])):
                with_prop.append(i['key'])
        token = page.get('nextPageToken')
        if not token:
            break
    print('issues with definitionguard-dod:', with_prop)
    save('discover.json', {'projects': projects, 'pay': rows, 'withProperty': with_prop})
    b.close()
