#!/usr/bin/env python3
# Copyright (c) 2026 Asymm Systems. All rights reserved.
#
# @author Fahim Farook
"""Fails a CI job when an FSRT report has a finding that the allowlist does not justify.

Usage: fsrt_gate.py <app> <fsrt-report.json> <allowlist.txt>

FSRT (Atlassian's Forge Security Requirements Tester) writes one JSON report per scan. Each finding
has a check_name such as Custom-Check-Authorization-16711047855292326038; the number is a hash of
the source path below src/, the entry point and the call stack, so it is the same on every machine.

Allowlist format, one entry per line: "<app> <check_name> <justification>". Blank lines and lines
that start with # are ignored. An entry without a justification is an error.

Exit codes: 0 = no unjustified finding; 1 = unjustified finding, or the scan did not complete
(errors true), or the report is unreadable; 2 = bad usage or a bad allowlist entry.
"""
import json
import sys


def read_allowlist(path, app):
    allowed = {}
    with open(path, encoding="utf-8") as f:
        for n, raw in enumerate(f, 1):
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split(None, 2)
            if len(parts) < 3 or not parts[2].strip():
                print(f"{path}:{n}: an entry needs <app> <check_name> <justification>", file=sys.stderr)
                sys.exit(2)
            if parts[0] == app:
                allowed[parts[1]] = parts[2].strip()
    return allowed


def main(argv):
    if len(argv) != 4:
        print(__doc__, file=sys.stderr)
        return 2
    app, report_path, allowlist_path = argv[1:]
    allowed = read_allowlist(allowlist_path, app)
    try:
        with open(report_path, encoding="utf-8") as f:
            report = json.load(f)
    except (OSError, ValueError) as e:
        print(f"FSRT report {report_path} is unreadable: {e}", file=sys.stderr)
        return 1
    if report.get("errors"):
        # A scan that stops early reports no findings; that is not a pass.
        print(f"FSRT did not complete for {app}: {report.get('error_message')}", file=sys.stderr)
        return 1
    failed = 0
    for v in report.get("vulns", []):
        name = v.get("check_name", "")
        proof = (v.get("proof") or "").replace("\n", " | ")
        if name in allowed:
            print(f"ALLOWED {app} {name}: {allowed[name]}")
            print(f"        {proof}")
        else:
            failed += 1
            print(f"FINDING {app} {name} ({v.get('severity')}, {v.get('marketplace_security_requirement')})")
            print(f"        {v.get('description')}")
            print(f"        {proof}")
    print(f"{app}: {len(report.get('vulns', []))} finding(s), {failed} not in the allowlist")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
