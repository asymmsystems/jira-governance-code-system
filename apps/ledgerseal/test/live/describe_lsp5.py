"""Live write for screenshot 03: gives the probe issue LSP-5 a description after its seal. Prints the old value.
Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
from playwright.sync_api import sync_playwright
from ls_live import open_browser, rest, SITE
with sync_playwright() as p:
    b, ctx = open_browser(p)
    pg = ctx.new_page()
    pg.goto(SITE + '/jira/your-work', wait_until='domcontentloaded', timeout=120000)
    print('old description:', rest(pg, 'GET', '/rest/api/3/issue/LSP-5?fields=description')['json']['fields']['description'])
    doc = {'type': 'doc', 'version': 1, 'content': [{'type': 'paragraph', 'content': [{'type': 'text', 'text': 'Rotate the payment gateway API keys on Friday, then disable the old keys.'}]}]}
    print('put', rest(pg, 'PUT', '/rest/api/3/issue/LSP-5', {'fields': {'description': doc}})['status'])
    b.close()
