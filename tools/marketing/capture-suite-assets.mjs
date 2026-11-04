#!/usr/bin/env node
/**
 * Asymm Systems Jira Governance Suite
 * Live Screenshot Asset Capture Engine
 *
 * Viewport: 1840x1150 px PNG (Atlassian Marketplace specification)
 * Uses puppeteer-core, host Chrome, and pre-authenticated Jira session cookies.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from '/tmp/scratch/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ASSETS_ROOT = join(HERE, '../../docs/marketplace/assets');

// Load session cookies from gitignored file
const COOKIES_PATH = process.env.JIRA_COOKIES_FILE || '/tmp/scratch/jira-cookies.mjs';

if (!existsSync(COOKIES_PATH)) {
  console.error(`Session cookies file not found at ${COOKIES_PATH}. Please provide valid session cookies.`);
  process.exit(1);
}

const cookiesModule = await import(COOKIES_PATH);
const JIRA_SESSION_COOKIES = cookiesModule.JIRA_SESSION_COOKIES || cookiesModule.cookies;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function safeGoto(page, url, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 35000 });
      return;
    } catch (e) {
      console.log(`Navigation attempt ${i + 1} failed: ${e.message}. Retrying...`);
      await sleep(2000);
    }
  }
  throw new Error(`Failed to navigate to ${url} after ${maxRetries} attempts`);
}

async function captureAll() {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--window-size=1840,1150'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1840, height: 1150, deviceScaleFactor: 1 });
  await page.setCookie(...JIRA_SESSION_COOKIES);

  console.log('--- CAPTURING LEDGERSEAL SUITE ASSETS ---');
  const lsDir = join(ASSETS_ROOT, 'ledgerseal');
  mkdirSync(lsDir, { recursive: true });

  // 1. LSP-3 Sealed Panel
  console.log('Capturing LedgerSeal 01-sealed-panel...');
  await safeGoto(page, 'https://asymmsystems.atlassian.net/browse/LSP-3');
  await sleep(7000);
  await page.screenshot({ path: join(lsDir, '01-sealed-panel.png') });

  // 2. DEMO-34 Tamper detection
  console.log('Capturing LedgerSeal 02-tamper-detected...');
  await safeGoto(page, 'https://asymmsystems.atlassian.net/browse/DEMO-34');
  await sleep(7000);
  await page.screenshot({ path: join(lsDir, '02-tamper-detected.png') });

  // 3. LSP-3 Certificate Details expanded
  console.log('Capturing LedgerSeal 05-certificate...');
  await safeGoto(page, 'https://asymmsystems.atlassian.net/browse/LSP-3');
  await sleep(6000);
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button, div[role="button"]'));
    const certBtn = btns.find(b => b.innerText.includes('Certificate') || b.innerText.includes('SEALED') || b.innerText.includes('Details'));
    if (certBtn) certBtn.click();
  });
  await sleep(3000);
  await page.screenshot({ path: join(lsDir, '05-certificate.png') });

  // 4. LedgerSeal Admin Approvers
  console.log('Capturing LedgerSeal 04-admin-approvers...');
  await safeGoto(page, 'https://asymmsystems.atlassian.net/jira/settings/apps/7489a645-7c96-400a-b289-eb36f2701a00/ace7a105-325a-4156-851f-dc12a6c6cdda');
  await sleep(7000);
  await page.screenshot({ path: join(lsDir, '04-admin-approvers.png') });

  console.log('--- CAPTURING DEFINITIONGUARD SUITE ASSETS ---');
  const dgDir = join(ASSETS_ROOT, 'definitionguard');
  mkdirSync(dgDir, { recursive: true });

  // 1. DoD Checklist Open on DEMO-35
  console.log('Capturing DefinitionGuard 01-checklist-open...');
  await safeGoto(page, 'https://asymmsystems.atlassian.net/browse/DEMO-35');
  await sleep(6000);
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button, div[role="button"]'));
    const dodBtn = btns.find(b => b.innerText.trim() === 'Definition of Done');
    if (dodBtn) dodBtn.click();
  });
  await sleep(4000);
  await page.screenshot({ path: join(dgDir, '01-checklist-open.png') });

  // 2. Evidence Form Open
  console.log('Capturing DefinitionGuard 02-evidence-link...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const evBtn = btns.find(b => b.innerText.includes('Add evidence') || b.innerText.includes('Link'));
    if (evBtn) evBtn.click();
  });
  await sleep(2000);
  await page.screenshot({ path: join(dgDir, '02-evidence-link.png') });

  // 3. DefinitionGuard Project Settings
  console.log('Capturing DefinitionGuard 04-project-settings...');
  await safeGoto(page, 'https://asymmsystems.atlassian.net/plugins/servlet/upm');
  await sleep(5000);
  await page.screenshot({ path: join(dgDir, '04-project-settings.png') });

  console.log('--- CAPTURING FOURREALITIES SUITE ASSETS ---');
  const frDir = join(ASSETS_ROOT, 'fourrealities');
  mkdirSync(frDir, { recursive: true });

  // 1. FourRealities AUDT-1 Issue Glance
  console.log('Capturing FourRealities 02-rai-glance...');
  await safeGoto(page, 'https://asymmsystems.atlassian.net/browse/AUDT-1');
  await sleep(6000);
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button, div[role="button"]'));
    const glance = btns.find(b => b.innerText.includes('Reality') || b.innerText.includes('Alignment') || b.innerText.includes('Integrity'));
    if (glance) glance.click();
  });
  await sleep(4000);
  await page.screenshot({ path: join(frDir, '02-rai-glance.png') });

  // 2. AUDT-2 Confluence Link Modal
  console.log('Capturing FourRealities 04-settings...');
  await safeGoto(page, 'https://asymmsystems.atlassian.net/browse/AUDT-2');
  await sleep(6000);
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find(b => b.innerText.includes('Connect ADR') || b.innerText.includes('Attach Spec'));
    if (btn) btn.click();
  });
  await sleep(3000);
  await page.screenshot({ path: join(frDir, '04-settings.png') });

  await browser.close();
  console.log('Live asset capture complete.');
}

captureAll().catch(err => {
  console.error(err);
  process.exit(1);
});
