"""N-08 development-site test (fix plan section 10, step 0): how Jira changes a parent or a work type.

Creates throw-away issues in project DEMO as the signed-in user: tasks A, B and C, a sub-task S of
A, a "Blocks" link C -> B, a due date and a cascadeplan.dates property on S and C. Then:
  R2: PUT S with parent B (the edit endpoint); is the key, id, due date and property kept?
  R3: bulk move C (a task with no sub-tasks) into a sub-task of A; job result, key, id, link, property.
  R4: bulk move S (a sub-task) into a Task; job result, key, id, due date, property.
Deletes every issue it created at the end. Prints one JSON object.

Needs CASCADEPLAN_LIVE_COOKIES (see live_common.py).

Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import json
import sys
import time

from playwright.sync_api import sync_playwright

from live_common import SITE, cookies, CHROME

H = {'Accept': 'application/json', 'Content-Type': 'application/json', 'X-Atlassian-Token': 'no-check', 'User-Agent': 'cascadeplan-live-check'}
out = {}
created = []


def main(api):
    types = api.get(f'{SITE}/rest/api/3/issue/createmeta/DEMO/issuetypes', headers=H).json()
    types = types.get('issueTypes', types.get('values', []))
    task_t = next(t for t in types if t['name'] == 'Task')
    sub_t = next(t for t in types if t.get('subtask'))
    out['types'] = {'task': task_t['id'], 'subtask': sub_t['id'], 'subtask_name': sub_t['name']}

    def create(summary, type_id, parent=None):
        fields = {'project': {'key': 'DEMO'}, 'issuetype': {'id': type_id}, 'summary': f'CascadePlan hierarchy check: {summary} (deleted at once)'}
        if parent:
            fields['parent'] = {'key': parent}
        r = api.post(f'{SITE}/rest/api/3/issue', headers=H, data=json.dumps({'fields': fields}))
        if r.status != 201:
            raise SystemExit(f'create {summary} failed: {r.status} {r.text()[:300]}')
        j = r.json()
        created.append(j['key'])
        return j['key'], j['id']

    def state(key):
        r = api.get(f'{SITE}/rest/api/3/issue/{key}?fields=parent,issuetype,duedate,issuelinks&properties=cascadeplan.dates', headers=H)
        if r.status != 200:
            return {'status': r.status}
        j = r.json()
        f = j['fields']
        return {'key': j['key'], 'id': j['id'], 'type': f['issuetype']['name'], 'parent': (f.get('parent') or {}).get('key'),
                'due': f.get('duedate'), 'links': sorted(l.get('inwardIssue', {}).get('key') or l.get('outwardIssue', {}).get('key') for l in f.get('issuelinks', [])),
                'property': (j.get('properties') or {}).get('cascadeplan.dates')}

    a, _ = create('A', task_t['id'])
    b, _ = create('B', task_t['id'])
    c, c_id = create('C', task_t['id'])
    s, s_id = create('S', sub_t['id'], a)
    for key in (s, c):
        api.put(f'{SITE}/rest/api/3/issue/{key}', headers=H, data=json.dumps({'fields': {'duedate': '2026-12-11'}}))
        api.put(f'{SITE}/rest/api/3/issue/{key}/properties/cascadeplan.dates', headers=H, data=json.dumps({'startDate': '2026-12-07', 'endDate': '2026-12-11', 'v': 1}))
    lk = api.post(f'{SITE}/rest/api/3/issueLink', headers=H, data=json.dumps({'type': {'name': 'Blocks'}, 'inwardIssue': {'key': c}, 'outwardIssue': {'key': b}}))
    out['link_create'] = lk.status
    out['issues'] = {'A': a, 'B': b, 'C': c, 'S': s}

    # R2: the edit endpoint with a new parent.
    before = state(s)
    r2 = api.put(f'{SITE}/rest/api/3/issue/{s}', headers=H, data=json.dumps({'fields': {'parent': {'key': b}}}))
    out['R2'] = {'status': r2.status, 'body': r2.text()[:300] if r2.status >= 300 else '', 'before': before, 'after': state(s)}

    def bulk_move(key, target):
        body = {'sendBulkNotification': False, 'targetToSourcesMapping': {target: {
            'inferClassificationDefaults': True, 'inferFieldDefaults': True, 'inferStatusDefaults': True, 'inferSubtaskTypeDefault': True,
            'issueIdsOrKeys': [key]}}}
        r = api.post(f'{SITE}/rest/api/3/bulk/issues/move', headers=H, data=json.dumps(body))
        res = {'submit_status': r.status, 'submit_body': r.text()[:400]}
        if r.status not in (200, 201):
            return res
        task_id = r.json().get('taskId')
        res['taskId'] = task_id
        for _ in range(30):
            q = api.get(f'{SITE}/rest/api/3/bulk/queue/{task_id}', headers=H)
            qj = q.json() if q.status == 200 else {}
            if qj.get('status') in ('COMPLETE', 'FAILED', 'CANCELLED', 'DEAD'):
                res['job'] = {k: qj.get(k) for k in ('status', 'progressPercent', 'processedAccessibleIssues', 'failedAccessibleIssues', 'invalidOrInaccessibleIssueCount')}
                break
            time.sleep(2)
        else:
            res['job'] = {'status': 'still running after 60 s'}
        return res

    # R3: task C (no sub-tasks) becomes a sub-task of A.
    before = state(c)
    out['R3'] = bulk_move(c, f"DEMO,{sub_t['id']},{a}")
    out['R3'].update({'before': before, 'after': state(c_id)})
    # R4: sub-task S becomes a Task.
    before = state(s)
    out['R4'] = bulk_move(s, f"DEMO,{task_t['id']}")
    out['R4'].update({'before': before, 'after': state(s_id)})


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'], executable_path=CHROME)
    ctx = browser.new_context()
    ctx.add_cookies(cookies())
    api = ctx.request
    try:
        main(api)
    finally:
        out['deleted'] = {}
        for key in reversed(created):
            r = api.delete(f'{SITE}/rest/api/3/issue/{key}?deleteSubtasks=true', headers=H)
            out['deleted'][key] = r.status
        browser.close()
print(json.dumps(out, indent=1))
