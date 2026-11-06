"""Live check helpers for DefinitionGuard on the development site.

Session cookies are read at run time from the file named by CASCADEPLAN_LIVE_COOKIES (outside
this repository). Never copy its values anywhere. Output (screenshots, JSON) goes to DG_LIVE_OUT,
default /home/fahimfarookme/Documents/projects/jira-governance/.tmp/cache/suite-fixes/scratch-definitionguard/live.

Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import json
import os
import pathlib
import re
import sys

SITE = 'https://asymmsystems.atlassian.net'
CHROME = '/opt/google/chrome/chrome'
OUT = pathlib.Path(os.environ.get('DG_LIVE_OUT', '/home/fahimfarookme/Documents/projects/jira-governance/.tmp/cache/suite-fixes/scratch-definitionguard/live'))
APP_ID = '73e4f63d-7d60-450c-96d5-f81ca68a709c'


def cookies():
    path = os.environ.get('CASCADEPLAN_LIVE_COOKIES')
    if not path or not pathlib.Path(path).is_file():
        sys.exit('Set CASCADEPLAN_LIVE_COOKIES to the cookie file.')
    text = pathlib.Path(path).read_text()
    out = []
    for m in re.finditer(r"\{\s*name:\s*'([^']*)',\s*value:\s*'([^']*)',\s*domain:\s*'([^']*)',\s*path:\s*'([^']*)'", text):
        name, value, domain, cpath = m.groups()
        out.append({'name': name, 'value': value, 'domain': domain, 'path': cpath, 'secure': True})
    if not out:
        sys.exit('No cookies found in the CASCADEPLAN_LIVE_COOKIES file.')
    return out


def open_browser(p, width=1600, height=1000, dpr=1.0):
    OUT.mkdir(parents=True, exist_ok=True)
    b = p.chromium.launch(executable_path=CHROME, headless=True, args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': width, 'height': height}, device_scale_factor=dpr, bypass_csp=True)
    ctx.add_cookies(cookies())
    return b, ctx


def rest(pg, method, path, body=None):
    """A Jira REST call as the signed-in user, from the page (same origin). Returns (status, json or text)."""
    return pg.evaluate("""async ([method, path, body]) => {
      const r = await fetch(path, { method, headers: { 'Content-Type': 'application/json', 'X-Atlassian-Token': 'no-check' },
        body: body === null ? undefined : JSON.stringify(body) });
      const t = await r.text();
      let j = t; try { j = JSON.parse(t); } catch (e) {}
      return [r.status, j];
    }""", [method, path, body])


def save(name, data):
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / name).write_text(json.dumps(data, indent=2))


# ---- Issue panel helpers (UI Kit renders in the page, not in a frame) ----

def open_issue(pg, key, wait_ms=8000):
    pg.goto(SITE + '/browse/' + key, wait_until='domcontentloaded', timeout=150000)
    pg.get_by_role('button', name='View app actions').first.wait_for(timeout=90000)
    pg.wait_for_timeout(wait_ms)


def ensure_panel(pg):
    """Opens the Definition of Done panel, adding it from View app actions when it is not shown."""
    try:
        pg.get_by_text('Definition of Done items').first.wait_for(timeout=30000)
    except Exception:
        pass
    if pg.get_by_text('Definition of Done items').count() == 0:
        if pg.get_by_role('button', name='Refresh').count() == 0:
            pg.get_by_role('button', name='View app actions').first.click()
            pg.wait_for_timeout(1500)
            pg.get_by_role('menuitem', name='Definition of Done').first.click()
    pg.get_by_text('Definition of Done items').first.wait_for(timeout=90000)
    pg.wait_for_timeout(2500)


def row_button(pg, title, button):
    """The button (Waive, Tick with evidence, Show evidence) in the row of the item with this title."""
    # The nearest ancestor that holds exactly one checkbox is the item's own row.
    return pg.locator(f"xpath=//*[normalize-space(text())='{title}']/ancestor::*[count(.//input[@type='checkbox'])=1][last()]//button[normalize-space()='{button}']").first


def item_checkbox(pg, title):
    return pg.get_by_role('checkbox', name=title, exact=True).first


def panel_error(pg):
    loc = pg.locator("xpath=//*[normalize-space(text())='Not saved']/ancestor::section[1]")
    return loc.first.inner_text() if loc.count() else ''


def wait_quiet(pg, ms=6000):
    pg.wait_for_timeout(ms)


def expand_history(pg):
    """Opens the "Checklist audit history" section and loads it."""
    if pg.get_by_role('button', name='Load audit history').count() == 0:
        pg.locator("xpath=//*[normalize-space(text())='Checklist audit history']/ancestor::*[.//button[normalize-space()='Show details']][1]//button[normalize-space()='Show details']").first.click()
        pg.wait_for_timeout(2000)
    pg.get_by_role('button', name='Load audit history').first.click()
    pg.wait_for_timeout(8000)
