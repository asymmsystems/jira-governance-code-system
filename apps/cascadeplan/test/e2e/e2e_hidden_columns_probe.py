"""Harness check: the timeline bars stay on their task rows, and stay in view, when columns change.

Found on the development site on 2026-11-10 (TASK-00003): with columns hidden the bars drew one row
lower than their task rows, and after "Unhide All Columns" the bars were not on the timeline.

The canvas draws each bar from measured positions (row start, header height, data column width,
the wrapper's place in its section). The check compares, for every visible bar, the canvas pixels
with the bar's hit element, which sits in the task row: the bar must be painted at the row's bar
centre, and its painted run must end where the hit element ends (2 px tolerance for the 1.5 px
outline). A shift up or down moves that bottom edge. The top edge is not compared, because the
today flag can join the first bar from above.

Steps: dismiss the first-link tip (the grid moves up), a backlog drag that ends without a drop (the
drop rows shrink with their CSS transition), hide five columns, zoom Month and back, Compact on and
off, then Unhide All Columns. After Unhide All, the bar that was in the middle of the timeline must
still be in view.

Usage, from apps/cascadeplan/test/e2e:  python3 build_site.py && python3 e2e_hidden_columns_probe.py

Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import sys
from playwright.sync_api import sync_playwright
from e2e import serve, wait_rows, CHROME

ALIGN = """(() => {
  const cv = document.querySelector('canvas.timeline-canvas');
  if (!cv || getComputedStyle(cv).display === 'none') return {canvas: false, rows: []};
  const cr = cv.getBoundingClientRect();
  const ctx = cv.getContext('2d');
  const dpr = cv.width / Math.max(1, cr.width);
  const painted = (x, y) => x >= cr.left && x < cr.right && y >= cr.top && y < cr.bottom
    && ctx.getImageData(Math.floor((x - cr.left) * dpr), Math.floor((y - cr.top) * dpr), 1, 1).data[3] > 200;
  const rows = [];
  for (const tr of document.querySelectorAll('#ganttBody tr.task-row')) {
    const hit = tr.querySelector('.bar-hit');
    if (!hit) continue;
    const r = hit.getBoundingClientRect();
    if (r.width < 24 || r.right <= cr.left + 8 || r.left >= cr.right - 8) continue;
    const xs = [r.left + 6, r.left + r.width / 2, r.right - 6].filter(x => x > cr.left && x < cr.right);
    let aligned = false;
    let seen = null;
    for (const x of xs) {
      const mid = Math.round(r.top + r.height / 2);
      if (!painted(x, mid)) { seen = seen || 'no bar at the row centre'; continue; }
      let top = mid; while (top > r.top - 60 && painted(x, top - 1)) top--;
      let bottom = mid; while (bottom < r.bottom + 60 && painted(x, bottom + 1)) bottom++;
      seen = `bar ${top - Math.round(r.top)}..${bottom - Math.round(r.bottom)} px from the row's bar slot`;
      // The top may join the today flag drawn above the first row; the bottom edge shows any shift.
      if (top <= r.top + 2 && Math.abs(bottom - r.bottom) <= 2) { aligned = true; break; }
    }
    rows.push({key: tr.dataset.taskId, aligned, seen});
  }
  return {canvas: true, rows};
})()"""

CANCELLED_DRAG = """(async () => {
  const card = document.querySelector('.backlog-card');
  const dt = new DataTransfer();
  card.dispatchEvent(new DragEvent('dragstart', {bubbles: true, dataTransfer: dt}));
  await new Promise(r => setTimeout(r, 400));
  card.dispatchEvent(new DragEvent('dragend', {bubbles: true, dataTransfer: dt}));
})()"""

# The key of the bar nearest the middle of the visible timeline, and whether a key is in view.
MIDDLE_BAR = """(() => {
  const w = document.getElementById('ganttWrapper');
  const cv = document.querySelector('canvas.timeline-canvas').getBoundingClientRect();
  const mid = (cv.left + cv.right) / 2;
  let best = null;
  for (const hit of document.querySelectorAll('.bar-hit')) {
    const r = hit.getBoundingClientRect();
    if (r.width < 8) continue;
    const d = Math.abs((r.left + r.right) / 2 - mid);
    if (!best || d < best.d) best = {d, key: hit.dataset.taskId};
  }
  return best && best.key;
})()"""
IN_VIEW = """(key => {
  const cv = document.querySelector('canvas.timeline-canvas');
  if (!cv || getComputedStyle(cv).display === 'none') return false;
  const c = cv.getBoundingClientRect();
  const r = document.querySelector(`.bar-hit[data-task-id="${key}"]`).getBoundingClientRect();
  return r.right > c.left + 8 && r.left < c.right - 8;
})"""

# The day at the middle of the visible timeline, counted from the range start.
MIDDLE_DAY = """(() => {
  const w = document.getElementById('ganttWrapper');
  const cv = document.querySelector('canvas.timeline-canvas').getBoundingClientRect();
  const trackLeft = cv.left - w.getBoundingClientRect().left;
  return Math.floor((w.scrollLeft + (w.clientWidth - trackLeft) / 2) / Number(w.dataset.dayPx));
})()"""

results = []


def check(pg, step):
    pg.mouse.move(5, 5)
    pg.wait_for_timeout(400)
    state = pg.evaluate(ALIGN)
    bad = [f"{r['key']}: {r['seen']}" for r in state['rows'] if not r['aligned']]
    ok = state['canvas'] and len(state['rows']) > 0 and not bad
    results.append(ok)
    print(('PASS' if ok else 'FAIL') + f" {step}: {len(state['rows'])} bars checked" + (f"; off: {bad}" if bad else '')
          + ('' if state['canvas'] else '; canvas hidden'))


def toggle_columns(pg, keys):
    for key in keys:
        pg.evaluate("document.getElementById('btnManageColumns').click()")
        pg.wait_for_timeout(200)
        pg.evaluate(f"document.querySelector('#col_chk_{key}').closest('.col-option-row').click()")
        pg.wait_for_timeout(300)
    pg.evaluate("document.getElementById('columnManagerPopover').style.display = 'none'")


def main():
    srv = serve()
    base = f'http://127.0.0.1:{srv.server_address[1]}/index.html'
    errors = []
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME, headless=True, args=['--no-sandbox'])
        pg = b.new_context(viewport={'width': 1825, 'height': 743}).new_page()
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.goto(base)
        pg.evaluate('localStorage.clear()')
        pg.reload()
        wait_rows(pg)
        check(pg, 'first render')
        pg.evaluate("document.getElementById('btnHintDismiss').click()")
        check(pg, 'first-link tip dismissed (the grid moves up)')
        pg.evaluate("document.getElementById('toggleBacklogBtn').click()")
        pg.wait_for_timeout(500)
        check(pg, 'backlog tray open')
        pg.evaluate(CANCELLED_DRAG)
        pg.wait_for_timeout(800)
        check(pg, 'backlog drag ended without a drop')
        toggle_columns(pg, ['epic', 'story', 'resource', 'effort', 'progress'])
        check(pg, 'five columns hidden (hidden-columns bar shown)')
        pg.evaluate(CANCELLED_DRAG)
        pg.wait_for_timeout(800)
        check(pg, 'five columns hidden, backlog drag ended without a drop')
        pg.click('#zoomGroup [data-zoom=month]')
        check(pg, 'columns hidden, Month zoom')
        pg.click('#zoomGroup [data-zoom=week]')
        check(pg, 'columns hidden, Week zoom')
        pg.evaluate("document.getElementById('btnCompactColumns').click()")
        check(pg, 'Compact on')
        pg.evaluate("document.getElementById('btnCompactColumns').click()")
        check(pg, 'Compact off')
        toggle_columns(pg, ['epic', 'story', 'resource', 'effort', 'progress'])
        middle = pg.evaluate(MIDDLE_BAR)
        day_before = pg.evaluate(MIDDLE_DAY)
        pg.evaluate("document.getElementById('btnUnhideAllBanner').click()")
        check(pg, 'Unhide All Columns')
        day_after = pg.evaluate(MIDDLE_DAY)
        same_middle = abs(day_after - day_before) <= 1
        results.append(same_middle)
        print(('PASS' if same_middle else 'FAIL') + f' the middle of the timeline stays on the same day (day {day_before} before, {day_after} after Unhide All)')
        in_view = pg.evaluate(IN_VIEW, middle)
        results.append(bool(in_view))
        print(('PASS' if in_view else 'FAIL') + f' after Unhide All the middle bar {middle} is still in view')
        b.close()
    srv.shutdown()
    if errors:
        results.append(False)
        print('FAIL page errors: ' + '; '.join(errors))
    ok = all(results)
    print(('PASS' if ok else 'FAIL') + f' hidden columns: {sum(results)}/{len(results)} checks')
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
