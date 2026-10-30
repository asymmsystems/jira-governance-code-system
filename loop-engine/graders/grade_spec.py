#!/usr/bin/env python3
"""
Loop Engineering Grader: Loop 1 Specification & Contract Evaluator
Verifies specification document, domain schemas, and manifest least-privilege contracts.
"""

import sys
from pathlib import Path

def grade_spec(app_dir: Path) -> dict:
    app_name = app_dir.name
    spec_file = app_dir.parent.parent / "docs" / "spec" / f"{app_name}-spec.md"
    manifest_file = app_dir / "manifest.yml"

    failures = []

    if not spec_file.exists():
        failures.append(f"Specification file not found: {spec_file}")
    else:
        content = spec_file.read_text(encoding="utf-8")
        required_sections = [
            "Executive Summary",
            "Invariants",
            "Domain Model",
            "Manifest",
            "Storage Schema",
            "Validator"
        ]
        for sec in required_sections:
            if sec.lower() not in content.lower():
                failures.append(f"Spec missing required section: '{sec}'")

    if not manifest_file.exists():
        failures.append(f"manifest.yml not found: {manifest_file}")
    else:
        manifest_text = manifest_file.read_text(encoding="utf-8")
        if "permissions:" not in manifest_text or "scopes:" not in manifest_text:
            failures.append("manifest.yml missing permissions/scopes declaration")

    passed = (len(failures) == 0)
    return {
        "evaluator": "grade_spec",
        "passed": passed,
        "failures": failures,
        "feedback": (
            "Specification and contract frozen with all required sections and least-privilege manifest."
            if passed else f"Spec validation failures: {'; '.join(failures)}"
        )
    }

if __name__ == "__main__":
    app_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.cwd()
    result = grade_spec(app_path)
    import json
    print(json.dumps(result, indent=2))
    sys.exit(0 if result["passed"] else 1)
