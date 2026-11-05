"""Builds the browser harness page into test/e2e/site/ (ignored by git).

The page is the app's own static/frontend/build/index.html and style.css, plus the Atlassian
design-token stylesheet that Jira normally injects. The script bundles entry.ts with the app's
own esbuild (apps/cascadeplan/tools), with the Forge platform replaced by the stubs in stubs/.

Usage, from apps/cascadeplan/test/e2e:  python3 build_site.py
Then run any harness script, for example:  python3 e2e.py

Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
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
    (SITE / 'index.html').write_text(page.replace(marker, link + '\n  ' + marker, 1))
    cmd = [str(ESBUILD), 'entry.ts', '--bundle', '--format=iife', '--target=es2020', '--outfile=site/app.js',
           '--banner:js=var process={env:{}};',
           '--alias:@forge/api=./stubs/forge-api.ts', '--alias:@forge/kvs=./stubs/forge-kvs.ts',
           '--alias:@forge/resolver=./stubs/forge-resolver.ts', '--alias:@forge/bridge=./stubs/forge-bridge.ts']
    return subprocess.run(cmd, cwd=HERE).returncode


if __name__ == '__main__':
    sys.exit(main())
