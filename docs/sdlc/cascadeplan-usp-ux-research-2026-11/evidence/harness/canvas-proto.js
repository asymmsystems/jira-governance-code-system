/*
 * CascadePlan research prototype: canvas timeline with row virtualisation,
 * dependency arrows, hover highlight, drag with a live preview of dependents,
 * and an accessible DOM layer (role=grid rows; Left/Right move a bar by one day).
 * Reads the synthetic plan from mock-bridge.js (window.__plan).
 * Instrumentation: window.__perf entries { name, start, dur } like instrument.js.
 * Copyright (c) 2026 Asymm Systems. @author Fahim Farook
 */
(function () {
  const plan = window.__plan;
  const DAY = 85 / 7;              // px per day (same week width as the DOM UI)
  const ROW = 44;                  // px per row (same as the DOM UI)
  const BAR_H = 22;
  const weeks = plan.weeks;
  const t0 = Date.parse(weeks[0].startDate + 'T00:00:00Z');
  const dayOf = iso => Math.round((Date.parse(iso.slice(0, 10) + 'T00:00:00Z') - t0) / 86400000);
  const tasks = plan.tasks.map((t, i) => ({
    key: t.key, row: i, start: dayOf(t.startDate), days: (t.spanWeeks || 1) * 7,
    progress: t.progress || 0, isEpic: !!t.isEpic,
    dep: t.dependency ? { pred: t.dependency.predecessorKey, pct: t.dependency.triggerPercent } : null
  }));
  const byKey = new Map(tasks.map(t => [t.key, t]));
  const succ = new Map();
  for (const t of tasks) if (t.dep) { (succ.get(t.dep.pred) || succ.set(t.dep.pred, []).get(t.dep.pred)).push(t); }

  const wrap = document.getElementById('wrap');
  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const grid = document.getElementById('a11y');
  const spacer = document.getElementById('spacer');
  const totalW = weeks.length * 85;
  spacer.style.height = (tasks.length * ROW) + 'px';
  spacer.style.width = totalW + 'px';

  let hover = null, drag = null, dirty = true;
  window.__perf = window.__perf || [];

  function size() {
    const dpr = window.devicePixelRatio || 1;
    cv.width = wrap.clientWidth * dpr; cv.height = wrap.clientHeight * dpr;
    cv.style.width = wrap.clientWidth + 'px'; cv.style.height = wrap.clientHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dirty = true;
  }

  // Earliest start (days) of a successor: predecessor start + pct of its duration.
  function earliest(t, starts) {
    const p = byKey.get(t.dep.pred);
    const ps = starts.get(p.key) ?? p.start;
    return ps + Math.ceil(p.days * t.dep.pct / 100);
  }
  // Preview of dependents while a bar is dragged: forward pass over successors only.
  function previewStarts(key, newStart) {
    const starts = new Map([[key, newStart]]);
    const queue = [key];
    while (queue.length) {
      const k = queue.shift();
      for (const s of succ.get(k) || []) {
        const e = earliest(s, starts);
        const cur = starts.get(s.key) ?? s.start;
        if (e > cur) { starts.set(s.key, e); queue.push(s.key); }
      }
    }
    return starts;
  }

  function draw() {
    const t = performance.now();
    const W = wrap.clientWidth, H = wrap.clientHeight;
    const sx = wrap.scrollLeft, sy = wrap.scrollTop;
    cv.style.transform = `translate(${sx}px, ${sy}px)`;
    const css = getComputedStyle(document.documentElement);
    const C = n => css.getPropertyValue(n).trim();
    ctx.clearRect(0, 0, W, H);
    // week grid
    ctx.strokeStyle = C('--grid'); ctx.lineWidth = 1;
    for (let w = 0; w <= weeks.length; w++) { const x = w * 85 - sx + 0.5; if (x >= 0 && x <= W) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); } }
    const r0 = Math.max(0, Math.floor(sy / ROW) - 1), r1 = Math.min(tasks.length - 1, Math.ceil((sy + H) / ROW) + 1);
    const starts = drag ? drag.preview : null;
    const startOf = k => (starts && starts.has(k)) ? starts.get(k) : byKey.get(k).start;
    const active = hover || (drag && drag.key);
    // arrows for visible successors (and visible predecessors)
    for (let r = r0; r <= r1; r++) {
      const s = tasks[r];
      const lists = [];
      if (s.dep) lists.push([byKey.get(s.dep.pred), s]);
      for (const c of succ.get(s.key) || []) if (c.row > r1 || c.row < r0) lists.push([s, c]);
      for (const [p, c] of lists) {
        if (!p) continue;
        const x1 = (startOf(p.key) + p.days * c.dep.pct / 100) * DAY - sx, y1 = p.row * ROW + ROW / 2 - sy;
        const x2 = startOf(c.key) * DAY - sx, y2 = c.row * ROW + ROW / 2 - sy;
        const on = active && (active === p.key || active === c.key);
        ctx.strokeStyle = on ? C('--arrow-on') : C('--arrow'); ctx.lineWidth = on ? 2 : 1;
        ctx.beginPath(); ctx.moveTo(x1, y1);
        ctx.bezierCurveTo(x1 + 30, y1, x2 - 30, y2, x2, y2); ctx.stroke();
        ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.arc(x1, y1, 3, 0, 6.283); ctx.fill();
      }
    }
    // bars
    ctx.font = '12px system-ui, sans-serif'; ctx.textBaseline = 'middle';
    for (let r = r0; r <= r1; r++) {
      const b = tasks[r];
      const x = startOf(b.key) * DAY - sx, y = r * ROW + (ROW - BAR_H) / 2 - sy, w = b.days * DAY;
      if (x > W || x + w < 0) continue;
      const moved = starts && starts.has(b.key) && starts.get(b.key) !== b.start;
      if (moved) { ctx.setLineDash([4, 3]); ctx.strokeStyle = C('--ghost'); ctx.strokeRect(b.start * DAY - sx, y, w, BAR_H); ctx.setLineDash([]); }
      ctx.fillStyle = b.isEpic ? C('--epic') : C('--bar'); ctx.fillRect(x, y, w, BAR_H);
      ctx.fillStyle = C('--fill'); ctx.fillRect(x, y, w * b.progress / 100, BAR_H);
      if (b.key === active) { ctx.strokeStyle = C('--focus'); ctx.lineWidth = 2; ctx.strokeRect(x - 1, y - 1, w + 2, BAR_H + 2); }
      ctx.fillStyle = C('--text'); ctx.fillText(`${b.key} ${b.progress}%`, Math.max(x, 0) + 6, y + BAR_H / 2);
    }
    syncA11y(r0, r1);
    window.__perf.push({ name: 'canvasDraw', start: t, dur: performance.now() - t });
  }

  // Accessible layer: one focusable row element per visible task, positioned over its bar.
  let a11yRange = [-1, -1];
  function syncA11y(r0, r1) {
    if (a11yRange[0] === r0 && a11yRange[1] === r1 && !drag) return;
    a11yRange = [r0, r1];
    const focusedKey = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.key : null;
    grid.replaceChildren();
    for (let r = r0; r <= r1; r++) {
      const b = tasks[r];
      const row = document.createElement('div');
      row.setAttribute('role', 'row');
      const cell = document.createElement('div');
      cell.setAttribute('role', 'gridcell');
      cell.tabIndex = (focusedKey ? b.key === focusedKey : r === r0) ? 0 : -1;
      cell.dataset.key = b.key;
      cell.className = 'a11y-bar';
      cell.style.top = (r * ROW + (ROW - BAR_H) / 2) + 'px';
      cell.style.left = (b.start * DAY) + 'px';
      cell.style.width = (b.days * DAY) + 'px';
      cell.setAttribute('aria-label', `${b.key}, starts day ${b.start}, ${b.days} days, ${b.progress}% done`);
      row.appendChild(cell);
      grid.appendChild(row);
      if (b.key === focusedKey) cell.focus({ preventScroll: true });
    }
  }

  function frame() { if (dirty) { dirty = false; draw(); } requestAnimationFrame(frame); }

  function hit(e) {
    const rect = wrap.getBoundingClientRect();
    const x = e.clientX - rect.left + wrap.scrollLeft, y = e.clientY - rect.top + wrap.scrollTop;
    const b = tasks[Math.floor(y / ROW)];
    if (!b) return null;
    const by = b.row * ROW + (ROW - BAR_H) / 2;
    if (y < by || y > by + BAR_H || x < b.start * DAY || x > (b.start + b.days) * DAY) return null;
    return b;
  }

  wrap.addEventListener('scroll', () => { dirty = true; }, { passive: true });
  wrap.addEventListener('pointermove', e => {
    if (drag) {
      const nd = Math.round((e.clientX - drag.x0) / DAY);
      if (nd !== drag.delta) { drag.delta = nd; drag.preview = previewStarts(drag.key, byKey.get(drag.key).start + nd); dirty = true; }
      return;
    }
    const b = hit(e); const k = b ? b.key : null;
    if (k !== hover) { hover = k; dirty = true; }
  });
  wrap.addEventListener('pointerdown', e => {
    const b = hit(e); if (!b || e.button !== 0) return;
    wrap.setPointerCapture(e.pointerId);
    drag = { key: b.key, x0: e.clientX, delta: 0, preview: new Map() };
  });
  wrap.addEventListener('pointerup', () => {
    if (!drag) return;
    if (drag.delta) {
      for (const [k, s] of drag.preview) byKey.get(k).start = s;
      window.__commits = (window.__commits || []).concat([{ key: drag.key, delta: drag.delta, moved: drag.preview.size }]);
    }
    drag = null; dirty = true; a11yRange = [-1, -1];
  });
  grid.addEventListener('keydown', e => {
    const k = e.target.dataset && e.target.dataset.key; if (!k) return;
    const b = byKey.get(k);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const d = e.key === 'ArrowRight' ? 1 : -1;
      const p = previewStarts(k, b.start + d);
      for (const [kk, s] of p) byKey.get(kk).start = s;
      a11yRange = [-1, -1]; dirty = true; e.preventDefault();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const nb = tasks[b.row + (e.key === 'ArrowDown' ? 1 : -1)];
      if (nb) { const el = grid.querySelector(`[data-key="${nb.key}"]`); if (el) { e.target.tabIndex = -1; el.tabIndex = 0; el.focus(); } }
      e.preventDefault();
    }
  });
  window.addEventListener('resize', size);
  window.__byKey = byKey;
  size();
  requestAnimationFrame(frame);
})();
