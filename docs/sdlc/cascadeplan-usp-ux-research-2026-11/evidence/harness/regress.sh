#!/bin/sh
# Runs every harness check after rebuilding the site copy. Prints one line per check.
# Copyright (c) 2026 Asymm Systems. All rights reserved. @author Fahim Farook
export PYTHONPATH="/home/fahimfarookme/.var/app/com.visualstudio.code/data/python/lib/python3.13/site-packages:$PYTHONPATH"
cd "$(dirname "$0")" && python3 build_site.py >/dev/null
for c in check_load check_xss check_no_visible_markup check_b03 check_b04 check_b05 check_b07 check_b10 check_b12 check_b13 check_b14 check_b15 check_b16 check_b17 check_b18 check_b19 check_b20 check_b23 check_b25 check_b27 check_b28 check_b26 "$@"; do
  if [ -f "$c.py" ]; then python3 "$c.py" > "results/$c.out" 2>&1 && echo "$c PASS" || echo "$c FAIL (results/$c.out)"; fi
done
