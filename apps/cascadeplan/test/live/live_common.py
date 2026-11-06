"""Live test helpers for CascadePlan on the development site.

Session cookies are read at run time from a file OUTSIDE the repository. Set the environment
variable CASCADEPLAN_LIVE_COOKIES to its path. The file holds a JavaScript-style array of
{ name: '...', value: '...', domain: '...', path: '...' } objects. Never commit that file and
never copy its values into a report.

Screenshots and results go to CASCADEPLAN_LIVE_OUT (default: ./shots next to this file, which
is ignored by git).

Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import os
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent
OUT = pathlib.Path(os.environ.get('CASCADEPLAN_LIVE_OUT', str(HERE / 'shots')))
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


def open_browser(p):
    OUT.mkdir(parents=True, exist_ok=True)
    b = p.chromium.launch(executable_path=CHROME, headless=True, args=['--no-sandbox'])
    # The app CSP blocks eval, which Playwright evaluate needs. This affects the test browser only.
    ctx = b.new_context(viewport={'width': 1600, 'height': 950}, bypass_csp=True)
    ctx.add_cookies(cookies())
    return b, ctx


def planner_frame(pg, timeout_ms=60000):
    """The Custom UI iframe of the planner."""
    import time
    end = time.time() + timeout_ms / 1000
    while time.time() < end:
        for f in pg.frames:
            try:
                if f.url and ('cdn.prod.atlassian-dev.net' in f.url or 'forge' in f.url) and f.query_selector('#ganttBody'):
                    return f
            except Exception:
                pass
        pg.wait_for_timeout(1000)
    return None
