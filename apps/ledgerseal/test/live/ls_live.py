"""Live helpers for LedgerSeal on the development site (asymmsystems.atlassian.net).

Session cookies are read at run time from the file named by CASCADEPLAN_LIVE_COOKIES (outside the
repository). Never commit that file and never copy its values anywhere. Output goes to
LEDGERSEAL_LIVE_OUT (default: ./shots next to this file, ignored by git).

Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import json
import os
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent
OUT = pathlib.Path(os.environ.get('LEDGERSEAL_LIVE_OUT', str(HERE / 'shots')))
SITE = 'https://asymmsystems.atlassian.net'
CHROME = '/opt/google/chrome/chrome'


def cookies():
    path = os.environ.get('CASCADEPLAN_LIVE_COOKIES')
    if not path or not pathlib.Path(path).is_file():
        sys.exit('Set CASCADEPLAN_LIVE_COOKIES to a cookie file outside the repository.')
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
    """Calls the Jira REST API as the signed-in user from inside the page (same origin)."""
    return pg.evaluate(
        """async ([method, path, body]) => {
          const r = await fetch(path, { method, headers: { 'Content-Type': 'application/json', 'X-Atlassian-Token': 'no-check' },
            body: body === null ? undefined : JSON.stringify(body) });
          const text = await r.text();
          let json = null; try { json = JSON.parse(text); } catch (e) {}
          return { status: r.status, json };
        }""",
        [method, path, body],
    )


def dump(name, value):
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / name).write_text(json.dumps(value, indent=2))
