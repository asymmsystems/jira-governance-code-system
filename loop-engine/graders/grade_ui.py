#!/usr/bin/env python3
"""
Loop Engineering Grader: Loop 4 'Runs on Atlassian' & UI Integration Evaluator
Verifies UI Kit components, Forge bridge calls, and clean frontend compilation.
"""

import sys
import subprocess
from pathlib import Path

def grade_ui(app_dir: Path) -> dict:
    failures = []
    frontend_dir = app_dir / "src" / "frontend"

    # 1. Check frontend source files exist
    if not frontend_dir.exists():
        return {
            "evaluator": "grade_ui",
            "passed": False,
            "failures": ["src/frontend directory not found"],
            "feedback": "Frontend UI component directory missing."
        }

    ui_files = list(frontend_dir.glob("*.tsx")) + list(frontend_dir.glob("*.ts"))
    if not ui_files:
        failures.append("No UI component files (.tsx / .ts) found in src/frontend")

    # 2. Check UI Kit imports and Forge bridge invocation
    has_forge_react = False
    has_bridge_invoke = False

    for f in ui_files:
        content = f.read_text(encoding="utf-8")
        if "@forge/react" in content:
            has_forge_react = True
        if "@forge/bridge" in content and "invoke" in content:
            has_bridge_invoke = True

    if not has_forge_react:
        failures.append("Frontend components must use native '@forge/react' UI Kit 2")
    if not has_bridge_invoke:
        failures.append("Frontend components must invoke backend via '@forge/bridge'")

    # 3. Check compilation with tsc
    proc = subprocess.run(["npx", "tsc", "--noEmit"], cwd=app_dir, capture_output=True, text=True)
    if proc.returncode != 0:
        failures.append(f"TypeScript compilation failed: {proc.stdout or proc.stderr}")

    passed = (len(failures) == 0)
    return {
        "evaluator": "grade_ui",
        "passed": passed,
        "failures": failures,
        "feedback": (
            "UI Kit 2 integration verified: clean compilation, native Forge React components, and bridge calls verified."
            if passed else f"UI verification failed: {'; '.join(failures)}"
        )
    }

if __name__ == "__main__":
    app_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.cwd()
    result = grade_ui(app_path)
    import json
    print(json.dumps(result, indent=2))
    sys.exit(0 if result["passed"] else 1)
