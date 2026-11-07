<!--
Copyright (c) 2026 Asymm Systems. All rights reserved.

@author Fahim Farook
-->
# LedgerSeal regulated build (2026-11)

Build of the owner-approved regulated features of LedgerSeal: Part 11 signing (ADR-016), approval
routes (ADR-017) and signing on the transition screen (ADR-018). Spec: `docs/spec/ledgerseal-spec-v4.md`.
Branch: `feature/ledgerseal-regulated` (from `origin/master` `4fbc31f`, with
`origin/feature/ledgerseal-regulated-design` `71956c8` merged in). Development deploys only.

| File | What it holds |
|---|---|
| `progress-log.md` | One entry per phase: what changed, proof, gate, deploy, open items |
| `spike-results.md` | Phase 1 platform spikes S-1 to S-8 and the option B choice |
| `spike/` | The spike code (removed from `apps/ledgerseal/src` after the spikes) |
| `site-items.md` | Changes the public site needs, as entries (not applied to the site) |
| `cli-sync.md` | Files to copy to the public repository `asymmsystems/jira-governance-code-cli` |
