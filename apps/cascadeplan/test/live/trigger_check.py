"""Live check of the issue-deleted trigger (BL-9) on the development site.

Creates one throw-away issue in project DEMO as the signed-in user, deletes it, and prints its key.
Then read `forge logs -e development` within 3 minutes for the line
"issue-deleted <key> (project id present|missing): N record(s) deleted".

Needs CASCADEPLAN_LIVE_COOKIES (see live_common.py). Writes only that one issue, which it deletes.

Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import json
import sys

from playwright.sync_api import sync_playwright

from live_common import SITE, cookies

HEADERS = {'Accept': 'application/json', 'Content-Type': 'application/json', 'X-Atlassian-Token': 'no-check',
           'User-Agent': 'cascadeplan-live-check'}

with sync_playwright() as p:
    req = p.request.new_context(base_url=SITE, extra_http_headers=HEADERS)
    req.storage_state()  # initialise
    ctx_cookies = cookies()
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'], executable_path='/opt/google/chrome/chrome')
    ctx = browser.new_context()
    ctx.add_cookies(ctx_cookies)
    api = ctx.request
    types = api.get(f'{SITE}/rest/api/3/issue/createmeta/DEMO/issuetypes', headers=HEADERS)
    if types.status != 200:
        sys.exit(f'createmeta failed: {types.status}')
    standard = [t for t in types.json().get('issueTypes', types.json().get('values', [])) if not t.get('subtask')]
    if not standard:
        sys.exit('no standard issue type in DEMO')
    body = {'fields': {'project': {'key': 'DEMO'}, 'issuetype': {'id': standard[0]['id']},
                       'summary': 'CascadePlan trigger check (deleted at once)'}}
    created = api.post(f'{SITE}/rest/api/3/issue', data=json.dumps(body), headers=HEADERS)
    if created.status != 201:
        sys.exit(f'create failed: {created.status} {created.text()[:200]}')
    key = created.json()['key']
    deleted = api.delete(f'{SITE}/rest/api/3/issue/{key}', headers=HEADERS)
    print(json.dumps({'created': key, 'type': standard[0].get('name'), 'deleteStatus': deleted.status}))
    browser.close()
