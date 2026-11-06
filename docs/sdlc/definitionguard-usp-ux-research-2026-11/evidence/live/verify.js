// Copyright (c) 2026 Asymm Systems. @author Fahim Farook
// Verifies a definitionguard-dod property with the published public key, independent of the app code.
const fs = require('fs'), crypto = require('crypto');
const canon = v => v === null || typeof v !== 'object' ? JSON.stringify(v) : Array.isArray(v) ? '[' + v.map(x => canon(x === undefined ? null : x)).join(',') + ']' : '{' + Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
const prop = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const pub = fs.readFileSync(process.argv[3], 'utf8');
const { sig, ...unsigned } = prop;
console.log('valid signature:', crypto.verify(null, Buffer.from(canon(unsigned)), pub, Buffer.from(sig, 'base64')));
const tampered = { ...unsigned, isFullySatisfied: true };
console.log('tampered copy valid:', crypto.verify(null, Buffer.from(canon(tampered)), pub, Buffer.from(sig, 'base64')));
