#!/usr/bin/env python3
"""
Loop Engineering Driver / Orchestrator
Executes the outer SDLC loops, drives inner cycle iterations, evaluates graders,
records state transitions, and halts on machine-checkable gates.
Enforces all 5 discrete SDLC Loops:
1. LOOP_1_SPECIFICATION: grade_spec
2. LOOP_2_TDD_BUILD: grade_tdd
3. LOOP_3_SECURITY_VERIFICATION: grade_security
4. LOOP_4_UI_INTEGRATION: grade_ui
5. LOOP_5_MARKETPLACE_PACKAGING: grade_packaging
"""

import sys
import time
import argparse
from pathlib import Path

# Add loop-engine directory to path
sys.path.insert(0, str(Path(__file__).parent))

from state import LoopState, LoopStage, CycleRecord
from graders.grade_spec import grade_spec
from graders.grade_tdd import grade_tdd
from graders.grade_security import grade_security
from graders.grade_ui import grade_ui
from graders.grade_packaging import grade_packaging

def run_loop_orchestrator(app_name: str, app_dir: Path, state_file: Path, reset: bool = False) -> LoopState:
    print(f"\n========================================================")
    print(f"  LOOP ENGINEERING HARNESS: {app_name.upper()}")
    print(f"  App Directory: {app_dir}")
    print(f"  State File:    {state_file}")
    print(f"========================================================\n")

    if reset and state_file.exists():
        state_file.unlink()

    state = LoopState.load(state_file)
    state.app_name = app_name

    print(f"[*] Starting at stage: {state.current_stage.value} (Cycle {state.current_cycle})\n")

    # LOOP 1: SPECIFICATION & CONTRACT
    if state.current_stage == LoopStage.SPEC:
        print("[LOOP 1] Evaluating Specification & Contract Gate...")
        spec_result = grade_spec(app_dir)
        passed = spec_result["passed"]

        record = CycleRecord(
            cycle_number=state.current_cycle,
            stage=LoopStage.SPEC.value,
            timestamp=time.time(),
            action_summary="Audited architecture specification, invariants, and manifest contracts",
            evaluator_name="grade_spec",
            passed=passed,
            score=1.0 if passed else 0.0,
            failures=spec_result.get("failures", []),
            feedback=spec_result.get("feedback", "")
        )
        state.record_cycle(LoopStage.SPEC, record)

        if passed:
            print(f"  [✓] Loop 1 Gate Cleared: {spec_result.get('feedback')}")
            state.advance_stage(LoopStage.TDD)
        else:
            print(f"  [✗] Loop 1 Gate Failed: {spec_result.get('feedback')}")
            state.save(state_file)
            return state

    # LOOP 2: TDD & BUILD
    if state.current_stage == LoopStage.TDD:
        print("\n[LOOP 2] Executing TDD & Coverage Evaluation Loop...")
        tdd_result = grade_tdd(app_dir)
        passed = tdd_result["passed"]

        record = CycleRecord(
            cycle_number=state.current_cycle,
            stage=LoopStage.TDD.value,
            timestamp=time.time(),
            action_summary="Ran automated test suite and measured branch coverage",
            evaluator_name="grade_tdd",
            passed=passed,
            score=tdd_result.get("branch_coverage", 0.0),
            failures=tdd_result.get("failures", []),
            feedback=tdd_result.get("feedback", "")
        )
        state.record_cycle(LoopStage.TDD, record)

        if passed:
            print(f"  [✓] Loop 2 Gate Cleared: Tests passed with {tdd_result.get('branch_coverage', 0):.2f}% branch coverage.")
            state.advance_stage(LoopStage.SECURITY)
        else:
            print(f"  [✗] Loop 2 Gate Failed: {tdd_result.get('feedback')}")
            state.save(state_file)
            return state

    # LOOP 3: SECURITY & ADVERSARIAL VERIFICATION
    if state.current_stage == LoopStage.SECURITY:
        print("\n[LOOP 3] Executing Adversarial Security & Zero-Egress Loop...")
        sec_result = grade_security(app_dir)
        passed = sec_result["passed"]

        record = CycleRecord(
            cycle_number=state.current_cycle,
            stage=LoopStage.SECURITY.value,
            timestamp=time.time(),
            action_summary="Inspected manifest permissions, audited dependencies, scanned for external egress",
            evaluator_name="grade_security",
            passed=passed,
            score=1.0 if passed else 0.0,
            failures=sec_result.get("failures", []),
            feedback=sec_result.get("feedback", "")
        )
        state.record_cycle(LoopStage.SECURITY, record)

        if passed:
            print(f"  [✓] Loop 3 Gate Cleared: {sec_result.get('feedback')}")
            state.advance_stage(LoopStage.UI)
        else:
            print(f"  [✗] Loop 3 Gate Failed: {sec_result.get('feedback')}")
            state.save(state_file)
            return state

    # LOOP 4: UI & FORGE NATIVE INTEGRATION
    if state.current_stage == LoopStage.UI:
        print("\n[LOOP 4] Executing 'Runs on Atlassian' UI Integration Loop...")
        ui_result = grade_ui(app_dir)
        passed = ui_result["passed"]

        record = CycleRecord(
            cycle_number=state.current_cycle,
            stage=LoopStage.UI.value,
            timestamp=time.time(),
            action_summary="Audited UI Kit 2 components, bridge calls, and verified clean TypeScript compilation",
            evaluator_name="grade_ui",
            passed=passed,
            score=1.0 if passed else 0.0,
            failures=ui_result.get("failures", []),
            feedback=ui_result.get("feedback", "")
        )
        state.record_cycle(LoopStage.UI, record)

        if passed:
            print(f"  [✓] Loop 4 Gate Cleared: {ui_result.get('feedback')}")
            state.advance_stage(LoopStage.PACKAGING)
        else:
            print(f"  [✗] Loop 4 Gate Failed: {ui_result.get('feedback')}")
            state.save(state_file)
            return state

    # LOOP 5: MARKETPLACE PACKAGING & RELEASE
    if state.current_stage == LoopStage.PACKAGING:
        print("\n[LOOP 5] Evaluating Marketplace Packaging & Release Gate...")
        pkg_result = grade_packaging(app_dir)
        passed = pkg_result["passed"]

        record = CycleRecord(
            cycle_number=state.current_cycle,
            stage=LoopStage.PACKAGING.value,
            timestamp=time.time(),
            action_summary="Verified documentation, marketplace listing copy, pricing tiers, and security disclosures",
            evaluator_name="grade_packaging",
            passed=passed,
            score=1.0 if passed else 0.0,
            failures=pkg_result.get("failures", []),
            feedback=pkg_result.get("feedback", "")
        )
        state.record_cycle(LoopStage.PACKAGING, record)

        if passed:
            print(f"  [✓] Loop 5 Gate Cleared: {pkg_result.get('feedback')}")
            state.advance_stage(LoopStage.COMPLETE)
        else:
            print(f"  [✗] Loop 5 Gate Failed: {pkg_result.get('feedback')}")
            state.save(state_file)
            return state

    if state.current_stage == LoopStage.COMPLETE:
        print(f"\n[★] ALL 5 SDLC LOOPS COMPLETE FOR {app_name.upper()}!")
        print(f"    State recorded and frozen in: {state_file}")

    state.save(state_file)
    return state

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SDLC Loop Engineering Orchestrator")
    parser.add_argument("app", nargs="?", default="ledgerseal", help="Target application name (default: ledgerseal)")
    parser.add_argument("--reset", action="store_true", help="Reset state and rerun all 5 loops from cycle 1")
    args = parser.parse_args()

    base_dir = Path(__file__).resolve().parent.parent
    target_app_dir = base_dir / "apps" / args.app
    state_target_file = base_dir / "loop-engine" / "runs" / f"{args.app}_state.json"

    run_loop_orchestrator(args.app, target_app_dir, state_target_file, reset=args.reset)
