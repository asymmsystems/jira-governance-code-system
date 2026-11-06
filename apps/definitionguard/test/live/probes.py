"""Live checks of the DefinitionGuard gate and the not-the-assignee rule on two probe Tasks in PAY.
Usage: python3 probes.py create | check | passing | delete
  create  creates DG probe A (unassigned) and DG probe B (assigned to the signed-in user)
  check   runs the checks; needs the validator on PAY's Done transition (pay_validator.py add)
Results: DG_LIVE_OUT/probes.json. Writes in PAY only (the two probe issues and their checklists).

Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import json
import sys
from playwright.sync_api import sync_playwright
from dg_live import open_browser, rest, save, SITE, OUT, open_issue, ensure_panel, row_button, item_checkbox, panel_error, wait_quiet, expand_history

STATE = OUT / 'probes-keys.json'
TESTS = 'Unit and integration tests pass in CI'
REVIEW = 'Code review approved by another engineer'
PCI = 'PCI DSS scope impact assessed'
LOAD = 'Load test results attached for changed endpoints'
results = {}


def record(name, ok, detail=''):
    results[name] = {'ok': bool(ok), 'detail': detail}
    print(('PASS ' if ok else 'FAIL ') + name, '|', str(detail)[:300])


def create(pg):
    st, me = rest(pg, 'GET', '/rest/api/3/myself')
    keys = {}
    for label, assignee in [('A', None), ('B', me['accountId'])]:
        fields = {'project': {'key': 'PAY'}, 'issuetype': {'name': 'Task'}, 'summary': f'DG probe {label}: DefinitionGuard live check, delete after test'}
        if assignee:
            fields['assignee'] = {'accountId': assignee}
        st, res = rest(pg, 'POST', '/rest/api/3/issue', {'fields': fields})
        print('created', label, st, res.get('key') if isinstance(res, dict) else res)
        keys[label] = res['key']
    STATE.write_text(json.dumps(keys))


def evidence_tick(pg, title, url):
    item_checkbox(pg, title).click()  # an evidence-required item opens the evidence form
    pg.wait_for_timeout(1500)
    pg.locator('input[placeholder="https://..."]').first.fill(url)
    pg.wait_for_timeout(800)
    pg.get_by_role('button', name='Save and tick').first.click()
    wait_quiet(pg)


def waive(pg, title, reason):
    row_button(pg, title, 'Waive').click()
    pg.wait_for_timeout(1500)
    pg.locator('input[placeholder="Reason (10 to 500 characters)"]').first.fill(reason)
    pg.wait_for_timeout(800)
    pg.get_by_role('button', name='Waive item').first.click()
    wait_quiet(pg)


def transition_done(pg, key):
    return rest(pg, 'POST', f'/rest/api/3/issue/{key}/transitions', {'transition': {'id': '31'}})


def check(pg):
    keys = json.loads(STATE.read_text())
    st, me = rest(pg, 'GET', '/rest/api/3/myself')
    my_id = me['accountId']
    A, B = keys['A'], keys['B']

    # Probe B: assigned to me. H-1, H-2 and the gate message.
    open_issue(pg, B)
    ensure_panel(pg)
    body = pg.inner_text('body')
    record('panel: template items shown', all(t in body for t in [TESTS, REVIEW, PCI, LOAD]))
    record('panel: approver line (M-1)', 'Authorized approvers (waive and reset): project administrators and Jira administrators.' in body)
    record('panel: no Four Realities button (M-2)', 'Open Four Realities panel' not in body)
    record('panel: no licence notice while licensed', 'Licence not active' not in body)
    item_checkbox(pg, REVIEW).click()
    wait_quiet(pg)
    err = panel_error(pg)
    record('B: assignee tick of a not-the-assignee item refused', 'The assignee cannot complete this item. Ask a reviewer.' in err, err)
    waive(pg, REVIEW, 'I reviewed this change myself.')
    err = panel_error(pg)
    record('B: H-1 waiver of a not-the-assignee item by the assignee refused', 'The assignee cannot waive this item' in err, err)
    st, _ = rest(pg, 'PUT', f'/rest/api/3/issue/{B}/assignee', {'accountId': None})
    record('B: unassigned (REST)', st == 204, st)
    open_issue(pg, B)
    ensure_panel(pg)
    item_checkbox(pg, REVIEW).click()
    wait_quiet(pg)
    err = panel_error(pg)
    record('B: H-2 tick by a former assignee refused (unassign, then tick)', 'you were the assignee of this issue after the item was opened' in err, err)
    st, res = transition_done(pg, B)
    msg = json.dumps(res)
    record('B: gate blocks Done with the open items and the panel name (M-5)', st == 400 and REVIEW in msg and 'Open the Definition of Done panel on this issue (from the View app actions button' in msg, f'{st} {msg[:400]}')
    st, iss = rest(pg, 'GET', f'/rest/api/3/issue/{B}?fields=status')
    record('B: status unchanged after the block', iss['fields']['status']['statusCategory']['key'] != 'done', iss['fields']['status']['name'])

    # Probe A: never assigned. Complete everything as me, then the gate passes; then assign to me: blocked.
    open_issue(pg, A)
    ensure_panel(pg)
    evidence_tick(pg, TESTS, 'https://ci.example.com/payments/build/4182')
    item_checkbox(pg, REVIEW).click()
    wait_quiet(pg)
    record('A: review ticked by someone who was never the assignee', panel_error(pg) == '', panel_error(pg))
    waive(pg, PCI, 'No card data flows change in this task.')
    evidence_tick(pg, LOAD, 'https://perf.example.com/reports/checkout-3x')
    body = pg.inner_text('body')
    record('A: panel says satisfied', 'Definition of Done satisfied' in body)
    st, prop = rest(pg, 'GET', f'/rest/api/3/issue/{A}/properties/definitionguard-dod')
    value = prop.get('value', {}) if isinstance(prop, dict) else {}
    save('probe-a-property.json', value)
    record('A: property schema 3, signed, no account id (BL-1, BL-2)', value.get('schemaVersion') == 3 and value.get('keyId') == 'dg-dev-2026-11' and bool(value.get('sig')) and my_id not in json.dumps(value) and 'lastModifiedByAccountId' not in value, json.dumps(value)[:300])
    st, _ = rest(pg, 'PUT', f'/rest/api/3/issue/{A}/assignee', {'accountId': my_id})
    st, res = transition_done(pg, A)
    record('A: H-2 validator blocks when the reviewer is now the assignee', st == 400 and REVIEW in json.dumps(res), f'{st} {json.dumps(res)[:300]}')
    st, _ = rest(pg, 'PUT', f'/rest/api/3/issue/{A}/assignee', {'accountId': None})
    st, res = transition_done(pg, A)
    record('A: H-2 validator still blocks after unassigning (former assignee)', st == 400 and REVIEW in json.dumps(res), f'{st} {json.dumps(res)[:300]}')

    # History, signature line and export (BL-1, BL-2) on probe A.
    open_issue(pg, A)
    ensure_panel(pg)
    expand_history(pg)
    body = pg.inner_text('body')
    record('A: history chain intact', 'chain intact' in body, body[body.find('History checked'):][:120])
    record('A: signature line names the key (BL-2)', 'Property signed' in body and 'signed with the Ed25519 key dg-dev-2026-11' in body)
    pg.get_by_role('button', name='Export history').first.click()
    wait_quiet(pg, 8000)
    code = pg.locator('code').last.inner_text() if pg.locator('code').count() else ''
    try:
        doc = json.loads(code)
    except Exception:
        doc = {}
    save('probe-a-export.json', doc)
    events = doc.get('events', [])
    record('A: export events hold pseudonyms only, and parties maps them (BL-1)',
           events and all(e['actorPartyId'].startswith('dgp-') or e['actorPartyId'] == 'system' for e in events) and my_id not in json.dumps(events) and my_id in json.dumps(doc.get('parties', {})),
           f"{len(events)} events, parties {len(doc.get('parties', {}))}")
    save('probes.json', results)


def passing(pg):
    """Probe C, never assigned: complete every mandatory item, then the gate lets Done through (204)."""
    st, res = rest(pg, 'POST', '/rest/api/3/issue', {'fields': {'project': {'key': 'PAY'}, 'issuetype': {'name': 'Task'}, 'summary': 'DG probe C: DefinitionGuard live check, delete after test'}})
    C = res['key']
    keys = json.loads(STATE.read_text()); keys['C'] = C; STATE.write_text(json.dumps(keys))
    open_issue(pg, C)
    ensure_panel(pg)
    st, res = transition_done(pg, C)
    record('C: gate blocks while items are open', st == 400, st)
    evidence_tick(pg, TESTS, 'https://ci.example.com/payments/build/4190')
    item_checkbox(pg, REVIEW).click(); wait_quiet(pg)
    waive(pg, PCI, 'No card data flows change in this task.')
    evidence_tick(pg, LOAD, 'https://perf.example.com/reports/checkout-3x')
    st, res = transition_done(pg, C)
    record('C: gate lets a complete checklist through to Done', st == 204, f'{st} {json.dumps(res)[:200]}')
    st, iss = rest(pg, 'GET', f'/rest/api/3/issue/{C}?fields=status')
    record('C: status is Done', iss['fields']['status']['statusCategory']['key'] == 'done', iss['fields']['status']['name'])
    st, prop = rest(pg, 'GET', f'/rest/api/3/issue/{C}/properties/definitionguard-dod')
    save('probe-c-property.json', prop.get('value', {}))
    save('probes-c.json', results)


def delete(pg):
    keys = json.loads(STATE.read_text())
    for k in keys.values():
        st, res = rest(pg, 'DELETE', f'/rest/api/3/issue/{k}')
        print('deleted', k, st)


if __name__ == '__main__':
    with sync_playwright() as p:
        b, ctx = open_browser(p, 1600, 1100)
        pg = ctx.new_page()
        pg.goto(SITE + '/rest/api/3/myself', wait_until='domcontentloaded')
        {'create': create, 'check': check, 'passing': passing, 'delete': delete}[sys.argv[1]](pg)
        b.close()
