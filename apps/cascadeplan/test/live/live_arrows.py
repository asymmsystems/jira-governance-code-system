"""Live check of the owner report on bars and arrows, on the development site, project DEMO.

On a hovered bar, the elements at its right and left edges are the resize handles, and the link
ports start where the handles end. Every drawn dependency arrow has a label button. A click on the
line of an arrow (away from its label) opens the link editor, which is then cancelled.

Writes nothing.

Needs CASCADEPLAN_LIVE_COOKIES (see live_common.py).

Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import json

from playwright.sync_api import sync_playwright

from live_common import open_browser, SITE, OUT, planner_frame

URL = SITE + '/jira/servicedesk/projects/DEMO/apps/cac8499e-e92e-4ba6-95cc-af398b1be791/5dfcdd60-51aa-4ea9-a5e2-c94d7e294677'
out = {}
with sync_playwright() as p:
    b, ctx = open_browser(p)
    ctx.add_init_script('window.__cpPerf = true;')
    pg = ctx.new_page()
    pg.goto(URL, wait_until='domcontentloaded', timeout=150000)
    f = planner_frame(pg, 150000)
    f.wait_for_function("document.querySelectorAll('#ganttBody tr.task-row').length > 0", timeout=90000)
    pg.wait_for_timeout(4000)

    # A resizable bar (it has handles) in view.
    key = f.evaluate("""() => { const h = [...document.querySelectorAll('.bar-hit')].find(x => x.querySelector('.bar-handle-right'));
      return h ? h.dataset.taskId : null; }""")
    out['bar'] = key
    hit = f.locator(f'.bar-hit[data-task-id="{key}"]')
    hit.scroll_into_view_if_needed()
    box = hit.bounding_box()
    pg.mouse.move(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
    pg.wait_for_timeout(600)
    out['edges'] = f.evaluate("""(key) => {
      const hit = document.querySelector(`.bar-hit[data-task-id="${key}"]`);
      const r = (el) => el.getBoundingClientRect();
      const bar = r(hit), rh = r(hit.querySelector('.bar-handle-right')), rp = r(hit.querySelector('.bar-link-port-right'));
      const lh = r(hit.querySelector('.bar-handle-left')), lp = r(hit.querySelector('.bar-link-port-left'));
      const at = (x) => { const e = document.elementFromPoint(x, bar.top + bar.height / 2); return e && e.className; };
      return { rightGap: Math.round(rp.left - rh.right), leftGap: Math.round(lh.left - lp.right), atRightEdge: at(bar.right - 2), atLeftEdge: at(bar.left + 2) };
    }""", key)
    pg.screenshot(path=str(OUT / 'arrows-hover.png'))

    pg.mouse.move(5, 5); pg.wait_for_timeout(600)
    out['arrows'] = f.evaluate("(window.__cpArrows || []).map(a => a.predecessorKey + '>' + a.successorKey).sort()")
    out['badges'] = f.evaluate("[...document.querySelectorAll('#depLinksLayer .dep-link-badge')].map(b => b.dataset.pred + '>' + b.dataset.succ).sort()")

    # A click on a line, a quarter of the way along its first visible arrow.
    target = f.evaluate("""() => {
      const w = document.getElementById('ganttWrapper'), wr = w.getBoundingClientRect();
      for (const a of (window.__cpArrows || [])) {
        const pt = a.path[Math.floor(a.path.length / 4)];
        const x = wr.left + pt[0] - w.scrollLeft, y = wr.top + pt[1] - w.scrollTop;
        const e = document.elementFromPoint(x, y);
        if (e && !e.closest('.bar-hit, .dep-link-badge')) return { x, y, link: a.predecessorKey + '>' + a.successorKey };
      }
      return null;
    }""")
    out['line_target'] = target
    if target:
        # The frame's client coordinates are offset by the iframe's position in the page.
        frame_el = f.frame_element().bounding_box()
        pg.mouse.click(frame_el['x'] + target['x'], frame_el['y'] + target['y'])
        pg.wait_for_timeout(1000)
        out['editor_open'] = f.evaluate("!document.getElementById('depEditPopover').hidden")
        out['editor_parties'] = f.evaluate("document.getElementById('depEditParties').innerText.split('\\n')[0]")
        pg.screenshot(path=str(OUT / 'arrows-editor.png'))
        f.click('#btnCancelDepEdit')
    b.close()

e = out['edges']
ok = (e['rightGap'] >= 0 and e['leftGap'] >= 0 and 'bar-handle-right' in (e['atRightEdge'] or '') and 'bar-handle-left' in (e['atLeftEdge'] or '')
      and out['arrows'] and out['arrows'] == out['badges'] and out.get('editor_open'))
print(('PASS' if ok else 'FAIL') + ' live bars and arrows: ' + json.dumps(out, indent=1))
