"""Screenshot 04: the LedgerSeal approvers admin page with a group search (reads only; nothing is saved).
Crop: the app page below the Jira header, 1840 x 900 px.
Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import pathlib
from PIL import Image
from playwright.sync_api import sync_playwright
from ls_live import open_browser, SITE

ASSETS = pathlib.Path(__file__).resolve().parents[4] / 'docs' / 'marketplace' / 'assets' / 'ledgerseal'
URL = SITE + '/jira/settings/apps/7489a645-7c96-400a-b289-eb36f2701a00/ace7a105-325a-4156-851f-dc12a6c6cdda'
W = 1320
with sync_playwright() as p:
    b, ctx = open_browser(p, W, 1000, 1840 / W)
    pg = ctx.new_page()
    pg.goto(URL, wait_until='domcontentloaded', timeout=150000)
    pg.get_by_text('Approver groups', exact=False).first.wait_for(timeout=90000)
    pg.get_by_placeholder('Type group name...').fill('jira')
    pg.locator('button').filter(has_text='Search').last.click()
    pg.wait_for_timeout(6000)
    pg.mouse.move(2, 2)
    top = pg.get_by_role('heading', name='LedgerSeal approvers').first.bounding_box()['y'] - 24
    path = ASSETS / '04-admin-approvers.png'
    pg.screenshot(path=str(path), clip={'x': 0, 'y': top, 'width': W, 'height': W * 900 / 1840})
    im = Image.open(path)
    if im.size != (1840, 900):
        im.resize((1840, 900), Image.LANCZOS).save(path)
    print('wrote', path.name, Image.open(path).size)
    b.close()
