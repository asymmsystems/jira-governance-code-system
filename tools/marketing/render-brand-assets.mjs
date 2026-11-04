#!/usr/bin/env node
/**
 * Render Marketplace Brand Assets (Icons and Hero Banners)
 * Generates:
 * - icon.png: 144x144 px transparent background PNG
 * - banner.png: 2280x1140 px (2:1 ratio) high-res hero banner
 *
 * Uses puppeteer-core and system Chrome.
 */

import puppeteer from '/tmp/scratch/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ASSETS_ROOT = join(HERE, '../../docs/marketplace/assets');

const APPS = [
  {
    name: 'ledgerseal',
    title: 'LedgerSeal',
    tagline: 'Tamper-evident approval seals and post-approval change control for Jira.',
    primaryColor: '#0C66E4',
    badgeColor: '#1F845A',
    badgeText: 'CRYPTOGRAPHIC AUDIT GATE',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="96" height="96" fill="none" stroke="#0C66E4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5 4.5 5.5v6c0 4.7 3.2 8.6 7.5 10 4.3-1.4 7.5-5.3 7.5-10v-6z"/><path d="m8.5 12 2.5 2.5 4.5-5"/></svg>`,
    highlights: [
      'Ed25519 digital signatures on approvals',
      'SHA-256 snapshot hashes of ticket state',
      'Workflow transition validator prevents unapproved releases',
      '100% Forge native: zero external egress'
    ]
  },
  {
    name: 'definitionguard',
    title: 'DefinitionGuard',
    tagline: 'Enforceable Definition of Done with evidence, peer review rules, and audit history.',
    primaryColor: '#0052CC',
    badgeColor: '#0052CC',
    badgeText: 'DEFINITION OF DONE ENFORCEMENT',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="#0052CC" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 12.5l2.8 2.8L16.5 9"/></svg>`,
    highlights: [
      'Per-issue-type DoD checklist criteria',
      'Mandatory evidence links and documentation notes',
      'Peer review rules and audited waiver workflows',
      'Workflow transition gate blocks move to Done'
    ]
  },
  {
    name: 'fourrealities',
    title: 'FourRealities',
    tagline: 'Delivery integrity dashboard: align Confluence specs, Jira issues, and Git PRs.',
    primaryColor: '#6554C0',
    badgeColor: '#6554C0',
    badgeText: 'DELIVERY INTEGRITY & DRIFT AUDIT',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="#6554C0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
    highlights: [
      'Four delivery perspectives: Intent, Process, Code, Audit',
      'Objective Reality Alignment Index (RAI) scoring',
      'Detects unlinked PRs, missed reviews, and rework loops',
      'Native Jira development status and remote links integration'
    ]
  },
  {
    name: 'cascadeplan',
    title: 'CascadePlan',
    tagline: 'Visual sprint baseline control, scope creep detection, and WBS planning for Jira.',
    primaryColor: '#0065FF',
    badgeColor: '#FF8B00',
    badgeText: 'BASELINE CONTROL & SCOPE GOVERNANCE',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="#0065FF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="7" y1="8" x2="17" y2="8"/><line x1="7" y1="12" x2="13" y2="12"/><line x1="7" y1="16" x2="15" y2="16"/><circle cx="17" cy="12" r="1.5" fill="#36B37E"/></svg>`,
    highlights: [
      'Visual sprint baseline freezing and commitment snapshots',
      'Scope creep detection with variance and delta tracking',
      'Formal shift approval workflows with authority control',
      'Visual WBS task planning and resource utilization grid'
    ]
  }
];

async function renderAssets() {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  for (const app of APPS) {
    const appDir = join(ASSETS_ROOT, app.name);
    mkdirSync(appDir, { recursive: true });

    // 1. Render Icon (144x144 px PNG)
    const iconPage = await browser.newPage();
    await iconPage.setViewport({ width: 144, height: 144, deviceScaleFactor: 1 });
    const iconHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            width: 144px;
            height: 144px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: transparent;
          }
          .icon-box {
            width: 136px;
            height: 136px;
            border-radius: 28px;
            background: #FFFFFF;
            box-shadow: 0 4px 16px rgba(9, 30, 66, 0.12), 0 0 0 1px rgba(9, 30, 66, 0.08);
            display: flex;
            align-items: center;
            justify-content: center;
          }
        </style>
      </head>
      <body>
        <div class="icon-box">
          ${app.iconSvg}
        </div>
      </body>
      </html>
    `;
    await iconPage.setContent(iconHtml, { waitUntil: 'domcontentloaded' });
    const iconPath = join(appDir, 'icon.png');
    await iconPage.screenshot({ path: iconPath, omitBackground: true });
    await iconPage.close();
    console.log(`Rendered icon: ${iconPath}`);

    // 2. Render Cover Banner (2280x1140 px PNG, 2:1 ratio)
    const bannerPage = await browser.newPage();
    await bannerPage.setViewport({ width: 2280, height: 1140, deviceScaleFactor: 1 });
    const bannerHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            width: 2280px;
            height: 1140px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background: linear-gradient(135deg, #091E42 0%, #172B4D 60%, #0052CC 100%);
            color: #FFFFFF;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            padding: 100px 140px;
            position: relative;
            overflow: hidden;
          }
          .bg-decor {
            position: absolute;
            top: -200px;
            right: -100px;
            width: 900px;
            height: 900px;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(12, 102, 228, 0.15) 0%, rgba(9, 30, 66, 0) 70%);
            pointer-events: none;
          }
          .header-row {
            display: flex;
            align-items: center;
            gap: 24px;
            z-index: 10;
          }
          .publisher-tag {
            font-size: 24px;
            font-weight: 700;
            letter-spacing: 2px;
            color: #B3D4FF;
            text-transform: uppercase;
          }
          .badge {
            background: rgba(255, 255, 255, 0.12);
            border: 1px solid rgba(255, 255, 255, 0.25);
            padding: 8px 20px;
            border-radius: 20px;
            font-size: 20px;
            font-weight: 600;
            letter-spacing: 1px;
            color: #E9F2FF;
          }
          .content-hero {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 80px;
            z-index: 10;
          }
          .text-col {
            flex: 1;
            max-width: 1200px;
          }
          .title-row {
            display: flex;
            align-items: center;
            gap: 32px;
            margin-bottom: 28px;
          }
          .app-icon-large {
            width: 120px;
            height: 120px;
            border-radius: 26px;
            background: #FFFFFF;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
          }
          .app-title {
            font-size: 92px;
            font-weight: 800;
            letter-spacing: -1.5px;
            color: #FFFFFF;
            line-height: 1;
          }
          .app-tagline {
            font-size: 38px;
            line-height: 1.35;
            color: #DEEBFF;
            font-weight: 400;
            margin-bottom: 44px;
          }
          .highlight-list {
            list-style: none;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px 40px;
          }
          .highlight-item {
            font-size: 26px;
            color: #FFFFFF;
            display: flex;
            align-items: center;
            gap: 16px;
            font-weight: 500;
          }
          .check-bullet {
            width: 28px;
            height: 28px;
            border-radius: 50%;
            background: #36B37E;
            color: #FFFFFF;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            font-weight: 700;
            flex-shrink: 0;
          }
          .footer-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-top: 1px solid rgba(255, 255, 255, 0.15);
            padding-top: 36px;
            font-size: 24px;
            color: #8993A4;
            z-index: 10;
          }
          .footer-pills {
            display: flex;
            gap: 24px;
          }
          .footer-pill {
            display: flex;
            align-items: center;
            gap: 10px;
            color: #B3D4FF;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="bg-decor"></div>
        <div class="header-row">
          <span class="publisher-tag">Asymm Systems</span>
          <span class="badge">${app.badgeText}</span>
        </div>
        <div class="content-hero">
          <div class="text-col">
            <div class="title-row">
              <div class="app-icon-large">${app.iconSvg}</div>
              <h1 class="app-title">${app.title}</h1>
            </div>
            <p class="app-tagline">${app.tagline}</p>
            <ul class="highlight-list">
              ${app.highlights.map(h => `<li class="highlight-item"><span class="check-bullet">&#10003;</span> ${h}</li>`).join('')}
            </ul>
          </div>
        </div>
        <div class="footer-row">
          <div class="footer-pills">
            <span class="footer-pill">&#128274; 100% Forge Native</span>
            <span class="footer-pill">&#128737; Zero External Egress</span>
            <span class="footer-pill">&#128190; Customer Tenant Data Residency</span>
          </div>
          <div>Jira Cloud Marketplace</div>
        </div>
      </body>
      </html>
    `;
    await bannerPage.setContent(bannerHtml, { waitUntil: 'domcontentloaded' });
    const bannerPath = join(appDir, 'banner.png');
    await bannerPage.screenshot({ path: bannerPath });
    await bannerPage.close();
    console.log(`Rendered banner: ${bannerPath}`);
  }

  await browser.close();
  console.log('All brand assets rendered successfully.');
}

renderAssets().catch(err => {
  console.error(err);
  process.exit(1);
});
