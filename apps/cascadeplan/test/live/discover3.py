"""Discovery 3: open the planner page. Asymm Systems. @author Fahim Farook"""
from playwright.sync_api import sync_playwright
from live_common import open_browser, SITE, OUT, planner_frame
URL = SITE + '/jira/servicedesk/projects/DEMO/apps/cac8499e-e92e-4ba6-95cc-af398b1be791/5dfcdd60-51aa-4ea9-a5e2-c94d7e294677'
with sync_playwright() as p:
    b, ctx = open_browser(p)
    pg = ctx.new_page()
    pg.goto(URL, wait_until='domcontentloaded', timeout=60000)
    f = planner_frame(pg, 70000)
    print('url', pg.url, 'frame', bool(f))
    print('frames', [x.url[:90] for x in pg.frames][:8])
    if f:
        f.wait_for_function("document.querySelectorAll('#ganttBody tr.task-row').length > 0", timeout=60000)
        pg.wait_for_timeout(2000)
        print('rows', f.evaluate("[...document.querySelectorAll('#ganttBody tr.task-row')].map(r => r.dataset.taskId)"))
        print('plan label', f.inner_text('#planSelectorLabel'))
        print('buttons', f.evaluate("[...document.querySelectorAll('button')].map(b => b.textContent.trim()).filter(Boolean).slice(0,60)"))
    pg.screenshot(path=str(OUT / 'L1-planner-loaded.png'))
    b.close()
