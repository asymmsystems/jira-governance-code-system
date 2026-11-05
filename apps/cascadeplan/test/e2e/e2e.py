"""End-to-end check of the four CascadePlan defects in headless Chrome, against the real bundled
frontend and the real resolvers (only the Forge platform is stubbed; KVS lives in localStorage).

1. Refresh keeps the active plan.
2. Moving a bar works on any plan, twice in a row. Jira is the single truth for a task: a move in any
   plan writes the due date to Jira and the same dates to every plan, and a due date changed directly
   in Jira shows in every plan.
3. Row hover does not cover the bars.
4. Parents with child rows have a toggle; a collapse hides the descendants and survives re-renders.

Copyright (c) 2026 Asymm Systems. @author Fahim Farook
"""
import functools
import http.server
import json
import pathlib
import sys
import threading

from playwright.sync_api import sync_playwright

SITE = pathlib.Path(__file__).resolve().parent / 'site'
OUT = pathlib.Path(__file__).resolve().parent / 'results'
CHROME = '/opt/google/chrome/chrome'
results = []


def check(name, cond, detail=''):
    results.append({'check': name, 'pass': bool(cond), 'detail': detail})
    print(('PASS ' if cond else 'FAIL ') + name + (f'  [{detail}]' if detail else ''))


def serve():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(SITE))
    handler.log_message = lambda *a: None
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def wait_rows(pg):
    pg.wait_for_function("document.querySelectorAll('#ganttBody tr.task-row').length > 0", timeout=30000)
    pg.wait_for_timeout(400)


def row_keys(pg):
    return pg.evaluate("[...document.querySelectorAll('#ganttBody tr.task-row')].map(r => r.dataset.taskId)")


def toggles(pg):
    return pg.evaluate("[...document.querySelectorAll('.tree-toggle-btn')].map(b => b.dataset.parentKey)")


def kvs(pg):
    return pg.evaluate("JSON.parse(localStorage.getItem('__harness_kvs') || '{}')")


def record(store, plan_id, key):
    prefix = 'cp:10000:' + (f'plan:{plan_id}:' if plan_id and plan_id != 'default' else '') + 'we:'
    for k, v in store.items():
        if k.startswith(prefix) and v.get('issueKey') == key:
            # Stored as a WorkEffort record (B-24): estimated start and completion dates.
            e = v.get('effort') or {}
            return dict(v, startDate=e.get('estimatedStartDate'), endDate=e.get('estimatedCompletionDate'))
    return None


def shown(pg, plan_id, key):
    """The dates a plan shows for a task (ADR-008): the shared issue property when it exists, else the plan record."""
    prop = pg.evaluate("JSON.parse(localStorage.getItem('__harness_jira_props') || '{}')").get(key, {}).get('cascadeplan.dates')
    if prop is not None:
        return {'startDate': prop.get('startDate'), 'endDate': prop.get('endDate')}
    rec = record(kvs(pg), plan_id, key) or {}
    return {'startDate': rec.get('startDate'), 'endDate': rec.get('endDate')}


def bar_dates(pg, key):
    """The start and end the bar's accessible label shows on screen."""
    import re
    label = pg.locator(f'.bar-hit[data-task-id="{key}"]').get_attribute('aria-label') or ''
    m = re.search(r'(\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})', label)
    return (m.group(1), m.group(2)) if m else (None, None)


def jira_writes(pg):
    return pg.evaluate("JSON.parse(localStorage.getItem('__harness_jira_writes') || '[]')")


def drag_bar(pg, key, dx):
    box = pg.locator(f'.bar-hit[data-task-id="{key}"]').bounding_box()
    x, y = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
    pg.mouse.move(x, y)
    pg.mouse.down()
    for i in range(1, 11):
        pg.mouse.move(x + dx * i / 10, y)
    pg.mouse.up()
    pg.wait_for_timeout(900)


def day_px(pg):
    return pg.evaluate("""(() => {
      const a = document.querySelector('.bar-hit[data-task-id="DEMO-40"]');
      return a ? null : null; })()""")


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
        pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' and 'favicon' not in m.text else None)
        pg.goto(base)
        pg.evaluate('localStorage.clear()')
        pg.reload()
        wait_rows(pg)
        print('rows:', row_keys(pg))

        # ---- Issue 4: toggles and collapse -------------------------------------------------
        t = sorted(toggles(pg))
        check('4a toggle on every parent with child rows (epic, story, task)', t == ['DEMO-1', 'DEMO-26', 'DEMO-9'], str(t))
        pg.click('.tree-toggle-btn[data-parent-key="DEMO-9"]')
        pg.wait_for_timeout(300)
        rk = row_keys(pg)
        check('4b collapsing DEMO-9 hides DEMO-30 and DEMO-29', 'DEMO-30' not in rk and 'DEMO-29' not in rk and 'DEMO-9' in rk, str(rk))
        aria = pg.get_attribute('.tree-toggle-btn[data-parent-key="DEMO-9"]', 'aria-expanded')
        check('4c toggle reports aria-expanded=false when collapsed', aria == 'false', str(aria))
        pg.click('.tree-toggle-btn[data-parent-key="DEMO-26"]')
        pg.wait_for_timeout(300)
        rk = row_keys(pg)
        check('4d collapsing task DEMO-26 hides DEMO-28 and DEMO-31', 'DEMO-28' not in rk and 'DEMO-31' not in rk, str(rk))
        # A re-render (a bar move returns a new plan) must keep both collapsed.
        drag_bar(pg, 'DEMO-40', 0)  # no-op click first to settle hover
        pg.click('#refreshBtn')
        wait_rows(pg)
        rk = row_keys(pg)
        check('4e collapse survives a full reload of the plan (renderPlan)', all(k not in rk for k in ('DEMO-30', 'DEMO-29', 'DEMO-28', 'DEMO-31')), str(rk))
        pg.click('.tree-toggle-btn[data-parent-key="DEMO-1"]')
        pg.wait_for_timeout(300)
        rk = row_keys(pg)
        check('4f collapsing the epic hides its story', 'DEMO-9' not in rk and 'DEMO-1' in rk, str(rk))
        for k in ('DEMO-1', 'DEMO-9', 'DEMO-26'):
            pg.click(f'.tree-toggle-btn[data-parent-key="{k}"]')
            pg.wait_for_timeout(250)
        rk = row_keys(pg)
        check('4g expanding again shows every row', all(k in rk for k in ('DEMO-9', 'DEMO-30', 'DEMO-29', 'DEMO-28', 'DEMO-31')), str(rk))

        # ---- Issue 3: hover does not cover bars --------------------------------------------
        hov = pg.evaluate("""(() => {
          const hit = document.querySelector('.bar-hit[data-task-id="DEMO-40"]');
          const r = hit.getBoundingClientRect();
          const cv = document.querySelector('canvas.timeline-canvas, #ganttWrapper canvas');
          const cr = cv.getBoundingClientRect();
          const dpr = cv.width / cr.width;
          const x = Math.round((r.left + r.width / 2 - cr.left) * dpr), y = Math.round((r.top + r.height / 2 - cr.top) * dpr);
          return { x: r.left + r.width / 2, y: r.top + r.height / 2, cx: x, cy: y };
        })()""")
        px = lambda: pg.evaluate(f"""(() => {{ const cv = document.querySelector('canvas.timeline-canvas, #ganttWrapper canvas');
          return [...cv.getContext('2d').getImageData({hov['cx']}, {hov['cy']}, 1, 1).data]; }})()""")
        before = px()
        # Hover the row on its data cell, away from the bar.
        row_box = pg.locator('tr.task-row[data-task-id="DEMO-40"] td.td-task-summary').bounding_box()
        pg.mouse.move(row_box['x'] + 20, row_box['y'] + row_box['height'] / 2)
        pg.wait_for_timeout(300)
        after = px()
        top = pg.evaluate(f"document.elementFromPoint({hov['x']}, {hov['y']}).className")
        track_bg = pg.evaluate("getComputedStyle(document.querySelector('tr.task-row[data-task-id=\"DEMO-40\"] td.timeline-track-cell')).backgroundColor")
        row_z = pg.evaluate("getComputedStyle(document.querySelector('tr.task-row[data-task-id=\"DEMO-40\"]')).zIndex")
        hovered = pg.evaluate("document.querySelector('tr.task-row[data-task-id=\"DEMO-40\"]').matches(':hover, .is-hovered')")
        check('3a row is hovered', hovered)
        check('3b bar pixel identical with and without row hover', before == after and before[3] > 0, f'{before} -> {after}')
        check('3c the bar hit element is the top element at the bar centre while hovered', 'bar-hit' in str(top), str(top))
        check('3d timeline cell stays transparent while hovered', track_bg in ('rgba(0, 0, 0, 0)', 'transparent'), track_bg)
        check('3e hovered row is not lifted above the canvas', row_z in ('auto', '0'), row_z)
        pg.screenshot(path=str(OUT / 'hover.png'))

        # ---- Issue 1: plan persistence across refresh --------------------------------------
        pg.click('#planSelectorBtn')
        pg.fill('#newPlanNameInput', 'Plan B')
        if not pg.is_checked('#cloneCurrentPlanCheckbox'):
            pg.check('#cloneCurrentPlanCheckbox')
        pg.click('#btnCreatePlan')
        wait_rows(pg)
        pg.wait_for_timeout(500)
        label = pg.inner_text('#planSelectorLabel')
        saved = pg.evaluate("localStorage.getItem('cp_active_plan_harness-cloud:DEMO')")
        check('1a creating Plan B switches to it and saves it per project', 'Plan B' in label and saved and saved.startswith('plan-'), f'{label} / {saved}')
        pg.reload()
        wait_rows(pg)
        label = pg.inner_text('#planSelectorLabel')
        check('1b a browser refresh reopens Plan B', 'Plan B' in label, label)
        plan_b = saved

        # ---- Issue 2: moves on the scenario plan -------------------------------------------
        store = kvs(pg)
        main_before = json.dumps({k: v for k, v in store.items() if k.startswith('cp:10000:we:')}, sort_keys=True)
        b40 = record(store, plan_b, 'DEMO-40')
        writes0 = len(jira_writes(pg))
        track = pg.evaluate("document.querySelector('td.timeline-track-cell').getBoundingClientRect().width")
        width = pg.locator('.bar-hit[data-task-id="DEMO-40"]').bounding_box()['width']
        # DEMO-40 lasts 5 days; move by about 7 days at the current zoom.
        dx = width / 5 * 7
        drag_bar(pg, 'DEMO-40', dx)
        store = kvs(pg)
        b40a = record(store, plan_b, 'DEMO-40')
        check('2a first move on Plan B is saved in Plan B', b40a and b40a['version'] == b40['version'] + 1 and b40a.get('startDate') != b40.get('startDate'),
              f"{b40.get('startDate')} v{b40['version']} -> {b40a.get('startDate')} v{b40a['version']}")
        drag_bar(pg, 'DEMO-40', dx)
        store = kvs(pg)
        b40b = record(store, plan_b, 'DEMO-40')
        check('2b second move of the same bar also saves (no stale-version conflict)', b40b['version'] == b40a['version'] + 1 and b40b.get('startDate') != b40a.get('startDate'),
              f"{b40a.get('startDate')} -> {b40b.get('startDate')}")
        flags = pg.evaluate("[...document.querySelectorAll('.flag, [role=alert], .cp-flag')].map(f => f.textContent.trim()).filter(Boolean)")
        check('2c no conflict message shown', not any('changed' in f and 'moment ago' in f for f in flags), str(flags)[:200])
        m40b = shown(pg, 'default', 'DEMO-40')
        check('2d a Plan B move gives the Main Plan the same dates', m40b['startDate'] == b40b['startDate'] and m40b['endDate'] == b40b['endDate'],
              f"main {m40b['startDate']}..{m40b['endDate']} / B {b40b['startDate']}..{b40b['endDate']}")
        b_writes = jira_writes(pg)[writes0:]
        check('2e a Plan B move writes its due date to Jira', any('PUT /rest/api/3/issue/DEMO-40' in w and f'"duedate":"{b40b["endDate"]}"' in w for w in b_writes), str(b_writes)[-300:])
        pg.reload()
        wait_rows(pg)
        x_after_reload = pg.locator('.bar-hit[data-task-id="DEMO-40"]').bounding_box()['x']
        label = pg.inner_text('#planSelectorLabel')
        check('2f after refresh Plan B still shows the moved bar', 'Plan B' in label and record(kvs(pg), plan_b, 'DEMO-40')['startDate'] == b40b['startDate'], label)

        # Main Plan: moves still work and write the due date to Jira.
        # The plan switcher select is hidden in the toolbar; the popover list is the visible control.
        pg.click('#planSelectorBtn')
        pg.locator('#plansListContainer').get_by_text('Main Plan', exact=True).first.click()
        wait_rows(pg)
        pg.wait_for_timeout(400)
        check('2g switching back to Main Plan saves that choice', pg.evaluate("localStorage.getItem('cp_active_plan_harness-cloud:DEMO')") == 'default')
        check('2g2 the Main Plan bar shows the dates of the Plan B move', bar_dates(pg, 'DEMO-40') == (b40b['startDate'], b40b['endDate']),
              f"{bar_dates(pg, 'DEMO-40')} / B {b40b['startDate']}..{b40b['endDate']}")
        m40 = record(kvs(pg), 'default', 'DEMO-40')
        writes_main0 = len(jira_writes(pg))
        calls0 = len(pg.evaluate('window.__calls || []'))
        box_before = pg.locator('.bar-hit[data-task-id="DEMO-40"]').bounding_box()
        # The two Plan B moves also moved this bar two weeks right, to the edge of the view: move it back.
        pg.locator('.bar-hit[data-task-id="DEMO-40"]').scroll_into_view_if_needed()
        drag_bar(pg, 'DEMO-40', -dx)
        m40a = record(kvs(pg), 'default', 'DEMO-40')
        new_writes = jira_writes(pg)[writes_main0:]
        dbg = {'box': box_before, 'vw': pg.viewport_size, 'calls': pg.evaluate('window.__calls || []')[calls0:][-4:],
               'flags': pg.evaluate("[...document.querySelectorAll('.flag, [role=alert], .cp-flag')].map(f => f.textContent.trim()).filter(Boolean)")}
        check('2h a Main Plan move saves in the Main Plan', m40a['version'] == m40['version'] + 1 and m40a['startDate'] != m40['startDate'],
              f"{m40['startDate']} v{m40['version']} -> {m40a['startDate']} v{m40a['version']} {json.dumps(dbg)[:600]}")
        check('2i a Main Plan move writes the due date to Jira', any('PUT /rest/api/3/issue/DEMO-40' in w and f'"duedate":"{m40a["endDate"]}"' in w for w in new_writes), str(new_writes)[:200])
        b40c = shown(pg, plan_b, 'DEMO-40')
        check('2j a Main Plan move gives Plan B the same dates', b40c['startDate'] == m40a['startDate'] and b40c['endDate'] == m40a['endDate'],
              f"B {b40c['startDate']}..{b40c['endDate']} / main {m40a['startDate']}..{m40a['endDate']}")

        # A due date changed directly in Jira shows in every plan (one week later: the bar gets longer).
        pg.reload()
        wait_rows(pg)
        w_before = pg.locator('.bar-hit[data-task-id="DEMO-40"]').bounding_box()['width']
        later = pg.evaluate(f"new Date(Date.parse('{m40a['endDate']}T00:00:00Z') + 7 * 86400000).toISOString().slice(0, 10)")
        pg.evaluate(f"localStorage.setItem('__harness_jira_due', JSON.stringify({{...JSON.parse(localStorage.getItem('__harness_jira_due') || '{{}}'), 'DEMO-40': '{later}'}}))")
        jira_writes_before_read = len(jira_writes(pg))
        pg.reload()
        wait_rows(pg)
        w_main = pg.locator('.bar-hit[data-task-id="DEMO-40"]').bounding_box()['width']
        check('2k a due date changed in Jira lengthens the bar in the Main Plan', w_main > w_before + 10, f'{w_before:.0f} -> {w_main:.0f} px')
        pg.click('#planSelectorBtn')
        pg.locator('#plansListContainer').get_by_text('Plan B', exact=True).first.click()
        wait_rows(pg)
        pg.wait_for_timeout(400)
        w_b = pg.locator('.bar-hit[data-task-id="DEMO-40"]').bounding_box()['width']
        check('2l ... and the same bar shows in Plan B', abs(w_b - w_main) < 1, f'B {w_b:.0f} px / main {w_main:.0f} px')
        check('2m reading the changed due date writes nothing to Jira', len(jira_writes(pg)) == jira_writes_before_read, str(jira_writes(pg)[jira_writes_before_read:])[:200])

        # A plan deleted elsewhere: the saved id falls back to the Main Plan on refresh.
        pg.evaluate(f"localStorage.setItem('cp_active_plan_harness-cloud:DEMO', 'plan-gone-0000')")
        pg.reload()
        wait_rows(pg)
        label = pg.inner_text('#planSelectorLabel')
        check('1c a saved plan that no longer exists opens the Main Plan', 'Main' in label, label)
        check('1d ... and the saved choice is reset to the Main Plan', pg.evaluate("localStorage.getItem('cp_active_plan_harness-cloud:DEMO')") == 'default')

        calls = pg.evaluate('window.__calls || []')
        pg.screenshot(path=str(OUT / 'final.png'))
        b.close()
    srv.shutdown()
    real_errors = [e for e in errors if 'Failed to load resource' not in e]
    check('0 no page errors', not real_errors, str(real_errors)[:300])
    (OUT / 'e2e.json').write_text(json.dumps({'results': results, 'calls_tail': calls[-15:]}, indent=1))
    failed = [r for r in results if not r['pass']]
    print(f'{len(results) - len(failed)}/{len(results)} passed')
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
