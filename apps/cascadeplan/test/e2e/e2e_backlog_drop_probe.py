"""Where a Backlog item lands (TASK-00003, the owner's option 2 of 2026-11-18), in headless Chrome.

One rule: the day under the pointer wherever a date is under the pointer (the timeline part of a row,
and the empty timeline below the rows), and today everywhere else (the grid columns of a row, the
"Drop here" rows, the area below the grid columns). On master a drop below the rows measured the
pointer from the wrapper's left edge and started 82 days after the day under the pointer, and the
grid and the "Drop here" rows started on the Monday of the current week.

Usage, from apps/cascadeplan/test/e2e, after "python3 build_site.py":  python3 e2e_backlog_drop_probe.py

Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import sys

from playwright.sync_api import sync_playwright

from e2e import serve, wait_rows, bar_dates, check, results, CHROME

# Starts a drag of the DEMO-41 Backlog card, then sends dragover and drop to the element under (x, y),
# or to the element of a selector (at its middle). Returns the element and the date label shown.
DROP = """async ([x, y, selector]) => {
  const card = [...document.querySelectorAll('.backlog-card')].find(c => c.textContent.includes('DEMO-41'));
  if (!card) return {error: 'no DEMO-41 card'};
  const dt = new DataTransfer();
  card.dispatchEvent(new DragEvent('dragstart', {bubbles: true, cancelable: true, dataTransfer: dt}));
  await new Promise(r => setTimeout(r, 600));
  const target = selector ? document.querySelector(selector) : document.elementFromPoint(x, y);
  if (!target) return {error: 'no target'};
  if (selector) { const r = target.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height / 2; }
  const opts = {bubbles: true, cancelable: true, dataTransfer: dt, clientX: x, clientY: y};
  target.dispatchEvent(new DragEvent('dragover', opts));
  await new Promise(r => setTimeout(r, 150));
  const badge = (document.querySelector('.drop-slot-badge') || {}).textContent || '';
  const what = target.className + ' <' + target.tagName + '>';
  target.dispatchEvent(new DragEvent('drop', opts));
  card.dispatchEvent(new DragEvent('dragend', {bubbles: true, dataTransfer: dt}));
  return {what, badge};
}"""

TODAY = "(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })()"


def fresh(pg, base):
    pg.goto(base)
    pg.evaluate('localStorage.clear()')
    pg.reload()
    wait_rows(pg)
    pg.wait_for_timeout(400)
    pg.evaluate("document.getElementById('toggleBacklogBtn').click()")
    pg.wait_for_timeout(700)


def drop(pg, x, y, selector=None):
    d = pg.evaluate(DROP, [x, y, selector])
    pg.wait_for_timeout(1800)
    start = bar_dates(pg, 'DEMO-41')[0] if pg.locator('.bar-hit[data-task-id="DEMO-41"]').count() > 0 else None
    return start, d


def main() -> int:
    srv = serve()
    base = f'http://127.0.0.1:{srv.server_address[1]}/index.html'
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME, headless=True, args=['--no-sandbox'])
        pg = b.new_context(viewport={'width': 1600, 'height': 900}).new_page()
        today = pg.evaluate(TODAY)

        def row_y():
            row = pg.locator('#ganttBody tr.task-row[data-task-id="DEMO-40"]').bounding_box()
            return row['y'] + row['height'] / 2 + 28  # the drop row that opens above moves the rows down

        def below_y():
            last = pg.locator('#ganttBody tr.task-row').last.bounding_box()
            return last['y'] + last['height'] + 120

        def timeline_x():
            wr = pg.locator('#ganttWrapper').bounding_box()
            return wr['x'] + wr['width'] * 0.75

        def grid_x():
            wr = pg.locator('#ganttWrapper').bounding_box()
            return wr['x'] + 120

        fresh(pg, base)
        on_row, d1 = drop(pg, timeline_x(), row_y())
        check('a drop on the timeline part of a row starts on the day the date label shows',
              on_row is not None and d1.get('badge', '').endswith(on_row or '-'), f'{on_row} {d1}')

        fresh(pg, base)
        below, d2 = drop(pg, timeline_x(), below_y())
        check('a drop on the empty timeline below the rows starts on the same day as a drop on a row at the same x',
              below is not None and below == on_row, f'below {below}, row {on_row}, {d2}')

        fresh(pg, base)
        grid, d3 = drop(pg, grid_x(), row_y())
        check('a drop on the grid columns of a row starts today', grid == today, f'{grid}, today {today}, {d3}')

        fresh(pg, base)
        top, d4 = drop(pg, 0, 0, '#ganttBody tr.drop-target-row')
        check('a drop on the "Drop here" row starts today', top == today, f'{top}, today {today}, {d4}')

        fresh(pg, base)
        under_grid, d5 = drop(pg, grid_x(), below_y())
        check('a drop below the rows under the grid columns starts today', under_grid == today, f'{under_grid}, today {today}, {d5}')
        b.close()
    srv.shutdown()
    failed = [r for r in results if not r['pass']]
    print(f'{len(results) - len(failed)} of {len(results)} checks pass')
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
