// Scratch probe for DefinitionGuard audit. Uses compiled copies of src/domain in ./build.
const path = require('path');
const B = path.join(__dirname, 'build');
const { calculateChecklistHash } = require(path.join(B, 'domain/hasher.js'));
const { ChecklistEngine, DEFAULT_DEFINITION_OF_DONE } = require(path.join(B, 'domain/checklist-engine.js'));
const { ChecklistRepository } = require(path.join(B, 'storage/checklist-repository.js'));
const { TransitionValidator } = require(path.join(B, 'validator/transition-validator.js'));

const clone = (o) => JSON.parse(JSON.stringify(o));
const out = (k, v) => console.log(`${k}: ${v}`);

const T = '2026-10-31T00:00:00.000Z';
let s = ChecklistEngine.initializeState('10001', 'P-1', DEFAULT_DEFINITION_OF_DONE, 'system', T);
s = ChecklistEngine.toggleItem(s, { issueId: '10001', issueKey: 'P-1', itemId: 'item-unit-tests', isCompleted: true, userId: 'Alice', userAccountId: 'acc-alice' }, T);
s = ChecklistEngine.toggleItem(s, { issueId: '10001', issueKey: 'P-1', itemId: 'item-peer-review', isCompleted: true, userId: 'Bob', userAccountId: 'acc-bob' }, T);
const ver = s.stateVersion, trail = s.auditTrail;
const H = (items, v = ver, a = trail) => calculateChecklistHash(items, v, a);
const base = H(s.items);
out('1 stored hash equals recompute', base === s.checklistHash);

out('2 order independence (reversed items same hash)', H([...s.items].reverse()) === base);

let m = clone(s.items); m[0].title = m[0].title + ' (edited)';
out('3 changed item title changes hash', H(m) !== base);

m = clone(s.items); m.find(i => i.id === 'item-unit-tests').completedByAccountId = 'acc-mallory';
out('4 changed checker accountId changes hash', H(m) !== base);

m = clone(s.items); m.find(i => i.id === 'item-unit-tests').completedBy = 'Mallory';
out('5 changed checker display name changes hash', H(m) !== base);

m = clone(s.items).filter(i => i.id !== 'item-documentation');
out('6 removed (optional) item changes hash', H(m) !== base);

m = clone(s.items); m.find(i => i.id === 'item-unit-tests').history[0].userId = 'Mallory';
out('7 edited per-item history changes hash', H(m) !== base);

let a = clone(trail); a[0].actorName = 'Mallory'; a[0].actorAccountId = 'acc-mallory';
out('8 edited earlier audit event (not last) changes hash', H(s.items, ver, a) !== base);

a = clone(trail); a[a.length - 1].actorName = 'Mallory';
out('9 edited LAST audit event actorName (id kept) changes hash', H(s.items, ver, a) !== base);

// 10: forge a full tampered state and recompute: does anything in the app detect it?
const forged = clone(s);
forged.items.forEach(i => { if (i.isMandatory) { i.isCompleted = true; i.completedBy = 'Alice'; i.completedAt = T; } });
forged.checklistHash = calculateChecklistHash(forged.items, forged.stateVersion, forged.auditTrail);
forged.isFullySatisfied = true;
out('10 forged state with recomputed hash passes validator', TransitionValidator.validate(forged).canTransition);

// 11: hash does not bind issueId: same items on another issue give the same hash
const other = clone(s); other.issueId = '99999'; other.issueKey = 'Q-9';
out('11 hash identical across issues (issueId not hashed)', calculateChecklistHash(other.items, other.stateVersion, other.auditTrail) === base);

// 12: the app's own display-name rewrite (index.ts:170-198) breaks the stored hash
const raw = clone(s); raw.items[0].completedBy = '712020:abc'; raw.checklistHash = calculateChecklistHash(raw.items, raw.stateVersion, raw.auditTrail);
const rewritten = clone(raw); rewritten.items[0].completedBy = 'Alice Smith';
out('12 after app name-rewrite stored hash still matches recompute', calculateChecklistHash(rewritten.items, rewritten.stateVersion, rewritten.auditTrail) === rewritten.checklistHash);

// 13: reset updates hash and keeps trail
const r = ChecklistEngine.resetChecklist(s, 'Carol', 'acc-carol', T);
out('13a reset changes hash', r.checklistHash !== s.checklistHash);
out('13b reset keeps prior audit events', r.auditTrail.length === s.auditTrail.length + 1);
out('13c reset keeps per-item history', JSON.stringify(r.items[0].history) === JSON.stringify(s.items[0].history));

// 14: Lost update under concurrent read-modify-write (same sequence as index.ts:227-245)
(async () => {
  const store = new Map();
  const slow = { async get(k) { const snap = store.has(k) ? clone(store.get(k)) : undefined; await new Promise(r => setTimeout(r, 5)); return snap; },
                 async set(k, v) { store.set(k, clone(v)); }, async delete(k) { store.delete(k); } };
  const repo = new ChecklistRepository(slow);
  await repo.saveIssueChecklist(ChecklistEngine.initializeState('20001', 'P-2', DEFAULT_DEFINITION_OF_DONE, 'system', T));
  const tick = async (itemId, who) => {
    const st = await repo.getIssueChecklist('20001');
    const up = ChecklistEngine.toggleItem(st, { issueId: '20001', issueKey: 'P-2', itemId, isCompleted: true, userId: who, userAccountId: 'acc-' + who }, T);
    await repo.saveIssueChecklist(up);
  };
  await Promise.all([tick('item-unit-tests', 'alice'), tick('item-peer-review', 'bob')]);
  const fin = await repo.getIssueChecklist('20001');
  const done = fin.items.filter(i => i.isCompleted).map(i => i.id);
  out('14 concurrent ticks: completed after both', JSON.stringify(done) + ' stateVersion=' + fin.stateVersion + ' auditEvents=' + fin.auditTrail.length);

  // 15: size growth (audit trail unbounded, history capped 25/item, notes up to 500)
  let g = ChecklistEngine.initializeState('30001', 'P-3', DEFAULT_DEFINITION_OF_DONE, 'system', T);
  const ids = g.items.map(i => i.id);
  const sizes = {};
  for (let n = 1; n <= 2000; n++) {
    g = ChecklistEngine.toggleItem(g, { issueId: '30001', issueKey: 'P-3', itemId: ids[n % ids.length], isCompleted: n % 2 === 0,
      userId: 'Firstname Lastname', userAccountId: '712020:0123456789abcdef01234567', notes: 'x'.repeat(500) }, T);
    if ([10, 50, 100, 200, 500, 1000, 2000].includes(n)) sizes[n] = Buffer.byteLength(JSON.stringify(g));
  }
  out('15 JSON bytes after N toggles', JSON.stringify(sizes));
  let crossed32 = null, crossed240 = null;
  g = ChecklistEngine.initializeState('30002', 'P-4', DEFAULT_DEFINITION_OF_DONE, 'system', T);
  for (let n = 1; n <= 5000; n++) {
    g = ChecklistEngine.toggleItem(g, { issueId: '30002', issueKey: 'P-4', itemId: ids[n % ids.length], isCompleted: n % 2 === 0,
      userId: 'Firstname Lastname', userAccountId: '712020:0123456789abcdef01234567' }, T);
    const b = Buffer.byteLength(JSON.stringify(g));
    if (!crossed32 && b > 32 * 1024) crossed32 = n;
    if (!crossed240 && b > 240 * 1024) { crossed240 = n; break; }
  }
  out('16 toggles (no notes) to exceed 32 KiB / 240 KiB', `${crossed32} / ${crossed240}`);

  // 17: empty-mandatory template: validator vs UI rule
  const opt = ChecklistEngine.initializeState('40001', 'P-5', { id: 'o', name: 'o', description: '', items: [{ id: 'x', title: 'x', isMandatory: false, category: 'TESTING' }] }, 'system', T);
  out('17 validator with zero mandatory items allows', TransitionValidator.validate(opt).canTransition + ' (UI isGateOpen rule index.tsx:105 would show LOCKED)');
})();
