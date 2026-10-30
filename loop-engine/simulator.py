#!/usr/bin/env python3
"""
Local Interactive Simulator for Atlassian Suite:
- LedgerSeal (Immutable Audit Seal & Sign-Off Gate)
- DefinitionGuard (Definition of Done & Compliance Checklist)
- FourRealities (Architecture & Delivery Audit Dashboard)
Runs a standalone HTTP server on localhost so the user can test the suite immediately.
"""

import http.server
import socketserver
import json
import hashlib
import sys
from pathlib import Path

PORT = 3333

HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Atlassian Suite: Local Interactive Testbench</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { background-color: #f4f5f7; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif; }
    .jira-blue { background-color: #0052cc; }
    .jira-header { background-color: #0747a6; color: white; }
    .jira-sidebar { background-color: #f4f5f7; border-right: 1px solid #ebecf0; }
  </style>
</head>
<body class="text-slate-800">

  <!-- Top Navigation Bar -->
  <header class="jira-header px-6 py-2 flex items-center justify-between shadow-sm">
    <div class="flex items-center space-x-6">
      <div class="flex items-center space-x-2">
        <svg class="w-6 h-6 fill-current text-white" viewBox="0 0 24 24"><path d="M11.53 2c0 2.4-1.97 4.35-4.39 4.35H2.8a.8.8 0 0 0-.8.8v4.34c2.42 0 4.39 1.95 4.39 4.35v4.36c0 .44.36.8.8.8h4.34c0-2.4 1.97-4.35 4.39-4.35h4.34c.44 0 .8-.36.8-.8v-4.36c-2.42 0-4.39-1.95-4.39-4.35V2.8a.8.8 0 0 0-.8-.8h-4.35z"/></svg>
        <span class="font-bold text-lg tracking-tight">Jira Software Cloud (Local Testbench)</span>
      </div>
      <nav class="flex space-x-4 text-sm font-medium">
        <button id="tab-issue-btn" onclick="switchView('issue')" class="px-3 py-1.5 rounded bg-blue-800 text-white font-semibold">Issue View (LedgerSeal & DefinitionGuard)</button>
        <button id="tab-project-btn" onclick="switchView('project')" class="px-3 py-1.5 rounded text-blue-100 hover:bg-blue-800">Project Audit Dashboard (FourRealities)</button>
      </nav>
    </div>
    <div class="text-xs text-blue-200">
      Suite: <span class="bg-blue-900 px-2 py-1 rounded text-white font-semibold">Runs on Atlassian Forge (Zero Egress)</span>
    </div>
  </header>

  <!-- Main Container -->
  <main class="max-w-7xl mx-auto p-6">

    <!-- VIEW 1: JIRA ISSUE VIEW -->
    <div id="view-issue" class="space-y-6">
      
      <!-- Issue Header Breadcrumb -->
      <div class="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm border border-slate-200">
        <div>
          <span class="text-xs font-semibold text-slate-500 uppercase tracking-wide">SEC / SEC-402</span>
          <h1 class="text-2xl font-bold text-slate-900 mt-0.5" id="issue-summary">Upgrade OAuth2 Token Exchange & PKCE Flow</h1>
        </div>
        <div class="flex items-center space-x-3">
          <div class="text-right">
            <span class="text-xs text-slate-400 block">Workflow Status</span>
            <span id="issue-status-badge" class="inline-block px-2.5 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 uppercase">IN REVIEW</span>
          </div>
          <button onclick="attemptTransition()" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded shadow-sm transition">
            Transition to "Done" &rarr;
          </button>
        </div>
      </div>

      <!-- Transition Alert Message Box -->
      <div id="transition-alert" class="hidden p-4 rounded-lg text-sm border"></div>

      <!-- Issue Content Grid (2 Columns: Jira Fields on Left, Forge Panels on Right) -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        <!-- Left Column: Issue Description & Tamper Simulation -->
        <div class="lg:col-span-7 space-y-6">
          <div class="bg-white p-6 rounded-lg shadow-sm border border-slate-200 space-y-4">
            <div class="flex justify-between items-center border-b pb-3">
              <h2 class="text-sm font-bold uppercase text-slate-600">Issue Specification & Details</h2>
              <span class="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">Issue Type: Security Story</span>
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">Description</label>
              <p id="issue-description" class="text-sm text-slate-700 leading-relaxed bg-slate-50 p-3 rounded border border-slate-200">
                Implement RFC 8693 Token Exchange specification. Enforce S256 code challenge method for all authorization code requests. Invalidate refresh tokens immediately upon rotation.
              </p>
            </div>
            <div class="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span class="font-semibold text-slate-500 uppercase block">Assignee:</span>
                <span class="text-slate-800 font-medium">Fahim Farook (Security Architect)</span>
              </div>
              <div>
                <span class="font-semibold text-slate-500 uppercase block">Reporter:</span>
                <span class="text-slate-800 font-medium">Compliance Auditor (SOC 2)</span>
              </div>
              <div>
                <span class="font-semibold text-slate-500 uppercase block">Pull Request:</span>
                <span class="text-blue-600 font-medium">PR #142 (Approved by Lead Reviewer)</span>
              </div>
              <div>
                <span class="font-semibold text-slate-500 uppercase block">Confluence Spec:</span>
                <span class="text-blue-600 font-medium">ADR-089: PKCE Migration Plan</span>
              </div>
            </div>

            <!-- Adversary Simulation Controls -->
            <div class="pt-4 border-t border-slate-200">
              <span class="text-xs font-bold text-slate-500 uppercase block mb-2">Simulate Unauthorized Jira Modification (Tamper Test)</span>
              <div class="flex space-x-2">
                <button onclick="tamperDescription()" class="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 text-xs font-semibold rounded">
                  Tamper Description (Rewrite Approved Requirements)
                </button>
                <button onclick="resetDescription()" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded">
                  Reset Original Description
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Column: Forge Native Panels -->
        <div class="lg:col-span-5 space-y-6">

          <!-- APP 1 PANEL: LEDGERSEAL -->
          <div class="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div class="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <div class="flex items-center space-x-2">
                <span class="w-3 h-3 rounded-full bg-emerald-500"></span>
                <h3 class="text-sm font-bold text-slate-800">LedgerSeal: Cryptographic Audit Seal</h3>
              </div>
              <span id="seal-status-lozenge" class="px-2 py-0.5 rounded text-xs font-bold bg-slate-200 text-slate-700">NO SEAL</span>
            </div>

            <div class="p-4 space-y-4" id="ledgerseal-body">
              <!-- Content rendered dynamically via JS -->
            </div>
          </div>

          <!-- APP 2 PANEL: DEFINITIONGUARD -->
          <div class="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div class="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <div class="flex items-center space-x-2">
                <span class="w-3 h-3 rounded-full bg-blue-500"></span>
                <h3 class="text-sm font-bold text-slate-800">DefinitionGuard: DoD Checklist Gate</h3>
              </div>
              <span id="dod-status-lozenge" class="px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800">GATE LOCKED</span>
            </div>

            <div class="p-4 space-y-3" id="definitionguard-body">
              <!-- Checklist rendered dynamically via JS -->
            </div>
          </div>

        </div>

      </div>

    </div>

    <!-- VIEW 2: FOURREALITIES DASHBOARD -->
    <div id="view-project" class="hidden space-y-6">
      
      <div class="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm border border-slate-200">
        <div>
          <span class="text-xs font-semibold text-slate-500 uppercase tracking-wide">FourRealities Audit Intelligence</span>
          <h1 class="text-2xl font-bold text-slate-900 mt-0.5">Project CORE: Architecture & Delivery Alignment</h1>
        </div>
        <div class="text-right">
          <span class="text-xs text-slate-400 block">Composite Health</span>
          <span class="inline-block px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 uppercase">86% HEALTHY</span>
        </div>
      </div>

      <!-- KPI Summary Cards -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        <div class="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
          <span class="text-xs font-semibold text-slate-500 uppercase block">Reality Alignment Index</span>
          <div class="text-3xl font-extrabold text-blue-600 mt-1">86%</div>
          <span class="text-xs text-slate-400 mt-1 block">Cross-Reality Score</span>
        </div>

        <div class="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
          <span class="text-xs font-semibold text-slate-500 uppercase block">M11: Traceability Rate</span>
          <div class="text-3xl font-extrabold text-emerald-600 mt-1">92%</div>
          <span class="text-xs text-slate-400 mt-1 block">Issues with Confluence ADR</span>
        </div>

        <div class="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
          <span class="text-xs font-semibold text-slate-500 uppercase block">M29: Review Compliance</span>
          <div class="text-3xl font-extrabold text-emerald-600 mt-1">88%</div>
          <span class="text-xs text-slate-400 mt-1 block">PRs with Peer Approval</span>
        </div>

        <div class="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
          <span class="text-xs font-semibold text-slate-500 uppercase block">M30: Rework Churn</span>
          <div class="text-3xl font-extrabold text-amber-600 mt-1">12%</div>
          <span class="text-xs text-slate-400 mt-1 block">Review/QA Regression Loops</span>
        </div>

      </div>

      <!-- Issues Table -->
      <div class="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div class="px-6 py-4 border-b border-slate-200">
          <h3 class="text-sm font-bold text-slate-800 uppercase">Cross-Reality Issue Auditing</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-50 text-slate-600 uppercase font-semibold border-b">
              <tr>
                <th class="px-6 py-3">Issue Key</th>
                <th class="px-6 py-3">Summary</th>
                <th class="px-6 py-3">Intent (ADR)</th>
                <th class="px-6 py-3">Code (PR)</th>
                <th class="px-6 py-3">Audit (Seal & DoD)</th>
                <th class="px-6 py-3">RAI Score</th>
                <th class="px-6 py-3">Risk Level</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 text-slate-700">
              <tr class="hover:bg-slate-50">
                <td class="px-6 py-3.5 font-bold text-blue-600">SEC-402</td>
                <td class="px-6 py-3.5 font-medium">Upgrade OAuth2 Token Exchange & PKCE Flow</td>
                <td class="px-6 py-3.5"><span class="text-emerald-700 font-semibold">&check; ADR-089</span></td>
                <td class="px-6 py-3.5"><span class="text-emerald-700 font-semibold">&check; PR #142 (Approved)</span></td>
                <td class="px-6 py-3.5" id="table-sec402-audit"><span class="text-amber-600 font-semibold">DoD Pending</span></td>
                <td class="px-6 py-3.5 font-bold" id="table-sec402-rai">75%</td>
                <td class="px-6 py-3.5"><span class="px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800" id="table-sec402-risk">MEDIUM</span></td>
              </tr>
              <tr class="hover:bg-slate-50">
                <td class="px-6 py-3.5 font-bold text-blue-600">CORE-105</td>
                <td class="px-6 py-3.5 font-medium">Database connection pooling retry policy</td>
                <td class="px-6 py-3.5"><span class="text-emerald-700 font-semibold">&check; ADR-085</span></td>
                <td class="px-6 py-3.5"><span class="text-emerald-700 font-semibold">&check; PR #138 (Approved)</span></td>
                <td class="px-6 py-3.5"><span class="text-emerald-700 font-semibold">&check; Sealed & DoD Complete</span></td>
                <td class="px-6 py-3.5 font-bold text-emerald-600">100%</td>
                <td class="px-6 py-3.5"><span class="px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800">LOW</span></td>
              </tr>
              <tr class="hover:bg-slate-50">
                <td class="px-6 py-3.5 font-bold text-blue-600">CORE-112</td>
                <td class="px-6 py-3.5 font-medium">Bypass cache on emergency healthcheck</td>
                <td class="px-6 py-3.5"><span class="text-rose-600 font-semibold">&cross; Missing Spec</span></td>
                <td class="px-6 py-3.5"><span class="text-amber-600 font-semibold">! Merged Unreviewed</span></td>
                <td class="px-6 py-3.5"><span class="text-rose-600 font-semibold">&cross; No Seal</span></td>
                <td class="px-6 py-3.5 font-bold text-rose-600">35%</td>
                <td class="px-6 py-3.5"><span class="px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-800">CRITICAL</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>

  </main>

  <script>
    // State storage for the interactive simulator
    const ORIGINAL_DESCRIPTION = "Implement RFC 8693 Token Exchange specification. Enforce S256 code challenge method for all authorization code requests. Invalidate refresh tokens immediately upon rotation.";
    
    let state = {
      description: ORIGINAL_DESCRIPTION,
      seal: null, // null | { hash: string, signer: string, timestamp: string }
      dod: [
        { id: "t1", title: "Automated test suite passes with zero regressions", mandatory: true, checked: true },
        { id: "t2", title: "Branch test coverage >= 90%", mandatory: true, checked: true },
        { id: "t3", title: "Peer code review approved by authorized reviewers", mandatory: true, checked: true },
        { id: "t4", title: "Static analysis and vulnerability scans clear", mandatory: true, checked: true },
        { id: "t5", title: "User documentation and API specifications updated", mandatory: false, checked: true },
        { id: "t6", title: "Compliance and regulatory sign-off criteria satisfied", mandatory: true, checked: false }
      ]
    };

    function sha256(str) {
      // Simple synchronous browser SHA-256 calculation
      let buffer = new TextEncoder("utf-8").encode(str);
      return crypto.subtle.digest("SHA-256", buffer).then(hash => {
        return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
      });
    }

    function switchView(view) {
      if (view === 'issue') {
        document.getElementById('view-issue').classList.remove('hidden');
        document.getElementById('view-project').classList.add('hidden');
        document.getElementById('tab-issue-btn').className = 'px-3 py-1.5 rounded bg-blue-800 text-white font-semibold';
        document.getElementById('tab-project-btn').className = 'px-3 py-1.5 rounded text-blue-100 hover:bg-blue-800';
      } else {
        document.getElementById('view-issue').classList.add('hidden');
        document.getElementById('view-project').classList.remove('hidden');
        document.getElementById('tab-project-btn').className = 'px-3 py-1.5 rounded bg-blue-800 text-white font-semibold';
        document.getElementById('tab-issue-btn').className = 'px-3 py-1.5 rounded text-blue-100 hover:bg-blue-800';
      }
    }

    async function computeCurrentHash() {
      const canonicalString = JSON.stringify({
        summary: "Upgrade OAuth2 Token Exchange & PKCE Flow",
        description: state.description
      });
      return await sha256(canonicalString);
    }

    async function renderLedgerSeal() {
      const container = document.getElementById('ledgerseal-body');
      const lozenge = document.getElementById('seal-status-lozenge');

      if (!state.seal) {
        lozenge.className = "px-2 py-0.5 rounded text-xs font-bold bg-slate-200 text-slate-700";
        lozenge.innerText = "NO SEAL";
        container.innerHTML = `
          <div class="p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
            This issue is not cryptographically sealed. A seal is required to pass Jira workflow transition gates.
          </div>
          <button onclick="signIssue()" class="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded shadow-sm">
            &check; Sign & Cryptographically Seal (21 CFR Part 11)
          </button>
        `;
        return;
      }

      const liveHash = await computeCurrentHash();
      const isTampered = liveHash !== state.seal.hash;

      if (isTampered) {
        lozenge.className = "px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-800";
        lozenge.innerText = "TAMPER DETECTED";
        container.innerHTML = `
          <div class="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-900 space-y-1">
            <div class="font-bold">&times; CRITICAL: Cryptographic Seal Broken!</div>
            <div>The ticket content was modified after sign-off by <strong>${state.seal.signer}</strong>.</div>
            <div class="font-mono text-[11px] mt-1 pt-1 border-t border-rose-200">
              Sealed: ${state.seal.hash.slice(0, 16)}...<br>
              Live: &nbsp;&nbsp;${liveHash.slice(0, 16)}...
            </div>
          </div>
          <div class="text-[11px] text-rose-600 font-semibold">&bull; Workflow validator will reject all transitions until resealed.</div>
          <button onclick="signIssue()" class="w-full py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded">
            Re-Authorize & Reseal Ticket
          </button>
        `;
      } else {
        lozenge.className = "px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800";
        lozenge.innerText = "SEAL VALID";
        container.innerHTML = `
          <div class="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-900 space-y-1">
            <div class="font-bold flex items-center">&check; Cryptographic Seal Verified</div>
            <div>Signed by: <strong>${state.seal.signer}</strong></div>
            <div class="text-slate-500 text-[11px]">Timestamp: ${state.seal.timestamp}</div>
            <div class="font-mono text-[11px] text-slate-600">SHA-256: ${state.seal.hash.slice(0, 24)}...</div>
          </div>
          <div class="text-[11px] text-emerald-700 font-medium">&bull; Immutable state frozen. Ready for compliance transition.</div>
        `;
      }
      updateDashboardTable();
    }

    function renderDefinitionGuard() {
      const container = document.getElementById('definitionguard-body');
      const lozenge = document.getElementById('dod-status-lozenge');

      const mandatoryTotal = state.dod.filter(i => i.mandatory).length;
      const mandatoryChecked = state.dod.filter(i => i.mandatory && i.checked).length;
      const isComplete = mandatoryTotal === mandatoryChecked;

      if (isComplete) {
        lozenge.className = "px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800";
        lozenge.innerText = "GATE OPEN";
      } else {
        lozenge.className = "px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800";
        lozenge.innerText = "GATE LOCKED (" + mandatoryChecked + "/" + mandatoryTotal + ")";
      }

      let html = '<div class="space-y-2">';
      state.dod.forEach((item, index) => {
        html += `
          <div class="flex items-start justify-between text-xs p-1.5 hover:bg-slate-50 rounded">
            <label class="flex items-start space-x-2 cursor-pointer flex-1">
              <input type="checkbox" ${item.checked ? 'checked' : ''} onchange="toggleDoD(${index})" class="mt-0.5 text-blue-600 rounded">
              <span class="${item.checked ? 'line-through text-slate-400' : 'text-slate-700 font-medium'}">${item.title}</span>
            </label>
            <span class="ml-2 text-[10px] font-bold px-1.5 py-0.2 rounded ${item.mandatory ? 'bg-slate-200 text-slate-700' : 'bg-slate-100 text-slate-500'}">
              ${item.mandatory ? 'MANDATORY' : 'OPTIONAL'}
            </span>
          </div>
        `;
      });
      html += '</div>';

      container.innerHTML = html;
      updateDashboardTable();
    }

    function updateDashboardTable() {
      const auditCell = document.getElementById('table-sec402-audit');
      const raiCell = document.getElementById('table-sec402-rai');
      const riskCell = document.getElementById('table-sec402-risk');

      const mandatoryComplete = state.dod.filter(i => i.mandatory).every(i => i.checked);
      const isSealed = state.seal && !isCurrentTampered();

      if (mandatoryComplete && isSealed) {
        auditCell.innerHTML = '<span class="text-emerald-700 font-semibold">&check; Sealed & DoD Complete</span>';
        raiCell.innerText = "100%";
        raiCell.className = "px-6 py-3.5 font-bold text-emerald-600";
        riskCell.innerText = "LOW";
        riskCell.className = "px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800";
      } else if (mandatoryComplete || isSealed) {
        auditCell.innerHTML = '<span class="text-amber-600 font-semibold">Partial (Seal or DoD pending)</span>';
        raiCell.innerText = "75%";
        raiCell.className = "px-6 py-3.5 font-bold text-amber-600";
        riskCell.innerText = "MEDIUM";
        riskCell.className = "px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800";
      } else {
        auditCell.innerHTML = '<span class="text-rose-600 font-semibold">&cross; Unsealed & DoD Pending</span>';
        raiCell.innerText = "50%";
        raiCell.className = "px-6 py-3.5 font-bold text-rose-600";
        riskCell.innerText = "HIGH";
        riskCell.className = "px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-800";
      }
    }

    function isCurrentTampered() {
      return state.seal && state.description !== ORIGINAL_DESCRIPTION;
    }

    async function signIssue() {
      const hash = await computeCurrentHash();
      state.seal = {
        hash: hash,
        signer: "Fahim Farook (Security Architect)",
        timestamp: new Date().toISOString()
      };
      hideAlert();
      renderLedgerSeal();
    }

    function toggleDoD(index) {
      state.dod[index].checked = !state.dod[index].checked;
      renderDefinitionGuard();
    }

    function tamperDescription() {
      state.description = "MALICIOUS TAMPER: Invalidate token rotation requirements and permit unauthenticated debug tokens in production endpoints.";
      document.getElementById('issue-description').innerText = state.description;
      document.getElementById('issue-description').className = "text-sm text-rose-800 font-medium leading-relaxed bg-rose-50 p-3 rounded border border-rose-300";
      renderLedgerSeal();
    }

    function resetDescription() {
      state.description = ORIGINAL_DESCRIPTION;
      document.getElementById('issue-description').innerText = state.description;
      document.getElementById('issue-description').className = "text-sm text-slate-700 leading-relaxed bg-slate-50 p-3 rounded border border-slate-200";
      renderLedgerSeal();
    }

    function attemptTransition() {
      const alertBox = document.getElementById('transition-alert');
      const mandatoryIncomplete = state.dod.filter(i => i.mandatory && !i.checked);
      
      const failures = [];

      // 1. DefinitionGuard Validator Check
      if (mandatoryIncomplete.length > 0) {
        failures.push(`DefinitionGuard: Definition of Done incomplete (${mandatoryIncomplete.length} mandatory item(s) pending).`);
      }

      // 2. LedgerSeal Validator Check
      if (!state.seal) {
        failures.push("LedgerSeal: Cryptographic seal missing. Issue cannot transition without an active electronic signature.");
      } else if (state.description !== ORIGINAL_DESCRIPTION) {
        failures.push("LedgerSeal: TRANSITION REJECTED. Cryptographic seal is broken (tamper detected).");
      }

      alertBox.classList.remove('hidden');

      if (failures.length > 0) {
        alertBox.className = "p-4 rounded-lg text-xs bg-rose-50 border border-rose-200 text-rose-900 space-y-1";
        let msg = '<div class="font-bold flex items-center">&times; Workflow Validator: Transition Blocked!</div><ul class="list-disc list-inside mt-1 space-y-0.5">';
        failures.forEach(f => msg += `<li>${f}</li>`);
        msg += '</ul>';
        alertBox.innerHTML = msg;
      } else {
        alertBox.className = "p-4 rounded-lg text-xs bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-1";
        alertBox.innerHTML = `
          <div class="font-bold flex items-center">&check; Workflow Transition Approved!</div>
          <div>All DefinitionGuard checklist items complete and LedgerSeal cryptographic certificate verified. Issue successfully transitioned to <strong>DONE</strong>.</div>
        `;
        document.getElementById('issue-status-badge').className = "inline-block px-2.5 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800 uppercase";
        document.getElementById('issue-status-badge').innerText = "DONE";
      }
    }

    function hideAlert() {
      document.getElementById('transition-alert').classList.add('hidden');
    }

    // Initial render
    renderLedgerSeal();
    renderDefinitionGuard();
  </script>
</body>
</html>
"""

class SimulatorHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(HTML_TEMPLATE.encode("utf-8"))

    def log_message(self, format, *args):
        # Clean logging
        sys.stderr.write(f"[Simulator] {args[0]} - {args[1]}\n")

def run_server():
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), SimulatorHandler) as httpd:
        print(f"\n========================================================")
        print(f"  ATLASSIAN SUITE LOCAL TESTBENCH RUNNING")
        print(f"  URL: http://localhost:{PORT}")
        print(f"========================================================")
        print(f"[*] Open http://localhost:{PORT} in your web browser to test:")
        print(f"    1. LedgerSeal (Sign & Seal, Tamper detection, Gate blocking)")
        print(f"    2. DefinitionGuard (Checklist DoD toggles, Gate locking)")
        print(f"    3. FourRealities (Project audit dashboard, M11, M29, M30)")
        print(f"[*] Press Ctrl+C in terminal to stop.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nSimulator stopped.")

if __name__ == "__main__":
    run_server()
