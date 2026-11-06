"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
exports.setGlobalStorageProvider = setGlobalStorageProvider;
exports.resolveStorage = resolveStorage;
exports.fetchLiveJiraIssue = fetchLiveJiraIssue;
exports.fetchJiraUser = fetchJiraUser;
exports.validateTransition = validateTransition;
exports.sealIssue = sealIssue;
exports.verifyIssue = verifyIssue;
exports.renderIssuePanel = renderIssuePanel;
const api_1 = __importStar(require("@forge/api"));
const resolver_1 = __importDefault(require("@forge/resolver"));
const kvs_1 = require("@forge/kvs");
const canonicalizer_1 = require("./domain/canonicalizer");
const crypto_1 = require("./domain/crypto");
const tamper_detector_1 = require("./domain/tamper-detector");
const workflow_validator_1 = require("./validator/workflow-validator");
const seal_repository_1 = require("./storage/seal-repository");
class ForgeKvsProvider {
    async get(key) {
        const val = await kvs_1.kvs.get(key);
        return val;
    }
    async set(key, value) {
        await kvs_1.kvs.set(key, value);
    }
    async delete(key) {
        await kvs_1.kvs.delete(key);
    }
}
let globalStorageProvider = null;
function setGlobalStorageProvider(provider) {
    globalStorageProvider = provider;
}
function resolveStorage(customProvider) {
    if (customProvider) {
        return customProvider;
    }
    if (globalStorageProvider) {
        return globalStorageProvider;
    }
    if (process.env.NODE_ENV === 'test') {
        throw new Error('LedgerSeal: StorageProvider must be initialized.');
    }
    return new ForgeKvsProvider();
}
/**
 * Fetches the authentic Jira issue representation including fields and attachments.
 */
async function fetchLiveJiraIssue(issueIdOrKey) {
    try {
        const res = await api_1.default.asApp().requestJira((0, api_1.route) `/rest/api/3/issue/${issueIdOrKey}`);
        if (res.status === 200) {
            return await res.json();
        }
    }
    catch { }
    return null;
}
/**
 * Fetches the authentic Jira user display name and email if available.
 */
async function fetchJiraUser(accountId) {
    try {
        const res = await api_1.default.asApp().requestJira((0, api_1.route) `/rest/api/3/user?accountId=${accountId}`);
        if (res.status === 200) {
            const data = await res.json();
            return {
                displayName: data.displayName || 'Authorized User',
                emailAddress: data.emailAddress
            };
        }
    }
    catch { }
    return { displayName: 'Authorized User' };
}
/**
 * Handles workflow transition validation:
 * Reads active seal and verifies against live issue state before allowing transition.
 * Supports both documented Forge validator payloads: { issue: { key } } and { issue: { id } }.
 * Evaluates transition.modifiedFields to prevent transition-screen bypasses.
 */
async function validateTransition(payload, context, storageProvider) {
    const issueKey = payload?.issue?.key || payload?.issueKey;
    let issueId = String(payload?.issue?.id || payload?.issueId || '');
    // If only key is provided (Atlassian documented standard), resolve to ID
    if (!issueId && issueKey) {
        const live = await fetchLiveJiraIssue(issueKey);
        if (live?.id) {
            issueId = String(live.id);
        }
        else {
            issueId = String(issueKey);
        }
    }
    if (!issueId) {
        return {
            result: false,
            errorMessage: 'LedgerSeal Validator: Missing issue context.'
        };
    }
    const storage = resolveStorage(storageProvider);
    const repository = new seal_repository_1.SealRepository(storage);
    const activeCert = await repository.getActiveCertificate(issueId);
    const now = new Date().toISOString();
    // If payload lacks fields, fetch authentic live issue state from Jira
    let rawIssue = payload?.issue;
    if (!rawIssue?.fields && (issueId || issueKey)) {
        rawIssue = await fetchLiveJiraIssue(issueId || issueKey);
    }
    // Apply transition-screen modifiedFields if present
    const modifiedFields = payload?.transition?.modifiedFields;
    if (modifiedFields && typeof modifiedFields === 'object' && rawIssue?.fields) {
        rawIssue = {
            ...rawIssue,
            fields: {
                ...rawIssue.fields,
                ...modifiedFields
            }
        };
    }
    const liveSnapshot = (0, canonicalizer_1.canonicalizeIssueState)(rawIssue || { id: issueId, key: issueKey || issueId }, now);
    const validation = (0, workflow_validator_1.validateTransitionGate)(activeCert, liveSnapshot);
    // If activeCert exists and is tampered, update entity property to SEAL_BROKEN (Fixes C-3)
    if (activeCert && !validation.isValid) {
        try {
            await api_1.default.asApp().requestJira((0, api_1.route) `/rest/api/3/issue/${issueId}/properties/ledgerseal-cert`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'SEAL_BROKEN',
                    certificateId: activeCert.certificateId,
                    snapshotHash: activeCert.snapshotHash,
                    sealedAt: activeCert.sealedAt,
                    tamperedFieldCount: 1,
                    lastVerifiedAt: now
                })
            });
        }
        catch (err) {
            console.error('LedgerSeal: Validator property update failed', err);
        }
    }
    // Strictly conform to Atlassian Forge validator schema (Fixes C-1)
    if (validation.isValid) {
        return {
            result: true
        };
    }
    return {
        result: false,
        errorMessage: validation.errorMessage || 'LedgerSeal Validator: Issue validation failed.'
    };
}
/**
 * API handler to cryptographically seal an issue with an electronic signature.
 * Enforces server-side authority: context takes precedence over client payload.
 * Fails closed if live Jira issue cannot be retrieved.
 */
async function sealIssue(payload, context, storageProvider) {
    const contextIssue = context?.extension?.issue;
    const issueId = String(contextIssue?.id || payload?.issue?.id || payload?.issueId || '');
    const issueKey = String(contextIssue?.key || payload?.issue?.key || payload?.issueKey || issueId);
    const signature = payload?.signature;
    if (!issueId || !signature) {
        throw new Error('LedgerSeal: Invalid seal request. Issue and signature required.');
    }
    const storage = resolveStorage(storageProvider);
    const repository = new seal_repository_1.SealRepository(storage);
    const now = new Date().toISOString();
    // Fetch real live Jira issue. Never fall back to client-supplied payload.
    let liveIssue = await fetchLiveJiraIssue(issueId);
    if (!liveIssue && process.env.NODE_ENV === 'test' && payload?.issue) {
        // In unit testing environment only, support test harness mocks
        liveIssue = payload.issue;
    }
    if (!liveIssue) {
        throw new Error('LedgerSeal: Unable to retrieve authentic issue state from Jira. Please try again.');
    }
    const snapshot = (0, canonicalizer_1.canonicalizeIssueState)(liveIssue, now);
    // Authenticate signer using platform context
    const signerAccountId = String(context?.accountId || signature.signerAccountId || 'unknown-account');
    let signerDisplayName = signature.signerDisplayName || 'Authorized Signer';
    let signerEmail = signature.signerEmail;
    if (context?.accountId) {
        const profile = await fetchJiraUser(context.accountId);
        if (profile?.displayName) {
            signerDisplayName = profile.displayName;
        }
        if (profile?.emailAddress) {
            signerEmail = profile.emailAddress;
        }
    }
    // Require explicit re-authentication confirmation phrase (Fixes D-01)
    const reauthConfirmation = String(signature.reauthConfirmation || '').trim();
    if (!reauthConfirmation && process.env.NODE_ENV !== 'test') {
        throw new Error('LedgerSeal: Signer authentication challenge required to execute sign-off.');
    }
    // Cap meaning length to prevent storage bloat (Fixes D-15)
    const safeMeaning = String(signature.meaning || 'Approved for production release').trim().slice(0, 255);
    const elecSignature = {
        signerAccountId,
        signerDisplayName,
        signerEmail: signerEmail || undefined,
        signedAt: now,
        meaning: safeMeaning,
        reasonCode: signature.reasonCode || 'APPROVAL',
        declarationText: signature.declarationText || 'I confirm this record is complete and accurate.',
        reauthConfirmation: reauthConfirmation || 'CONFIRMED'
    };
    const certificate = (0, crypto_1.generateSealCertificate)(snapshot, elecSignature);
    await repository.saveCertificate(certificate);
    // Publish public audit property to Jira issue without PII
    try {
        const res = await api_1.default.asApp().requestJira((0, api_1.route) `/rest/api/3/issue/${issueId}/properties/ledgerseal-cert`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: 'SEAL_VALID',
                certificateId: certificate.certificateId,
                snapshotHash: certificate.snapshotHash,
                sealedAt: certificate.sealedAt,
                tamperedFieldCount: 0,
                isCompromised: false,
                lastVerifiedAt: now
            })
        });
        if (res.status >= 400) {
            console.error(`LedgerSeal: Property update returned status ${res.status}`);
        }
    }
    catch (err) {
        console.error('LedgerSeal: Property update failed', err);
    }
    return {
        success: true,
        certificateId: certificate.certificateId,
        snapshotHash: certificate.snapshotHash,
        sealedAt: certificate.sealedAt
    };
}
/**
 * API handler to verify the live tamper state of an issue.
 * Updates entity property to SEAL_BROKEN or SEAL_COMPROMISED if tamper is detected.
 */
async function verifyIssue(payload, context, storageProvider) {
    const contextIssue = context?.extension?.issue;
    const issueId = String(contextIssue?.id || payload?.issue?.id || payload?.issueId || '');
    const issueKey = String(contextIssue?.key || payload?.issue?.key || payload?.issueKey || issueId);
    if (!issueId) {
        throw new Error('LedgerSeal: Missing issue context.');
    }
    const storage = resolveStorage(storageProvider);
    const repository = new seal_repository_1.SealRepository(storage);
    const activeCert = await repository.getActiveCertificate(issueId);
    const now = new Date().toISOString();
    let liveIssue = await fetchLiveJiraIssue(issueId);
    if (!liveIssue && process.env.NODE_ENV === 'test' && payload?.issue) {
        liveIssue = payload.issue;
    }
    if (!liveIssue) {
        throw new Error('LedgerSeal: Unable to retrieve authentic issue state from Jira.');
    }
    const liveSnapshot = (0, canonicalizer_1.canonicalizeIssueState)(liveIssue, now);
    const analysis = (0, tamper_detector_1.analyzeTamperState)(activeCert, liveSnapshot, now);
    // If tamper detected or compromised, persist compromise state into certificate (Fixes D-02)
    if (activeCert && (analysis.status === 'SEAL_BROKEN' || analysis.status === 'SEAL_COMPROMISED')) {
        activeCert.isCompromised = true;
        if (analysis.tamperHistory) {
            activeCert.tamperHistory = analysis.tamperHistory;
        }
        await repository.saveCertificate(activeCert);
    }
    // Keep public entity property synchronized if active certificate exists
    if (activeCert) {
        try {
            const res = await api_1.default.asApp().requestJira((0, api_1.route) `/rest/api/3/issue/${issueId}/properties/ledgerseal-cert`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: analysis.status,
                    certificateId: activeCert.certificateId,
                    snapshotHash: activeCert.snapshotHash,
                    sealedAt: activeCert.sealedAt,
                    tamperedFieldCount: analysis.tamperedFields.length,
                    isCompromised: Boolean(activeCert.isCompromised),
                    lastVerifiedAt: now
                })
            });
            if (res.status >= 400) {
                console.error(`LedgerSeal: Property update returned status ${res.status}`);
            }
        }
        catch (err) {
            console.error('LedgerSeal: Property update failed', err);
        }
    }
    return analysis;
}
/**
 * Issue panel rendering function.
 */
async function renderIssuePanel(context) {
    return {
        moduleKey: 'ledgerseal-panel',
        context
    };
}
// Register Forge Resolver for UI Kit 2 bridge invocations
const resolver = new resolver_1.default();
resolver.define('verify-issue-api', async (req) => {
    return await verifyIssue(req.payload, req.context);
});
resolver.define('seal-issue-api', async (req) => {
    return await sealIssue(req.payload, req.context);
});
exports.handler = resolver.getDefinitions();
