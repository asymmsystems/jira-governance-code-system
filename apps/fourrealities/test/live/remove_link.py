"""Removes the remote link that marketplace_shots.py ("link" state) adds to PAY-4, restoring the issue.

Usage: python3 remove_link.py. Needs CASCADEPLAN_LIVE_COOKIES (see live_common.py).

Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import json
import urllib.request

from live_common import SITE, cookies

ISSUE = 'PAY-4'
TITLE = 'Template - Decision documentation'


def call(method, path):
    header = '; '.join(f"{c['name']}={c['value']}" for c in cookies())
    req = urllib.request.Request(SITE + path, method=method, headers={'Cookie': header, 'Accept': 'application/json', 'X-Atlassian-Token': 'no-check'})
    with urllib.request.urlopen(req, timeout=60) as r:
        raw = r.read().decode()
        return r.status, (json.loads(raw) if raw else None)


if __name__ == '__main__':
    status, links = call('GET', f'/rest/api/3/issue/{ISSUE}/remotelink')
    for link in links or []:
        if (link.get('object') or {}).get('title') == TITLE:
            print('delete', link['id'], call('DELETE', f"/rest/api/3/issue/{ISSUE}/remotelink/{link['id']}")[0])
    print('left', len(call('GET', f'/rest/api/3/issue/{ISSUE}/remotelink')[1] or []))
