"""Marketplace screenshots of FourRealities (BL-4), from the "Payments Platform" (PAY) project.

Each screenshot shows only the app: the UI Kit surface of the dashboard, the issue panel, the
Inspect or Link dialog, or the admin page, with no Jira navigation and no DEV badge. The capture
runs at a device pixel ratio of 2; the crop keeps the 1840 : 900 shape from the top of the app and
is scaled to exactly 1840 x 900 px.

Usage: python3 marketplace_shots.py [state ...]; the states are listed in STATES.
Output: docs/marketplace/assets/fourrealities/<NN>-<state>.png.
Writes in PAY only, in the "link" state: a remote link from PAY-4 to the Confluence page
"Template - Decision documentation" (remove it afterwards with remove_link.py).
Needs CASCADEPLAN_LIVE_COOKIES (see live_common.py).

Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import pathlib
import sys

from PIL import Image
from playwright.sync_api import sync_playwright

from live_common import ADMIN, CHROME, DASHBOARD, SITE, cookies

ASSETS = pathlib.Path(__file__).resolve().parents[4] / 'docs' / 'marketplace' / 'assets' / 'fourrealities'
W, H = 1840, 900
ISSUE = 'PAY-4'

# The UI Kit surface around a text: the nearest ancestor with a background and at least minWidth.
SURFACE_JS = """([text, minWidth]) => {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    if (!node.textContent.includes(text)) continue;
    let el = node.parentElement;
    while (el && el !== document.body) {
      const bg = getComputedStyle(el).backgroundColor;
      if (el.offsetWidth >= minWidth && bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      }
      el = el.parentElement;
    }
  }
  return null;
}"""


def browser(p):
    b = p.chromium.launch(executable_path=CHROME, headless=True, args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 1500, 'height': 1000}, device_scale_factor=2, bypass_csp=True)
    ctx.add_cookies(cookies())
    return b, ctx.new_page()


def go(pg, path, wait_text, timeout=120000):
    pg.goto(SITE + path, wait_until='commit', timeout=150000)
    pg.get_by_text(wait_text).first.wait_for(timeout=timeout)
    pg.wait_for_timeout(3000)


def calm(pg):
    pg.mouse.move(2, 2)
    pg.evaluate("document.activeElement && document.activeElement.blur && document.activeElement.blur()")
    pg.wait_for_timeout(600)


BACKGROUND = (247, 248, 249)


def fit(pg, name, box, pad=0):
    """Captures the whole box and scales it into a 1840 x 900 canvas, centred on a plain background."""
    path = ASSETS / f'{name}.png'
    pg.screenshot(path=str(path), clip={'x': box['x'] - pad, 'y': box['y'] - pad, 'width': box['width'] + 2 * pad, 'height': box['height'] + 2 * pad})
    im = Image.open(path).convert('RGB')
    scale = min(W / im.width, H / im.height)
    im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    canvas = Image.new('RGB', (W, H), BACKGROUND)
    canvas.paste(im, ((W - im.width) // 2, (H - im.height) // 2))
    canvas.save(path)
    print('wrote', path.name, canvas.size)


def shoot(pg, name, box, pad=8):
    """Crops the 1840:900 region from the top of the box (plus a small margin) and scales it."""
    x, y = max(0, box['x'] - pad), max(0, box['y'] - pad)
    width = box['width'] + 2 * pad
    height = width * H / W
    path = ASSETS / f'{name}.png'
    pg.screenshot(path=str(path), clip={'x': x, 'y': y, 'width': width, 'height': height})
    Image.open(path).convert('RGB').resize((W, H), Image.LANCZOS).save(path)
    print('wrote', path.name, Image.open(path).size)


def surface(pg, text, min_width=600):
    box = pg.evaluate(SURFACE_JS, [text, min_width])
    if not box:
        sys.exit(f'No app surface around "{text}".')
    return box


def open_panel(pg):
    """Opens the Four Realities issue panel from the issue's app actions, with every finding shown."""
    pg.goto(SITE + f'/browse/{ISSUE}', wait_until='commit', timeout=150000)
    actions = pg.get_by_role('button', name='View app actions').first
    actions.wait_for(timeout=120000)
    # Once added to an issue, the panel stays; the app actions menu adds it only the first time.
    for _ in range(30):
        if pg.get_by_text('Gate findings').count():
            break
        pg.wait_for_timeout(2000)
    else:
        actions.click()
        pg.get_by_role('menuitem', name='Four Realities').first.click(timeout=15000)
    for _ in range(45):
        if pg.get_by_text('Gate findings').count():
            break
        pg.wait_for_timeout(2000)
    pg.wait_for_timeout(2500)
    show = pg.get_by_role('button', name='Show details')
    if show.count():
        show.first.click()
        pg.wait_for_timeout(1500)


STATES = {}


def state(fn):
    STATES[fn.__name__] = fn
    return fn


@state
def dashboard(pg):
    go(pg, DASHBOARD, 'Delivery assurance and audit readiness')
    pg.locator('button', has_text='Refresh').first.click()
    pg.wait_for_timeout(30000)
    pg.get_by_text('Delivery assurance and audit readiness').first.wait_for(timeout=120000)
    pg.wait_for_timeout(3000)
    calm(pg)
    shoot(pg, '01-dashboard', surface(pg, 'Delivery assurance and audit readiness', 1000))


@state
def panel(pg):
    open_panel(pg)
    calm(pg)
    findings = surface(pg, 'Gate findings', 700)
    # From the panel header (its Refresh button) down, as wide as the findings card.
    head = pg.locator('button', has_text='Refresh').first.bounding_box()
    top = head['y'] - 6
    shoot(pg, '02-issue-panel', {'x': findings['x'], 'y': top, 'width': findings['width'], 'height': findings['y'] + findings['height'] - top})


@state
def link(pg):
    """The Link decision record dialog with Confluence search results, then the link is added."""
    open_panel(pg)
    button = pg.get_by_role('button', name='Link decision record')
    if not button.count():
        print('Intent already has evidence: no link dialog to show.')
        return
    button.first.click()
    pg.get_by_role('dialog').first.wait_for(timeout=30000)
    pg.get_by_role('dialog').get_by_role('button', name='Search Confluence...').first.click()
    pg.wait_for_timeout(1000)
    # One input event: UI Kit text fields keep only the last key of fast typing (round log L3-3).
    pg.get_by_label('Search Confluence pages').first.fill('Decision')
    pg.wait_for_timeout(800)
    pg.get_by_role('dialog').get_by_role('button', name='Search', exact=True).first.click()
    try:
        pg.get_by_text('Template - Decision documentation').first.wait_for(timeout=30000)
    except Exception:
        print('DIALOG:', pg.get_by_role('dialog').first.inner_text().replace('\n', ' | '))
        pg.screenshot(path='/home/fahimfarookme/.cache/jira-suite-fixes/scratch-fourrealities/shots/link-fail.png')
        raise
    pg.wait_for_timeout(1500)
    calm(pg)
    fit(pg, '03-link-decision', pg.get_by_role('dialog').first.bounding_box())
    pg.get_by_role('dialog').get_by_role('button', name='Select', exact=True).first.click()
    pg.wait_for_timeout(800)
    pg.get_by_role('dialog').get_by_role('button', name='Add link').first.click()
    pg.get_by_text('Link added.').first.wait_for(timeout=60000)
    print(pg.get_by_text('Link added.').first.inner_text())


@state
def inspect(pg):
    go(pg, DASHBOARD, 'Issue triage')
    row = pg.get_by_role('row').filter(has_text=ISSUE).first
    row.get_by_role('button', name='Inspect').click()
    pg.get_by_role('dialog').first.wait_for(timeout=30000)
    pg.wait_for_timeout(2000)
    calm(pg)
    fit(pg, '04-inspect', pg.get_by_role('dialog').first.bounding_box())


@state
def admin(pg):
    go(pg, ADMIN, 'Evidence sources')
    calm(pg)
    shoot(pg, '05-admin', surface(pg, 'Evidence sources, decision issue types and approver groups', 900))


if __name__ == '__main__':
    wanted = sys.argv[1:] or list(STATES)
    with sync_playwright() as p:
        b, pg = browser(p)
        for name in wanted:
            STATES[name](pg)
        b.close()
