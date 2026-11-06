"""Opens an issue with the Approval Seal panel, adding the panel through "View app actions" when needed.
Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
from ls_live import SITE


def open_issue(pg, key):
    pg.goto(f'{SITE}/browse/{key}', wait_until='domcontentloaded', timeout=150000)
    try:
        pg.get_by_text('Approval seal:', exact=False).first.wait_for(timeout=40000)
    except Exception:
        pass
    if pg.get_by_text('Approval seal:', exact=False).count() == 0:
        pg.get_by_role('button', name='View app actions').first.click()
        pg.wait_for_timeout(2000)
        pg.get_by_text('Approval Seal', exact=True).first.click()
    pg.get_by_text('Approval seal:', exact=False).first.wait_for(timeout=90000)
    pg.wait_for_timeout(1500)


def panel_box(pg):
    """The LedgerSeal app surface: from the app's own header row to the end of its content (no Jira header, no DEV badge)."""
    return pg.evaluate("""() => {
      const leaf = [...document.querySelectorAll('*')].find(e => e.childElementCount === 0 && (e.textContent || '').startsWith('Approval seal:'));
      let best = null;
      for (let el = leaf; el && el !== document.body; el = el.parentElement) {
        if ((el.innerText || '').trim().startsWith('LedgerSeal')) best = el;
      }
      const r = best.getBoundingClientRect();
      return { x: r.x + window.scrollX, y: r.y + window.scrollY, width: r.width, height: r.height };
    }""")


def click_text(pg, text, exact=True):
    """Clicks the button whose visible text is `text` (an icon can change a button's accessible name)."""
    import re
    pattern = re.compile('^\\s*' + re.escape(text) + '\\s*$') if exact else re.compile(re.escape(text))
    pg.locator('button').filter(has_text=pattern).first.click()
    pg.wait_for_timeout(1500)
