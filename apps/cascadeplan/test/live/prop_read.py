"""Read-only: print the cascadeplan.dates property and the due date of one DEMO issue.

Usage: python3 prop_read.py DEMO-29. Needs CASCADEPLAN_LIVE_COOKIES (see live_common.py).

Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import json
import sys

from playwright.sync_api import sync_playwright

from live_common import SITE, cookies, CHROME

KEY = sys.argv[1] if len(sys.argv) > 1 else 'DEMO-29'
HEADERS = {'Accept': 'application/json', 'User-Agent': 'cascadeplan-live-check'}
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'], executable_path=CHROME)
    ctx = browser.new_context()
    ctx.add_cookies(cookies())
    prop = ctx.request.get(f'{SITE}/rest/api/3/issue/{KEY}/properties/cascadeplan.dates', headers=HEADERS)
    issue = ctx.request.get(f'{SITE}/rest/api/3/issue/{KEY}?fields=duedate', headers=HEADERS)
    print(json.dumps({'issue': KEY, 'property_status': prop.status,
                      'property': prop.json().get('value') if prop.status == 200 else None,
                      'due': issue.json().get('fields', {}).get('duedate') if issue.status == 200 else None}))
    browser.close()
