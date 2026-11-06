"""Live check of progress and Jira status (owner decision 2026-11-06, INV-19), development site, project PAY.

On the To Do task "Checkout analytics events":
1. Digit 3, Enter: the planner asks "Also move it to In Progress?". Keep: Jira's status stays To Do.
2. Digit 4, Enter: the same question. Move: Jira's status becomes In Progress (workflow transition).
3. Ctrl+Z twice: the status goes back to To Do and the progress back to what it was.
On the Done story "Card payment form": a digit does nothing and the task dialog locks the progress with the reason.

Writes only in PAY and restores what it changed; prints every Jira status it saw.

Needs CASCADEPLAN_LIVE_COOKIES (see live_common.py).

Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import json

from playwright.sync_api import sync_playwright

from live_common import open_browser, SITE, OUT, planner_frame

URL = SITE + '/jira/software/projects/PAY/apps/cac8499e-e92e-4ba6-95cc-af398b1be791/5dfcdd60-51aa-4ea9-a5e2-c94d7e294677'
TODO_SUMMARY = 'Checkout analytics events'
DONE_SUMMARY = 'Card payment form'

FIND = r"""async (summary) => {
  const r = await fetch('/rest/api/3/search/jql?jql=' + encodeURIComponent('project = PAY ORDER BY key') + '&fields=summary&maxResults=100');
  const b = await r.json();
  const i = (b.issues || []).find(x => x.fields.summary === summary);
  return i ? i.key : null;
}"""
STATUS = r"""async (key) => {
  const r = await fetch('/rest/api/3/issue/' + key + '?fields=status');
  const b = await r.json();
  return b.fields.status.name + ' / ' + b.fields.status.statusCategory.key;
}"""
FOCUS = """key => {
  const rows = [...document.querySelectorAll('[role="treegrid"] [role="row"][data-row]')];
  const row = rows.find(r => (r.querySelector('[data-col="0"]') || {}).textContent === key);
  if (!row) return false;
  row.querySelector('[data-col="1"]').focus();
  return true;
}"""
QUESTION = "document.getElementById('statusOfferModal').style.display === 'flex' ? document.getElementById('statusOfferQuestion').textContent : null"


def chip(f, key):
    """The treegrid's Progress and Status cells of the row (they show in Compact view too)."""
    return f.evaluate("""key => {
      const r = [...document.querySelectorAll('[role="treegrid"] [role="row"][data-row]')].find(r => (r.querySelector('[data-col="0"]') || {}).textContent === key);
      return r ? r.querySelector('[data-col="4"]').textContent + ' | ' + r.querySelector('[data-col="5"]').textContent : null;
    }""", key)


def wait_question(f):
    f.wait_for_function("document.getElementById('statusOfferModal').style.display === 'flex'", timeout=20000)
    return f.evaluate(QUESTION)


out = {}
with sync_playwright() as p:
    b, ctx = open_browser(p)
    pg = ctx.new_page()
    pg.goto(URL, wait_until='domcontentloaded', timeout=150000)
    f = planner_frame(pg, 150000)
    f.wait_for_function("document.querySelectorAll('#ganttBody tr.task-row').length > 0", timeout=90000)
    pg.wait_for_timeout(4000)

    todo = pg.evaluate(FIND, TODO_SUMMARY)
    done = pg.evaluate(FIND, DONE_SUMMARY)
    out['keys'] = [todo, done]
    out['status_0'] = pg.evaluate(STATUS, todo)
    out['chip_0'] = chip(f, todo)

    # 1. Keep.
    f.evaluate(FOCUS, todo); pg.keyboard.press('3'); pg.wait_for_timeout(300); pg.keyboard.press('Enter')
    out['q1'] = wait_question(f)
    f.click('#btnStatusOfferKeep'); pg.wait_for_timeout(6000)
    out['status_1'] = pg.evaluate(STATUS, todo)
    out['chip_1'] = chip(f, todo)

    # 2. Move.
    f.evaluate(FOCUS, todo); pg.keyboard.press('4'); pg.wait_for_timeout(300); pg.keyboard.press('Enter')
    out['q2'] = wait_question(f)
    pg.screenshot(path=str(OUT / 'progress-status-question.png'))
    f.click('#btnStatusOfferMove'); pg.wait_for_timeout(8000)
    out['status_2'] = pg.evaluate(STATUS, todo)
    out['chip_2'] = chip(f, todo)

    # 3. Undo both.
    f.evaluate(FOCUS, todo); pg.keyboard.press('Control+z'); pg.wait_for_timeout(8000)
    out['status_3a'] = pg.evaluate(STATUS, todo)
    f.evaluate(FOCUS, todo); pg.keyboard.press('Control+z'); pg.wait_for_timeout(8000)
    out['status_3b'] = pg.evaluate(STATUS, todo)
    out['chip_3'] = chip(f, todo)

    # 4. Done is locked.
    out['done_status'] = pg.evaluate(STATUS, done)
    out['done_chip_before'] = chip(f, done)
    f.evaluate(FOCUS, done); pg.keyboard.press('2'); pg.wait_for_timeout(500)
    out['done_chip_after_digit'] = chip(f, done)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    f.evaluate(FOCUS, done); pg.keyboard.press('Enter'); pg.wait_for_timeout(1500)
    out['done_dialog'] = f.evaluate("[document.getElementById('editProgressInput').disabled, document.getElementById('editProgressLockNote').textContent]")
    pg.keyboard.press('Escape'); pg.wait_for_timeout(500)
    b.close()

ok = (
    out['q1'] == f"{todo} is To Do in Jira. Also move it to In Progress?" and out['status_1'] == out['status_0']
    and (out['chip_1'] or '').startswith('30%')
    and out['q2'] == out['q1'] and out['status_2'].endswith('/ indeterminate') and (out['chip_2'] or '').startswith('40%')
    and out['status_3b'] == out['status_0'] and out['chip_3'] == out['chip_0']
    and out['done_status'].endswith('/ done') and (out['done_chip_before'] or '').startswith('100% | Done')
    and out['done_chip_after_digit'] == out['done_chip_before']
    and out['done_dialog'][0] is True and 'is Done in Jira' in out['done_dialog'][1]
)
print(('PASS' if ok else 'FAIL') + ' live progress and status: ' + json.dumps(out, indent=1))
