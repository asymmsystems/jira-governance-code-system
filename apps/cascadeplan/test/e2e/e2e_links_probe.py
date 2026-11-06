"""N-11 harness check: dependencies are Jira links, the same in every plan (ADR-006).

In the page, through the real resolvers: a link DEMO-40 -> DEMO-41 is made in a new Plan B at 30%.
The fake Jira then holds one "Blocks" link and the percent property on DEMO-41; the Main Plan shows
the link at 30%; the Plan B record holds no link. A second Jira link (DEMO-26 -> DEMO-41, made
"by a user in Jira") is added; removing DEMO-40's link deletes only that one.

Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import json
import sys
from playwright.sync_api import sync_playwright
from e2e import serve, wait_rows, CHROME

srv = serve()
base = f'http://127.0.0.1:{srv.server_address[1]}/index.html'
out = {}
CALL = """async ([fn, payload]) => JSON.parse(JSON.stringify(await window.__resolvers[fn]({ payload,
  context: { cloudId: 'harness-cloud', siteUrl: 'https://harness.atlassian.net', extension: { project: { key: 'DEMO', id: '10000' } } } })))"""
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, headless=True, args=['--no-sandbox'])
    pg = b.new_context(viewport={'width': 1600, 'height': 900}).new_page()
    pg.goto(base); pg.evaluate('localStorage.clear()'); pg.reload(); wait_rows(pg); pg.wait_for_timeout(500)
    created = pg.evaluate(CALL, ['createProjectPlan', {'name': 'Plan B', 'cloneFromPlanId': 'default'}])
    plan_b = created['plan']['id']
    dep = {'predecessorKey': 'DEMO-40', 'predecessorId': 'DEMO-40', 'triggerPercent': 30, 'isTriggerSatisfied': False}
    res = pg.evaluate(CALL, ['updateWbsTask', {'planId': plan_b, 'taskId': 'DEMO-41', 'updates': {'dependency': dep}}])
    out['add_ok'] = res.get('ok', True) is not False
    out['jira_links'] = pg.evaluate("JSON.parse(localStorage.getItem('__harness_jira_links') || '[]')")
    out['percent_property'] = pg.evaluate("(JSON.parse(localStorage.getItem('__harness_jira_props') || '{}')['DEMO-41'] || {})['cascadeplan.links']")
    kvs = pg.evaluate("JSON.parse(localStorage.getItem('__harness_kvs'))")
    rec_b = [v for k, v in kvs.items() if k.startswith(f'cp:10000:plan:{plan_b}:we:') and v.get('issueKey') == 'DEMO-41']
    out['plan_b_record_links'] = [a for a in (rec_b[0].get('assocs') or []) if not a.get('thruDate')] if rec_b else []
    main = pg.evaluate(CALL, ['getProjectPlan', {}])
    t41 = [t for t in main['tasks'] + main.get('backlogTasks', []) if t['key'] == 'DEMO-41'][0]
    out['main_plan_links'] = [[d['predecessorKey'], d['triggerPercent']] for d in (t41.get('dependencies') or [])]
    # A link a user made directly in Jira.
    pg.evaluate("""(() => { const l = JSON.parse(localStorage.getItem('__harness_jira_links') || '[]');
      l.push({ id: '7777', pred: 'DEMO-26', succ: 'DEMO-41' }); localStorage.setItem('__harness_jira_links', JSON.stringify(l)); })()""")
    rm = pg.evaluate(CALL, ['updateWbsTask', {'taskId': 'DEMO-41', 'updates': {'removeDependency': {'predecessorKey': 'DEMO-40'}}}])
    out['remove_ok'] = rm.get('ok', True) is not False
    out['jira_links_after'] = pg.evaluate("JSON.parse(localStorage.getItem('__harness_jira_links') || '[]')")
    b.close()
srv.shutdown()
ok = (out['add_ok'] and len(out['jira_links']) == 1 and out['jira_links'][0]['pred'] == 'DEMO-40' and out['jira_links'][0]['succ'] == 'DEMO-41'
      and out['percent_property'] == {'v': 1, 'links': {'40': 30}} and out['plan_b_record_links'] == []
      and out['main_plan_links'] == [['DEMO-40', 30]] and out['remove_ok']
      and out['jira_links_after'] == [{'id': '7777', 'pred': 'DEMO-26', 'succ': 'DEMO-41'}])
print(('PASS' if ok else 'FAIL') + ' N-11 links are Jira links, shared by every plan: ' + json.dumps(out))
sys.exit(0 if ok else 1)
