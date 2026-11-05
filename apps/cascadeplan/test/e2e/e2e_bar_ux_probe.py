"""Probe: link ports on hover and the ring on click. Copyright (c) 2026 Asymm Systems. @author Fahim Farook"""
import json
import pathlib
from playwright.sync_api import sync_playwright
from e2e import serve, wait_rows, CHROME

OUT = pathlib.Path(__file__).resolve().parent / 'results-review'
srv = serve()
base = f'http://127.0.0.1:{srv.server_address[1]}/index.html'
KEY = 'DEMO-40'
PROBE = """(key) => {
  const hit = document.querySelector(`.bar-hit[data-task-id="${key}"]`);
  const port = hit && hit.querySelector('.bar-link-port-right');
  const cv = document.querySelector('.timeline-canvas');
  const r = port.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const stack = document.elementsFromPoint(cx, cy).slice(0, 4).map(e => e.className || e.tagName);
  const z = (el) => getComputedStyle(el).zIndex;
  return {
    portOpacity: getComputedStyle(port).opacity,
    portRect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
    canvasZ: cv ? z(cv) : null, canvasDisplay: cv ? getComputedStyle(cv).display : null,
    hitZ: z(hit), portZ: z(port),
    canvasParentIsHitAncestor: cv ? cv.parentElement.contains(hit) : null,
    topElementsAtPortCentre: stack,
    activeElement: document.activeElement ? (document.activeElement.className || document.activeElement.tagName) : null
  };
}"""
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, headless=True, args=['--no-sandbox'])
    pg = b.new_context(viewport={'width': 1600, 'height': 900}).new_page()
    pg.goto(base); pg.evaluate('localStorage.clear()'); pg.reload(); wait_rows(pg)
    hit = pg.locator(f'.bar-hit[data-task-id="{KEY}"]')
    hit.scroll_into_view_if_needed()
    box = hit.bounding_box()
    pg.mouse.move(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
    pg.wait_for_timeout(400)
    hover = pg.evaluate(PROBE, KEY)
    clip = {'x': max(0, box['x'] - 60), 'y': max(0, box['y'] - 30), 'width': box['width'] + 120, 'height': box['height'] + 60}
    pg.screenshot(path=str(OUT / 'UX1-hover-ports.png'), clip=clip)
    pg.mouse.click(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
    pg.wait_for_timeout(700)
    click = pg.evaluate(PROBE, KEY)
    pg.mouse.move(5, 5); pg.wait_for_timeout(300)
    pg.screenshot(path=str(OUT / 'UX2-after-click.png'), clip=clip)
    print(json.dumps({'hover': hover, 'afterClick': click}, indent=1))
    b.close()
srv.shutdown()
# N-10: on hover the port shows, and the hit layer (with its ports) is above the canvas.
ok = float(hover['portOpacity']) > 0 and int(hover['hitZ']) > int(hover['canvasZ'])
print(('PASS' if ok else 'FAIL') + ' N-10 link ports visible above the canvas on hover')
import sys
sys.exit(0 if ok else 1)
