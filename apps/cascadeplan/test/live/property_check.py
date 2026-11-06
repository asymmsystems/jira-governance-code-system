"""DEC-3 Option C development-site test: is a Jira issue property usable as the shared start date?

Creates one throw-away issue in project DEMO as the signed-in user, then:
1. sets the property cascadeplan.dates as the user;
2. reads it back in a JQL search with properties=cascadeplan.dates (the planner's own read path);
3. reads it directly;
4. deletes the issue and checks that the property is gone with it.
Prints one JSON line with every answer. Writes only that one issue, which it deletes.

Not covered here (needs the owner): the refusal for a Browse-only user (Atlassian documents that
setting a property needs Edit issues), and whether a property moves with an issue to another project
(this test may change only project DEMO).

Needs CASCADEPLAN_LIVE_COOKIES (see live_common.py).

Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import json
import sys

from playwright.sync_api import sync_playwright

from live_common import SITE, cookies, CHROME

HEADERS = {'Accept': 'application/json', 'Content-Type': 'application/json', 'X-Atlassian-Token': 'no-check',
           'User-Agent': 'cascadeplan-live-check'}
PROP = 'cascadeplan.dates'

out = {}
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'], executable_path=CHROME)
    ctx = browser.new_context()
    ctx.add_cookies(cookies())
    api = ctx.request
    types = api.get(f'{SITE}/rest/api/3/issue/createmeta/DEMO/issuetypes', headers=HEADERS).json()
    standard = [t for t in types.get('issueTypes', types.get('values', [])) if not t.get('subtask')]
    created = api.post(f'{SITE}/rest/api/3/issue', headers=HEADERS, data=json.dumps(
        {'fields': {'project': {'key': 'DEMO'}, 'issuetype': {'id': standard[0]['id']}, 'summary': 'CascadePlan property check (deleted at once)'}}))
    if created.status != 201:
        sys.exit(f'create failed: {created.status}')
    key = created.json()['key']
    issue_id = created.json()['id']
    out['issue'] = key
    value = {'startDate': '2026-11-10', 'v': 1}
    put = api.put(f'{SITE}/rest/api/3/issue/{key}/properties/{PROP}', headers=HEADERS, data=json.dumps(value))
    out['put_status'] = put.status
    # The search is eventually consistent; reconcileIssues asks for read-after-write for this issue.
    search = api.get(f'{SITE}/rest/api/3/search/jql?jql=key%3D{key}&fields=summary&properties={PROP}&reconcileIssues={issue_id}', headers=HEADERS)
    issues = search.json().get('issues', []) if search.status == 200 else []
    out['search_status'] = search.status
    out['search_issue_count'] = len(issues)
    out['search_properties'] = issues[0].get('properties') if issues else None
    direct = api.get(f'{SITE}/rest/api/3/issue/{key}/properties/{PROP}', headers=HEADERS)
    out['direct_status'] = direct.status
    out['direct_value'] = direct.json().get('value') if direct.status == 200 else None
    deleted = api.delete(f'{SITE}/rest/api/3/issue/{key}', headers=HEADERS)
    out['delete_status'] = deleted.status
    after = api.get(f'{SITE}/rest/api/3/issue/{issue_id}/properties/{PROP}', headers=HEADERS)
    out['after_delete_status'] = after.status
    browser.close()
print(json.dumps(out))
