"""Live helpers for FourRealities on the development site (asymmsystems.atlassian.net).

Session cookies are read at run time from a file OUTSIDE the repository, named by the environment
variable CASCADEPLAN_LIVE_COOKIES (the same file the CascadePlan live tests use). Never commit that
file and never copy its values into a report.

Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import os
import pathlib
import re
import sys

SITE = 'https://asymmsystems.atlassian.net'
CHROME = '/opt/google/chrome/chrome'
APP = '974e4981-7626-4b1c-a41f-7eaccb7f3605'
DEV_ENV = 'c9d5ad8b-0b9e-41eb-9bca-a0384f708c20'
DASHBOARD = f'/jira/software/projects/PAY/apps/{APP}/{DEV_ENV}'
ADMIN = f'/jira/settings/apps/{APP}/{DEV_ENV}'


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
