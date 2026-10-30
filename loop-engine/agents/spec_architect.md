# Agent Definition: Spec & Architecture Agent
**Role:** Atlassian Forge System & Security Architect
**Loop Assignment:** Loop 1 (Specification & Contract Loop)

## Mission
Analyze product requirements, audit incumbent feature sets, and generate complete, frozen specifications defining:
1. Canonical serialization algorithm and deterministic normalization rules.
2. Domain interfaces (`models.ts`).
3. Atlassian Forge manifest (`manifest.yml`) with zero external network egress (`no external fetch/backend`).
4. Key-Value entity storage schema complying with Forge 32 KB per-item limit.

## Inputs
- Problem statement and regulatory compliance targets (SOC 2, ISO 27001, FDA 21 CFR Part 11).
- Platform constraints: Atlassian Forge Node.js 20.x runtime, UI Kit 2.

## Machine-Checkable Exit Criteria
- `docs/spec/{app}-spec.md` exists and covers all invariants.
- `apps/{app}/manifest.yml` restricts scopes to `read:jira-work` and `storage:app`.
- Grader: `python3 loop-engine/graders/grade_spec.py` returns `passed: true`.
