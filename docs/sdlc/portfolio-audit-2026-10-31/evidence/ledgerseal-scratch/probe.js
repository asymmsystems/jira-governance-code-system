// Asymm Systems audit scratch probe. Requires compiled src in ./build
const path = require('path');
const B = path.join(__dirname, 'build');
const { canonicalizeIssueState } = require(B + '/domain/canonicalizer');
const { computeSnapshotHash } = require(B + '/domain/crypto');
const { analyzeTamperState } = require(B + '/domain/tamper-detector');
const { generateSealCertificate } = require(B + '/domain/crypto');
const T = '2026-10-31T00:00:00Z';
const base = () => ({
  id: '10001', key: 'P-1',
  fields: {
    project: { key: 'P' }, issuetype: { name: 'Task' }, status: { name: 'Approved' },
    summary: 'Release v1', reporter: { accountId: 'r1' },
    resolution: null,
    labels: ['b', 'a'], components: [{ name: 'X', id: '1' }],
    priority: { id: '2', name: 'High' },
    assignee: { accountId: 'a1', displayName: 'Alice' },
    customfield_10001: 'Approved budget 1000',
    customfield_10050: 42,
    customfield_20000: ['step1', 'step2', 'step3'],
    customfield_20001: 'see pullrequest 12 notes',
    customfield_20002: '2026-10-31T10:00:00.000+0000',
    customfield_20003: [{ state: 'ok', value: 'Gold' }],
    attachment: [{ id: '5', filename: 'evidence.pdf', size: 100, created: '2026-10-30T00:00:00.000+0000', author: { accountId: 'u' } }],
    comment: { comments: [], total: 0 }
  }
});
const h = (iss) => computeSnapshotHash(canonicalizeIssueState(iss, T));
const H0 = h(base());
const sig = { signerAccountId: 'a', signerDisplayName: 'A', signedAt: T, meaning: 'm', reasonCode: 'APPROVAL', declarationText: 'd' };
const cert = generateSealCertificate(canonicalizeIssueState(base(), T), sig);
function probe(name, mut) {
  const i = base(); mut(i);
  const hv = h(i);
  const st = analyzeTamperState(cert, canonicalizeIssueState(i, T), T).status;
  console.log((hv === H0 ? 'SAME-HASH ' : 'DIFF-HASH ') + st.padEnd(12) + name);
}
// Determinism
const reordered = base(); const f = reordered.fields; reordered.fields = Object.fromEntries(Object.entries(f).reverse());
console.log('key order reversed  -> ' + (h(reordered) === H0 ? 'SAME' : 'DIFF'));
probe('labels reordered', i => i.fields.labels = ['a', 'b']);
probe('date same instant other tz (+0530)', i => i.fields.customfield_20002 = '2026-10-31T15:30:00.000+0530');
probe('ordered list reordered (step3,step1,step2)', i => i.fields.customfield_20000 = ['step3', 'step1', 'step2']);
// Excluded / dropped fields
probe('status changed', i => i.fields.status = { name: 'Rejected' });
probe('reporter changed', i => i.fields.reporter = { accountId: 'evil' });
probe('resolution set', i => i.fields.resolution = { name: "Won't Do" });
probe('customfield_10001 (hardcoded volatile id) changed', i => i.fields.customfield_10001 = 'Approved budget 9999999');
probe('customfield_10050 (hardcoded volatile id) changed', i => i.fields.customfield_10050 = 0);
probe('string field containing "pullrequest" changed', i => i.fields.customfield_20001 = 'see pullrequest 99 notes, scope tripled');
probe('array of objects with .state changed', i => i.fields.customfield_20003 = [{ state: 'ok', value: 'Bronze' }]);
probe('summary trailing whitespace added', i => i.fields.summary = 'Release v1   ');
probe('label duplicated', i => i.fields.labels = ['a', 'b', 'b']);
probe('component renamed id kept (name change only)', i => i.fields.components = [{ name: 'Y', id: '1' }]);
probe('component id swapped same name', i => i.fields.components = [{ name: 'X', id: '99' }]);
probe('assignee displayName changed only (profile rename)', i => i.fields.assignee = { accountId: 'a1', displayName: 'Alice Smith' });
probe('priority changed', i => i.fields.priority = { id: '1', name: 'Highest' });
probe('summary changed', i => i.fields.summary = 'Release v2');
probe('attachment replaced same id/size/name (impossible in Jira, content not hashed)', i => {});
probe('worklog added', i => i.fields.worklog = { worklogs: [{ id: '1', timeSpent: '8h' }] });
probe('timeoriginalestimate changed', i => i.fields.timeoriginalestimate = 999999);
probe('comment added', i => i.fields.comment = { comments: [{ id: '9', author: { accountId: 'x' }, body: 'sneaky', created: T }] });
probe('field set to [] from absent (empty array) ', i => i.fields.customfield_30000 = []);
probe('string field "0|abc" changed (rank heuristic)', i => { });
// array of scalar where order matters but canonicalizeValue sorts
const A = base(); A.fields.customfield_20000 = ['b','a']; const B2 = base(); B2.fields.customfield_20000 = ['a','b'];
console.log('ordered custom array [b,a] vs [a,b] -> ' + (h(A) === h(B2) ? 'SAME (order lost)' : 'DIFF'));
// capturedAt excluded
console.log('capturedAt differs -> ' + (computeSnapshotHash(canonicalizeIssueState(base(), 'X')) === H0 ? 'SAME' : 'DIFF'));
// Hash is unkeyed: anyone can recompute
const crypto = require('crypto');
const s = canonicalizeIssueState(base(), T);
const outside = crypto.createHash('sha256').update(JSON.stringify({ issueId: s.issueId, issueKey: s.issueKey, projectKey: s.projectKey, issueType: s.issueType, fields: s.fields, attachments: s.attachments, comments: s.comments || [] })).digest('hex');
console.log('outside recompute equals app hash -> ' + (outside === H0));
// tamperHistory growth per verify
let c = JSON.parse(JSON.stringify(cert)); const tampered = base(); tampered.fields.summary = 'x';
for (let k = 0; k < 500; k++) { const a = analyzeTamperState(c, canonicalizeIssueState(tampered, T), T); c.isCompromised = true; c.tamperHistory = a.tamperHistory; }
console.log('tamperHistory after 500 verifies: ' + c.tamperHistory.length + ' entries, cert bytes=' + Buffer.byteLength(JSON.stringify(c)));
// Big description size
const big = base(); big.fields.description = { type: 'doc', version: 1, content: Array.from({ length: 400 }, (_, n) => ({ type: 'paragraph', content: [{ type: 'text', text: 'Line ' + n + ' '.padEnd(200, 'x') }] })) };
const bc = generateSealCertificate(canonicalizeIssueState(big, T), sig);
console.log('cert bytes with 400-paragraph description: ' + Buffer.byteLength(JSON.stringify(bc)));
