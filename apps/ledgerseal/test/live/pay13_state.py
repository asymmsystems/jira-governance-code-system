"""Reads PAY-13's change log entries of today and its comments, to restore what the live check changed. Reads only.
Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
from playwright.sync_api import sync_playwright
from ls_live import open_browser, rest, SITE, dump
with sync_playwright() as p:
    b, ctx = open_browser(p)
    pg = ctx.new_page()
    pg.goto(SITE + '/jira/your-work', wait_until='domcontentloaded', timeout=120000)
    log = rest(pg, 'GET', '/rest/api/3/issue/PAY-13/changelog?maxResults=100')['json']['values']
    for e in log:
        if e['created'] >= '2026-11-06':
            for it in e['items']:
                print(e['created'], it.get('field'), '| from:', repr((it.get('fromString') or '')[:200]), '| to:', repr((it.get('toString') or '')[:120]))
    cs = rest(pg, 'GET', '/rest/api/3/issue/PAY-13/comment')['json']['comments']
    for c in cs:
        print('comment', c['id'], c['created'], c['author']['displayName'])
    dump('pay13-changelog.json', log)
    b.close()
