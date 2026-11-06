# Copyright (c) 2026 Asymm Systems. All rights reserved.
#
# @author Fahim Farook
"""Review checks added on top of e2e.py (marketplace readiness review, 2026-11-05).

Runs against the real bundled frontend and real resolvers; only Forge is stubbed (KVS in
localStorage, a fake DEMO Jira). Each check prints PASS when the EXPECTED (correct) behaviour holds,
FAIL when it does not. A FAIL here is a finding, not a harness error, unless the detail says so.

R1  shorter bar after a drag (owner observation): optimistic render vs resolver response vs reload
R2  undo and redo after that move (does redo write the stale end?)
R3  three plans: a move in Plan C reaches Main and Plan B
R4  undo after a plan switch
R5  collapse at every level after a plan switch
R6  cascade started in Plan B, seen in the Main Plan
R7  conflict: two tabs on the same plan move the same bar
R8  due date rejected by the Jira screen

Copyright (c) 2026 Asymm Systems. @author Fahim Farook
"""
import json
import pathlib
import sys

from playwright.sync_api import sync_playwright

from e2e import serve, wait_rows, row_keys, kvs, record, shown as shared_dates, bar_dates, jira_writes, drag_bar, CHROME

OUT = pathlib.Path(__file__).resolve().parent / 'results-review'
results = []


def check(name, cond, detail=''):
    results.append({'check': name, 'pass': bool(cond), 'detail': detail})
    print(('PASS ' if cond else 'FAIL ') + name + (f'  [{detail}]' if detail else ''))


def width(pg, key):
    b = pg.locator(f'.bar-hit[data-task-id="{key}"]').bounding_box()
    return round(b['width'], 1) if b else None


def flags(pg):
    return pg.evaluate("[...document.querySelectorAll('.flag')].map(f => f.textContent.trim())")


def click_flag_action(pg, label):
    btn = pg.locator('.flag .flag-action', has_text=label).last
    if btn.count() == 0:
        return False
    btn.click()
    pg.wait_for_timeout(1200)
    return True


def open_plans(pg):
    pg.click('#planSelectorBtn')
    pg.wait_for_timeout(200)


def create_plan(pg, name):
    open_plans(pg)
    pg.fill('#newPlanNameInput', name)
    if not pg.is_checked('#cloneCurrentPlanCheckbox'):
        pg.check('#cloneCurrentPlanCheckbox')
    pg.click('#btnCreatePlan')
    wait_rows(pg)
    pg.wait_for_timeout(500)
    return pg.evaluate("localStorage.getItem('cp_active_plan_harness-cloud:DEMO')")


def switch_plan(pg, name):
    open_plans(pg)
    pg.locator('#plansListContainer').get_by_text(name, exact=True).first.click()
    wait_rows(pg)
    pg.wait_for_timeout(400)


def fresh(pg, base):
    pg.goto(base)
    pg.evaluate('localStorage.clear()')
    pg.reload()
    wait_rows(pg)


def day_dx(pg, key, days, bar_days=5):
    return width(pg, key) / bar_days * days


def main():
    OUT.mkdir(exist_ok=True)
    srv = serve()
    base = f'http://127.0.0.1:{srv.server_address[1]}/index.html'
    errors = []
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME, headless=True, args=['--no-sandbox'])
        ctx = b.new_context(viewport={'width': 1600, 'height': 900})
        pg = ctx.new_page()
        pg.on('pageerror', lambda e: errors.append(str(e)))
        fresh(pg, base)

        # ---- R1 shorter bar after a drag ------------------------------------------------------
        w0 = width(pg, 'DEMO-40')
        dx = day_dx(pg, 'DEMO-40', 7)
        drag_bar(pg, 'DEMO-40', dx)  # first move: Jira has no due date yet
        w1 = width(pg, 'DEMO-40')
        r1 = record(kvs(pg), 'default', 'DEMO-40')
        check('R1a first move (Jira had no due date) keeps the bar length', abs(w1 - w0) < 2, f'{w0} -> {w1} px')
        pg.screenshot(path=str(OUT / 'R1a-after-first-move.png'))
        # Second move: Jira now holds the due date of move 1. Delay the Jira PUT so the optimistic
        # render can be seen on its own.
        pg.evaluate("localStorage.setItem('__harness_put_delay_ms', '2500')")
        box = pg.locator('.bar-hit[data-task-id="DEMO-40"]').bounding_box()
        x, y = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
        pg.mouse.move(x, y); pg.mouse.down()
        for i in range(1, 11):
            pg.mouse.move(x + dx * i / 10, y)
        pg.mouse.up()
        pg.wait_for_timeout(500)
        w_optimistic = width(pg, 'DEMO-40')
        pg.screenshot(path=str(OUT / 'R1b-optimistic-render.png'))
        pg.wait_for_timeout(3500)
        pg.evaluate("localStorage.removeItem('__harness_put_delay_ms')")
        w_response = width(pg, 'DEMO-40')
        pg.screenshot(path=str(OUT / 'R1c-after-resolver-response.png'))
        r2 = record(kvs(pg), 'default', 'DEMO-40')
        check('R1b optimistic render keeps the bar length', abs(w_optimistic - w0) < 2, f'{w0} -> {w_optimistic} px')
        check('R1c bar length after the resolver response equals the saved dates', abs(w_response - w0) < 2,
              f'{w0} -> {w_response} px; saved {r2["startDate"]}..{r2["endDate"]}')
        pg.reload(); wait_rows(pg)
        w_reload = width(pg, 'DEMO-40')
        pg.screenshot(path=str(OUT / 'R1d-after-reload.png'))
        check('R1d after a reload the bar length is correct', abs(w_reload - w0) < 2, f'{w_reload} px')

        # ---- R2 undo and redo of a move whose response was stale ------------------------------
        pg.locator('.bar-hit[data-task-id="DEMO-40"]').scroll_into_view_if_needed()
        pg.wait_for_timeout(300)
        drag_bar(pg, 'DEMO-40', -dx)  # move 3 (Jira has a due date, so the response is stale again)
        r3 = record(kvs(pg), 'default', 'DEMO-40')
        check('R2 setup: move 3 was saved', r3['startDate'] != r2['startDate'], f'{r2["startDate"]} -> {r3["startDate"]}; flags {flags(pg)}')
        jw0 = len(jira_writes(pg))
        undone = click_flag_action(pg, 'Undo')
        r4 = record(kvs(pg), 'default', 'DEMO-40')
        check('R2a Undo restores the dates before the move', undone and r4['startDate'] == r2['startDate'] and r4['endDate'] == r2['endDate'],
              f'undo={undone}; before move {r2["startDate"]}..{r2["endDate"]}; after undo {r4["startDate"]}..{r4["endDate"]}')
        redone = click_flag_action(pg, 'Redo')
        r5 = record(kvs(pg), 'default', 'DEMO-40')
        check('R2b Redo re-applies the moved dates (both ends)', redone and r5['startDate'] == r3['startDate'] and r5['endDate'] == r3['endDate'],
              f'redo={redone}; move {r3["startDate"]}..{r3["endDate"]}; after redo {r5["startDate"]}..{r5["endDate"]}')
        check('R2c Undo and Redo each write the due date to Jira', len(jira_writes(pg)) - jw0 >= 2, str(jira_writes(pg)[jw0:])[:300])

        # ---- R3 three plans -------------------------------------------------------------------
        plan_b = create_plan(pg, 'Plan B')
        plan_c = create_plan(pg, 'Plan C')
        before30 = record(kvs(pg), plan_c, 'DEMO-30')
        drag_bar(pg, 'DEMO-30', day_dx(pg, 'DEMO-30', 7))
        s = kvs(pg)
        c30, b30, m30 = record(s, plan_c, 'DEMO-30'), shared_dates(pg, plan_b, 'DEMO-30'), shared_dates(pg, 'default', 'DEMO-30')
        check('R3a a Plan C move changes DEMO-30', c30['startDate'] != before30['startDate'], f'{before30["startDate"]} -> {c30["startDate"]}')
        check('R3b Plan B and the Main Plan get the same dates', (b30['startDate'], b30['endDate']) == (c30['startDate'], c30['endDate']) == (m30['startDate'], m30['endDate']),
              f'C {c30["startDate"]}..{c30["endDate"]} B {b30["startDate"]}..{b30["endDate"]} M {m30["startDate"]}..{m30["endDate"]}')
        pg.screenshot(path=str(OUT / 'R3-three-plans-plan-c.png'))

        # ---- R4 undo after a plan switch ------------------------------------------------------
        switch_plan(pg, 'Plan B')
        b_before = record(kvs(pg), plan_b, 'DEMO-30')
        pg.locator('#ganttBody').click(position={'x': 5, 'y': 5})
        pg.keyboard.press('Control+z')
        pg.wait_for_timeout(1200)
        b_after = record(kvs(pg), plan_b, 'DEMO-30')
        check('R4 (observation) Ctrl+Z in Plan B after a Plan C move changes nothing',
              (b_after['startDate'], b_after['version']) == (b_before['startDate'], b_before['version']), f'{b_before["startDate"]} v{b_before["version"]} -> {b_after["startDate"]} v{b_after["version"]}')

        # ---- R5 collapse at every level after a plan switch -----------------------------------
        for k in ('DEMO-9', 'DEMO-26'):
            pg.click(f'.tree-toggle-btn[data-parent-key="{k}"]'); pg.wait_for_timeout(250)
        rows_b = row_keys(pg)
        switch_plan(pg, 'Main Plan')
        rows_main = row_keys(pg)
        pg.click('.tree-toggle-btn[data-parent-key="DEMO-1"]'); pg.wait_for_timeout(250)
        rows_main2 = row_keys(pg)
        switch_plan(pg, 'Plan C')
        rows_c = row_keys(pg)
        toggles_c = pg.evaluate("Object.fromEntries([...document.querySelectorAll('.tree-toggle-btn')].map(b => [b.dataset.parentKey, b.getAttribute('aria-expanded')]))")
        check('R5a collapsing story and task in Plan B hides their sub-tasks', all(k not in rows_b for k in ('DEMO-30', 'DEMO-29', 'DEMO-28', 'DEMO-31')), str(rows_b))
        check('R5b (observation) collapsed state after switching to the Main Plan', True, f'main rows {rows_main}')
        check('R5c collapsing the epic in Main hides story and its sub-tasks', all(k not in rows_main2 for k in ('DEMO-9', 'DEMO-30', 'DEMO-29')), str(rows_main2))
        check('R5d toggle state agrees with the visible rows after a switch to Plan C',
              all((toggles_c.get(k) == 'false') == (any(c in rows_c for c in kids) is False) for k, kids in
                  (('DEMO-9', ('DEMO-30', 'DEMO-29')), ('DEMO-26', ('DEMO-28', 'DEMO-31'))) if k in rows_c),
              f'rows {rows_c} toggles {toggles_c}')
        pg.screenshot(path=str(OUT / 'R5-collapse-after-switch.png'))

        # ---- R6 cascade started in Plan B, seen in Main ---------------------------------------
        fresh(pg, base)
        plan_b = create_plan(pg, 'Plan B')
        # Plan B only: DEMO-40 starts together with DEMO-31 (trigger 0%).
        pg.evaluate(f"""(() => {{
          const m = JSON.parse(localStorage.getItem('__harness_kvs'));
          const k = Object.keys(m).find(k => k.startsWith('cp:10000:plan:{plan_b}:we:') && m[k].issueKey === 'DEMO-40');
          m[k].assocs = [{{ workEffortIdFrom: 'DEMO-31', workEffortIdTo: 'DEMO-40', workEffortAssocTypeId: 'WORK_EFF_PRECEDENCY', fromDate: '2026-11-01', attrs: {{ triggerPercent: 0 }} }}];
          localStorage.setItem('__harness_kvs', JSON.stringify(m));
        }})()""")
        pg.reload(); wait_rows(pg)
        m40_before = record(kvs(pg), 'default', 'DEMO-40')
        jw0 = len(jira_writes(pg))
        drag_bar(pg, 'DEMO-31', day_dx(pg, 'DEMO-31', 7))
        s = kvs(pg)
        b31, b40, m40 = record(s, plan_b, 'DEMO-31'), record(s, plan_b, 'DEMO-40'), shared_dates(pg, 'default', 'DEMO-40')
        check('R6a the cascade moved DEMO-40 in Plan B to the new start of DEMO-31', b40['startDate'] == b31['startDate'], f'31 {b31["startDate"]} / 40 {b40["startDate"]}')
        check('R6b the Main Plan shows the cascaded dates of DEMO-40', (m40['startDate'], m40['endDate']) == (b40['startDate'], b40['endDate']),
              f'main {m40_before["startDate"]} -> {m40["startDate"]}..{m40["endDate"]}')
        check('R6c the cascaded due date went to Jira', any('DEMO-40' in w and b40['endDate'] in w for w in jira_writes(pg)[jw0:]), str(jira_writes(pg)[jw0:])[:300])
        switch_plan(pg, 'Main Plan')
        pg.screenshot(path=str(OUT / 'R6-cascade-from-plan-b-seen-in-main.png'))
        check('R6d the Main Plan bar of DEMO-40 shows the cascaded dates on screen', bar_dates(pg, 'DEMO-40') == (b40['startDate'], b40['endDate']),
              f"{bar_dates(pg, 'DEMO-40')} / B {b40['startDate']}..{b40['endDate']}")

        # ---- R7 conflict: two tabs, same plan, same bar ---------------------------------------
        pg2 = ctx.new_page()
        pg2.on('pageerror', lambda e: errors.append('tab2: ' + str(e)))
        pg2.goto(base); wait_rows(pg2)
        dx29 = day_dx(pg, 'DEMO-29', 7)
        drag_bar(pg, 'DEMO-29', dx29)
        tab1 = record(kvs(pg), 'default', 'DEMO-29')
        jw0 = len(jira_writes(pg))
        drag_bar(pg2, 'DEMO-29', dx29 * 2)
        tab2_flags = flags(pg2)
        after = record(kvs(pg), 'default', 'DEMO-29')
        pg2.screenshot(path=str(OUT / 'R7-conflict-tab2.png'))
        check('R7a the stale tab is refused and the first write survives', (after['startDate'], after['version']) == (tab1['startDate'], tab1['version']),
              f'tab1 {tab1["startDate"]} v{tab1["version"]} / final {after["startDate"]} v{after["version"]}')
        check('R7b the stale tab shows the conflict message', any('changed' in f.lower() for f in tab2_flags), str(tab2_flags)[:300])
        check('R7c the stale tab wrote nothing to Jira', not any('DEMO-29' in w for w in jira_writes(pg)[jw0:]), str(jira_writes(pg)[jw0:])[:200])
        bar2 = pg2.locator('.bar-hit[data-task-id="DEMO-29"]').bounding_box()
        bar1 = pg.locator('.bar-hit[data-task-id="DEMO-29"]').bounding_box()
        check('R7d after the conflict the stale tab shows the saved position', bar2 and bar1 and abs(bar2['x'] - bar1['x']) < 2, f'tab2 x={bar2 and round(bar2["x"])} tab1 x={bar1 and round(bar1["x"])}')
        pg2.close()

        # ---- R8 due date rejected by the Jira screen ------------------------------------------
        pg.evaluate("localStorage.setItem('__harness_reject_due', JSON.stringify(['DEMO-29']))")
        pg.reload(); wait_rows(pg)
        before29 = record(kvs(pg), 'default', 'DEMO-29')
        jira_due_before = pg.evaluate("JSON.parse(localStorage.getItem('__harness_jira_due') || '{}')['DEMO-29'] || null")
        drag_bar(pg, 'DEMO-29', day_dx(pg, 'DEMO-29', 7))
        f8 = flags(pg)
        pg.screenshot(path=str(OUT / 'R8a-due-rejected-flag.png'))
        pg.click('#btnChanges'); pg.wait_for_timeout(300)
        changes = pg.evaluate("[...document.querySelectorAll('#changesBody tr')].map(r => r.textContent.trim()).slice(-5)")
        pg.screenshot(path=str(OUT / 'R8b-changes-panel.png'))
        pg.click('#btnCloseChanges')
        saved = record(kvs(pg), 'default', 'DEMO-29')
        pg.reload(); wait_rows(pg)
        shown = pg.evaluate("""(() => { const h = document.querySelector('.bar-hit[data-task-id="DEMO-29"]'); return h ? h.getAttribute('aria-label') || h.title || '' : ''; })()""")
        pg.screenshot(path=str(OUT / 'R8c-after-reload.png'))
        check('R8a the user is told the due date was not written', any('due date' in f.lower() or 'not' in f.lower() for f in f8) or any('due' in c.lower() for c in changes),
              f'flags {str(f8)[:200]} changes {str(changes)[:300]}')
        # F-19: when Jira refuses the due date, the task keeps its old dates, so the planner and Jira agree.
        check('R8b (D3 edge a, F-19) a refused due date leaves the task on its old dates', saved['startDate'] == before29['startDate'] and saved['endDate'] == before29['endDate'],
              f'KVS {saved["startDate"]}..{saved["endDate"]} (before {before29["startDate"]}..{before29["endDate"]}), Jira due {jira_due_before}; bar after reload: {shown[:120]}')
        b.close()
    srv.shutdown()
    check('0 no page errors', not errors, str(errors)[:300])
    (OUT / 'e2e_review.json').write_text(json.dumps({'results': results}, indent=1))
    failed = [r for r in results if not r['pass']]
    print(f'{len(results) - len(failed)}/{len(results)} expected behaviours held')
    sys.exit(0)


if __name__ == '__main__':
    main()
