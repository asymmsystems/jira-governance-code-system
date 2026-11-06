#!/usr/bin/env python3
# Copyright (c) 2026 Asymm Systems. All rights reserved.
#
# @author Fahim Farook
"""Fails a CI job when an FSRT scan has a finding that the allowlist does not justify, or when
the scan analysed nothing.

Usage:
  fsrt_gate.py <app> <fsrt-report.json> <allowlist.txt> <fsrt-log.txt>
  fsrt_gate.py --canary <app> <fsrt-report.json> <fsrt-log.txt>

FSRT (Atlassian's Forge Security Requirements Tester) writes one JSON report per scan. Each finding
has a check_name such as Custom-Check-Authorization-16711047855292326038; the number is a hash of
the source path below src/, the entry point and the call stack, so it is the same on every machine.

The report does not say what FSRT analysed: "scanned" holds only the app key. So the gate also
reads FSRT's diagnostics, written to stderr when FSRT runs with FORGE_LOG="info,fsrt=debug". FSRT
logs "parsing, file=<path>" for each source file it loads and opens a "run_checker def=..." span
for each function a scanner runs on. A scan with no parsed file or no checked function analysed
nothing, and it fails, whatever the report says.

Allowlist format, one entry per line: "<app> <check_name> <justification>". Blank lines and lines
that start with # are ignored. An entry without a justification is an error.

--canary checks a scan of tools/ci/fsrt-canary instead. That app has one UI resolver,
handler.readIssue, that calls Jira as the app without an authorization check. The canary passes
only when FSRT reports that call as Custom-Check-Authorization. The allowlist does not apply.

Exit codes: 0 = pass; 1 = unjustified finding, a scan that did not complete (errors true), a scan
that analysed nothing, a missing canary finding, or an unreadable report or log; 2 = bad usage or a
bad allowlist entry.
"""
import json
import sys

APP_KEY_PREFIX = "systems.asymm."
FILE_MARKER = "parsing, file="
FUNCTION_MARKER = "run_checker def="
CANARY_CHECK_PREFIX = "Custom-Check-Authorization-"
CANARY_PATH = "handler.readIssue"


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


def read_report(path):
    try:
        with open(path, encoding="utf-8") as f:
            report = json.load(f)
    except (OSError, ValueError) as e:
        print(f"FSRT report {path} is unreadable: {e}", file=sys.stderr)
        return None
    if not isinstance(report, dict):
        print(f"FSRT report {path} is not a JSON object", file=sys.stderr)
        return None
    return report


def coverage_failure(app, report, log_path):
    """Returns why the scan does not count as a scan, or None when it completed and analysed code."""
    if report.get("errors"):
        # A scan that stops early reports no findings; that is not a pass.
        return f"FSRT did not complete for {app}: {report.get('error_message')}"
    if not isinstance(report.get("vulns"), list):
        return f"FSRT report for {app} has no vulns list"
    scanned = report.get("scanned")
    app_key = APP_KEY_PREFIX + app
    if not isinstance(scanned, list) or app_key not in scanned:
        # FSRT writes an empty report (scanned []) before it starts and replaces it at the end.
        return f"FSRT report for {app} does not list {app_key} as scanned: {scanned!r}"
    try:
        with open(log_path, encoding="utf-8", errors="replace") as f:
            log = f.read()
    except OSError as e:
        return f"FSRT log {log_path} is unreadable: {e}"
    files = log.count(FILE_MARKER)
    functions = log.count(FUNCTION_MARKER)
    print(f"{app}: FSRT parsed {files} file(s) and ran {functions} function check(s)")
    if files == 0 or functions == 0:
        return (f"FSRT analysed nothing for {app}: {files} file(s) parsed, {functions} function "
                f"check(s) run. Was it run with FORGE_LOG=\"info,fsrt=debug\" and stderr kept?")
    return None


def gate(app, report_path, allowlist_path, log_path):
    allowed = read_allowlist(allowlist_path, app)
    report = read_report(report_path)
    if report is None:
        return 1
    failure = coverage_failure(app, report, log_path)
    if failure:
        print(failure, file=sys.stderr)
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


def canary(app, report_path, log_path):
    report = read_report(report_path)
    if report is None:
        return 1
    failure = coverage_failure(app, report, log_path)
    if failure:
        print(failure, file=sys.stderr)
        return 1
    for v in report.get("vulns", []):
        if (v.get("check_name", "").startswith(CANARY_CHECK_PREFIX)
                and CANARY_PATH in (v.get("description") or "")):
            print(f"CANARY {app}: FSRT reported {v.get('check_name')} through {CANARY_PATH}")
            return 0
    print(f"CANARY {app}: FSRT did not report the unchecked asApp() call through {CANARY_PATH}. "
          f"The scanner is not working; no scan result can be trusted.", file=sys.stderr)
    return 1


def main(argv):
    if len(argv) == 5 and argv[1] == "--canary":
        return canary(*argv[2:])
    if len(argv) == 5 and not argv[1].startswith("-"):
        return gate(*argv[1:])
    print(__doc__, file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
