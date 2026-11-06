"""Saves a realistic Definition of Done template for PAY's Task issue type through the settings
page (a live write in PAY: key dg:tmpl:10036:<Task id>). Usage: python3 pay_template.py

Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
from playwright.sync_api import sync_playwright
from dg_live import open_browser, SITE, OUT, APP_ID

ENV = 'b575a3a8-ffe9-4570-ac50-42a6a555c167'
URL = f'{SITE}/jira/software/c/projects/PAY/settings/apps/{APP_ID}/{ENV}'
NAME = 'Payments task DoD'
# (title, mandatory, evidence required, not the assignee)
ITEMS = [
    ('Unit and integration tests pass in CI', True, True, False),
    ('Code review approved by another engineer', True, False, True),
    ('PCI DSS scope impact assessed', True, False, False),
    ('Load test results attached for changed endpoints', True, True, False),
    ('Runbook and on-call notes updated', False, False, False),
]

with sync_playwright() as p:
    b, ctx = open_browser(p)
    pg = ctx.new_page()
    pg.goto(URL, wait_until='domcontentloaded', timeout=150000)
    pg.get_by_text('Gate coverage').first.wait_for(timeout=90000)
    pg.wait_for_timeout(5000)
    assert 'Task' in pg.inner_text('body')
    name = pg.locator('[id$="-dg-template-name"]')
    name.fill(NAME)
    for title, *_ in ITEMS:
        pg.locator('[id$="-dg-new-item"]').fill(title)
        pg.wait_for_timeout(600)
        pg.get_by_role('button', name='Add item').click()
        pg.wait_for_timeout(1500)
    for i, (title, mandatory, evidence, not_assignee) in enumerate(ITEMS):
        if not mandatory:
            pg.get_by_label('Mandatory', exact=True).nth(i).click()
            pg.wait_for_timeout(700)
        if evidence:
            pg.get_by_label('Evidence required', exact=True).nth(i).click()
            pg.wait_for_timeout(700)
        if not_assignee:
            pg.get_by_label('Not the assignee', exact=True).nth(i).click()
            pg.wait_for_timeout(700)
    pg.screenshot(path=str(OUT / 'template-before-save.png'), full_page=True)
    pg.get_by_role('button', name='Save template').click()
    pg.get_by_text('saved. New checklists for this issue type use it').first.wait_for(timeout=60000)
    pg.wait_for_timeout(2000)
    pg.screenshot(path=str(OUT / 'template-saved.png'), full_page=True)
    print('saved:', pg.get_by_text('saved. New checklists').first.inner_text())
    b.close()
