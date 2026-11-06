"""Live writes on a sealed issue as the signed-in user: one comment and a new summary. Prints the comment id and the
old summary so both can be restored. Usage: python3 change_rest.py KEY "new summary" "comment"
Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import sys
from playwright.sync_api import sync_playwright
from ls_live import open_browser, rest, SITE

key, summary, comment = sys.argv[1:4]
with sync_playwright() as p:
    b, ctx = open_browser(p)
    pg = ctx.new_page()
    pg.goto(SITE + '/jira/your-work', wait_until='domcontentloaded', timeout=120000)
    old = rest(pg, 'GET', f'/rest/api/3/issue/{key}?fields=summary')['json']['fields']['summary']
    print('old summary:', old)
    body = {'type': 'doc', 'version': 1, 'content': [{'type': 'paragraph', 'content': [{'type': 'text', 'text': comment}]}]}
    c = rest(pg, 'POST', f'/rest/api/3/issue/{key}/comment', {'body': body})
    print('comment', c['status'], (c['json'] or {}).get('id'))
    s = rest(pg, 'PUT', f'/rest/api/3/issue/{key}', {'fields': {'summary': summary}})
    print('summary', s['status'])
    b.close()
