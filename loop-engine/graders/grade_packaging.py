#!/usr/bin/env python3
"""
Loop Engineering Grader: Loop 5 Marketplace Packaging & Release Evaluator
Verifies documentation, marketplace listing copy, pricing strategy, and security disclosures.
"""

import sys
from pathlib import Path

def grade_packaging(app_dir: Path) -> dict:
    app_name = app_dir.name
    failures = []

    # 1. Check README.md
    readme_file = app_dir / "README.md"
    if not readme_file.exists():
        failures.append(f"App README.md not found: {readme_file}")
    else:
        content = readme_file.read_text(encoding="utf-8")
        if len(content) < 500:
            failures.append("README.md is too short (under 500 characters)")
        if "Runs on Atlassian" not in content and "Forge" not in content:
            failures.append("README.md missing platform and hosting disclosures")

    # 2. Check Marketplace listing copy
    listing_file = app_dir.parent.parent / "docs" / "marketplace" / f"{app_name}-listing.md"
    if not listing_file.exists():
        failures.append(f"Marketplace listing copy not found: {listing_file}")
    else:
        listing_content = listing_file.read_text(encoding="utf-8")
        required_items = ["Pricing", "Security", "Key Capabilities", "Runs on Atlassian"]
        for item in required_items:
            if item.lower() not in listing_content.lower():
                failures.append(f"Marketplace listing missing section: '{item}'")

    # 3. Check manifest has valid app structure
    manifest_file = app_dir / "manifest.yml"
    if manifest_file.exists():
        manifest_text = manifest_file.read_text(encoding="utf-8")
        if "modules:" not in manifest_text or "app:" not in manifest_text:
            failures.append("manifest.yml missing valid modules or app configuration")

    passed = (len(failures) == 0)
    return {
        "evaluator": "grade_packaging",
        "passed": passed,
        "failures": failures,
        "feedback": (
            "Packaging complete: README, Marketplace listing copy, pricing tiers, and security disclosures verified."
            if passed else f"Packaging verification failures: {'; '.join(failures)}"
        )
    }

if __name__ == "__main__":
    app_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.cwd()
    result = grade_packaging(app_path)
    import json
    print(json.dumps(result, indent=2))
    sys.exit(0 if result["passed"] else 1)
