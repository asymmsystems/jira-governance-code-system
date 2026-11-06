"""Append one build-item row to the round-log table. Usage: logrow.py '<row markdown>'
Copyright (c) 2026 Asymm Systems. All rights reserved. @author Fahim Farook
"""
import pathlib, sys
p = pathlib.Path('/home/fahimfarookme/Documents/projects/jira-governance/repository/code/jira-governance-code-system/docs/sdlc/cascadeplan-usp-ux-research-2026-11/round-log.md')
t = p.read_text().rstrip('\n') + '\n' + sys.argv[1].strip() + '\n'
p.write_text(t)
