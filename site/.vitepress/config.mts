import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Asymm Systems Docs',
  description: 'Technical and Compliance Documentation for the Asymm Systems Jira Governance Suite',
  cleanUrls: true,
  sitemap: {
    hostname: 'https://docs.asymm.systems'
  },
  themeConfig: {
    siteTitle: 'Asymm Systems',
    search: {
      provider: 'local'
    },
    nav: [
      { text: 'Suite Overview', link: '/' },
      { text: 'Quickstart', link: '/quickstart' },
      {
        text: 'Governance Apps',
        items: [
          { text: 'LedgerSeal', link: '/apps/ledgerseal/' },
          { text: 'DefinitionGuard', link: '/apps/definitionguard/' },
          { text: 'FourRealities', link: '/apps/fourrealities/' },
          { text: 'PlanShift', link: '/apps/planshift/' }
        ]
      },
      { text: 'Security & Architecture', link: '/architecture-and-security' },
      { text: 'Vendor Assessment', link: '/vendor-security-assessment' },
      { text: 'FAQ', link: '/faq' }
    ],
    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: 'Suite Overview', link: '/' },
          { text: '5-Minute Quickstart', link: '/quickstart' },
          { text: 'Architecture & Zero-Egress', link: '/architecture-and-security' },
          { text: 'Uniform Permission Standard', link: '/permissions-standard' },
          { text: 'Vendor Security Assessment (CAIQ)', link: '/vendor-security-assessment' },
          { text: 'Frequently Asked Questions', link: '/faq' }
        ]
      },
      {
        text: 'LedgerSeal',
        collapsed: false,
        items: [
          { text: 'Overview & Mechanics', link: '/apps/ledgerseal/' },
          { text: 'Admin Guide', link: '/apps/ledgerseal/admin-guide' },
          { text: 'User Guide', link: '/apps/ledgerseal/user-guide' },
          { text: 'Compliance Mapping (SOC 2, Part 11)', link: '/apps/ledgerseal/compliance-mapping' },
          { text: 'Offline Open Verifier', link: '/apps/ledgerseal/open-verifier' }
        ]
      },
      {
        text: 'DefinitionGuard',
        collapsed: false,
        items: [
          { text: 'Overview & DoD Enforcement', link: '/apps/definitionguard/' },
          { text: 'Admin Guide', link: '/apps/definitionguard/admin-guide' },
          { text: 'User Guide', link: '/apps/definitionguard/user-guide' },
          { text: 'Transition Coverage Report', link: '/apps/definitionguard/coverage-report' },
          { text: 'Compliance Mapping (ISO, SOC 2)', link: '/apps/definitionguard/compliance-mapping' }
        ]
      },
      {
        text: 'FourRealities',
        collapsed: false,
        items: [
          { text: 'Overview & Delivery Integrity', link: '/apps/fourrealities/' },
          { text: 'Admin Guide', link: '/apps/fourrealities/admin-guide' },
          { text: 'User Guide & RAI Scores', link: '/apps/fourrealities/user-guide' },
          { text: 'Resolving Delivery Drift', link: '/apps/fourrealities/resolving-drift' }
        ]
      },
      {
        text: 'PlanShift',
        collapsed: false,
        items: [
          { text: 'Overview & Baseline Protection', link: '/apps/planshift/' },
          { text: 'Admin Guide', link: '/apps/planshift/admin-guide' },
          { text: 'User Guide & WBS Planning', link: '/apps/planshift/user-guide' },
          { text: 'Scope Creep Auditing', link: '/apps/planshift/scope-creep-audit' }
        ]
      }
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/asymm-systems/ledgerseal-verifier' }
    ],
    footer: {
      message: '100% Forge Native Governance Suite for Jira Cloud.',
      copyright: 'Copyright 2026 Asymm Systems. All rights reserved.'
    }
  }
});
