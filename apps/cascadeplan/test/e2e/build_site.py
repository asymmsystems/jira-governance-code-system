"""Builds the browser harness page into test/e2e/site/ (ignored by git).

The page is the app's own static/frontend/build/index.html and style.css, plus the Atlassian
design-token stylesheet that Jira normally injects. The script bundles entry.ts with the app's
own esbuild (apps/cascadeplan/tools), with the Forge platform replaced by the stubs in stubs/.

Usage, from apps/cascadeplan/test/e2e:  python3 build_site.py
(CP_STRICT_CSP=1 python3 build_site.py builds the page under style-src 'self', for MK-09.)
Then run any harness script, for example:  python3 e2e.py

Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import os
import pathlib
import shutil
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent
APP = HERE.parent.parent
SITE = HERE / 'site'
STATIC = APP / 'static' / 'frontend' / 'build'
ESBUILD = APP / 'tools' / 'node_modules' / '.bin' / 'esbuild'
TOKENS = 'atlaskit-tokens_light.css'


def main() -> int:
    if not ESBUILD.exists():
        print(f'esbuild not found at {ESBUILD}. Run "npm ci" in {APP / "tools"} first.', file=sys.stderr)
        return 1
    SITE.mkdir(exist_ok=True)
    for name in ('style.css', 'icon.svg'):
        shutil.copyfile(STATIC / name, SITE / name)
    shutil.copyfile(HERE / 'assets' / TOKENS, SITE / TOKENS)
    page = (STATIC / 'index.html').read_text()
    link = f'<link rel="stylesheet" href="{TOKENS}">'
    marker = '<link rel="stylesheet" href="./style.css">'
    if marker not in page:
        print('index.html has no ./style.css link; cannot add the token stylesheet.', file=sys.stderr)
        return 1
    page = page.replace(marker, link + '\n  ' + marker, 1)
    # MK-09: with CP_STRICT_CSP=1 the page runs under style-src 'self' (no 'unsafe-inline'), as the app
    # does in Jira once the permission is dropped, and every refused style is kept in __cspViolations.
    if os.environ.get('CP_STRICT_CSP') == '1':
        strict = ('<meta http-equiv="Content-Security-Policy" content="style-src \'self\'">\n  '
                  '<script>window.__cspViolations = []; document.addEventListener("securitypolicyviolation", '
                  'e => window.__cspViolations.push(e.violatedDirective + " " + (e.sourceFile || "") + ":" + e.lineNumber + " " + (e.sample || "")));</script>\n  ')
        page = page.replace('<meta charset="UTF-8">', '<meta charset="UTF-8">\n  ' + strict, 1)
    (SITE / 'index.html').write_text(page)
    cmd = [str(ESBUILD), 'entry.ts', '--bundle', '--format=iife', '--target=es2020', '--outfile=site/app.js',
           '--banner:js=var process={env:{}};',
           '--alias:@forge/api=./stubs/forge-api.ts', '--alias:@forge/kvs=./stubs/forge-kvs.ts',
           '--alias:@forge/resolver=./stubs/forge-resolver.ts', '--alias:@forge/bridge=./stubs/forge-bridge.ts',
           '--alias:async_hooks=./stubs/async-hooks.ts']
    return subprocess.run(cmd, cwd=HERE).returncode


if __name__ == '__main__':
    sys.exit(main())
