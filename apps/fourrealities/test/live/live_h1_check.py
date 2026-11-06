"""Live check of merge review H-1 on PAY-4: a hand-written, unsigned DefinitionGuard and LedgerSeal
property must not raise the score. Restores everything it changes.

Steps: add a Confluence decision link (so Intent is found), read the panel; write unsigned "complete"
definitionguard-dod and "SEAL_VALID" ledgerseal-cert properties, read the panel again; delete both
properties and the link. Usage: python3 live_h1_check.py. Needs CASCADEPLAN_LIVE_COOKIES.

Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import json
import re
import urllib.request

from playwright.sync_api import sync_playwright

from live_common import CHROME, SITE, cookies

ISSUE = 'PAY-4'
PAGE_URL = SITE + '/wiki/spaces/SD/pages/196933/Template+-+Decision+documentation'
FORGED_DOD = {'isFullySatisfied': True, 'mandatoryCompleted': 1, 'mandatoryTotal': 1, 'headHash': 'a' * 64}
FORGED_SEAL = {'status': 'SEAL_VALID', 'certificateId': '3f0c2a52-7d1b-4c47-9a51-0d6e3b8a9f10', 'snapshotHash': 'b' * 64, 'sealedAt': '2026-11-06T09:00:00.000Z'}


def call(method, path, body=None):
    header = '; '.join(f"{c['name']}={c['value']}" for c in cookies())
    req = urllib.request.Request(SITE + path, method=method, data=None if body is None else json.dumps(body).encode(),
                                 headers={'Cookie': header, 'Accept': 'application/json', 'Content-Type': 'application/json', 'X-Atlassian-Token': 'no-check'})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read().decode()
            return r.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        return e.code, None


def panel_text(pg):
    """The issue context panel's text after a fresh load."""
    pg.goto(SITE + f'/browse/{ISSUE}', wait_until='commit', timeout=150000)
    pg.get_by_role('button', name='View app actions').first.wait_for(timeout=120000)
    for _ in range(45):
        if pg.get_by_text('Gate findings').count():
            break
        pg.wait_for_timeout(2000)
    show = pg.get_by_role('button', name='Show details')
    if show.count():
        show.first.click()
        pg.wait_for_timeout(1500)
    text = pg.inner_text('body')
    start = text.find('Four Realities\nIncomplete') if 'Four Realities\nIncomplete' in text else text.find('Gate findings')
    return text[start:start + 2500]


def summary(text):
    rai = re.search(r'Reality Alignment Index \(RAI\) ([^:]+):', text)
    process = re.search(r'Process: Evidence [a-z]+\n[^\n]*', text)
    audit = re.search(r'Audit: Evidence [a-z]+\n[^\n]*', text)
    return {'rai': rai.group(1) if rai else None, 'process': process.group(0) if process else None, 'audit': audit.group(0) if audit else None}


if __name__ == '__main__':
    status, link = call('POST', f'/rest/api/3/issue/{ISSUE}/remotelink', {'object': {'url': PAGE_URL, 'title': 'Template - Decision documentation'}})
    print('link added', status)
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(executable_path=CHROME, headless=True, args=['--no-sandbox'])
            ctx = b.new_context(viewport={'width': 1500, 'height': 1000}, bypass_csp=True)
            ctx.add_cookies(cookies())
            pg = ctx.new_page()
            before = summary(panel_text(pg))
            print('NO RECORDS', json.dumps(before))
            print('put dod', call('PUT', f'/rest/api/3/issue/{ISSUE}/properties/definitionguard-dod', FORGED_DOD)[0])
            print('put seal', call('PUT', f'/rest/api/3/issue/{ISSUE}/properties/ledgerseal-cert', FORGED_SEAL)[0])
            after = summary(panel_text(pg))
            print('FORGED UNSIGNED', json.dumps(after))
            print('same score:', before['rai'] == after['rai'])
            b.close()
    finally:
        print('delete dod', call('DELETE', f'/rest/api/3/issue/{ISSUE}/properties/definitionguard-dod')[0])
        print('delete seal', call('DELETE', f'/rest/api/3/issue/{ISSUE}/properties/ledgerseal-cert')[0])
        if link and link.get('id'):
            print('delete link', call('DELETE', f"/rest/api/3/issue/{ISSUE}/remotelink/{link['id']}")[0])
        print('left: links', len(call('GET', f'/rest/api/3/issue/{ISSUE}/remotelink')[1] or []),
              'dod', call('GET', f'/rest/api/3/issue/{ISSUE}/properties/definitionguard-dod')[0],
              'seal', call('GET', f'/rest/api/3/issue/{ISSUE}/properties/ledgerseal-cert')[0])
