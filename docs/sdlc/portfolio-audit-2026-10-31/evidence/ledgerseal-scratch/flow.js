// Asymm Systems audit scratch: end-to-end resolver flow with mocked Forge APIs.
const Module = require('module');
let issue = { id: '10001', key: 'P-1', fields: { project: { key: 'P' }, issuetype: { name: 'Task' }, status: { name: 'Approved' }, summary: 'Ship v1' } };
const props = {};
const apiMock = { __esModule: true, default: { asApp: () => ({ requestJira: async (p, opt) => {
  if (p.includes('/properties/')) { props[p] = JSON.parse(opt.body); return { status: 200 }; }
  if (p.includes('/user')) return { status: 200, json: async () => ({ displayName: 'Mallory' }) }; // email hidden by privacy
  return { status: 200, json: async () => JSON.parse(JSON.stringify(issue)) };
} }) }, route: (s, ...v) => s.reduce((a, x, i) => a + x + (v[i] !== undefined ? v[i] : ''), '') };
const origLoad = Module._load;
Module._load = function (req, ...rest) {
  if (req === '@forge/api') return apiMock;
  if (req === '@forge/kvs') return { kvs: {} };
  if (req === '@forge/resolver') return class { define() {} getDefinitions() { return () => {}; } };
  return origLoad.call(this, req, ...rest);
};
const idx = require('./build/index');
const map = new Map();
const store = { get: async k => map.has(k) ? JSON.parse(JSON.stringify(map.get(k))) : null, set: async (k, v) => { map.set(k, JSON.parse(JSON.stringify(v))); }, delete: async k => map.delete(k) };
(async () => {
  const ctxApprover = { accountId: 'approver-1', extension: { issue: { id: '10001', key: 'P-1' } } };
  const ctxMallory = { accountId: 'mallory-9', extension: { issue: { id: '10001', key: 'P-1' } } };
  await idx.sealIssue({ signature: { reauthConfirmation: 'x', meaning: 'Approved' } }, ctxApprover, store);
  console.log('1 sealed by approver; validator:', (await idx.validateTransition({ issue: { id: '10001' } }, {}, store)).result);
  issue.fields.summary = 'Ship v1 plus unreviewed scope';
  for (let i = 0; i < 3; i++) await idx.verifyIssue({}, ctxMallory, store);
  console.log('2 after tamper + 3 panel views: validator:', (await idx.validateTransition({ issue: { id: '10001' } }, {}, store)).result,
    '| history entries:', (map.get('cert:history:10001') || []).length,
    '| active tamperHistory:', map.get('cert:active:10001').tamperHistory.length);
  const r = await idx.sealIssue({ signature: { reauthConfirmation: 'anything', meaning: 'Approved', signerEmail: 'cfo@victim.example', signerDisplayName: 'CFO' } }, ctxMallory, store);
  const act = map.get('cert:active:10001');
  console.log('3 mallory reseals; validator:', (await idx.validateTransition({ issue: { id: '10001' } }, {}, store)).result,
    '| signer:', act.sealedBy.signerAccountId, act.sealedBy.signerDisplayName, act.sealedBy.signerEmail,
    '| active isCompromised:', act.isCompromised, '| tamperHistory:', act.tamperHistory);
  console.log('4 history list:', JSON.stringify(map.get('cert:history:10001').map(h => [h.certificateId.slice(0, 8), h.signerAccountId, h.status])));
  console.log('5 entity property:', JSON.stringify(Object.values(props).pop()));
  // validator with Jira fetch failure
  apiMock.default.asApp = () => ({ requestJira: async (p, opt) => { if (p.includes('/properties/')) { props.last = JSON.parse(opt.body); return { status: 200 }; } throw new Error('timeout'); } });
  const v = await idx.validateTransition({ issue: { id: '10001', key: 'P-1' } }, {}, store);
  console.log('6 validator on Jira fetch failure:', v.result, '|', v.errorMessage.slice(0, 70), '| property written:', props.last && props.last.status);
})();
