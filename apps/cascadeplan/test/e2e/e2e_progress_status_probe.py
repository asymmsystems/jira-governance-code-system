"""Progress and Jira status (owner decision 2026-11-06, INV-03), in the browser harness.

The fake Jira offers two transitions (Start, Done). Each check sets progress the way a user does and
reads the question, the Jira writes and the row:

1. Digit 3 then Enter on a To Do row asks "Also move it to In Progress?"; Move sends the Start transition.
2. The same on another To Do row with Keep: the progress is saved, no transition is sent.
3. 100% from the progress picker on an In Progress row asks "Also move it to Done?"; Keep shows
   "100%, not Done in Jira".
4. 100% again with Move: the Done transition is sent; after that the row is Done, its digits do
   nothing and the picker says why.
5. Escape on the question writes nothing.
6. Two rows in one digit batch get one question that lists both.

Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import json
import sys
from playwright.sync_api import sync_playwright
from e2e import serve, wait_rows, jira_writes, CHROME

srv = serve()
base = f'http://127.0.0.1:{srv.server_address[1]}/index.html'
out = {}

FOCUS = """key => {
  const rows = [...document.querySelectorAll('[role="treegrid"] [role="row"][data-row]')];
  const row = rows.find(r => (r.querySelector('[data-col="0"]') || {}).textContent === key);
  if (!row) return false;
  row.querySelector('[data-col="1"]').focus();
  return true;
}"""
QUESTION = "document.getElementById('statusOfferModal').style.display === 'flex' ? document.getElementById('statusOfferQuestion').textContent : null"
LIST = "[...document.querySelectorAll('#statusOfferList li')].map(li => li.textContent)"


def transitions(pg, since):
    return [w for w in jira_writes(pg)[since:] if '/transitions' in w]


def chip(pg, key):
    return pg.evaluate("""key => {
      const td = document.querySelector(`#ganttBody tr.task-row[data-task-id="${key}"] .td-progress-cell`);
      return td ? { title: td.getAttribute('title'), cls: td.querySelector('.progress-chip-cell').className } : null;
    }""", key)


def digit(pg, key, d):
    pg.evaluate(FOCUS, key)
    pg.keyboard.press(d)
    pg.wait_for_timeout(150)


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, headless=True, args=['--no-sandbox'])
    pg = b.new_context(viewport={'width': 1600, 'height': 900}).new_page()
    pg.goto(base); pg.evaluate('localStorage.clear()'); pg.evaluate("localStorage.setItem('__harness_transitions', '1')")
    pg.reload(); wait_rows(pg); pg.wait_for_timeout(500)

    # 1. To Do -> 30% -> Move.
    w0 = len(jira_writes(pg))
    digit(pg, 'DEMO-40', '3'); pg.keyboard.press('Enter'); pg.wait_for_timeout(400)
    out['q1'] = pg.evaluate(QUESTION)
    pg.click('#btnStatusOfferMove'); pg.wait_for_timeout(1500)
    out['t1'] = transitions(pg, w0)

    # 2. To Do -> 50% -> Keep.
    w1 = len(jira_writes(pg))
    digit(pg, 'DEMO-26', '5'); pg.keyboard.press('Enter'); pg.wait_for_timeout(400)
    out['q2'] = pg.evaluate(QUESTION)
    pg.click('#btnStatusOfferKeep'); pg.wait_for_timeout(1500)
    out['t2'] = transitions(pg, w1)
    out['chip2'] = chip(pg, 'DEMO-26')

    # 5. Escape on the question writes nothing.
    w5 = len(jira_writes(pg))
    digit(pg, 'DEMO-9', '4'); pg.keyboard.press('Enter'); pg.wait_for_timeout(400)
    out['q5'] = pg.evaluate(QUESTION)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(800)
    out['q5_closed'] = pg.evaluate(QUESTION) is None
    out['w5'] = jira_writes(pg)[w5:]
    pg.evaluate(FOCUS, 'DEMO-9'); pg.keyboard.press('Escape'); pg.wait_for_timeout(200)  # drop the waiting change

    # 3. In Progress (DEMO-40 after step 1) -> 100% in the picker -> Keep.
    w3 = len(jira_writes(pg))
    pg.locator('#ganttBody tr.task-row[data-task-id="DEMO-40"] .td-progress-cell').click(); pg.wait_for_timeout(300)
    pg.locator('.progress-preset-btn[data-pct="100"]').first.click(); pg.wait_for_timeout(400)
    out['q3'] = pg.evaluate(QUESTION)
    pg.click('#btnStatusOfferKeep'); pg.wait_for_timeout(1500)
    out['t3'] = transitions(pg, w3)
    out['chip3'] = chip(pg, 'DEMO-40')

    # 6. One question for a batch of two rows.
    digit(pg, 'DEMO-9', '2')
    digit(pg, 'DEMO-41', '9') if pg.evaluate(FOCUS, 'DEMO-41') else None
    digit(pg, 'DEMO-30', '6')
    pg.keyboard.press('Enter'); pg.wait_for_timeout(400)
    out['q6'] = pg.evaluate(QUESTION)
    out['l6'] = pg.evaluate(LIST)
    w6 = len(jira_writes(pg))
    pg.click('#btnStatusOfferKeep'); pg.wait_for_timeout(1500)
    out['t6'] = transitions(pg, w6)

    # 4. 100% with Move: Done, then locked.
    w4 = len(jira_writes(pg))
    pg.locator('#ganttBody tr.task-row[data-task-id="DEMO-40"] .td-progress-cell').click(); pg.wait_for_timeout(300)
    pg.locator('.progress-preset-btn[data-pct="100"]').first.click(); pg.wait_for_timeout(400)
    out['q4'] = pg.evaluate(QUESTION)
    pg.click('#btnStatusOfferMove'); pg.wait_for_timeout(1500)
    out['t4'] = transitions(pg, w4)
    out['chip4'] = chip(pg, 'DEMO-40')
    digit(pg, 'DEMO-40', '2')
    out['digit_on_done'] = pg.evaluate("document.querySelector('#ganttBody tr.task-row[data-task-id=\"DEMO-40\"] .progress-chip-text').textContent")
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    pg.locator('#ganttBody tr.task-row[data-task-id="DEMO-40"] .td-progress-cell').click(); pg.wait_for_timeout(400)
    out['picker_open_on_done'] = pg.evaluate("getComputedStyle(document.getElementById('progressPickerPopover')).display !== 'none'")
    out['flags'] = pg.evaluate("[...document.querySelectorAll('.flag')].map(f => f.textContent.trim())")[-1:]

    # 7. The task dialog: a Done item's progress is locked with the reason; choosing another status unlocks it.
    row = pg.locator('#ganttBody tr.task-row[data-task-id="DEMO-40"]')
    row.hover()
    row.locator('.row-more-actions-btn').first.click(force=True)
    pg.locator('.quick-menu-item[data-action="edit"]').first.click(); pg.wait_for_timeout(500)
    out['dialog_locked'] = pg.evaluate("[document.getElementById('editProgressInput').disabled, document.getElementById('editProgressLockNote').hidden, document.getElementById('editProgressLockNote').textContent]")
    pg.select_option('#editStatusSelect', 'IN_PROGRESS'); pg.wait_for_timeout(200)
    out['dialog_unlocked'] = pg.evaluate("[document.getElementById('editProgressInput').disabled, document.getElementById('editProgressLockNote').hidden]")
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    if pg.is_visible('.discard-prompt'):
        pg.click('.discard-prompt .btn-outline'); pg.wait_for_timeout(300)

    # 8. A transition Jira refuses: the progress is saved and the user is told why.
    pg.goto(base); pg.evaluate('localStorage.clear()'); pg.reload(); wait_rows(pg); pg.wait_for_timeout(500)
    digit(pg, 'DEMO-40', '3'); pg.keyboard.press('Enter'); pg.wait_for_timeout(400)
    pg.click('#btnStatusOfferMove'); pg.wait_for_timeout(1500)
    out['refused'] = pg.evaluate("document.body.innerText.includes('No workflow transition leads to in progress')")
    out['refused_chip'] = chip(pg, 'DEMO-40')
    b.close()
srv.shutdown()

ok = (
    out['q1'] == 'DEMO-40 is To Do in Jira. Also move it to In Progress?'
    and len(out['t1']) == 1 and '"21"' in out['t1'][0]
    and out['q2'] == 'DEMO-26 is To Do in Jira. Also move it to In Progress?' and out['t2'] == []
    and out['chip2'] and '50%' in out['chip2']['title']
    and out['q5'] and out['q5_closed'] and out['w5'] == []
    and out['q3'] == 'DEMO-40 is In Progress in Jira. Also move it to Done?' and out['t3'] == []
    and out['chip3'] and '100%, not Done in Jira' in out['chip3']['title'] and 'is-complete' not in out['chip3']['cls']
    and out['q6'] and out['q6'].startswith('The new progress does not match the Jira status of') and len(out['l6']) >= 2 and out['t6'] == []
    and out['q4'] == 'DEMO-40 is In Progress in Jira. Also move it to Done?' and len(out['t4']) == 1 and '"31"' in out['t4'][0]
    and out['chip4'] and 'is-complete' in out['chip4']['cls'] and 'is Done in Jira' in out['chip4']['title']
    and 'not saved' not in out['digit_on_done'] and not out['picker_open_on_done']
    and out['flags'] and 'is Done in Jira' in out['flags'][0]
    and out['dialog_locked'][0] is True and out['dialog_locked'][1] is False and 'is Done in Jira' in out['dialog_locked'][2]
    and out['dialog_unlocked'] == [False, True]
    and out['refused'] and out['refused_chip'] and '30%' in out['refused_chip']['title']
)
print(('PASS' if ok else 'FAIL') + ' progress and status: ' + json.dumps(out))
sys.exit(0 if ok else 1)
