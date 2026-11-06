# Copyright (c) 2026 Asymm Systems. All rights reserved.
#
# @author Fahim Farook
"""Live H2 check on the development site, project PAY: hold a drag, read the preview line, drop, and
compare the "<key> due <date>" entries of the line with the Jira due dates that changed. Then Undo from
the Jira flag, and put back every due date and every cascadeplan.dates property that still differs
from its value before the check (DEC-6 leaves a parent's due date at its roll-up end after an Undo).

Usage: python3 live_drop_preview.py KEY WEEKS [KEY WEEKS ...], for example PAY-7 1 PAY-8 3.
Writes only issues of project PAY. Needs CASCADEPLAN_LIVE_COOKIES (see live_common.py).
"""
import json
import re
import sys

from playwright.sync_api import sync_playwright

from live_common import open_browser, SITE, OUT, planner_frame

URL = SITE + '/jira/software/projects/PAY/apps/cac8499e-e92e-4ba6-95cc-af398b1be791/5dfcdd60-51aa-4ea9-a5e2-c94d7e294677'
PAIRS = list(zip(sys.argv[1::2], [int(w) for w in sys.argv[2::2]]))


def snapshot(pg):
    js = """fetch('/rest/api/3/search/jql?jql=' + encodeURIComponent('project = PAY') + '&fields=duedate&properties=cascadeplan.dates&maxResults=100')
      .then(r => r.json()).then(j => Object.fromEntries(j.issues.map(i => [i.key, { due: i.fields.duedate, prop: (i.properties || {})['cascadeplan.dates'] || null }])))"""
    return pg.evaluate(js)


def restore(pg, before, now):
    done = []
    for key, was in before.items():
        cur = now.get(key, {})
        if cur.get('due') != was['due']:
            s = pg.evaluate(f"""fetch('/rest/api/3/issue/{key}', {{ method: 'PUT', headers: {{ 'Content-Type': 'application/json', 'X-Atlassian-Token': 'no-check' }},
              body: JSON.stringify({{ fields: {{ duedate: {json.dumps(was['due'])} }} }}) }}).then(r => r.status)""")
            done.append([key, 'duedate', was['due'], s])
        if json.dumps(cur.get('prop'), sort_keys=True) != json.dumps(was['prop'], sort_keys=True):
            if was['prop'] is None:
                s = pg.evaluate(f"fetch('/rest/api/3/issue/{key}/properties/cascadeplan.dates', {{ method: 'DELETE', headers: {{ 'X-Atlassian-Token': 'no-check' }} }}).then(r => r.status)")
            else:
                s = pg.evaluate(f"""fetch('/rest/api/3/issue/{key}/properties/cascadeplan.dates', {{ method: 'PUT', headers: {{ 'Content-Type': 'application/json', 'X-Atlassian-Token': 'no-check' }},
                  body: JSON.stringify({json.dumps(was['prop'])}) }}).then(r => r.status)""")
            done.append([key, 'cascadeplan.dates', was['prop'], s])
    return done


def load(pg):
    pg.goto(URL, wait_until='domcontentloaded', timeout=120000)
    f = planner_frame(pg, 120000)
    f.wait_for_function("document.querySelectorAll('#ganttBody tr.task-row').length > 0", timeout=90000)
    pg.wait_for_timeout(3000)
    return f


def day_px(f, key):
    label = f.locator(f'.bar-hit[data-task-id="{key}"]').get_attribute('aria-label') or ''
    m = re.search(r'(\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})', label)
    import datetime
    s, e = [datetime.date.fromisoformat(x) for x in m.groups()]
    return f.locator(f'.bar-hit[data-task-id="{key}"]').bounding_box()['width'] / ((e - s).days + 1)


results = []
ok = True
with sync_playwright() as p:
    b, ctx = open_browser(p)
    pg = ctx.new_page()
    f = load(pg)
    for key, weeks in PAIRS:
        before = snapshot(pg)
        hit = f.locator(f'.bar-hit[data-task-id="{key}"]')
        hit.scroll_into_view_if_needed()
        box = hit.bounding_box()
        dx = day_px(f, key) * 7 * weeks
        x, y = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
        pg.mouse.move(x, y); pg.mouse.down()
        for i in range(1, 13):
            pg.mouse.move(x + dx * i / 12, y)
            pg.wait_for_timeout(40)
        pg.wait_for_timeout(900)
        preview = f.evaluate("(document.getElementById('writePreview') || {}).textContent || ''")
        pg.screenshot(path=str(OUT / f'H2-live-preview-{key}.png'))
        pg.mouse.up()
        pg.wait_for_timeout(12000)
        after = snapshot(pg)
        listed = sorted(re.findall(r'([A-Z]+-\d+) due (\d{4}-\d{2}-\d{2})', preview))
        changed = sorted((k, v['due']) for k, v in after.items() if v['due'] != before.get(k, {}).get('due'))
        changes = f.evaluate("[...document.querySelectorAll('#changesBody tr')].map(r => [...r.children].map(c => c.textContent.trim()).join(' | '))")
        undo = pg.get_by_role('button', name='Undo')
        if undo.count() == 0:
            undo = f.get_by_role('button', name='Undo')
        undo.first.click()
        pg.wait_for_timeout(15000)
        restored = restore(pg, before, snapshot(pg))
        final = snapshot(pg)
        same = bool(changed) and listed == changed
        ok = ok and same and final == before
        results.append({'key': key, 'weeks': weeks, 'preview': preview, 'listed': listed, 'changed_in_jira': changed, 'same': same,
                        'changes_panel': changes[:12], 'restored_by_script': restored, 'final_equals_before': final == before})
        f = load(pg)
    b.close()
print(('PASS' if ok else 'FAIL') + ' H2 live: ' + json.dumps(results, indent=1))
sys.exit(0 if ok else 1)
