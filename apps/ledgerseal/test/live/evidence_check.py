"""Reads the ledgerseal-cert property by REST and the evidence from the panel ("Show evidence (JSON)"), and saves
both to the output folder. Reads only. Usage: python3 evidence_check.py KEY
Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import json
import sys
from playwright.sync_api import sync_playwright
from ls_live import open_browser, rest, OUT, dump
from ls_panel import open_issue, click_text

key = sys.argv[1]
with sync_playwright() as p:
    b, ctx = open_browser(p, 2300, 1300, 1.0)
    pg = ctx.new_page()
    open_issue(pg, key)
    prop = rest(pg, 'GET', f'/rest/api/3/issue/{key}/properties/ledgerseal-cert')
    value = (prop['json'] or {}).get('value') or {}
    dump(f'property-{key}.json', value)
    print('property', prop['status'], 'schema', value.get('schemaVersion'), 'status', value.get('status'), 'keyId', value.get('keyId'),
          'has sealedByAccountId', 'sealedByAccountId' in value, 'signed', 'sig' in value)
    click_text(pg, 'Show details')
    click_text(pg, 'Show evidence (JSON)')
    pg.wait_for_timeout(6000)
    text = pg.locator('pre, code').first.inner_text()
    evidence = json.loads(text)
    (OUT / f'evidence-{key}.json').write_text(json.dumps(evidence, indent=2))
    hist = [(h['seq'], h['statusId'], h['transitionName']) for h in evidence['history']]
    print('evidence', evidence['format'], 'history', hist, 'parties', evidence.get('parties'), 'warning' in evidence)
    print('account id of the user in evidence text:', '712020:' in text)
    b.close()
