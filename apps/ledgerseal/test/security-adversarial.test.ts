/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

import * as fs from 'fs';
import * as path from 'path';
import { generateSealCertificate, verifyCertificateIntegrity, computeSnapshotHash } from '../src/domain/crypto';
import { analyzeTamperState } from '../src/domain/tamper-detector';
import { CanonicalIssueSnapshot, ElectronicSignature } from '../src/domain/models';

describe('Loop 3: Adversarial Security & Quality Verification', () => {
  const sampleSnapshot: CanonicalIssueSnapshot = {
    issueId: '10001',
    issueKey: 'SEC-1',
    projectKey: 'SEC',
    issueType: 'Security Advisory',
    status: 'Approved',
    fields: [
      { id: 'summary', name: 'Summary', type: 'string', value: 'Zero-day vulnerability mitigation' },
      { id: 'customfield_cvss', name: 'CVSS Score', type: 'number', value: 9.8 }
    ],
    attachments: [
      { id: 'att-1', filename: 'cve-evidence.pdf', size: 4096, created: '2026-10-28T00:00:00Z', authorAccountId: 'acc-ciso' }
    ],
    capturedAt: '2026-10-28T12:00:00Z'
  };

  const sampleSig: ElectronicSignature = {
    signerAccountId: 'acc-ciso',
    signerDisplayName: 'Chief Information Security Officer',
    signedAt: '2026-10-28T12:01:00Z',
    meaning: 'Approved for urgent patch deployment',
    reasonCode: 'RELEASE_GATE',
    declarationText: 'Verified per the change management procedure.'
  };

  describe('Adversarial Invariant 1: Zero External Egress Verification', () => {
    it('manifest.yml contains zero external network permissions or domains', () => {
      const manifestPath = path.resolve(__dirname, '../manifest.yml');
      const manifestContent = fs.readFileSync(manifestPath, 'utf8');

      expect(manifestContent).not.toContain('external:');
      expect(manifestContent).not.toContain('fetch:');
      expect(manifestContent).not.toContain('backend:');
      expect(manifestContent).toContain('read:jira-work');
      expect(manifestContent).toContain('storage:app');
    });

    it('source code contains no unauthorized external networking modules', () => {
      const srcDir = path.resolve(__dirname, '../src');
      const checkFiles = (dir: string) => {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const fullPath = path.join(dir, file);
          if (fs.statSync(fullPath).isDirectory()) {
            checkFiles(fullPath);
          } else if (file.endsWith('.ts')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            expect(content).not.toMatch(/from\s+['"]axios['"]/);
            expect(content).not.toMatch(/from\s+['"]node-fetch['"]/);
            expect(content).not.toMatch(/require\(['"]http['"]\)/);
            expect(content).not.toMatch(/require\(['"]https['"]\)/);
          }
        }
      };
      checkFiles(srcDir);
    });
  });

  describe('Adversarial Invariant 2: Cryptographic Tamper Resilience', () => {
    it('detects single-bit manipulation of snapshotHash in certificate', () => {
      const cert = generateSealCertificate(sampleSnapshot, sampleSig);
      // Flip the last character of the snapshot hash
      const flippedChar = cert.snapshotHash.endsWith('a') ? 'b' : 'a';
      const tamperedCert = {
        ...cert,
        snapshotHash: cert.snapshotHash.slice(0, -1) + flippedChar
      };
      expect(verifyCertificateIntegrity(tamperedCert)).toBe(false);
    });

    it('detects substitution of signerAccountId post-signing', () => {
      const cert = generateSealCertificate(sampleSnapshot, sampleSig);
      const forgedCert = {
        ...cert,
        sealedBy: {
          ...cert.sealedBy,
          signerAccountId: 'acc-attacker'
        }
      };
      expect(verifyCertificateIntegrity(forgedCert)).toBe(false);
    });

    it('detects minor precision change in numeric custom fields (e.g. CVSS 9.8 to 9.81)', () => {
      const cert = generateSealCertificate(sampleSnapshot, sampleSig);
      const liveSnapshot: CanonicalIssueSnapshot = {
        ...sampleSnapshot,
        fields: [
          { id: 'summary', name: 'Summary', type: 'string', value: 'Zero-day vulnerability mitigation' },
          { id: 'customfield_cvss', name: 'CVSS Score', type: 'number', value: 9.81 } // subtly modified
        ]
      };
      const analysis = analyzeTamperState(cert, liveSnapshot, '2026-10-28T12:05:00Z');
      expect(analysis.status).toBe('SEAL_BROKEN');
      expect(analysis.tamperedFields[0].fieldId).toBe('customfield_cvss');
      expect(analysis.tamperedFields[0].sealedValue).toBe(9.8);
      expect(analysis.tamperedFields[0].liveValue).toBe(9.81);
    });
  });

  describe('Adversarial Invariant 3: Forge storage limits', () => {
    it('serialized seal certificate comfortably fits within Forge 32 KB per-item storage limit', () => {
      const cert = generateSealCertificate(sampleSnapshot, sampleSig);
      const serialized = JSON.stringify(cert);
      const byteSize = Buffer.byteLength(serialized, 'utf8');

      // Forge limit is 32,768 bytes (32 KB)
      expect(byteSize).toBeLessThan(10240); // should be well under 10 KB
    });
  });
});
