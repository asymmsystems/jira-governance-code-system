# Copyright (c) 2026 Asymm Systems. All rights reserved.
#
# @author Fahim Farook
"""Probe: is Undo offered after a drag when the resolver response is not stale? Asymm Systems. @author Fahim Farook"""
import pathlib
from playwright.sync_api import sync_playwright
from e2e import serve, wait_rows, kvs, record, drag_bar, CHROME
OUT = pathlib.Path(__file__).resolve().parent / 'results-review'
srv = serve(); base = f'http://127.0.0.1:{srv.server_address[1]}/index.html'
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, headless=True, args=['--no-sandbox'])
    pg = b.new_context(viewport={'width': 1600, 'height': 900}).new_page()
    pg.goto(base); pg.evaluate('localStorage.clear()'); pg.reload(); wait_rows(pg)
    w = pg.locator('.bar-hit[data-task-id="DEMO-40"]').bounding_box()['width']
    before = record(kvs(pg), 'default', 'DEMO-40')
    drag_bar(pg, 'DEMO-40', w / 5 * 7)
    after = record(kvs(pg), 'default', 'DEMO-40')
    fl = pg.evaluate("[...document.querySelectorAll('.flag')].map(f => f.textContent.trim())")
    print('first drag (Jira had no due date):', before['startDate'], '->', after['startDate'], 'flags:', fl)
    pg.screenshot(path=str(OUT / 'R2-probe-first-drag-no-undo.png'))
    pg.keyboard.press('Control+z'); pg.wait_for_timeout(1200)
    print('after Ctrl+Z:', record(kvs(pg), 'default', 'DEMO-40')['startDate'])
    b.close()
srv.shutdown()
