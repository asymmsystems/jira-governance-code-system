"""Marketplace screenshots of LedgerSeal from the development site, project PAY ("Payments Platform").
Each image is the LedgerSeal app surface only (no Jira header, no DEV badge), 1840 x 900 px: the crop is the
panel's full width and 900/1840 of it in height from the panel's top, captured at the pixel ratio that makes the
panel 1840 px wide. Usage: python3 shots.py measure|STATE...  Output: docs/marketplace/assets/ledgerseal/.
Reads only, except that opening a panel can record a change that Jira already holds.
Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import pathlib
import sys
from PIL import Image
from playwright.sync_api import sync_playwright
from ls_live import open_browser, OUT, SITE
from ls_panel import open_issue, panel_box, click_text

ASSETS = pathlib.Path(__file__).resolve().parents[4] / 'docs' / 'marketplace' / 'assets' / 'ledgerseal'
VIEW_W, VIEW_H = 2300, 1400


def calm(pg):
    pg.mouse.move(2, 2)
    pg.evaluate("document.activeElement && document.activeElement.blur && document.activeElement.blur()")
    pg.wait_for_timeout(800)


def sealed_details(pg):
    open_issue(pg, 'PAY-10')
    click_text(pg, 'Show details')
    click_text(pg, 'Show fields')


def changed(pg):
    open_issue(pg, 'PAY-13')


def history(pg):
    open_issue(pg, 'PAY-10')
    click_text(pg, 'Show details')
    click_text(pg, 'Show history')
    pg.wait_for_timeout(4000)


STATES = {'01-sealed-panel': sealed_details, '02-tamper-detected': changed, '05-seal-history': history}


def capture(p, name, setup, dpr):
    b, ctx = open_browser(p, VIEW_W, VIEW_H, dpr)
    pg = ctx.new_page()
    setup(pg)
    calm(pg)
    box = panel_box(pg)
    pg.evaluate(f"window.scrollTo(0, {box['y'] - 60})")
    pg.wait_for_timeout(1200)
    box = panel_box(pg)
    top = box['y'] - pg.evaluate('window.scrollY')
    need = box['width'] * 900 / 1840
    clip = {'x': box['x'], 'y': top, 'width': box['width'], 'height': need}
    if name != 'measure':
        ASSETS.mkdir(parents=True, exist_ok=True)
        path = ASSETS / f'{name}.png'
        pg.screenshot(path=str(path), clip=clip)
        im = Image.open(path)
        if im.size != (1840, 900):
            im.resize((1840, 900), Image.LANCZOS).save(path)
        print('wrote', path.name, Image.open(path).size)
    b.close()
    return box, need


with sync_playwright() as p:
    targets = sys.argv[1:]
    if targets == ['measure']:
        for name, setup in STATES.items():
            box, need = capture(p, 'measure', setup, 1.0)
            print(name, 'panel', round(box['width']), 'x', round(box['height']), 'needs height', round(need), 'fits' if box['height'] >= need else 'TOO SHORT')
    else:
        for name in targets:
            box, _ = capture(p, 'measure', STATES[name], 1.0)
            capture(p, name, STATES[name], 1840 / box['width'])
