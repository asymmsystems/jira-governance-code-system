"""F-03 live capture: runs LSP-4's gated transition (41, to Done) with a transition comment and a summary,
so the validator logs its payload shape. LSP-4 is not sealed, so the validator blocks and Jira changes nothing.
Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
from playwright.sync_api import sync_playwright
from ls_live import open_browser, rest, SITE, dump

DOC = {'type': 'doc', 'version': 1, 'content': [{'type': 'paragraph', 'content': [{'type': 'text', 'text': 'LedgerSeal payload probe'}]}]}
with sync_playwright() as p:
    b, ctx = open_browser(p)
    pg = ctx.new_page()
    pg.goto(SITE + '/jira/your-work', wait_until='domcontentloaded', timeout=120000)
    before = rest(pg, 'GET', '/rest/api/3/issue/LSP-4?fields=summary,status,comment')
    tries = {
        'comment-only': {'transition': {'id': '41'}, 'update': {'comment': [{'add': {'body': DOC}}]}},
        'comment-and-summary': {'transition': {'id': '41'}, 'fields': {'summary': 'probe summary'}, 'update': {'comment': [{'add': {'body': DOC}}]}},
    }
    out = {}
    for name, body in tries.items():
        r = rest(pg, 'POST', '/rest/api/3/issue/LSP-4/transitions', body)
        out[name] = r
        print(name, r['status'], str(r['json'])[:300])
    after = rest(pg, 'GET', '/rest/api/3/issue/LSP-4?fields=summary,status,comment')
    print('unchanged', before['json']['fields'] == after['json']['fields'])
    dump('capture-validator.json', out)
    b.close()
