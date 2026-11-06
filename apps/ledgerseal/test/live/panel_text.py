"""Prints the LedgerSeal panel text of an issue. Reads only (opening the panel may record a new change).
Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import sys
from playwright.sync_api import sync_playwright
from ls_live import open_browser
from ls_panel import open_issue
with sync_playwright() as p:
    b, ctx = open_browser(p, 2300, 1300, 1.0)
    pg = ctx.new_page()
    open_issue(pg, sys.argv[1])
    pg.wait_for_timeout(3000)
    txt = pg.locator('body').inner_text()
    i = txt.find('\nLedgerSeal\n')
    print(txt[i:i + 1500])
    b.close()
