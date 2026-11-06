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
exports.calculateChecklistHash = calculateChecklistHash;
const crypto = __importStar(require("crypto"));
function codeUnitCompare(a, b) {
    if (a < b)
        return -1;
    if (a > b)
        return 1;
    return 0;
}
/**
 * Calculates a deterministic SHA-256 hash of the checklist state.
 * Binds items, monotonic state version, and audit trail to ensure non-monotonic integrity.
 */
function calculateChecklistHash(items, stateVersion = 1, auditTrail = []) {
    const sortedItems = [...items].sort((a, b) => codeUnitCompare(a.id, b.id));
    const serializedItems = sortedItems.map(item => ({
        id: item.id,
        title: item.title,
        isMandatory: item.isMandatory,
        isCompleted: item.isCompleted,
        category: item.category,
        completedBy: item.completedBy || null,
        completedByAccountId: item.completedByAccountId || null,
        completedAt: item.completedAt || null,
        notes: item.notes || null
    }));
    const payload = {
        stateVersion,
        items: serializedItems,
        eventCount: auditTrail.length,
        lastEventId: auditTrail.length > 0 ? auditTrail[auditTrail.length - 1].id : null
    };
    const jsonString = JSON.stringify(payload);
    return crypto.createHash('sha256').update(jsonString, 'utf8').digest('hex');
}
