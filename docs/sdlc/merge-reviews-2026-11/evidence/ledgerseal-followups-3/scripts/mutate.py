import subprocess, sys, shutil, os
APP='/home/fahimfarookme/Documents/projects/jira-governance/.tmp/cache/merge-review/ledgerseal-followups-3/repo/apps/ledgerseal'
C=APP+'/src/service/conversion.ts'
muts = {
 'M2 no re-check before assignments': (C, """  for (const row of history) await storage.set(`ls3:wes:${issueId}:${String(row.seq).padStart(6, '0')}`, row);
  if (!(await stillCurrent())) return 'BUSY';
""", """  for (const row of history) await storage.set(`ls3:wes:${issueId}:${String(row.seq).padStart(6, '0')}`, row);
"""),
 'M3 no read-back': (C, "  return (await storage.get(key))?.holder === lease.holder ? lease.holder : null;", "  return lease.holder;"),
 'M4 no release': (C, "  await releaseLease(storage, issueId, holder);\n  return result;", "  return result;"),
 'M5 no holder check in stillCurrent': (C, "    if (!(await holdsLease(storage, issueId, holder))) return false;\n", ""),
 'M6 no re-check before history': (C, """  if (!(await stillCurrent())) return 'BUSY';

  // Rows and seals""", """
  // Rows and seals"""),
 'M7 no re-check before commit': (C, """  if (!(await stillCurrent())) return 'BUSY';
  await storage.commit([""", """  await storage.commit(["""),
 'M8 no expiry (always take over)': (C, "  if (current && Date.parse(now) - Date.parse(current.takenAt) < CONVERSION_LEASE_MS) return null;\n", ""),
 'M9 lease not deleted with issue': (APP+'/src/service/personal-data.ts', "  if (await storage.get(`ls3:convert-lease:${issueId}`)) keys.push(`ls3:convert-lease:${issueId}`);\n", ""),
 'M10 inactive mapped (L-13 reverted)': (APP+'/src/storage/party-repository.ts', "        if (state === 'inactive') continue;\n", ""),
}
only = sys.argv[1:]
for name,(f,old,new) in muts.items():
    if only and not any(name.startswith(o) for o in only): continue
    src=open(f).read()
    assert src.count(old)==1, name
    open(f,'w').write(src.replace(old,new))
    try:
        r=subprocess.run(['flatpak-spawn','--host','bash','-lc',f'cd {APP} && npx jest 2>&1 | grep -E "^Tests:|^  ● "'],capture_output=True,text=True,timeout=900)
        print('==',name); print(r.stdout.strip())
    finally:
        open(f,'w').write(src)
