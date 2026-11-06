"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChecklistRepository = void 0;
class ChecklistRepository {
    storage;
    constructor(storage) {
        this.storage = storage;
    }
    getIssueKey(issueId) {
        return `dg:checklist:${issueId}`;
    }
    getTemplateKey(templateId) {
        return `dg:template:${templateId}`;
    }
    async getIssueChecklist(issueId) {
        return await this.storage.get(this.getIssueKey(issueId));
    }
    async saveIssueChecklist(state) {
        await this.storage.set(this.getIssueKey(state.issueId), state);
    }
    async deleteIssueChecklist(issueId) {
        await this.storage.delete(this.getIssueKey(issueId));
    }
    async getTemplate(templateId) {
        return await this.storage.get(this.getTemplateKey(templateId));
    }
    async saveTemplate(template) {
        await this.storage.set(this.getTemplateKey(template.id), template);
    }
}
exports.ChecklistRepository = ChecklistRepository;
