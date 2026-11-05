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
import { CANVAS_TOKENS, FORCED_COLOURS, barStyle, labelPlacement, isInProgressZero } from '../ui/canvas-palette';

export interface ArrowLink {
  predecessorKey: string;
  successorKey: string;
  triggerPercent: number;
  triggerDate?: string;
  isViolated: boolean;
  /** Stored only in this plan's record, not in Jira (ADR-006 migration). */
  planOnly?: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
}

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
  isConflict?: boolean;
}

export interface ActiveLinking {
  sourceKey: string;
  x1: number;
  y1: number;
  curX: number;
  curY: number;
  targetKey: string | null;
  predKey?: string | null;
  succKey?: string | null;
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
  hoveredRowKey: string | null = null;
  focusKey: string | null = null;
  driverKeys: string[] = [];
  drag: DragPreview | null = null;
  activeLinking: ActiveLinking | null = null;
  /** Focused element of the treegrid in the canvas fallback content, for drawFocusIfNeeded (B-15). */
  focusElement: Element | null = null;
  /** The last input type: the system focus ring is drawn only after keyboard input (N-09). */
  private lastInput: 'pointer' | 'keyboard' = 'pointer';
  private forced = false;
  private arrowLinks: ArrowLink[] = [];
  onDraw?: (links: ArrowLink[]) => void;

  constructor(private readonly wrapper: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'timeline-canvas';
    // The canvas is an overlay next to the scroll container, not inside it: nothing in the scrolled
    // content moves on scroll, so the browser never re-scrolls to the focused treegrid cell (B-15).
    const host = wrapper.parentElement as HTMLElement;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;
    document.addEventListener('pointerdown', () => { this.lastInput = 'pointer'; }, true);
    document.addEventListener('keydown', () => { this.lastInput = 'keyboard'; }, true);
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

  getArrowLinks(): ArrowLink[] {
    return this.arrowLinks;
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
    this.arrowLinks = [];
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
      this.onDraw?.([]);
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

    this.drawHoveredRow(m, left, cssW);
    this.drawGrid(m, left, top, cssW, cssH);
    // The today line goes under the bars so it never crosses a label; its flag goes on top.
    const todayX = this.drawTodayLine(m, top, cssH);
    const rects = this.barRects(m);
    this.drawArrows(m, rects, top, cssH);
    for (let i = m.first; i <= m.last; i++) this.drawBar(m, i, rects);
    if (this.activeLinking) this.drawActiveLinking(this.activeLinking, rects, left, cssW);
    if (todayX !== null) this.drawTodayFlag(m, todayX, top);
    ctx.restore();
    this.onDraw?.(this.arrowLinks);
    if (perf) performance.measure('cp:draw', 'cp:draw:start');
  }

  private drawHoveredRow(m: TimelineModel, left: number, cssW: number): void {
    const hoverKey = this.hoveredRowKey || this.activeKey;
    if (!hoverKey) return;
    const hi = this.index.get(hoverKey);
    if (hi === undefined || hi < m.first || hi > m.last) return;
    const ctx = this.ctx;
    const ry = m.rowTop(hi);
    ctx.save();
    ctx.fillStyle = this.c('--cp-surface-sunken');
    ctx.fillRect(left, ry, cssW, ROW_H);
    ctx.strokeStyle = this.c(CANVAS_TOKENS.focus);
    ctx.globalAlpha = 0.28;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left, ry + 0.5);
    ctx.lineTo(left + cssW, ry + 0.5);
    ctx.moveTo(left, ry + ROW_H - 0.5);
    ctx.lineTo(left + cssW, ry + ROW_H - 0.5);
    ctx.stroke();
    ctx.restore();
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

    const isConflict = Boolean(this.drag && this.drag.key === task.key && this.drag.isConflict);
    if (this.drag && this.drag.moves.has(task.key)) {
      // Dashed outline at the old position while the preview moves the bar (UR-05).
      const old = this.rectFor(m, i, task, true);
      if (old) {
        this.path(old);
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = this.c(isConflict ? CANVAS_TOKENS.arrowViolated : CANVAS_TOKENS.preview);
        ctx.lineWidth = isConflict ? 2 : 1.5;
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
    } else if (isInProgressZero(task)) {
      ctx.save();
      this.path(r);
      ctx.clip();
      ctx.strokeStyle = fill;
      ctx.lineWidth = 1.75;
      ctx.globalAlpha = 0.45;
      const step = 7;
      ctx.beginPath();
      for (let offset = -r.h; offset < r.w + r.h; offset += step) {
        ctx.moveTo(r.x + offset, r.y + r.h);
        ctx.lineTo(r.x + offset + r.h, r.y);
      }
      ctx.stroke();
      ctx.restore();
    }
    const isHovered = task.key === this.activeKey && task.key !== this.focusKey;
    const isFocused = task.key === this.focusKey;
    const isDriver = this.driverKeys.includes(task.key);
    const focus = this.c(CANVAS_TOKENS.focus);

    this.path(r);
    ctx.strokeStyle = isConflict
      ? this.c(CANVAS_TOKENS.arrowViolated)
      : (isFocused || isHovered || isDriver)
      ? focus
      : fill;
    ctx.lineWidth = isConflict ? 2.5 : isFocused ? 2.25 : isHovered ? 2 : 1.5;
    ctx.setLineDash(isConflict ? [4, 3] : isDriver ? [5, 3] : []);
    ctx.stroke();
    ctx.setLineDash([]);

    if (isFocused && !isConflict) {
      // A designed "selected" outline: 2 px in the focus colour, 2 px outside the bar, with a soft glow (N-09).
      ctx.save();
      ctx.strokeStyle = focus;
      ctx.lineWidth = 2;
      ctx.shadowColor = focus;
      ctx.shadowBlur = this.forced ? 0 : 6;
      this.path({ x: r.x - 2, y: r.y - 2, w: r.w + 4, h: r.h + 4 }, RADIUS + 2);
      ctx.stroke();
      ctx.restore();
    }
    // The system focus ring is for keyboard users only; a mouse click shows the outline above (N-09).
    if (isFocused && this.focusElement && (this.lastInput === 'keyboard' || this.forced)) {
      this.path(r);
      ctx.drawFocusIfNeeded(this.focusElement);
    }

    ctx.font = `600 11px ${cssToken('--cp-font', 'sans-serif')}`;
    ctx.textBaseline = 'middle';
    const epic = task.isEpic || task.hierarchyLevel === 1;
    const rollup = epic && task.childrenCount ? ` [${task.childrenCount} stories]` : '';
    let text = this.drag && this.drag.key === task.key ? this.drag.label : `${task.key} (${task.progress || 0}%)${rollup}`;
    if (isDriver) text = `${text} · Driver`;
    const chipW = ctx.measureText(text).width + 10;
    const place = labelPlacement(r.x, r.w, chipW, done);
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
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      if (x2 >= x1 + 16) {
        // Standard forward dependency: smooth curve from predecessor right to successor left
        const dx = Math.max(24, (x2 - x1) * 0.45);
        ctx.bezierCurveTo(x1 + dx, y1, x2 - dx, y2, x2 - 6, y2);
      } else {
        // Backward / conflicting link: route out from predecessor, loop around, and enter successor from the left
        const loopOutX = x1 + 16;
        const loopInX = x2 - 16;
        const midY = y1 < y2 ? y1 + ROW_H * 0.5 : y1 - ROW_H * 0.5;
        ctx.bezierCurveTo(loopOutX, y1, loopOutX, midY, (loopOutX + loopInX) / 2, midY);
        ctx.bezierCurveTo(loopInX, midY, loopInX, y2, x2 - 6, y2);
      }
      ctx.strokeStyle = colour;
      ctx.lineWidth = active && !connected ? 1 : connected ? 2.5 : 1.75;
      ctx.setLineDash(violated ? [4, 3] : []);
      ctx.stroke();
      ctx.setLineDash([]);

      // Arrowhead always enters successor left edge pointing cleanly to the right
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - 8, y2 - 4.5);
      ctx.lineTo(x2 - 8, y2 + 4.5);
      ctx.closePath();
      ctx.fillStyle = colour;
      ctx.fill();

      // Predecessor origin anchor dot
      ctx.beginPath();
      ctx.arc(x1, y1, connected ? 4.5 : 3.5, 0, Math.PI * 2);
      ctx.fill();
      if (!active || connected) {
        const when = dep.triggerDate ? `, ${dep.triggerDate}` : '';
        const planOnlyNote = dep.planOnly ? ' (not in Jira)' : '';
        const text = (violated ? `${dep.triggerPercent}%${when}: starts too early` : `${dep.triggerPercent}%${when}`) + planOnlyNote;
        const tw = ctx.measureText(text).width + 10;
        const badgeX = (x1 + x2) / 2;
        const badgeY = (y1 + y2) / 2;
        this.arrowLinks.push({
          predecessorKey: dep.predecessorKey,
          successorKey: task.key,
          triggerPercent: typeof dep.triggerPercent === 'number' ? dep.triggerPercent : 100,
          triggerDate: dep.triggerDate,
          isViolated: violated,
          ...(dep.planOnly ? { planOnly: true } : {}),
          x: badgeX,
          y: badgeY,
          width: tw,
          height: CHIP_H,
          text
        });
        this.chip(text, badgeX - tw / 2, badgeY,
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

  private drawActiveLinking(linking: ActiveLinking, rects: Map<string, { i: number; r: Rect }>, left: number, cssW: number): void {
    const ctx = this.ctx;
    const { sourceKey, x1, y1, curX, curY, targetKey } = linking;
    const colour = this.c(CANVAS_TOKENS.arrowActive);

    const angle = Math.atan2(curY - y1, curX - x1);
    const dist = Math.hypot(curX - x1, curY - y1);
    const curveOffset = Math.min(60, dist * 0.35);

    let endX = curX;
    let endY = curY;
    let enterAngle = angle;
    if (targetKey) {
      const target = rects.get(targetKey);
      if (target) {
        endX = target.r.x;
        endY = target.r.y + target.r.h / 2;
        enterAngle = 0; // enter from left pointing right
      }
    }

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    if (targetKey) {
      const dx = Math.max(24, Math.abs(endX - x1) * 0.45);
      ctx.bezierCurveTo(x1 + dx, y1, endX - dx, endY, endX - 6, endY);
    } else {
      ctx.bezierCurveTo(
        x1 + Math.cos(angle) * curveOffset,
        y1 + Math.sin(angle) * curveOffset,
        endX - Math.cos(angle) * curveOffset,
        endY - Math.sin(angle) * curveOffset,
        endX,
        endY
      );
    }
    ctx.strokeStyle = colour;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    const tipLen = 9;
    const tipHalf = 5;
    const cosA = Math.cos(enterAngle);
    const sinA = Math.sin(enterAngle);
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - cosA * tipLen + sinA * tipHalf, endY - sinA * tipLen - cosA * tipHalf);
    ctx.lineTo(endX - cosA * tipLen - sinA * tipHalf, endY - sinA * tipLen + cosA * tipHalf);
    ctx.closePath();
    ctx.fillStyle = colour;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x1, y1, 5, 0, Math.PI * 2);
    ctx.fill();

    if (targetKey) {
      const target = rects.get(targetKey);
      if (target) {
        this.path({ x: target.r.x - 3, y: target.r.y - 3, w: target.r.w + 6, h: target.r.h + 6 }, RADIUS + 2);
        ctx.strokeStyle = colour;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
    }

    ctx.font = `600 11px ${cssToken('--cp-font', 'sans-serif')}`;
    ctx.textBaseline = 'middle';
    const effectivePred = linking.predKey || sourceKey;
    const effectiveSucc = linking.succKey || targetKey;
    const label = targetKey
      ? `${effectiveSucc} depends on ${effectivePred}`
      : `Drag arrow to connect dependency`;
    const tw = ctx.measureText(label).width + 10;
    const chipX = Math.max(left + 6, Math.min(left + cssW - tw - 6, curX + 12));
    this.chip(label, chipX, Math.max(y1 - 24, curY - 18), this.c(CANVAS_TOKENS.driverText), colour);
  }
}
