"""Screenshot 03: the Require Valid LedgerSeal validator blocks a changed issue's move to Done (the status does not
change). Usage: python3 shot_blocked.py KEY (default LSP-5, whose only change is a description, so no test title shows).
Crop: the LedgerSeal panel area from its own header, with Jira's "Transition failed" message, 1840 x 900 px.
LSP is the project where the validator is on a transition; PAY has no LedgerSeal validator.
Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import pathlib
import sys
from PIL import Image
from playwright.sync_api import sync_playwright
from ls_live import open_browser, SITE, rest
from ls_panel import open_issue, panel_box

KEY = sys.argv[1] if len(sys.argv) > 1 else 'LSP-5'
ASSETS = pathlib.Path(__file__).resolve().parents[4] / 'docs' / 'marketplace' / 'assets' / 'ledgerseal'
with sync_playwright() as p:
    b, ctx = open_browser(p, 1600, 1000, 1.0)
    pg = ctx.new_page()
    open_issue(pg, KEY)
    box = panel_box(pg)
    w = box['width']
    h = w * 900 / 1840
    b.close()
    # Viewport so the flag (bottom-left of the window) lands inside the crop under the panel header
    b, ctx = open_browser(p, 1600, int(box['y'] + h + 20), 1840 / w)
    pg = ctx.new_page()
    open_issue(pg, KEY)
    status = rest(pg, 'GET', f'/rest/api/3/issue/{KEY}?fields=status')['json']['fields']['status']['name']
    pg.locator('button').filter(has_text=status).first.click()
    pg.wait_for_timeout(2500)
    pg.get_by_role('option', name='Done').first.click() if pg.get_by_role('option', name='Done').count() else pg.get_by_text('Done', exact=True).last.click()
    pg.get_by_text('Transition failed').first.wait_for(timeout=60000)
    pg.mouse.move(1500, 60)
    pg.wait_for_timeout(1500)
    box = panel_box(pg)
    path = ASSETS / '03-transition-blocked.png'
    pg.screenshot(path=str(path), clip={'x': box['x'], 'y': box['y'] - pg.evaluate('window.scrollY'), 'width': w, 'height': h})
    im = Image.open(path)
    if im.size != (1840, 900):
        im.resize((1840, 900), Image.LANCZOS).save(path)
    print('wrote', path.name, Image.open(path).size, 'status', rest(pg, 'GET', f'/rest/api/3/issue/{KEY}?fields=status')['json']['fields']['status']['name'])
    b.close()
