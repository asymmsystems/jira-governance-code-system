# Loop Engineering Harness

This directory contains the executable **Loop Engineering Engine** that drives the autonomous Software Development Lifecycle (SDLC) for the Atlassian Forge Enterprise Suite.

---

## 1. Structure

```
loop-engine/
├── runner.py                 # The State Machine & Orchestrator Driver
├── state.py                  # LoopState & CycleRecord data classes
├── graders/                  # Machine-Checkable Evaluators (The Graders)
│   ├── grade_tdd.py          # Runs Jest, parses coverage thresholds (>= 90% branch)
│   └── grade_security.py     # Static analysis (zero egress, least-privilege scopes)
├── agents/                   # Agent Roles, System Prompts & Task Contracts
│   ├── spec_architect.md     # Loop 1 Agent (Spec & Manifest Contract)
│   ├── tdd_engineer.md       # Loop 2 Agent (TDD Implementation)
│   └── adversary_grader.md   # Loop 3 Agent (Adversarial Security Grader)
└── runs/                     # Persisted Loop State Machine JSON Runs
    └── ledgerseal_state.json # Recorded state & cycle logs for LedgerSeal
```

---

## 2. How the Engine Operates

A loop in Loop Engineering is a closed feedback loop:
1. **Act:** Agent performs task (writes spec, writes failing test, writes code).
2. **Observe:** Grader runs automated check (`grade_tdd`, `grade_security`).
3. **Evaluate:** Grader produces structured JSON verdict (`passed`, `score`, `failures`, `feedback`).
4. **Adjust:** If failed, error traces feed directly back to the agent to self-correct. If passed, state machine advances to the next loop stage.

---

## 3. Running the Harness

To execute the Loop Harness against an app:

```bash
# Run the full SDLC loop cycle for LedgerSeal:
python3 loop-engine/runner.py ledgerseal

# Inspect the recorded state file:
cat loop-engine/runs/ledgerseal_state.json
```
