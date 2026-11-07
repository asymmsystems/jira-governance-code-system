<!--
Copyright (c) 2026 Asymm Systems. All rights reserved.

@author Fahim Farook
-->
# FourRealities evidence reports: spike results (S-1 to S-4), 2026-11-08

The four spikes of the high-level design (`architecture/model/fourrealities-evidence-report-hld.org`, section 12), run before the build of ADR-015 (Accepted 2026-11-08). Development environment only (`c9d5ad8b-0b9e-41eb-9bca-a0384f708c20`, site asymmsystems.atlassian.net). Production and staging were not touched.

## How the spikes ran

- Code: branch `spike/fourrealities-evidence-report-spikes`, commit `fb10e51` (`apps/fourrealities/src/spike.ts`, `src/frontend/spike.tsx` and the manifest additions). It was deployed over FourRealities in development as versions 6.0.0 to 7.x and is never merged. The build of this branch replaces it in development.
- No signed-in browser session was available. The Chrome profile was signed out of the development site, and the stored live-test session cookies (`CASCADEPLAN_LIVE_COOKIES`) returned 401 on `/rest/api/3/myself`. Entering the owner's password is not allowed. So the spike added a web trigger (spike only) to run the app-side parts. A web trigger makes an app ineligible for Runs on Atlassian ("App is using a webtrigger module that can egress data", `forge eligibility`), so the eligibility result below is from 6.0.0, the deploy before the web trigger was added.
- The parts that need a user in a browser (S-1 in Chrome and Firefox, S-4 from a user's resolver) were not run. Each is listed under "Owner checks" with the exact steps.
- Raw outputs: `~/Documents/projects/jira-governance/.tmp/cache/fr-evidence-reports/spike-*.json` (not in git).
- Clean-up: every spike object was deleted from Object Store (`spike/...` and `tmp/spike-*`, read back as absent) and the 205 KVS keys `spike:*` the spikes wrote were deleted.

## Summary

| Spike | Result | Consequence |
|---|---|---|
| S-1 Object Store write and download | Backend PASS. Browser download NOT RUN (no session). | Object Store is used as approved (Q5). FourRealities enforces "written once" itself. The file name is set by `FileCard`. Owner check 1 before production. |
| S-2 Bulk changelog from Forge | PASS | As designed. |
| S-3 10,000-issue job, time and memory | Memory PASS, assembly PASS with parts in Object Store. KVS parts FAIL (rate limit). Visibility check PASS (as the app). | Parts are temporary Object Store objects, not KVS values (spec v4 D-17). Synthetic dataset; the site's largest project has 35 issues. |
| S-4 asUser in a queue consumer | Not proven: without a user the consumer cannot read as the user; the case of an event pushed from a user's resolver was NOT RUN. | The design stands as written (HLD: "if no, the design stands as written"): scope as the user in the resolver, long reads as the app for those ids only. |

No spike showed that the approved design cannot work. The build went ahead.

## S-1. Object Store from Forge and UI Kit

Question (HLD 12): can a UI Kit page download an Object Store object with `useObjectStore` and `FileCard`, with a file name we choose; which scope or module does it need; does `forge eligibility` still report Runs on Atlassian?

What was found:

| Item | Result | Evidence |
|---|---|---|
| Package | `@forge/object-store` 3.0.3. `@forge/os` 4.0.8 is deprecated and re-exports it. | npm registry; `@forge/os` README "Deprecated" |
| Manifest | `modules.objectStore: [{ key, storageClass: standard }]`. `forge lint` before the first deploy: "This deployment triggers a major version upgrade ... because: Change due to usage of core:os module" (MAJOR_VERSION_RULE). | lint output; manifest reference page "object store" |
| Scope | None. The deploy with `objectStore` and the consumer kept the seven existing scopes. | `forge deploy` 6.0.0; manifest |
| Backend write | No `put` method: the function asks `createUploadUrl({ key, length, checksum, checksumType: 'SHA256' })`, then PUTs to the URL. Host `tdp-os.services.atlassian.com`. The global `fetch` PUT returned 201 with no `permissions.external`. | `spike-roundtrip_bytes_2048.json`, `..._5000000.json` |
| Read back | `createDownloadUrl` then GET: 200, the same bytes (2,048 bytes and 5,000,000 bytes), `content-type` as sent, no `content-disposition`. | same files |
| Timing | 2 KB write 942 ms; 5 MB write 967 ms; a 40 MB write 3.4 s and a 45.7 MB write 3.6 s (S-3). | same files; `spike-s3-os-12.json` |
| Delete | `delete` then `get`: absent. | same files |
| Overwrite | A second `createUploadUrl` for the same key with `overwrite: false` was granted, and the PUT (201) replaced the object (size 2, new checksum). | same files, `overwrite` |
| Runs on Atlassian | 6.0.0 (objectStore, consumer, no web trigger): "is eligible for the Runs on Atlassian program". | `forge deploy` output |
| UI Kit download | `useObjectStore().downloadObjects({ functionKey, keys })` calls the resolver named by `functionKey` with `{ keys }`, expects `{ [url]: key }`, fetches each URL in the browser and returns a `Blob`. `FileCard.onDownload` may return that `Blob`, and "FileCard trigger[s] the browser download automatically". | `@forge/bridge` 7.2.1 `out/object-store/download.js`; `@atlaskit/forge-react-types` `FileCardProps`; UI Kit hook page "use object store" (read 2026-11-08) |
| File name | Not observed in a browser. Object Store sends no `Content-Disposition`, so the name can only come from `FileCard` `fileName`. A community post reports raw key names and asks for a name option (FRGE-2229). | spike read-back headers; community thread "How to set file name for an object inside Forge Object Store" |

Result: the backend part passes (no new scope, no egress, Runs on Atlassian kept). The browser part (a file saved in Chrome and Firefox with the chosen name) was NOT RUN. It is owner check 1.

Changes made because of S-1:
- FourRealities makes "written once" true itself: `DefaultForgeObjectStoreAccessor.putOnce` refuses a key that exists, PUTs with the SHA-256 checksum, and reads the stored checksum and size back (spec v4 invariant 12, D-18). Report ids are fresh UUIDs, so a new report never reuses a key.
- The download file name is passed to `FileCard` as `fileName` (spec v4 11.3).

Fallback: not taken. The fallback of HLD 4.2 (KVS parts and a Custom UI download page) stays costed (HLD 10, item 14, +4 days) for the case that owner check 1 fails.

## S-2. Bulk changelog from Forge

Question: does `POST /rest/api/3/changelog/bulkfetch` work from Forge as the app with `read:jira-work`, and what are the response sizes?

Run: project DEMO (35 issues, every issue of the project), as the app, `maxResults` 10,000.

| Request | Status | Pages | Bytes | Entries | Items | Time | Bytes per entry |
|---|---|---|---|---|---|---|---|
| all fields | 200 | 1 | 341,091 | 268 | 328 | 266 ms | 1,273 |
| `fieldIds: ["status"]` | 200 | 1 | 22,609 | 18 | 18 | 180 ms | 1,256 |

- The body is `{ issueChangeLogs: [{ issueId, changeHistories: [{ id, author: { accountId, displayName, avatarUrls, ... }, created, items: [{ field, fieldtype, fieldId, from, fromString, to, toString }] }] }], nextPageToken? }`. `created` is a number (epoch milliseconds), not a text.
- Most of the size is the author object (avatar URLs). At about 1,270 bytes per entry, 10,000 entries are about 12.7 MB per page, read in memory and reduced at once to the report change (about 330 bytes in JSON).
- 1,000 ids per request were not tried: the site has no project that large. The job asks for 100 ids per request (spec v4 11.5), well inside the documented 1,000.

Result: PASS.

## S-3. A 10,000-issue job: time and memory

Question: time and memory of a 10,000-issue job and of the download visibility check (pass: job under 15 minutes; check under 20 s; assembly under 800 MB).

Dataset: SYNTHETIC. The development site's projects have 3 (AUDT), 35 (DEMO), 5 (LSP), 21 (PAY) and 4 (TEST) issues (`search/approximate-count` as the app). The consumer generated 10,000 report issues in the HLD 3.3 shape in memory (realistic gate results, sibling references and changes; one change in three a free-text change), then ran the real storage path: part writes and reads, both files, the hashes, an Ed25519 signature and the two object writes.

Runs (queue consumer, `timeoutSeconds: 900`, `memoryMB: 1024`):

| Run | Changes | Parts | Result |
|---|---|---|---|
| 1: 10,000 issues x 25 changes, parts in KVS (HLD 4.1) | 250,000 | about 205 written | FAILED: `ForgeKvsError RATE_LIMIT_EXCEEDED Limits for the current installation have been exceeded`, RSS 387 MB |
| 2: 10,000 issues x 12 changes, parts as Object Store objects | 120,000 | 213 | PASS: JSON 40,148,954 bytes (448 ms), CSV 45,667,018 bytes (1,956 ms), hashes and signature 460 ms, two uploads 7.0 s, peak RSS 540 MB, total 204 s (part round trips 193 s) |

Why run 1 failed: KVS allows 4,000 writes per minute per installation, counted in 10 KB units (Forge KVS limits page, read 2026-11-08). One part of 190,000 bytes is 19 units, so about 205 parts use the whole minute. A 50 MB report would also use the whole read budget for the assembly, and the dashboard of every project on the site would be refused meanwhile. So the HLD's KVS parts cannot carry a large report. The parts are now temporary Object Store objects (`tmp/{reportId}/part-{i}.json`), which have no byte rate limit (5,000 requests per minute per installation). Spec v4 D-17.

Sizes: the synthetic change is about 330 bytes in JSON and 380 bytes in CSV, above the HLD estimate (240 and 160). At that size the 50 MB cap is reached at about 150,000 changes, before the 250,000-change cap: such a report fails with `REPORT_TOO_LARGE` and asks for a shorter range or a field filter (as designed, D-15).

Visibility check (as the app, because no user session was available): 20 searches of 500 ids each (`id in (...)`) took 5,550 ms in all (236 to 481 ms each). Pass condition under 20 s. Run as the user it is the same request; owner check 2 times it as the user.

Other facts the check needs (as the app): JQL `id in (...)` with ids that do not exist returns 200 and leaves them out (`id in (10067,999999999)` gave one issue; two missing ids gave none); 1,000 ids in one query work.

Time of a real 10,000-issue job (estimate from measured parts; there is no such project to run):

| Work | Measured | 10,000 issues |
|---|---|---|
| Remote links, 8 at a time | 16 ms per read (160 reads in 2,562 ms) | about 160 s |
| Gate facts, 100 per search | about 0.3 s per search (S-3 searches) | about 30 s |
| Bulk changelog, 100 ids per request | 266 ms for 35 issues | about 30 to 90 s |
| Part objects, 100 issues each (write and read) | about 0.9 s per round trip | about 90 s |
| Assembly, hashes, signature, three objects | about 15 s for 86 MB of files | about 15 s |
| In all | | about 6 to 7 minutes, under the 15-minute pass |

Result: memory PASS (540 MB for 86 MB of files, under 800 MB); assembly PASS with parts in Object Store; parts in KVS FAIL, so the design changed (D-17); visibility check PASS as the app; job time PASS by estimate on synthetic data.

## S-4. Reading as the user in a queue consumer

Question: does `api.asUser()` work in a queue consumer whose event was pushed from a resolver? If yes, the on-demand job could read as the user throughout.

Run: an event pushed by the app (from the web trigger, so with no user), consumer as above.

| Call in the consumer | Result |
|---|---|
| `api.asUser().requestJira('/rest/api/3/myself')` | `PROXY_ERR ... 401 - AUTH_TYPE_UNAVAILABLE` |
| `api.asUser(accountId).requestJira(mypermissions)` | `PROXY_ERR ... 401 - NO_IMPERSONATION_SCOPES_DEFINED` (offline impersonation needs a manifest permission the app does not declare and should not) |
| `api.asApp().requestJira('/rest/api/3/myself')` | 200 |
| consumer `context` | keys `principal`, `installContext`, `installation`, `workspaceId`; `principal: null` |

The case of the question, an event pushed from a resolver that a user invoked, was NOT RUN: it needs a signed-in user (owner check 3). The design does not depend on it: HLD 12 says "if no, the design stands as written", and the build uses the design as written (the scope search as the user in the resolver, the long reads as the app for those ids only, the download check as the user).

## Owner checks (each needs a signed-in user on the development site)

1. **S-1 browser download.** In Chrome and in Firefox: open project PAY, Apps, Four Realities, tab "Evidence reports"; make a report for the last 30 days; when it is Ready, choose Download and each of the four files. Pass: each file is saved with the name shown on its card (for example `fourrealities-PAY-2026-10-09-2026-11-08-1a2b3c4d.json`). If the browser saves a file under another name or does not save it, the fallback of HLD 4.2 is needed (Custom UI download page, about 4 days).
2. **S-3 visibility check as the user.** Download a report as a user who can see all its issues (pass), then as a user who lacks one issue's security level (pass: "You cannot see 1 of the N issues in this report, so you cannot download it.").
3. **S-4 as the user.** Not needed for the build. Only to learn whether a later version could read as the user in the job.
