"""Marketplace screenshots of DefinitionGuard (BL-3) from project PAY ("Payments Platform") on the
development site. Each image is 1840 x 900 px: a 920 x 450 CSS px region captured at a device pixel
ratio of 2, cropped to the app's own content (no Jira navigation, no DEV badge).
Usage: python3 marketplace_shots.py prepare | panel | evidence | blocked | settings | history
Output: docs/marketplace/assets/definitionguard/<NN>-<name>.png. Writes in PAY only: "prepare"
ticks and waives items on PAY-15; "blocked" tries to move PAY-15 to Done (the validator refuses).

Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import pathlib
import sys
from PIL import Image
from playwright.sync_api import sync_playwright
from dg_live import open_browser, rest, SITE, OUT, APP_ID, open_issue, ensure_panel, row_button, item_checkbox, expand_history

ASSETS = pathlib.Path(__file__).resolve().parents[4] / 'docs' / 'marketplace' / 'assets' / 'definitionguard'
ISSUE = 'PAY-15'
DPR = 2
SETTINGS = f'{SITE}/jira/software/c/projects/PAY/settings/apps/{APP_ID}/b575a3a8-ffe9-4570-ac50-42a6a555c167'


def card(pg):
    """The app's own card in the issue panel: the nearest ancestor of the Refresh button that is
    wider than 850 CSS px. Returns its viewport box."""
    return pg.get_by_role('button', name='Refresh').first.evaluate("""b => { let e = b; while (e && e.getBoundingClientRect().width < 850) e = e.parentElement;
      const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; }""")


def scroll_to(pg, text, offset=12):
    """Scrolls the issue view so the element with this text is `offset` CSS px below the viewport top."""
    pg.get_by_text(text, exact=True).first.evaluate("(e, off) => { e.scrollIntoView({ block: 'start' }); let p = e.parentElement; while (p) { if (p.scrollHeight > p.clientHeight + 10 && getComputedStyle(p).overflowY !== 'visible') { p.scrollTop -= off; break; } p = p.parentElement; } window.scrollBy(0, -off); }", offset)
    pg.wait_for_timeout(1200)
    return pg.get_by_text(text, exact=True).first.bounding_box()


def shoot(pg, name, x, y, w, h=None):
    """A region w wide and w / 2.0444 tall (the 1840 x 900 ratio), in viewport CSS px."""
    h = h or round(w * 900 / 1840)
    path = ASSETS / f'{name}.png'
    pg.screenshot(path=str(path), clip={'x': x, 'y': y, 'width': w, 'height': h})
    im = Image.open(path)
    if im.size != (1840, 900):
        im = im.resize((1840, 900), Image.LANCZOS)
        im.save(path)
    print('wrote', path.name, Image.open(path).size)


def box_of_text(pg, text):
    return pg.get_by_text(text, exact=True).first.bounding_box()


def panel_left(pg):
    """Left edge of the app's own panel card (the Refresh button's row starts there)."""
    hb = pg.locator("xpath=//*[normalize-space(text())='Incomplete' or normalize-space(text())='DoD complete']").first.bounding_box()
    return hb


def calm(pg):
    pg.mouse.move(2, 2)
    pg.evaluate("window.scrollTo(0, 0)")
    pg.wait_for_timeout(800)


def prepare(pg):
    open_issue(pg, ISSUE)
    ensure_panel(pg)
    body = pg.inner_text('body')
    if 'Evidence attached' not in body:
        item_checkbox(pg, 'Unit and integration tests pass in CI').click()
        pg.wait_for_timeout(1500)
        pg.locator('input[placeholder="https://..."]').first.fill('https://ci.example.com/payments/build/4182')
        pg.locator('input[placeholder="Note (500 characters or less)"]').first.fill('412 tests passed, 0 failed')
        pg.wait_for_timeout(600)
        pg.get_by_role('button', name='Save and tick').first.click()
        pg.wait_for_timeout(7000)
    if 'Waived' not in pg.inner_text('body'):
        row_button(pg, 'PCI DSS scope impact assessed', 'Waive').click()
        pg.wait_for_timeout(1200)
        pg.locator('input[placeholder="Reason (10 to 500 characters)"]').first.fill('Load test only; no card data flow or PCI scope change.')
        pg.wait_for_timeout(600)
        pg.get_by_role('button', name='Waive item').first.click()
        pg.wait_for_timeout(7000)
    print(pg.inner_text('body')[pg.inner_text('body').find('Definition of Done items'):][:900])


def dump(pg, name):
    pg.screenshot(path=str(OUT / f'{name}-full.png'), full_page=True)


def own_status(pg):
    """The issue's own status button (right column), not a linked item's status menu."""
    for b in pg.get_by_role('button', name='To Do').all():
        box = b.bounding_box()
        if box and box['x'] > 1000:
            return b
    raise RuntimeError('status button not found')


MODES = {}
def mode(fn):
    MODES[fn.__name__] = fn
    return fn


def region(pg, top):
    """The card's width, the 1840 x 900 ratio, from `top` (viewport CSS px)."""
    c = card(pg)
    return c['x'], top, c['width']


@mode
def panel(pg):
    open_issue(pg, ISSUE); ensure_panel(pg); pg.mouse.move(2, 2)
    box = scroll_to(pg, 'Definition of Done items', 30)
    x, y, w = region(pg, box['y'] - 22)
    shoot(pg, '01-checklist-open', x, y, w)


@mode
def evidence(pg):
    open_issue(pg, ISSUE); ensure_panel(pg)
    item_checkbox(pg, 'Load test results attached for changed endpoints').click()
    pg.wait_for_timeout(1500)
    pg.locator('input[placeholder="https://..."]').first.fill('https://perf.example.com/reports/checkout-3x-2026-11-06')
    pg.locator('input[placeholder="Note (500 characters or less)"]').first.fill('p95 latency 240 ms at 3x peak; error rate 0.02%')
    pg.mouse.move(2, 2); pg.wait_for_timeout(800)
    box = scroll_to(pg, 'PCI DSS scope impact assessed', 30)
    x, y, w = region(pg, box['y'] - 20)
    shoot(pg, '02-evidence-link', x, y, w)


@mode
def blocked(pg):
    """The real Jira flag after a move to Done, over the panel. Jira shows the flag at the bottom left
    of the window, so the panel's own header is scrolled to the top of the bottom region."""
    open_issue(pg, ISSUE); ensure_panel(pg)
    vh = pg.viewport_size['height']
    refresh = pg.get_by_role('button', name='Refresh').first
    lozenge = pg.get_by_text('Incomplete', exact=True).first
    x0 = lozenge.bounding_box()['x'] - 260
    rb = refresh.bounding_box()
    w = rb['x'] + rb['width'] + 24 - x0
    h = round(w * 900 / 1840)
    # Size the window so that its bottom region starts just above the panel's own header.
    vh = round(lozenge.bounding_box()['y'] - 26 + h)
    pg.set_viewport_size({'width': pg.viewport_size['width'], 'height': vh})
    pg.wait_for_timeout(2500)
    vh = round(lozenge.bounding_box()['y'] - 26 + h)
    pg.set_viewport_size({'width': pg.viewport_size['width'], 'height': vh})
    pg.wait_for_timeout(2500)
    own_status(pg).click()
    pg.wait_for_timeout(2000)
    pg.get_by_role('option', name='Done').first.click() if pg.get_by_role('option', name='Done').count() else pg.get_by_text('Done', exact=True).last.click()
    pg.get_by_text('Transition failed').first.wait_for(timeout=30000)
    pg.mouse.move(x0 + w - 5, 5); pg.wait_for_timeout(1500)
    shoot(pg, '03-transition-blocked', x0, vh - h, w)


@mode
def history(pg):
    open_issue(pg, ISSUE); ensure_panel(pg)
    expand_history(pg)
    pg.mouse.move(2, 2)
    # Below Jira's sticky issue header, which shows once the page is scrolled this far.
    box = scroll_to(pg, 'Checklist audit history', 140)
    x, y, w = region(pg, box['y'] - 22)
    shoot(pg, '05-audit-export', x, y, w)


CATEGORIES = ['Testing', 'Code quality', 'Compliance', 'Testing', 'Documentation']


@mode
def settings(pg):
    """Project settings in a 1000 px window. Sets the item categories once (saves version 2)."""
    pg.set_viewport_size({'width': 1000, 'height': 1400})
    pg.goto(SETTINGS, wait_until='domcontentloaded', timeout=150000)
    pg.get_by_text('Gate coverage').first.wait_for(timeout=90000)
    pg.get_by_text('Gated', exact=True).first.wait_for(timeout=60000)
    pg.wait_for_timeout(3000)
    selects = pg.locator('input[id*="-dg-category-"]')
    if selects.count() == len(CATEGORIES) and 'version 2' not in pg.inner_text('body') and pg.get_by_text('Code quality', exact=True).count() == 0:
        for i, label in enumerate(CATEGORIES):
            if label == 'Testing':
                continue
            selects.nth(i).click(force=True)
            pg.wait_for_timeout(600)
            pg.get_by_role('option', name=label, exact=True).first.click()
            pg.wait_for_timeout(800)
        pg.get_by_role('button', name='Save template').click()
        pg.get_by_text('version 2 saved').first.wait_for(timeout=60000)
        pg.reload(wait_until='domcontentloaded')
        pg.get_by_text('Gated', exact=True).first.wait_for(timeout=90000)
        pg.wait_for_timeout(3000)
    pg.mouse.move(2, 2)
    pg.screenshot(path=str(OUT / 'settings-1000.png'), full_page=True)
    for t in ['Definition of Done templates', 'Code review approved by another engineer', 'Gate coverage', 'Statuses the gate lets through']:
        print(t, pg.get_by_text(t).first.bounding_box())


@mode
def settings_shot(pg):
    """Project settings, template editor: the content column at 1600 px, from the page heading."""
    pg.set_viewport_size({'width': 1600, 'height': 1300})
    pg.goto(SETTINGS, wait_until='domcontentloaded', timeout=150000)
    pg.get_by_text('Gated', exact=True).first.wait_for(timeout=90000)
    pg.wait_for_timeout(3000)
    pg.mouse.move(2, 2)
    head = pg.get_by_text('Definition of Done templates', exact=True).first.bounding_box()
    sel = pg.locator('input[id$="-dg-issue-type"]').first.evaluate("e => { let p = e; while (p && p.getBoundingClientRect().width < 1000) p = p.parentElement; const r = p.getBoundingClientRect(); return { x: r.left, w: r.width }; }")
    x = sel['x'] - 16
    w = pg.viewport_size['width'] - 2 * x  # the whole content column, both borders included
    shoot(pg, '04-project-settings', x, head['y'] - 16, w)


@mode
def blocked_look(pg):
    open_issue(pg, ISSUE); ensure_panel(pg)
    own_status(pg).click()
    pg.wait_for_timeout(2000)
    pg.screenshot(path=str(OUT / 'status-menu.png'))
    pg.get_by_role('option', name='Done').first.click() if pg.get_by_role('option', name='Done').count() else pg.get_by_text('Done', exact=True).last.click()
    pg.wait_for_timeout(6000)
    pg.screenshot(path=str(OUT / 'blocked.png'))
    t = pg.inner_text('body'); i = t.find('Definition of Done is not complete'); print(i, t[max(0, i-300):i+500])


@mode
def look(pg):
    open_issue(pg, ISSUE); ensure_panel(pg); calm(pg); dump(pg, 'issue')
    for t in ['Definition of Done items', 'Refresh', 'Complete DoD', 'Reset checklist', 'Checklist audit history']:
        print(t, pg.get_by_text(t, exact=True).first.bounding_box())


if __name__ == '__main__':
    with sync_playwright() as p:
        b, ctx = open_browser(p, 1600, 1000, DPR)
        pg = ctx.new_page()
        pg.goto(SITE + '/rest/api/3/myself', wait_until='domcontentloaded')
        (prepare if sys.argv[1] == 'prepare' else MODES[sys.argv[1]])(pg)
        b.close()
