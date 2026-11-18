"""Harness check: every row of the task dialog stays inside the dialog.

Found on the development site on 2026-11-08 (TASK-00003): in the task dialog, the "Apply" button of
the row "Parent in Jira" was outside the dialog at normal desktop width. The parent list shows work
item titles, and a long title made the list as wide as its longest choice, wider than the dialog.

The check opens the dialog of DEMO-26 at 1366 px and at 390 px, with the short titles of the fixture
and with long titles (the switch __harness_long_summaries). In each of the four cases:
- the dialog has no sideways scroll;
- no element of the dialog ends to the right of the dialog's content edge, or of its own panel;
- "Apply" is beside the parent list, inside the dialog, and takes a click at its centre.

A screenshot of each case goes to results/ (ignored by git).

Usage, from apps/cascadeplan/test/e2e:  python3 build_site.py && python3 e2e_task_dialog_layout_probe.py

Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import json
import sys
from playwright.sync_api import sync_playwright
from e2e import serve, wait_rows, CHROME, OUT

# Every element of the dialog against the content edge of its part (header, body, footer) and,
# inside a panel, against the content edge of the panel. Half a pixel of tolerance for rounding.
OVERFLOW = """(() => {
  const card = document.querySelector('#taskDetailModal .modal-card');
  const edge = (el) => {
    const s = getComputedStyle(el);
    return el.getBoundingClientRect().right - parseFloat(s.paddingRight) - parseFloat(s.borderRightWidth);
  };
  const name = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : (typeof el.className === 'string' && el.className ? '.' + el.className.split(' ')[0] : ''));
  const out = [];
  for (const part of card.querySelectorAll('.modal-header, .modal-body, .modal-footer')) {
    const partEdge = edge(part);
    for (const el of part.querySelectorAll('*')) {
      if (el.tagName === 'OPTION' || el.tagName === 'OPTGROUP') continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      const panel = el.closest('.ix-panel, .ix-panel-mb12');
      const limit = panel && panel !== el ? Math.min(partEdge, edge(panel)) : partEdge;
      if (r.right > limit + 0.5) out.push(name(el) + ' +' + Math.round(r.right - limit) + 'px');
    }
  }
  return { sidewaysScroll: card.scrollWidth - card.clientWidth, cardWidth: Math.round(card.getBoundingClientRect().width), outside: out };
})()"""

APPLY = """(() => {
  const btn = document.getElementById('btnApplyParent');
  const sel = document.getElementById('parentSelect');
  const card = document.querySelector('#taskDetailModal .modal-card');
  // Scroll down to the row only: a user must not need a sideways scroll to reach the button.
  btn.scrollIntoView({ block: 'center' });
  card.scrollLeft = 0;
  const r = btn.getBoundingClientRect(), s = sel.getBoundingClientRect();
  const c = card.getBoundingClientRect();
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return {
    insideDialog: r.left >= c.left && r.right <= c.right,
    besideList: r.left >= s.right - 0.5 && r.top < s.bottom && r.bottom > s.top,
    takesClick: hit === btn,
    enabled: !btn.disabled,
    listWidth: Math.round(s.width),
    choices: sel.options.length,
    longestChoice: Math.max(...[...sel.options].map(o => o.textContent.length)),
  };
})()"""


def open_dialog(pg, base, long_titles):
    pg.goto(base); pg.evaluate('localStorage.clear()')
    if long_titles:
        pg.evaluate("localStorage.setItem('__harness_long_summaries', '1')")
    pg.reload(); wait_rows(pg)
    # A script click: at 390 px the row's edit button is not in view.
    pg.evaluate("document.querySelector('#ganttBody tr.task-row[data-task-id=\"DEMO-26\"] .edit-modal-btn').click()")
    pg.wait_for_selector('#parentSelect', state='visible', timeout=10000)
    pg.wait_for_timeout(400)
    # Show the longest parent choice in the closed list. Nothing is written until "Apply".
    pg.evaluate("(() => { const s = document.getElementById('parentSelect'); s.selectedIndex = s.options.length - 1; })()")
    pg.wait_for_timeout(150)


srv = serve()
base = f'http://127.0.0.1:{srv.server_address[1]}/index.html'
OUT.mkdir(exist_ok=True)
cases = {}
failed = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, headless=True, args=['--no-sandbox'])
    for width, height in ((1366, 768), (390, 844)):
        for long_titles in (False, True):
            label = f"{width} px, {'long' if long_titles else 'short'} titles"
            pg = b.new_context(viewport={'width': width, 'height': height}).new_page()
            open_dialog(pg, base, long_titles)
            overflow = pg.evaluate(OVERFLOW)
            apply = pg.evaluate(APPLY)
            pg.wait_for_timeout(150)
            pg.screenshot(path=str(OUT / f"task-dialog-{width}-{'long' if long_titles else 'short'}.png"))
            pg.close()
            cases[label] = {'overflow': overflow, 'apply': apply}
            checks = {
                'no sideways scroll': overflow['sidewaysScroll'] <= 0,
                'nothing outside the dialog': not overflow['outside'],
                'Apply inside the dialog': apply['insideDialog'],
                'Apply beside the parent list': apply['besideList'],
                'Apply takes a click': apply['takesClick'] and apply['enabled'],
            }
            if long_titles:
                checks['the fixture gave a long parent choice'] = apply['longestChoice'] >= 100
            for check, passed in checks.items():
                print(('PASS ' if passed else 'FAIL ') + f'{label}: {check}')
                if not passed:
                    failed.append(f'{label}: {check}')
    b.close()
srv.shutdown()
print(json.dumps(cases))
print(('PASS' if not failed else 'FAIL') + f' task dialog layout: {len(failed)} failed check(s)')
sys.exit(0 if not failed else 1)
