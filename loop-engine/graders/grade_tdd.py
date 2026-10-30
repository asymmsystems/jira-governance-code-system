#!/usr/bin/env python3
"""
Loop Engineering Grader: TDD and Test Coverage Evaluator
Runs Jest, parses coverage thresholds, and outputs machine-readable evaluation.
"""

import subprocess
import json
import sys
from pathlib import Path

def grade_tdd(app_dir: Path) -> dict:
    try:
        # Run Jest with JSON coverage reporter
        cmd = ["npx", "jest", "--coverage", "--json"]
        proc = subprocess.run(cmd, cwd=app_dir, capture_output=True, text=True)

        passed = (proc.returncode == 0)
        failures = []

        if not passed:
            failures.append(f"Jest failed with exit code {proc.returncode}")
            # Extract error summary from stderr or stdout
            lines = proc.stderr.splitlines() or proc.stdout.splitlines()
            for line in lines[-10:]:
                if "FAIL" in line or "error" in line.lower() or "not met" in line:
                    failures.append(line.strip())

        # Attempt to parse coverage from coverage-summary.json if present
        coverage_summary_path = app_dir / "coverage" / "coverage-summary.json"
        branch_pct = 0.0
        line_pct = 0.0

        if coverage_summary_path.exists():
            with open(coverage_summary_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                total = data.get("total", {})
                branch_pct = total.get("branches", {}).get("pct", 0.0)
                line_pct = total.get("lines", {}).get("pct", 0.0)
        else:
            # Parse coverage table from stdout text
            for line in proc.stdout.splitlines():
                if line.startswith("All files"):
                    parts = [p.strip() for p in line.split("|") if p.strip()]
                    if len(parts) >= 4:
                        try:
                            line_pct = float(parts[0].split()[-1])
                            branch_pct = float(parts[1])
                        except ValueError:
                            pass

        if branch_pct < 90.0:
            passed = False
            failures.append(f"Branch coverage {branch_pct:.2f}% is below required 90.0% threshold")

        return {
            "evaluator": "grade_tdd",
            "passed": passed,
            "branch_coverage": branch_pct,
            "line_coverage": line_pct,
            "failures": failures,
            "feedback": (
                "All tests passed and coverage threshold met." if passed
                else f"Fix failing tests or add branch test cases: {'; '.join(failures)}"
            )
        }
    except Exception as e:
        return {
            "evaluator": "grade_tdd",
            "passed": False,
            "branch_coverage": 0.0,
            "line_coverage": 0.0,
            "failures": [str(e)],
            "feedback": f"Execution error running grade_tdd: {e}"
        }

if __name__ == "__main__":
    app_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.cwd()
    result = grade_tdd(app_path)
    print(json.dumps(result, indent=2))
    sys.exit(0 if result["passed"] else 1)
