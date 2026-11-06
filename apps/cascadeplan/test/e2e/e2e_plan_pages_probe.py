"""N-02 harness check: a plan with more than one page of records is cloned and deleted in pages.

The Main Plan gets 250 extra records. Cloning it from the plan list runs createProjectPlan (first
page) and continuePlanCopy until done, then opens the clone with every record copied. Deleting the
clone runs deleteProjectPlan (first page) and continuePlanDelete until done, and leaves no record.

Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import sys
from playwright.sync_api import sync_playwright
from e2e import serve, wait_rows, CHROME

srv = serve()
base = f'http://127.0.0.1:{srv.server_address[1]}/index.html'
out = {}
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, headless=True, args=['--no-sandbox'])
    pg = b.new_context(viewport={'width': 1600, 'height': 900}).new_page()
    pg.goto(base); pg.evaluate('localStorage.clear()')
    pg.reload(); wait_rows(pg); pg.wait_for_timeout(500)
    # 250 extra Main Plan records (issues the fixture search does not return; they are only copied).
    pg.evaluate("""(() => {
      const m = JSON.parse(localStorage.getItem('__harness_kvs'));
      const k0 = Object.keys(m).find(k => k.startsWith('cp:10000:we:'));
      for (let n = 9000; n < 9250; n++) m['cp:10000:we:' + n] = { ...m[k0], issueKey: 'DEMO-' + n, issueId: String(n) };
      localStorage.setItem('__harness_kvs', JSON.stringify(m));
    })()""")
    pg.reload(); wait_rows(pg); pg.wait_for_timeout(500)
    count = "(prefix) => Object.keys(JSON.parse(localStorage.getItem('__harness_kvs'))).filter(k => k.startsWith(prefix)).length"
    out['main_records'] = pg.evaluate(f"({count})('cp:10000:we:')")

    pg.evaluate('window.__calls = []')
    pg.click('#planSelectorBtn'); pg.wait_for_timeout(300)
    pg.locator('#plansListContainer .plan-item-row').first.locator('button[title="Duplicate / Clone this plan"]').click()
    pg.wait_for_function("document.getElementById('planSelectorLabel').textContent.includes('(Copy)')", timeout=30000)
    wait_rows(pg); pg.wait_for_timeout(500)
    calls = pg.evaluate('window.__calls.map(c => c.fn)')
    out['copy_calls'] = [c for c in calls if c in ('createProjectPlan', 'continuePlanCopy')]
    plans = pg.evaluate("JSON.parse(localStorage.getItem('__harness_kvs'))['cp:10000:plans']")
    clone = [x for x in plans['plans'] if x['name'].endswith('(Copy)')][0]
    out['clone_state'] = clone.get('state')
    out['clone_records'] = pg.evaluate(f"({count})('cp:10000:plan:{clone['id']}:we:')")

    pg.evaluate('window.__calls = []')
    pg.click('#planSelectorBtn'); pg.wait_for_timeout(300)
    row = pg.locator('#plansListContainer .plan-item-row', has_text='(Copy)').first
    row.locator('button[title="Delete plan"]').click()
    row.locator('button[title="Delete plan"]').click()
    pg.wait_for_function("!JSON.parse(localStorage.getItem('__harness_kvs'))['cp:10000:plans'].plans.some(p => p.name.endsWith('(Copy)'))", timeout=30000)
    pg.wait_for_timeout(500)
    calls = pg.evaluate('window.__calls.map(c => c.fn)')
    out['delete_calls'] = [c for c in calls if c in ('deleteProjectPlan', 'continuePlanDelete')]
    out['clone_records_after_delete'] = pg.evaluate(f"({count})('cp:10000:plan:{clone['id']}:')")
    out['label_after_delete'] = pg.inner_text('#planSelectorLabel')
    b.close()
srv.shutdown()
pages = -(-out['main_records'] // 100)
ok = (out['clone_records'] == out['main_records'] and out['clone_state'] is None
      and out['copy_calls'] == ['createProjectPlan'] + ['continuePlanCopy'] * (pages - 1)
      and out['delete_calls'] == ['deleteProjectPlan'] + ['continuePlanDelete'] * (pages - 1)
      and out['clone_records_after_delete'] == 0 and 'Main Plan' in out['label_after_delete'])
print(('PASS' if ok else 'FAIL') + f' N-02 clone and delete in pages of 100: {out}')
sys.exit(0 if ok else 1)
