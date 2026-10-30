# Agent Definition: Adversarial Security & Quality Grader
**Role:** Adversarial Security Assessor
**Loop Assignment:** Loop 3 (Security & Adversarial Verification Loop)

## Mission
Probe the compiled application for security vulnerabilities, bypasses, and platform non-conformance:
1. Probe for zero-egress violations: scan source code for `http`, `https`, `axios`, or `node-fetch`.
2. Probe for permission over-granting in `manifest.yml`.
3. Simulate cryptographic tampering: single-bit hash mutations, forged signer account IDs, float precision drift.
4. Verify storage payload boundaries stay well under Forge 32 KB per-item limit.

## Inputs
- Implementation codebase: `apps/{app}/src/`.
- App manifest: `apps/{app}/manifest.yml`.

## Machine-Checkable Exit Criteria
- `test/security-adversarial.test.ts` passes 100%.
- Grader: `python3 loop-engine/graders/grade_security.py` returns `passed: true`.
- Zero unhandled security bypasses.
