import sys
sys.path.insert(0, sys.argv[1])
from playwright.sync_api import sync_playwright
from dg_live import open_browser, rest, SITE
with sync_playwright() as p:
    b, ctx = open_browser(p)
    pg = ctx.new_page()
    pg.goto(SITE + '/rest/api/3/myself', wait_until='domcontentloaded')
    st, me = rest(pg, 'GET', '/rest/api/3/myself')
    print('myself', st, me.get('displayName') if isinstance(me, dict) else str(me)[:100])
    st, pr = rest(pg, 'GET', '/rest/api/3/project/PAY')
    print('PAY', st, pr.get('name') if isinstance(pr, dict) else str(pr)[:100])
    b.close()
