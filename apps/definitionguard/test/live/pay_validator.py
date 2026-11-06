"""Adds or removes the DefinitionGuard validator on PAY's transition into Done (only PAY uses
this workflow: "Software Simplified Workflow for Project PAY", scheme 10037). Usage:
  python3 pay_validator.py check | add | remove
"check" validates the change without saving. The original workflow is saved first to
DG_LIVE_OUT/pay-workflow-original.json; "remove" restores the Done transition without the validator.

Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import copy
import json
import sys
from playwright.sync_api import sync_playwright
from dg_live import open_browser, rest, save, SITE, OUT

WF_NAME = 'Software Simplified Workflow for Project PAY'
DONE_TRANSITION = '31'
DG_KEY = 'ari:cloud:ecosystem::extension/73e4f63d-7d60-450c-96d5-f81ca68a709c/b575a3a8-ffe9-4570-ac50-42a6a555c167/static/definitionguard-workflow-validator'


def is_dg(v):
    return 'definitionguard-workflow-validator' in json.dumps(v.get('parameters', {}))


def main(action):
    with sync_playwright() as p:
        b, ctx = open_browser(p)
        pg = ctx.new_page()
        pg.goto(SITE + '/rest/api/3/myself', wait_until='domcontentloaded')
        st, found = rest(pg, 'GET', '/rest/api/3/workflows/search?projectId=10036&expand=values.transitions&maxResults=50')
        wf = [w for w in found['values'] if w['name'] == WF_NAME][0]
        if not (OUT / 'pay-workflow-original.json').exists():
            save('pay-workflow-original.json', wf)
        ids = [s['statusReference'] for s in wf['statuses']]
        st, sts = rest(pg, 'GET', '/rest/api/3/statuses?' + '&'.join('id=' + i for i in ids))
        statuses = [{'id': s['id'], 'statusReference': s['id'], 'name': s['name'], 'statusCategory': s['statusCategory'], 'description': s.get('description', '')} for s in sts]
        new = copy.deepcopy(wf)
        for t in new['transitions']:
            if t['id'] == DONE_TRANSITION:
                t['validators'] = [v for v in t.get('validators', []) if not is_dg(v)]
                if action in ('add', 'check'):
                    t['validators'].append({'ruleKey': 'forge:expression-validator', 'parameters': {'key': DG_KEY}})
        body = {'statuses': statuses, 'workflows': [{k: new[k] for k in ['id', 'version', 'name', 'description', 'statuses', 'transitions', 'startPointLayout'] if k in new}]}
        if action == 'check':
            st, res = rest(pg, 'POST', '/rest/api/3/workflows/update/validation', {'payload': body})
        else:
            st, res = rest(pg, 'POST', '/rest/api/3/workflows/update', body)
        print(action, st, json.dumps(res)[:1500])
        st, after = rest(pg, 'GET', '/rest/api/3/workflows/search?projectId=10036&expand=values.transitions&maxResults=50')
        wf2 = [w for w in after['values'] if w['name'] == WF_NAME][0]
        done = [t for t in wf2['transitions'] if t['id'] == DONE_TRANSITION][0]
        print('version', wf2['version'], 'Done validators', json.dumps(done.get('validators')))
        b.close()


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'check')
