/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: the canvas timeline (B-13). One canvas covers the visible part of the timeline area
 * and draws the week grid, bars, label chips, dependency arrows, the today line and the drag preview.
 * It ignores the pointer: transparent DOM hit elements in the rows take focus, hover and drags.
 * Colours are read from --cp tokens at draw time, so the Jira theme applies (B-17).
 */

import { cssToken } from './theme';
import { barRect, xForDate, Rect } from '../ui/timeline-geometry';
import { CANVAS_TOKENS, FORCED_COLOURS, barStyle, labelPlacement } from '../ui/canvas-palette';

export const ROW_H = 44;
export const BAR_H = 24;
const CHIP_H = 18;
const RADIUS = 5;

export interface TimelineModel {
  /** Rows in display order. */
  tasks: any[];
  /** Index range of the rows that exist in the DOM (they cover the viewport). */
  first: number;
  last: number;
  /** Content y of the top of row i. */
  rowTop: (i: number) => number;
  originIso: string;
  dayPx: number;
  /** Content x where the timeline starts, and its width. */
  trackLeft: number;
  trackWidth: number;
  headerH: number;
  todayIso: string;
  /** Content x of the unit boundaries (days, weeks, months...) between two track x values (B-27). */
  gridX: (fromX: number, toX: number) => number[];
}

export interface DragPreview {
  key: string;
  moves: Map<string, { start: string; end: string }>;
  label: string;
}

export class CanvasTimeline {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private model: TimelineModel | null = null;
  private index = new Map<string, number>();
  private successors = new Map<string, number[]>();
  private colours = new Map<string, string>();
  private pending = 0;
  activeKey: string | null = null;
  focusKey: string | null = null;
  driverKeys: string[] = [];
  drag: DragPreview | null = null;
  /** Focused element of the treegrid in the canvas fallback content, for drawFocusIfNeeded (B-15). */
  focusElement: Element | null = null;
  private forced = false;

  constructor(private readonly wrapper: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'timeline-canvas';
    // The canvas is an overlay next to the scroll container, not inside it: nothing in the scrolled
    // content moves on scroll, so the browser never re-scrolls to the focused treegrid cell (B-15).
    const host = wrapper.parentElement as HTMLElement;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;
    // Forced colours (Windows contrast themes) replace tokens with system colours (B-15).
    const mq = window.matchMedia ? window.matchMedia('(forced-colors: active)') : null;
    const apply = () => {
      this.forced = !!(mq && mq.matches);
      this.canvas.dataset.forced = this.forced ? '1' : '0';
      this.invalidateColours();
    };
    apply();
    if (mq && mq.addEventListener) mq.addEventListener('change', () => { apply(); this.requestDraw(); });
  }

  /** The canvas element; its fallback content holds the accessible treegrid (B-15). */
  get root(): HTMLCanvasElement {
    return this.canvas;
  }

  setModel(model: TimelineModel): void {
    if (!this.model || this.model.tasks !== model.tasks) {
      this.index = new Map(model.tasks.map((t, i) => [t.key, i]));
      this.successors = new Map();
      model.tasks.forEach((t, i) => {
        const p = t.dependency && t.dependency.predecessorKey;
        if (p) this.successors.set(p, [...(this.successors.get(p) || []), i]);
      });
    }
    this.model = model;
  }

  /** Forget resolved colours; the next draw reads the tokens again (theme change). */
  invalidateColours(): void {
    this.colours.clear();
  }

  /** Draw on the next animation frame; several requests in one frame draw once. */
  requestDraw(): void {
    if (this.pending) return;
    this.pending = requestAnimationFrame(() => {
      this.pending = 0;
      this.draw();
    });
  }

  private c(token: string): string {
    let v = this.colours.get(token);
    if (!v) {
      v = this.forced ? (FORCED_COLOURS[token] || 'CanvasText') : cssToken(token, 'GrayText');
      this.colours.set(token, v);
    }
    return v;
  }

  draw(): void {
    const m = this.model;
    // The test harness sets __cpPerf to read draw times and the label texts canvas pixels hide.
    const perf = (globalThis as any).__cpPerf;
    if (perf) {
      performance.mark('cp:draw:start');
      (globalThis as any).__cpLabels = [];
    }
    const w = this.wrapper;
    // The data columns are frozen (B-27): the visible track always starts at the frozen edge.
    const left = w.scrollLeft + (m ? m.trackLeft : 0);
    const top = w.scrollTop + (m ? m.headerH : 0);
    const cssW = Math.max(0, w.clientWidth - (m ? m.trackLeft : 0));
    const cssH = Math.max(0, w.clientHeight - (m ? m.headerH : 0));
    if (!m || cssW === 0 || cssH === 0) {
      this.canvas.style.display = 'none';
      return;
    }
    const dpr = window.devicePixelRatio || 1;
    const cv = this.canvas;
    cv.style.display = 'block';
    cv.style.left = `${w.offsetLeft + left - w.scrollLeft}px`;
    cv.style.top = `${w.offsetTop + m.headerH}px`;
    cv.style.width = `${cssW}px`;
    cv.style.height = `${cssH}px`;
    const bw = Math.round(cssW * dpr);
    const bh = Math.round(cssH * dpr);
    if (cv.width !== bw) cv.width = bw;
    if (cv.height !== bh) cv.height = bh;
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, -left * dpr, -top * dpr);
    ctx.clearRect(left, top, cssW, cssH);
    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, cssW, cssH);
    ctx.clip();

    this.drawGrid(m, left, top, cssW, cssH);
    // The today line goes under the bars so it never crosses a label; its flag goes on top.
    const todayX = this.drawTodayLine(m, top, cssH);
    const rects = this.barRects(m);
    this.drawArrows(m, rects, top, cssH);
    for (let i = m.first; i <= m.last; i++) this.drawBar(m, i, rects);
    if (todayX !== null) this.drawTodayFlag(m, todayX, top);
    ctx.restore();
    if (perf) performance.measure('cp:draw', 'cp:draw:start');
  }

  private dates(task: any): { startDate?: string; endDate?: string } {
    const moved = this.drag && this.drag.moves.get(task.key);
    return moved ? { startDate: moved.start, endDate: moved.end } : task;
  }

  private rectFor(m: TimelineModel, i: number, task: any, original = false): Rect | null {
    const r = barRect(original ? task : this.dates(task), m.originIso, m.dayPx, m.rowTop(i), ROW_H, BAR_H);
    return r && { ...r, x: r.x + m.trackLeft };
  }

  /**
   * Bar rectangles by key for the rows in the DOM range and the rows at the other end of their
   * arrows. Only these are computed, so a draw costs the same at 1,000 and 5,000 tasks.
   */
  private barRects(m: TimelineModel): Map<string, { i: number; r: Rect }> {
    const out = new Map<string, { i: number; r: Rect }>();
    const add = (i: number | undefined) => {
      if (i === undefined || out.has(m.tasks[i].key)) return;
      const r = this.rectFor(m, i, m.tasks[i]);
      if (r) out.set(m.tasks[i].key, { i, r });
    };
    for (let i = m.first; i <= m.last; i++) {
      const t = m.tasks[i];
      add(i);
      if (t.dependency && t.dependency.predecessorKey) add(this.index.get(t.dependency.predecessorKey));
      for (const s of this.successors.get(t.key) || []) add(s);
    }
    return out;
  }

  private drawGrid(m: TimelineModel, left: number, top: number, w: number, h: number): void {
    const ctx = this.ctx;
    ctx.strokeStyle = this.c(CANVAS_TOKENS.grid);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const gx of m.gridX(left - m.trackLeft, left - m.trackLeft + w)) {
      const x = Math.round(m.trackLeft + gx) + 0.5;
      ctx.moveTo(x, top);
      ctx.lineTo(x, top + h);
    }
    ctx.stroke();
  }

  private path(r: Rect, radius = RADIUS): void {
    const ctx = this.ctx;
    const rad = Math.min(radius, r.h / 2, r.w / 2);
    ctx.beginPath();
    ctx.moveTo(r.x + rad, r.y);
    ctx.arcTo(r.x + r.w, r.y, r.x + r.w, r.y + r.h, rad);
    ctx.arcTo(r.x + r.w, r.y + r.h, r.x, r.y + r.h, rad);
    ctx.arcTo(r.x, r.y + r.h, r.x, r.y, rad);
    ctx.arcTo(r.x, r.y, r.x + r.w, r.y, rad);
    ctx.closePath();
  }

  private chip(text: string, x: number, cy: number, fg: string, border?: string): number {
    const ctx = this.ctx;
    const tw = ctx.measureText(text).width;
    const r = { x, y: cy - CHIP_H / 2, w: tw + 10, h: CHIP_H };
    const labels = (globalThis as any).__cpLabels;
    if (labels) labels.push(text);
    this.path(r, 4);
    ctx.fillStyle = this.c(CANVAS_TOKENS.labelChip);
    ctx.fill();
    if (border) {
      ctx.strokeStyle = border;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.fillStyle = fg;
    ctx.fillText(text, x + 5, cy);
    return r.w;
  }

  private drawBar(m: TimelineModel, i: number, rects: Map<string, { i: number; r: Rect }>): void {
    const task = m.tasks[i];
    const entry = task && rects.get(task.key);
    if (!entry) return;
    const ctx = this.ctx;
    const r = entry.r;
    const style = barStyle(task);
    const fill = this.c(style.fill);

    if (this.drag && this.drag.moves.has(task.key)) {
      // Dashed outline at the old position while the preview moves the bar (UR-05).
      const old = this.rectFor(m, i, task, true);
      if (old) {
        this.path(old);
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = this.c(CANVAS_TOKENS.preview);
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    this.path(r);
    ctx.fillStyle = this.c(style.track);
    ctx.fill();
    const done = Math.max(0, Math.min(100, task.progress || 0)) / 100;
    if (done > 0) {
      ctx.save();
      this.path(r);
      ctx.clip();
      ctx.fillStyle = fill;
      ctx.fillRect(r.x, r.y, r.w * done, r.h);
      ctx.restore();
    }
    this.path(r);
    ctx.strokeStyle = fill;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const focus = this.c(CANVAS_TOKENS.focus);
    const ring = (dashed: boolean) => {
      this.path({ x: r.x - 3, y: r.y - 3, w: r.w + 6, h: r.h + 6 }, RADIUS + 2);
      ctx.setLineDash(dashed ? [5, 3] : []);
      ctx.strokeStyle = focus;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
    };
    const isDriver = this.driverKeys.includes(task.key);
    if (task.key === this.focusKey && this.focusElement) {
      // Native focus ring for the focused treegrid cell, plus a 2 px focus token ring (UP-03, UP-40).
      this.path({ x: r.x - 3, y: r.y - 3, w: r.w + 6, h: r.h + 6 }, RADIUS + 2);
      ctx.drawFocusIfNeeded(this.focusElement);
    }
    if (task.key === this.focusKey || task.key === this.activeKey) ring(false);
    else if (isDriver) ring(true);

    ctx.font = `600 11px ${cssToken('--cp-font', 'sans-serif')}`;
    ctx.textBaseline = 'middle';
    const epic = task.isEpic || task.hierarchyLevel === 1;
    const rollup = epic && task.childrenCount ? ` [${task.childrenCount} stories]` : '';
    let text = this.drag && this.drag.key === task.key ? this.drag.label : `${task.key} (${task.progress || 0}%)${rollup}`;
    if (isDriver) text = `${text} · Driver`;
    const chipW = ctx.measureText(text).width + 10;
    const place = labelPlacement(r.x, r.w, chipW);
    this.chip(text, place.x, r.y + r.h / 2, this.c(isDriver ? CANVAS_TOKENS.driverText : CANVAS_TOKENS.labelText));
  }

  private drawArrows(m: TimelineModel, rects: Map<string, { i: number; r: Rect }>, top: number, h: number): void {
    const ctx = this.ctx;
    const active = this.activeKey;
    ctx.font = `600 10px ${cssToken('--cp-font', 'sans-serif')}`;
    ctx.textBaseline = 'middle';
    for (const { i } of rects.values()) {
      const task = m.tasks[i];
      const dep = task.dependency;
      if (!dep || !dep.predecessorKey) continue;
      const pred = rects.get(dep.predecessorKey);
      const succ = rects.get(task.key);
      if (!pred || !succ) continue;
      const y1 = pred.r.y + pred.r.h / 2;
      const y2 = succ.r.y + succ.r.h / 2;
      if (Math.max(y1, y2) < top - ROW_H || Math.min(y1, y2) > top + h + ROW_H) continue;
      const trigger = (typeof dep.triggerPercent === 'number' ? dep.triggerPercent : 100) / 100;
      const x1 = pred.r.x + pred.r.w * trigger;
      const x2 = succ.r.x;
      const connected = active === task.key || active === dep.predecessorKey;
      const violated = Boolean(dep.isViolated);
      const colour = this.c(violated ? CANVAS_TOKENS.arrowViolated : connected ? CANVAS_TOKENS.arrowActive : CANVAS_TOKENS.arrowOk);
      const dx = Math.max(35, Math.abs(x2 - x1) / 2);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.bezierCurveTo(x1 + dx, y1, x2 - dx, y2, x2 - 6, y2);
      ctx.strokeStyle = colour;
      ctx.lineWidth = active && !connected ? 1 : connected ? 2.5 : 1.75;
      ctx.setLineDash(violated ? [4, 3] : []);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - 7, y2 - 4);
      ctx.lineTo(x2 - 7, y2 + 4);
      ctx.closePath();
      ctx.fillStyle = colour;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x1, y1, connected ? 4.5 : 3.5, 0, Math.PI * 2);
      ctx.fill();
      if (!active || connected) {
        const when = dep.triggerDate ? `, ${dep.triggerDate}` : '';
        const text = violated ? `${dep.triggerPercent}%${when}: starts too early` : `${dep.triggerPercent}%${when}`;
        const tw = ctx.measureText(text).width + 10;
        this.chip(text, (x1 + x2) / 2 - tw / 2, (y1 + y2) / 2,
          this.c(violated ? CANVAS_TOKENS.badgeViolatedText : CANVAS_TOKENS.badgeOkText), colour);
      }
    }
  }

  private drawTodayLine(m: TimelineModel, top: number, h: number): number | null {
    const x = Math.round(m.trackLeft + xForDate(m.todayIso, m.originIso, m.dayPx) + m.dayPx / 2);
    if (x < m.trackLeft || x > m.trackLeft + m.trackWidth) return null;
    this.ctx.fillStyle = this.c(CANVAS_TOKENS.todayLine);
    this.ctx.fillRect(x - 1, top, 2, h);
    return x;
  }

  private drawTodayFlag(m: TimelineModel, x: number, top: number): void {
    const ctx = this.ctx;
    ctx.font = `700 9px ${cssToken('--cp-font', 'sans-serif')}`;
    ctx.textBaseline = 'middle';
    const text = `TODAY (${m.todayIso})`;
    const tw = ctx.measureText(text).width + 12;
    const r = { x: x - tw / 2, y: top + 2, w: tw, h: 15 };
    this.path(r, 3);
    ctx.fillStyle = this.c(CANVAS_TOKENS.todayFlagBg);
    ctx.fill();
    ctx.fillStyle = this.c(CANVAS_TOKENS.todayFlagText);
    ctx.fillText(text, r.x + 6, r.y + r.h / 2);
  }
}
