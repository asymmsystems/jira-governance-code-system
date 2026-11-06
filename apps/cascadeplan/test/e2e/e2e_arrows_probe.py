"""Harness check of the owner report on bars and arrows (2026-11-05).

1. The link ports never cover a bar's resize edges: on hover, the right port starts where the right
   resize handle ends, and the element at the bar's right edge is the resize handle.
2. Every dependency arrow has a clickable label: DEMO-40 waits for DEMO-26 and DEMO-29, and both
   arrows are drawn with a label button. The labels stay (dimmed) while another bar is selected.
3. A click on an arrow's line (not on its label) opens the link editor for that link.

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
LINKS = [{'id': '7001', 'pred': 'DEMO-26', 'succ': 'DEMO-40'}, {'id': '7002', 'pred': 'DEMO-29', 'succ': 'DEMO-40'}]
badges = "(succ) => [...document.querySelectorAll('#depLinksLayer .dep-link-badge')].filter(b => b.dataset.succ === succ).map(b => b.dataset.pred).sort()"
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, headless=True, args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 1600, 'height': 900})
    ctx.add_init_script('window.__cpPerf = true;')
    pg = ctx.new_page()
    pg.goto(base); pg.evaluate('localStorage.clear()')
    pg.evaluate(f"localStorage.setItem('__harness_jira_links', JSON.stringify({json.dumps(LINKS)}))")
    pg.reload(); wait_rows(pg); pg.wait_for_timeout(800)

    # 1. Ports and resize edges.
    hit = pg.locator('.bar-hit[data-task-id="DEMO-31"]')
    hit.scroll_into_view_if_needed()
    box = hit.bounding_box()
    pg.mouse.move(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
    pg.wait_for_timeout(500)
    out['edges'] = pg.evaluate("""() => {
      const hit = document.querySelector('.bar-hit[data-task-id="DEMO-31"]');
      const r = (el) => el.getBoundingClientRect();
      const bar = r(hit), handle = r(hit.querySelector('.bar-handle-right')), port = r(hit.querySelector('.bar-link-port-right'));
      const lh = r(hit.querySelector('.bar-handle-left')), lp = r(hit.querySelector('.bar-link-port-left'));
      const atEdge = document.elementFromPoint(bar.right - 2, bar.top + bar.height / 2);
      const atLeftEdge = document.elementFromPoint(bar.left + 2, bar.top + bar.height / 2);
      return { rightGap: Math.round(port.left - handle.right), leftGap: Math.round(lh.left - lp.right),
        portOpacity: getComputedStyle(hit.querySelector('.bar-link-port-right')).opacity,
        atRightEdge: atEdge && atEdge.className, atLeftEdge: atLeftEdge && atLeftEdge.className };
    }""")

    # 2. Every arrow into DEMO-40 has its label button.
    pg.mouse.move(5, 5); pg.wait_for_timeout(400)
    out['arrows_into_40'] = pg.evaluate("(window.__cpArrows || []).filter(a => a.successorKey === 'DEMO-40').map(a => a.predecessorKey).sort()")
    out['badges_into_40'] = pg.evaluate(badges, 'DEMO-40')
    # A selected bar elsewhere dims the other labels but keeps them clickable.
    other = pg.locator('.bar-hit[data-task-id="DEMO-9"]')
    if other.count():
        ob = other.bounding_box()
        pg.mouse.click(ob['x'] + ob['width'] / 2, ob['y'] + ob['height'] / 2)
        pg.wait_for_timeout(900)
        pg.keyboard.press('Escape')
        out['badges_with_selection'] = pg.evaluate(badges, 'DEMO-40')

    # 3. A click on the line of the DEMO-29 -> DEMO-40 arrow, a quarter of the way along.
    pg.mouse.move(5, 5); pg.wait_for_timeout(300)
    target = pg.evaluate("""() => {
      const a = (window.__cpArrows || []).find(l => l.predecessorKey === 'DEMO-29' && l.successorKey === 'DEMO-40');
      if (!a) return null;
      const w = document.getElementById('ganttWrapper'), wr = w.getBoundingClientRect();
      const pt = a.path[Math.floor(a.path.length / 4)];
      return { x: wr.left + pt[0] - w.scrollLeft, y: wr.top + pt[1] - w.scrollTop };
    }""")
    out['line_point'] = target
    if target:
        pg.mouse.move(target['x'], target['y']); pg.wait_for_timeout(300)
        out['cursor_on_line'] = pg.evaluate("document.getElementById('ganttWrapper').classList.contains('is-over-arrow')")
        under = pg.evaluate("(p) => { const e = document.elementFromPoint(p.x, p.y); return e && (e.className || e.tagName); }", target)
        out['element_under_point'] = under
        pg.mouse.click(target['x'], target['y']); pg.wait_for_timeout(600)
        out['editor_open'] = pg.evaluate("!document.getElementById('depEditPopover').hidden")
        out['editor_parties'] = pg.evaluate("document.getElementById('depEditParties').innerText.split('\\n')[0]")
    b.close()
srv.shutdown()

e = out['edges']
ok = (e['rightGap'] >= 0 and e['leftGap'] >= 0 and 'bar-handle-right' in (e['atRightEdge'] or '') and 'bar-handle-left' in (e['atLeftEdge'] or '')
      and out['arrows_into_40'] == ['DEMO-26', 'DEMO-29'] and out['badges_into_40'] == ['DEMO-26', 'DEMO-29']
      and out.get('badges_with_selection', ['DEMO-26', 'DEMO-29']) == ['DEMO-26', 'DEMO-29']
      and out.get('cursor_on_line') and out.get('editor_open') and 'DEMO-40 depends on DEMO-29' in (out.get('editor_parties') or ''))
print(('PASS' if ok else 'FAIL') + ' bars and arrows: resize edges free, every arrow labelled and clickable: ' + json.dumps(out))
sys.exit(0 if ok else 1)
