# In-Jira Live Browser Automation and Testing Guide

- **Status:** Approved Engineering Guide
- **Date:** 2026-11-04
- **Target Site:** `asymmsystems.atlassian.net`
- **Scope:** Automated browser verification, screenshot capture, and interaction testing for all Asymm Systems Jira suite apps (LedgerSeal, FourRealities, DefinitionGuard, PlanShift) using active session cookies.
- **Author:** Fahim Farook

---

## 1. Why Session Cookies Instead of Email/Password Login

When testing Jira Cloud apps in an automated browser (e.g., Puppeteer, Playwright), attempting to log in with an email and password triggers Atlassian's automated security challenge:
- Atlassian redirects to `https://id.atlassian.com/login/mfa?factorType=EMAIL`.
- An email OTP is generated and sent to the owner on every new browser process.
- Each fresh login attempt invalidates prior OTPs, causing OTP mismatches and inbox spam.

**The Solution:** Use pre-authenticated session cookies. By injecting the owner's session cookies (`tenant.session.token`, `atlassian.xsrf.token`, etc.) directly into the browser context before navigation, Puppeteer bypasses the login and MFA flows completely. Testing executes instantly with **zero OTPs**.

---

## 2. Reusable Session Cookie Set

All browser test scripts should load the following canonical cookie set for `asymmsystems.atlassian.net`:

```javascript
export const JIRA_SESSION_COOKIES = [
  { name: '__aid_user_id', value: '712020%3A0c24238d-ba5f-4307-9d59-fdda2d34b771', domain: '.atlassian.com', path: '/', secure: true },
  { name: '__awc_tld_test__', value: 'tld_test', domain: '.atlassian.net', path: '/', secure: true },
  { name: '__awc_tld_test__', value: 'tld_test', domain: '.asymmsystems.atlassian.net', path: '/', secure: true },
  { name: '__cuid', value: 'f998861064a6467e8f88818fce81d33c', domain: '.asymmsystems.atlassian.net', path: '/', secure: true },
  { name: '__cuid', value: 'd02a05d982c74c81985c2cdc6391feeb', domain: '.atlassian.com', path: '/', secure: true },
  { name: '__cuid', value: 'f998861064a6467e8f88818fce81d33c', domain: '.atlassian.net', path: '/', secure: true },
  { name: '__obref', value: '64878f2a-d224-4422-9c11-c14117af2272', domain: '.atlassian.com', path: '/', secure: true },
  { name: '_bhp', value: '49a78f07-4b2d-49c3-aeac-2ee731c0937d', domain: '.atlassian.com', path: '/', secure: true },
  { name: '_cq_duid', value: '1.1793263242.QN7EsEJshcoD7x13', domain: '.atlassian.com', path: '/', secure: true },
  { name: '_cq_s', value: '630b8c9ddbcbfca8664e82a79ec67e86.3iYzB9E+frGPnLFJ:XwaAly/eJEeHhkDvlyixmWN3dUQEtl+WMEcljgsjuidsogSMadZTg/lzj3VJ9n6dYZBJCgycbUhDWDQdwc7sGN/SZo6InxZ9ET9zvthxY602eETVMkaZbEDBhr0gigE/4FUpccl7uQfwx8eiVm1z9PcEabwq9tU6:y46fH8snpx2nrzpwpj9HRg==', domain: '.atlassian.com', path: '/', secure: true },
  { name: '_cq_session', value: '1.1793263242172.cTqx2AF49knInc16.1793263504085', domain: '.atlassian.com', path: '/', secure: true },
  { name: '_cs_c', value: '0', domain: '.atlassian.com', path: '/', secure: true },
  { name: '_cs_id', value: 'b56692e3-a879-affb-cef0-b6077c284834.1793169799.4.1793422848.1793422848.1.1827333799500.1.x', domain: '.atlassian.com', path: '/', secure: true },
  { name: '_fbp', value: 'fb.1.1793169803106.344897271783767129', domain: '.atlassian.com', path: '/', secure: true },
  { name: '_ga', value: 'GA1.1.1579832229.1793169801', domain: '.atlassian.com', path: '/', secure: true },
  { name: '_ga_EKLW76PEWW', value: 'GS2.2.s1793263245$o2$g1$t1793263419$j60$l0$h0', domain: '.atlassian.com', path: '/', secure: true },
  { name: '_ga_RBK6ZMDS61', value: 'GS2.1.s1793422855$o2$g1$t1793422931$j60$l0$h0', domain: '.atlassian.com', path: '/', secure: true },
  { name: '_ga_Z8B17X4R8Q', value: 'GS2.1.s1793169809$o1$g1$t1793169915$j60$l0$h1944683811', domain: '.atlassian.com', path: '/', secure: true },
  { name: '_gcl_au', value: '1.1.130419515.1793169801.-.-.1793263468.1107308145.1793263469.1793263501', domain: '.atlassian.com', path: '/', secure: true },
  { name: '_mkto_trk', value: 'id:594-ATC-127&token:_mch-atlassian.com-2a250dde4575f7ae68b3630042cb6fa4', domain: '.atlassian.com', path: '/', secure: true },
  { name: '_rdt_uuid', value: '1793263242198.61205a7b-03d1-4cf1-b22f-5d6025f032ef', domain: '.atlassian.com', path: '/', secure: true },
  { name: '_twpid', value: 'tw.1793263241352.93991875259697602', domain: '.atlassian.com', path: '/', secure: true },
  { name: '_twsid', value: '1793263241352-17016771.1.1793263504787', domain: '.atlassian.com', path: '/', secure: true },
  { name: '_uetvid', value: '6cd37db0d37411f1b7e2f59b4b408a31', domain: '.atlassian.com', path: '/', secure: true },
  { name: '_yjsu_yjad', value: '1793263406.d7aa108c-cf0a-4c96-8112-1e055de60399', domain: '.atlassian.com', path: '/', secure: true },
  { name: 'ajs_anonymous_id', value: '%22cd356e20-1ca8-4d95-9570-b76f3da200dc%22', domain: '.atlassian.net', path: '/', secure: true },
  { name: 'ajs_anonymous_id', value: '%22cd356e20-1ca8-4d95-9570-b76f3da200dc%22', domain: '.asymmsystems.atlassian.net', path: '/', secure: true },
  { name: 'ajs_anonymous_id', value: '%2285c5bce2-e6b9-407d-a137-9cd09e385aff%22', domain: '.atlassian.com', path: '/', secure: true },
  { name: 'atl_xid.xc', value: '%7B%22value%22%3A%22a6488b58-1273-4b8f-8761-624f6b9c27b6%22%2C%22type%22%3A%22xc%22%2C%22createdAt%22%3A%222026-10-28T06%3A43%3A16.640Z%22%7D', domain: '.atl-paas.net', path: '/', secure: true },
  { name: 'atl_xid.xc', value: '%7B%22value%22%3A%2295ea5acc-049d-441f-b7d0-b90b5d6ef16b%22%2C%22createdAt%22%3A%222026-10-28T06%3A43%3A16.916Z%22%2C%22type%22%3A%22xc%22%7D', domain: '.atlassian.com', path: '/', secure: true },
  { name: 'atl-bsc-consent-token', value: '0031111010', domain: 'asymmsystems.atlassian.net', path: '/', secure: true },
  { name: 'atl-bsc-consent-token-fallback', value: '0030000010', domain: 'asymmsystems.atlassian.net', path: '/', secure: true },
  { name: 'atl-bsc-show-banner', value: '0', domain: 'asymmsystems.atlassian.net', path: '/', secure: true },
  { name: 'Atl-Ctx-Cloud-Service-Provider', value: 'AWS', domain: '.asymmsystems.atlassian.net', path: '/', secure: true },
  { name: 'atl-sticky-version', value: '%7B%22currentVersion%22%3A%221.477338.0-35aa3a09242c77%22%2C%22currentVersionExpiry%22%3A%221793827620650%22%7D', domain: 'asymmsystems.atlassian.net', path: '/', secure: true },
  { name: 'atlassian.xsrf.token', value: '2e361507de3535f29674988530bc863a2240349c_lin', domain: 'asymmsystems.atlassian.net', path: '/', secure: true },
  { name: 'atlCohort', value: '{"bucketAll":{"bucketedAtUTC":"2026-10-28T06:43:15.909Z","version":"2","index":6,"bucketId":0}}', domain: '.atlassian.com', path: '/', secure: true },
  { name: 'atlUserHash', value: '1393648612', domain: '.atlassian.com', path: '/', secure: true },
  { name: 'AWSALB', value: 'cMfgG1oGzRzLNC6CsUrlOUzzGkY5ekUyJ0b2oOz776KCvzef65yUpj8CdeJV1U71lHfkMEt6UUFnGs/RLvvycBouHFo4MT3GNewZFURLapsnrGdrBiQ0ABxZiuzl', domain: 'asymmsystems.atlassian.net', path: '/', secure: true },
  { name: 'AWSALBCORS', value: 'cMfgG1oGzRzLNC6CsUrlOUzzGkY5ekUyJ0b2oOz776KCvzef65yUpj8CdeJV1U71lHfkMEt6UUFnGs/RLvvycBouHFo4MT3GNewZFURLapsnrGdrBiQ0ABxZiuzl', domain: 'asymmsystems.atlassian.net', path: '/', secure: true },
  { name: 'Bifrost-Atl-Ctx-Cloud-Service-Provider', value: 'AWS', domain: 'asymmsystems.atlassian.net', path: '/', secure: true },
  { name: 'cb_iss', value: 'v|5|0|9', domain: 'asymmsystems.atlassian.net', path: '/', secure: true },
  { name: 'cb_nin', value: '3|2|0|9', domain: 'asymmsystems.atlassian.net', path: '/', secure: true },
  { name: 'jira_theme', value: 'light', domain: 'asymmsystems.atlassian.net', path: '/', secure: true },
  { name: 'marketplace-launch-darkly', value: '%7B%22userKey%22%3A%22f4b9cafd-1768-4879-8820-61d177ff4e4b%22%2C%22aaid%22%3A%22712020%3A0c24238d-ba5f-4307-9d59-fdda2d34b771%22%7D', domain: 'asymmsystems.atlassian.net', path: '/', secure: true },
  { name: 'optimizelyEndUserId', value: 'oeu1793169795965r0.5505264678828571', domain: '.atlassian.com', path: '/', secure: true },
  { name: 'tenant.session.token', value: 'eyJraWQiOiJnZW5lcmljLWtleXBhaXIvc2Vzc2lvbi1zZXJ2aWNlL3NpZ25pbmcta2V5LS1xcGFib21va3ZsNW5iYzhuIiwiYWxnIjoiUlMyNTYifQ.eyJhc3NvY2lhdGlvbnMiOltdLCJzdWIiOiI3MTIwMjA6MGMyNDIzOGQtYmE1Zi00MzA3LTlkNTktZmRkYTJkMzRiNzcxIiwiZW1haWxEb21haW4iOiJhc3ltbS5zeXN0ZW1zIiwiaW1wZXJzb25hdGlvbiI6W10sImNyZWF0ZWQiOjE3OTMyNjMzNTEsInJlZnJlc2hUaW1lb3V0IjoxNzkzNzM0NzY4LCJ2ZXJpZmllZCI6dHJ1ZSwiaXNzIjoiZ2VuZXJpYy1rZXlwYWlyL3Nlc3Npb24tc2VydmljZSIsInNlc3Npb25JZCI6ImNjMDFjN2U5LTU5MjEtNDQ1ZS05N2I3LWI5ZjM2Y2I3YzllMCIsInN0ZXBVcHMiOltdLCJhdWQiOiJhdGxhc3NpYW4iLCJuYmYiOjE3OTM3MzQxNjgsImV4cCI6MTc5NjMyNjE2OCwiaWF0IjoxNzkzNzM0MTY4LCJlbWFpbCI6ImZhaGltQGFzeW1tLnN5c3RlbXMiLCJqdGkiOiJjYzAxYzdlOS01OTIxLTQ0NWUtOTdiNy1iOWYzNmNiN2M5ZTAifQ.V1Z359U7Hwp1f1tfMqPc0UtwrhDSx9N05sHnx6P-sGFAaG1Yg6l53PjTien-DxMuDBgqX-3XnckcyYuowo5pny-CEXZH4M3EhiDX49cjxIH6BCTJqn0oYWgNo6FcwSObNRs0PZJaYjdWOE44HKaNTl-3XHBDQN6Z6ozy42CNfm8C3AXvlrIIU4qnQ1thIXbLcCeT9UD8GaERhBuUzf3VoI05xQ7EtgETZ3-T4t_hEQQzvA1Sqv9flZAsT2m4XrAgT6evKBMW893iMbc9S3-XPlOjDnUi064L1SF3i95vfTQrK3gFdXCQCw58ZX21K_ecFKXyfrVPdNZyWahehsKNTw', domain: 'asymmsystems.atlassian.net', path: '/', httpOnly: true, secure: true },
  { name: 'user_id_for_aiq', value: '712020:0c24238d-ba5f-4307-9d59-fdda2d34b771', domain: '.atlassian.com', path: '/', secure: true },
  { name: 'user_seg_redirect_checked', value: 'true', domain: 'asymmsystems.atlassian.net', path: '/', secure: true },
  { name: 'wac_user_detected', value: '1', domain: '.atlassian.com', path: '/', secure: true }
];
```

---

## 3. Critical Puppeteer Automation Rules for Jira Cloud

When writing browser automation scripts targeting Jira Cloud:

### Rule 1: Always Use `waitUntil: 'domcontentloaded'`
Jira Cloud maintains active WebSockets, SSE channels, and continuous background telemetry.
- **Never use** `waitUntil: 'networkidle2'` or `'networkidle0'`. These will cause an unavoidable `TimeoutError: Navigation timeout of 60000 ms exceeded`.
- **Always use:**
  ```javascript
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  ```
- Allow 4 to 8 seconds of sleep (`new Promise(r => setTimeout(r, 6000))`) for Forge UI Kit native panels to reconcile and fetch initial resolver data.

### Rule 2: Zero Monorepo npm Installs
Do not install Puppeteer inside any app directory (`apps/ledgerseal`, etc.) or modify `package.json`.
- Execute all scratch scripts in a temporary or scratch directory (e.g., `<appDataDir>/brain/<conversationId>/scratch/`).
- Install `puppeteer-core` locally in the scratch directory:
  ```bash
  mkdir -p /tmp/scratch && cd /tmp/scratch && npm init -y && npm install puppeteer-core
  ```
- Use the host Chrome executable: `/usr/bin/google-chrome` with a persistent profile in `/tmp/`.

---

## 4. Jira Navigation Paths and URLs

### A. Testing Issue Panels
- **URL Format:** `https://asymmsystems.atlassian.net/browse/<ISSUE_KEY>`
- **Active Test Issues in Monorepo:**
  - `LSP-3`: Sealed with canonical version 2.1.0, zero incidents (`[SEALED]` lozenge).
  - `DEMO-34`: Revoked with Separation of Duties test (`[REVOKED]` lozenge).

### B. Accessing Admin Pages (`jira:adminPage`)
Do NOT use the internal Connect servlet path (`/plugins/servlet/ac/...`) as a top-level URL. Doing so strips the Jira admin iframe wrapper and triggers Atlassian error code `Hash: ERRN8N`.
Also do NOT use `/jira/settings/apps/manage` (returns 404).

**Canonical Route:**
1. Navigate to: `https://asymmsystems.atlassian.net/plugins/servlet/upm` (or click **Gear Icon (Settings)** -> **Marketplace apps**).
2. Look in the left sidebar under **Apps** for the app title (e.g. **LedgerSeal approvers**).
3. **Canonical App Admin URLs:**
   - **LedgerSeal:** `https://asymmsystems.atlassian.net/jira/settings/apps/7489a645-7c96-400a-b289-eb36f2701a00/ace7a105-325a-4156-851f-dc12a6c6cdda`

---

## 5. Reusable Automation Script Template

Save and run this script from any scratch directory:

```javascript
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { JIRA_SESSION_COOKIES } from './jira-cookies.mjs';

const SCREENSHOT_DIR = path.resolve('./screenshots');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

export async function runJiraTest(targetUrl, screenshotName, interactFn = null) {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    userDataDir: '/tmp/antigravity-cookie-profile',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1600,1000']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });
  await page.setCookie(...JIRA_SESSION_COOKIES);

  console.log(`Navigating to ${targetUrl}...`);
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  
  // Wait for Forge bridge and reconciler
  await new Promise(r => setTimeout(r, 6000));

  if (interactFn) {
    await interactFn(page);
  }

  const outPath = path.join(SCREENSHOT_DIR, screenshotName);
  await page.screenshot({ path: outPath, fullPage: false });
  console.log(`Screenshot saved to ${outPath}`);

  await browser.close();
  return outPath;
}
```

---

## 6. Interactive Testing Pattern on `AdminPolicyPanel`

To verify group searches and policy updates via the standard `@asymm/jira-ui` `AdminPolicyPanel`:

```javascript
// Example: Search, add group, save, and restore
await runJiraTest(
  'https://asymmsystems.atlassian.net/jira/settings/apps/7489a645-7c96-400a-b289-eb36f2701a00/ace7a105-325a-4156-851f-dc12a6c6cdda',
  'admin-test.png',
  async (page) => {
    // 1. Search group
    const input = await page.$('input[placeholder*="group"]');
    if (input) await input.type('jira-admins', { delay: 50 });
    
    // 2. Click Search button
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === 'Search');
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 3000));

    // 3. Click Add
    await page.evaluate(() => {
      const addBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === 'Add');
      if (addBtn) addBtn.click();
    });
    await new Promise(r => setTimeout(r, 2000));

    // 4. Click Save changes
    await page.evaluate(() => {
      const saveBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === 'Save changes');
      if (saveBtn) saveBtn.click();
    });
    await new Promise(r => setTimeout(r, 4000));
  }
);
```

---

## 7. Quality & Verification Gates for Browser Testing

When submitting a browser verification pass in an Asymm Systems app:
- Verify that the issue panel renders inside `<AppSurface>` with a single header title.
- Verify status lozenge appearance matches `@asymm/jira-ui` tokens (`SEALED` is green, `CHANGED`/`REVOKED` is amber/yellow, `NOT SEALED` is neutral gray).
- Verify all action buttons adhere to hierarchy (primary for primary action, default compact for secondary/revoke).
- Verify attestation details are collapsed by default.
- Verify admin panel renders inside Jira's native admin container with group search, card layout, and KVS save confirmation.
