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
Object.defineProperty(exports, "__esModule", { value: true });
exports.LedgerSealPanel = void 0;
const react_1 = __importStar(require("react"));
const react_2 = __importStar(require("@forge/react"));
const bridge_1 = require("@forge/bridge");
function formatDiffValue(val) {
    if (val === null || val === undefined)
        return '(empty)';
    if (typeof val === 'string')
        return val.length > 80 ? `${val.slice(0, 77)}...` : val;
    if (typeof val === 'number' || typeof val === 'boolean')
        return String(val);
    if (Array.isArray(val))
        return val.map(formatDiffValue).join(', ') || '(empty list)';
    if (typeof val === 'object') {
        if (val.name)
            return val.name;
        if (val.displayName)
            return val.displayName;
        if (val.type === 'doc')
            return 'Rich text description updated';
        return Object.entries(val)
            .map(([k, v]) => `${k}: ${typeof v === 'object' ? '...' : String(v)}`)
            .slice(0, 3)
            .join(', ');
    }
    return String(val);
}
const LedgerSealPanel = () => {
    const [analysis, setAnalysis] = (0, react_1.useState)(null);
    const [loading, setLoading] = (0, react_1.useState)(true);
    const [showSignForm, setShowSignForm] = (0, react_1.useState)(false);
    const [showDetails, setShowDetails] = (0, react_1.useState)(false);
    const [meaning, setMeaning] = (0, react_1.useState)('Approved for production release');
    const [reauthCode, setReauthCode] = (0, react_1.useState)('');
    const [declarationAgreed, setDeclarationAgreed] = (0, react_1.useState)(false);
    const [submitting, setSubmitting] = (0, react_1.useState)(false);
    (0, react_1.useEffect)(() => {
        loadTamperState();
    }, []);
    const loadTamperState = async () => {
        setLoading(true);
        try {
            const result = await (0, bridge_1.invoke)('verify-issue-api', {});
            if (result) {
                setAnalysis(result);
            }
            else {
                setAnalysis({
                    status: 'NO_SEAL',
                    tamperedFields: [],
                    tamperedAttachments: [],
                    verifiedAt: new Date().toISOString()
                });
            }
        }
        catch (err) {
            console.error('Failed to load seal state', err);
            setAnalysis({
                status: 'NO_SEAL',
                tamperedFields: [],
                tamperedAttachments: [],
                verifiedAt: new Date().toISOString()
            });
        }
        finally {
            setLoading(false);
        }
    };
    const handleSealSubmit = async () => {
        if (!declarationAgreed || !reauthCode.trim()) {
            return;
        }
        setSubmitting(true);
        try {
            await (0, bridge_1.invoke)('seal-issue-api', {
                signature: {
                    meaning,
                    reasonCode: 'APPROVAL',
                    declarationText: 'I electronically sign and seal this issue per compliance guidelines.',
                    reauthConfirmation: reauthCode.trim()
                }
            });
            setShowSignForm(false);
            setReauthCode('');
            await loadTamperState();
        }
        catch (err) {
            console.error('Failed to seal issue', err);
        }
        finally {
            setSubmitting(false);
        }
    };
    if (loading) {
        return (react_1.default.createElement(react_2.Inline, { alignBlock: "center" },
            react_1.default.createElement(react_2.Spinner, { size: "small" }),
            react_1.default.createElement(react_2.Text, null, "Verifying cryptographic seal...")));
    }
    return (react_1.default.createElement(react_2.Stack, { space: "space.150" },
        react_1.default.createElement(react_2.Heading, { as: "h4" }, "LedgerSeal: Cryptographic Sign-Off & Change Gate"),
        analysis?.status === 'SEAL_VALID' && (react_1.default.createElement(react_2.SectionMessage, { appearance: "success", title: "Cryptographic Seal Verified" },
            react_1.default.createElement(react_2.Text, null,
                "Signer: ",
                analysis.certificate?.sealedBy.signerDisplayName,
                " (",
                analysis.certificate?.sealedBy.reasonCode,
                ")"),
            react_1.default.createElement(react_2.Text, null,
                "Sealed At: ",
                analysis.certificate?.sealedAt),
            react_1.default.createElement(react_2.Text, null,
                "SHA-256 Hash: ",
                analysis.sealedHash?.slice(0, 16),
                "..."),
            react_1.default.createElement(react_2.Lozenge, { appearance: "success" }, "UNTAMPERED & AUDIT READY"))),
        analysis?.status === 'SEAL_COMPROMISED' && (react_1.default.createElement(react_2.SectionMessage, { appearance: "error", title: "CRITICAL: Previous Unauthorized Modification Detected" },
            react_1.default.createElement(react_2.Text, null, "Non-Monotonic Audit Alert: This issue was modified after sign-off and subsequently reverted. Reverting modified content does not heal a cryptographic seal. Explicit re-authorization is required."),
            react_1.default.createElement(react_2.Lozenge, { appearance: "removed" }, "PREVIOUSLY TAMPERED / COMPROMISED"),
            react_1.default.createElement(react_2.Button, { appearance: "warning", onClick: () => setShowSignForm(true) }, "Re-Authorize and Reseal"))),
        analysis?.status === 'SEAL_BROKEN' && (react_1.default.createElement(react_2.SectionMessage, { appearance: "error", title: "CRITICAL: Cryptographic Seal Broken" },
            react_1.default.createElement(react_2.Text, null,
                "This issue was modified after it was signed off by",
                ' ',
                analysis.certificate?.sealedBy.signerDisplayName,
                " at ",
                analysis.certificate?.sealedAt,
                "."),
            react_1.default.createElement(react_2.Lozenge, { appearance: "removed" }, "TAMPER DETECTED"),
            analysis.tamperedFields.length > 0 && (react_1.default.createElement(react_2.Stack, { space: "space.050" },
                react_1.default.createElement(react_2.Heading, { as: "h5" },
                    "Altered Fields (",
                    analysis.tamperedFields.length,
                    "):"),
                analysis.tamperedFields.map(diff => (react_1.default.createElement(react_2.Box, { key: diff.fieldId, padding: "space.050" },
                    react_1.default.createElement(react_2.Text, null,
                        diff.fieldName,
                        ": \"",
                        formatDiffValue(diff.sealedValue),
                        "\" \u2192 \"",
                        formatDiffValue(diff.liveValue),
                        "\"")))))),
            react_1.default.createElement(react_2.Button, { appearance: "warning", onClick: () => setShowSignForm(true) }, "Re-Authorize and Reseal"))),
        (!analysis || analysis.status === 'NO_SEAL') && (react_1.default.createElement(react_2.SectionMessage, { appearance: "information", title: "Issue Not Sealed" },
            react_1.default.createElement(react_2.Text, null, "This issue does not possess an active cryptographic seal. A seal is required to pass compliance workflow gates."),
            react_1.default.createElement(react_2.Button, { appearance: "primary", onClick: () => setShowSignForm(true) }, "Seal Issue with Cryptographic Sign-Off"))),
        analysis?.certificate && (react_1.default.createElement(react_2.Box, { padding: "space.100" },
            react_1.default.createElement(react_2.Stack, { space: "space.050" },
                react_1.default.createElement(react_2.Heading, { as: "h5" }, "Audit Certificate Details"),
                react_1.default.createElement(react_2.Text, null,
                    "Certificate ID: ",
                    analysis.certificate.certificateId),
                react_1.default.createElement(react_2.Text, null,
                    "Signer: ",
                    analysis.certificate.sealedBy.signerDisplayName,
                    analysis.certificate.sealedBy.signerEmail
                        ? ` (${analysis.certificate.sealedBy.signerEmail})`
                        : ` (Account: ${analysis.certificate.sealedBy.signerAccountId})`),
                react_1.default.createElement(react_2.Text, null,
                    "Meaning: ",
                    analysis.certificate.sealedBy.meaning),
                react_1.default.createElement(react_2.Text, null,
                    "Digest: ",
                    analysis.sealedHash),
                react_1.default.createElement(react_2.Button, { appearance: "subtle", onClick: () => setShowDetails(!showDetails) }, showDetails ? 'Hide Certificate Details' : 'Inspect Certificate Metadata'),
                showDetails && (react_1.default.createElement(react_2.Box, { padding: "space.050" },
                    react_1.default.createElement(react_2.Text, null,
                        "Algorithm: ",
                        analysis.certificate.algorithm),
                    react_1.default.createElement(react_2.Text, null,
                        "Canonical Fields Sealed: ",
                        analysis.certificate.snapshot.fields.length),
                    react_1.default.createElement(react_2.Text, null,
                        "Attachments Sealed: ",
                        analysis.certificate.snapshot.attachments.length),
                    react_1.default.createElement(react_2.Text, null,
                        "Comments Sealed: ",
                        analysis.certificate.snapshot.comments?.length || 0),
                    analysis.certificate.tamperHistory && analysis.certificate.tamperHistory.length > 0 && (react_1.default.createElement(react_2.Text, null,
                        "Tamper Incident Count: ",
                        analysis.certificate.tamperHistory.length))))))),
        showSignForm && (react_1.default.createElement(react_2.Box, { padding: "space.150" },
            react_1.default.createElement(react_2.Stack, { space: "space.100" },
                react_1.default.createElement(react_2.Heading, { as: "h4" }, "Cryptographic Sign-Off & Seal"),
                react_1.default.createElement(react_2.Label, { labelFor: "meaning" }, "Sign-Off Meaning / Regulatory Purpose"),
                react_1.default.createElement(react_2.Textfield, { id: "meaning", name: "meaning", placeholder: "e.g. Approved for production release", defaultValue: meaning, onChange: (e) => setMeaning(e.target.value) }),
                react_1.default.createElement(react_2.Label, { labelFor: "reauth" }, "Signer Re-Authentication Challenge"),
                react_1.default.createElement(react_2.Textfield, { id: "reauth", name: "reauth", placeholder: "Type 'CONFIRM' to authorize signature", value: reauthCode, onChange: (e) => setReauthCode(e.target.value) }),
                react_1.default.createElement(react_2.Checkbox, { value: "agreed", isChecked: declarationAgreed, onChange: (e) => setDeclarationAgreed(e.target.checked), label: "I certify that I am the authorized signer and this record is complete, accurate, and ready for release." }),
                react_1.default.createElement(react_2.Inline, { space: "space.100" },
                    react_1.default.createElement(react_2.Button, { appearance: "primary", isDisabled: !declarationAgreed || !reauthCode.trim() || submitting, onClick: handleSealSubmit }, submitting ? 'Sealing...' : 'Sign & Cryptographically Seal'),
                    react_1.default.createElement(react_2.Button, { appearance: "subtle", onClick: () => setShowSignForm(false) }, "Cancel")))))));
};
exports.LedgerSealPanel = LedgerSealPanel;
exports.default = exports.LedgerSealPanel;
react_2.default.render(react_1.default.createElement(react_1.default.StrictMode, null,
    react_1.default.createElement(exports.LedgerSealPanel, null)));
