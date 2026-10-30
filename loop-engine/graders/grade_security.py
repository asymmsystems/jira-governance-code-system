#!/usr/bin/env python3
"""
Loop Engineering Grader: Security and Zero-Egress Evaluator
Checks manifest permissions and static code boundaries.
"""

import sys
import re
from pathlib import Path

def grade_security(app_dir: Path) -> dict:
    failures = []

    # 1. Inspect manifest.yml
    manifest_path = app_dir / "manifest.yml"
    if not manifest_path.exists():
        return {
            "evaluator": "grade_security",
            "passed": False,
            "failures": ["manifest.yml not found"],
            "feedback": "manifest.yml must exist"
        }

    manifest_text = manifest_path.read_text(encoding="utf-8")

    # Check for unauthorized external networking in manifest
    forbidden_manifest_patterns = [
        (r"external\s*:", "External network declarations are forbidden ('external:')"),
        (r"fetch\s*:", "External fetch declarations are forbidden ('fetch:')"),
        (r"endpoints\s*:", "External endpoint declarations are forbidden ('endpoints:')")
    ]

    for pat, desc in forbidden_manifest_patterns:
        if re.search(pat, manifest_text):
            failures.append(f"Manifest violation: {desc}")

    # Check mandatory least-privilege scopes
    if "read:jira-work" not in manifest_text:
        failures.append("Manifest missing mandatory scope 'read:jira-work'")
    if "storage:app" not in manifest_text:
        failures.append("Manifest missing mandatory scope 'storage:app'")

    # 2. Inspect source code for external HTTP networking libraries
    src_dir = app_dir / "src"
    forbidden_code_patterns = [
        (r"from\s+['\"]axios['\"]", "Forbidden external HTTP client 'axios'"),
        (r"from\s+['\"]node-fetch['\"]", "Forbidden external HTTP client 'node-fetch'"),
        (r"require\(['\"]http['\"]\)", "Forbidden Node.js 'http' module"),
        (r"require\(['\"]https['\"]\)", "Forbidden Node.js 'https' module")
    ]

    if src_dir.exists():
        for ts_file in src_dir.rglob("*.ts*"):
            content = ts_file.read_text(encoding="utf-8")
            for pat, desc in forbidden_code_patterns:
                if re.search(pat, content):
                    failures.append(f"Code security violation in {ts_file.name}: {desc}")

    passed = (len(failures) == 0)

    return {
        "evaluator": "grade_security",
        "passed": passed,
        "failures": failures,
        "feedback": (
            "Security invariants verified: Zero external egress, least-privilege scopes satisfied."
            if passed else f"Security violations detected: {'; '.join(failures)}"
        )
    }

if __name__ == "__main__":
    app_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.cwd()
    result = grade_security(app_path)
    import json
    print(json.dumps(result, indent=2))
    sys.exit(0 if result["passed"] else 1)
