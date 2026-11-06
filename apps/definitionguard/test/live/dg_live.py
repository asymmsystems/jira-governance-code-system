"""Live check helpers for DefinitionGuard on the development site.

Session cookies are read at run time from the file named by CASCADEPLAN_LIVE_COOKIES (outside
this repository). Never copy its values anywhere. Output (screenshots, JSON) goes to DG_LIVE_OUT,
default /home/fahimfarookme/.cache/jira-suite-fixes/scratch-definitionguard/live.

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
OUT = pathlib.Path(os.environ.get('DG_LIVE_OUT', '/home/fahimfarookme/.cache/jira-suite-fixes/scratch-definitionguard/live'))
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
