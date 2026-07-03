/* Lightweight SVG chart kit following the dataviz mark specs:
   bars ≤24px with a 4px rounded data-end (square at the baseline), 2px surface
   gaps between touching fills, 2px lines, ≥8px markers with a 2px surface ring,
   hairline solid gridlines, selective direct labels, legend for ≥2 series,
   hover tooltips that enhance (tables elsewhere carry every value). */
import React, { useLayoutEffect, useRef, useState } from "react";

import { ink } from "./palette";
import { fmtNum } from "../utils";

// --- shared plumbing ---------------------------------------------------------

function useWidth(): [React.RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

interface TipState { x: number; y: number; lines: string[] }

function useTooltip() {
  const [tip, setTip] = useState<TipState | null>(null);
  const show = (e: React.MouseEvent, lines: string[]) => {
    const host = (e.currentTarget as SVGElement).closest("[data-chart]") as HTMLElement;
    const rect = host.getBoundingClientRect();
    setTip({ x: e.clientX - rect.left + 12, y: e.clientY - rect.top + 12, lines });
  };
  const hide = () => setTip(null);
  const node = tip ? (
    <div style={{
      position: "absolute", left: tip.x, top: tip.y, zIndex: 10, pointerEvents: "none",
      background: ink.primary, color: "#fff", borderRadius: 4, padding: "6px 10px",
      fontSize: 12, lineHeight: 1.5, boxShadow: "0 2px 8px rgba(0,0,0,.25)",
      whiteSpace: "nowrap",
    }}>
      {tip.lines.map((l, i) => <div key={i} style={i ? {} : { fontWeight: 600 }}>{l}</div>)}
    </div>
  ) : null;
  return { show, hide, node };
}

function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10;
  const ticks: number[] = [];
  // The last tick must cover the maximum so no mark overruns the scale.
  for (let v = 0; ; v += step) {
    ticks.push(v);
    if (v >= max) break;
  }
  return ticks;
}

/* Horizontal bar: square at the baseline (left), 4px rounded data-end (right). */
function barPath(x: number, y: number, w: number, h: number, r = 4): string {
  const rr = Math.min(r, w, h / 2);
  return `M${x},${y} h${w - rr} a${rr},${rr} 0 0 1 ${rr},${rr} v${h - 2 * rr}
          a${rr},${rr} 0 0 1 -${rr},${rr} h-${w - rr} z`;
}

const axisText: React.CSSProperties = { fontSize: 11, fill: ink.muted };
const labelText: React.CSSProperties = { fontSize: 11, fill: ink.secondary };
const valueText: React.CSSProperties = { fontSize: 11, fontWeight: 600, fill: ink.primary };

function ChartBox({ children, height, hostRef, tipNode }: {
  children: React.ReactNode; height: number;
  hostRef: React.RefObject<HTMLDivElement>; tipNode: React.ReactNode;
}) {
  return (
    <div ref={hostRef} data-chart style={{ position: "relative", width: "100%", height }}>
      {children}
      {tipNode}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", marginTop: 8 }}>
      {items.map((it) => (
        <span key={it.label} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: ink.secondary }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: it.color, display: "inline-block" }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

// --- 1. horizontal bars (FP breakdown) ---------------------------------------

export interface BarItem { key: string; label: string; value: number; color: string; tooltip?: string[] }

export function HBars({ items, unit = "" }: { items: BarItem[]; unit?: string }) {
  const [ref, width] = useWidth();
  const tt = useTooltip();
  const labelW = 150, valueW = 56, row = 30, barH = 18, padTop = 4;
  const height = items.length * row + padTop + 22;
  const plotW = Math.max(60, width - labelW - valueW);
  const max = Math.max(...items.map((i) => i.value), 1);
  const ticks = niceTicks(max);
  const scale = (v: number) => (v / (ticks[ticks.length - 1] || 1)) * plotW;

  return (
    <ChartBox hostRef={ref} height={height} tipNode={tt.node}>
      <svg width="100%" height={height}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={labelW + scale(t)} y1={padTop} x2={labelW + scale(t)}
                  y2={items.length * row + padTop} stroke={ink.grid} strokeWidth={1} />
            <text x={labelW + scale(t)} y={items.length * row + padTop + 14}
                  textAnchor="middle" style={axisText}>{fmtNum(t)}</text>
          </g>
        ))}
        {items.map((it, i) => {
          const y = padTop + i * row + (row - barH) / 2;
          const w = Math.max(scale(it.value), 0);
          return (
            <g key={it.key}
               onMouseMove={(e) => tt.show(e, it.tooltip ?? [it.label, `${fmtNum(it.value, 1)} ${unit}`])}
               onMouseLeave={tt.hide} style={{ cursor: "default" }}>
              <rect x={0} y={padTop + i * row} width={width} height={row} fill="transparent" />
              <text x={labelW - 8} y={y + barH / 2 + 4} textAnchor="end" style={labelText}>{it.label}</text>
              {w > 0.5 && <path d={barPath(labelW, y, w, barH)} fill={it.color} />}
              <text x={labelW + w + 6} y={y + barH / 2 + 4} style={valueText}>{fmtNum(it.value, 1)}</text>
            </g>
          );
        })}
        <line x1={labelW} y1={padTop} x2={labelW} y2={items.length * row + padTop}
              stroke={ink.baseline} strokeWidth={1} />
      </svg>
    </ChartBox>
  );
}

// --- 2. bars with uncertainty whisker (variant comparison) --------------------

export interface BandItem {
  key: string; label: string; color: string;
  best: number; expected: number; worst: number; tooltip?: string[];
}

export function BandBars({ items, unit }: { items: BandItem[]; unit: string }) {
  const [ref, width] = useWidth();
  const tt = useTooltip();
  const labelW = 150, valueW = 80, row = 38, barH = 20, padTop = 4;
  const height = items.length * row + padTop + 22;
  const plotW = Math.max(60, width - labelW - valueW);
  const max = Math.max(...items.map((i) => i.worst), 1);
  const ticks = niceTicks(max);
  const scale = (v: number) => (v / (ticks[ticks.length - 1] || 1)) * plotW;

  return (
    <ChartBox hostRef={ref} height={height} tipNode={tt.node}>
      <svg width="100%" height={height}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={labelW + scale(t)} y1={padTop} x2={labelW + scale(t)}
                  y2={items.length * row + padTop} stroke={ink.grid} strokeWidth={1} />
            <text x={labelW + scale(t)} y={items.length * row + padTop + 14}
                  textAnchor="middle" style={axisText}>{fmtNum(t)}</text>
          </g>
        ))}
        {items.map((it, i) => {
          const yMid = padTop + i * row + row / 2;
          const y = yMid - barH / 2;
          const w = scale(it.expected);
          return (
            <g key={it.key}
               onMouseMove={(e) => tt.show(e, it.tooltip ?? [it.label])}
               onMouseLeave={tt.hide} style={{ cursor: "default" }}>
              <rect x={0} y={padTop + i * row} width={width} height={row} fill="transparent" />
              <text x={labelW - 8} y={yMid + 4} textAnchor="end" style={labelText}>{it.label}</text>
              {w > 0.5 && <path d={barPath(labelW, y, w, barH)} fill={it.color} />}
              {/* best→worst whisker */}
              <line x1={labelW + scale(it.best)} y1={yMid} x2={labelW + scale(it.worst)} y2={yMid}
                    stroke={ink.primary} strokeWidth={1.5} />
              <line x1={labelW + scale(it.best)} y1={yMid - 5} x2={labelW + scale(it.best)} y2={yMid + 5}
                    stroke={ink.primary} strokeWidth={1.5} />
              <line x1={labelW + scale(it.worst)} y1={yMid - 5} x2={labelW + scale(it.worst)} y2={yMid + 5}
                    stroke={ink.primary} strokeWidth={1.5} />
              <text x={labelW + scale(it.worst) + 8} y={yMid + 4} style={valueText}>
                {fmtNum(it.expected)} {unit}
              </text>
            </g>
          );
        })}
        <line x1={labelW} y1={padTop} x2={labelW} y2={items.length * row + padTop}
              stroke={ink.baseline} strokeWidth={1} />
      </svg>
    </ChartBox>
  );
}

// --- 3. stacked horizontal bars (phase cost per variant) ----------------------

export interface StackRow { key: string; label: string; total: number;
  segments: { key: string; label: string; value: number; color: string }[] }

export function StackedBars({ rows, formatValue }: {
  rows: StackRow[]; formatValue: (v: number) => string;
}) {
  const [ref, width] = useWidth();
  const tt = useTooltip();
  const labelW = 150, valueW = 90, row = 38, barH = 22, padTop = 4, gap = 2;
  const height = rows.length * row + padTop + 8;
  const plotW = Math.max(60, width - labelW - valueW);
  const max = Math.max(...rows.map((r) => r.total), 1);

  return (
    <ChartBox hostRef={ref} height={height} tipNode={tt.node}>
      <svg width="100%" height={height}>
        {rows.map((r, i) => {
          const y = padTop + i * row + (row - barH) / 2;
          let x = labelW;
          return (
            <g key={r.key}>
              <text x={labelW - 8} y={y + barH / 2 + 4} textAnchor="end" style={labelText}>{r.label}</text>
              {r.segments.map((s, j) => {
                const w = Math.max((s.value / max) * plotW - (j < r.segments.length - 1 ? gap : 0), 0);
                const seg = (
                  <g key={s.key}
                     onMouseMove={(e) => tt.show(e, [s.label, `${r.label}: ${formatValue(s.value)}`])}
                     onMouseLeave={tt.hide}>
                    {j === r.segments.length - 1
                      ? <path d={barPath(x, y, w, barH)} fill={s.color} />
                      : <rect x={x} y={y} width={w} height={barH} fill={s.color} />}
                    {/* in-segment share label only when it comfortably fits */}
                    {w > 44 && (
                      <text x={x + w / 2} y={y + barH / 2 + 4} textAnchor="middle"
                            style={{ fontSize: 10, fill: "#fff" }}>
                        {Math.round((s.value / (r.total || 1)) * 100)}%
                      </text>
                    )}
                  </g>
                );
                x += w + gap;
                return seg;
              })}
              <text x={x + 6} y={y + barH / 2 + 4} style={valueText}>{formatValue(r.total)}</text>
            </g>
          );
        })}
        <line x1={labelW} y1={padTop} x2={labelW} y2={rows.length * row + padTop}
              stroke={ink.baseline} strokeWidth={1} />
      </svg>
    </ChartBox>
  );
}

// --- 4. burn-up line (scope history) ------------------------------------------

export interface BurnPoint { label: string; sub: string; value: number }

export function BurnUp({ points, color, unit }: { points: BurnPoint[]; color: string; unit: string }) {
  const [ref, width] = useWidth();
  const tt = useTooltip();
  const padL = 48, padR = 70, padT = 12, padB = 26, height = 220;
  const plotW = Math.max(60, width - padL - padR);
  const plotH = height - padT - padB;
  const max = Math.max(...points.map((p) => p.value), 1);
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || 1;
  const x = (i: number) => padL + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (v: number) => padT + plotH - (v / top) * plotH;
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.value)}`).join(" ");
  const last = points[points.length - 1];

  return (
    <ChartBox hostRef={ref} height={height} tipNode={tt.node}>
      <svg width="100%" height={height}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} y1={y(t)} x2={padL + plotW} y2={y(t)} stroke={ink.grid} strokeWidth={1} />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" style={axisText}>{fmtNum(t)}</text>
          </g>
        ))}
        <line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH}
              stroke={ink.baseline} strokeWidth={1} />
        <path d={path} fill="none" stroke={color} strokeWidth={2}
              strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={i} onMouseMove={(e) => tt.show(e, [p.label, p.sub, `${fmtNum(p.value, 1)} ${unit}`])}
             onMouseLeave={tt.hide}>
            <circle cx={x(i)} cy={y(p.value)} r={12} fill="transparent" />
            <circle cx={x(i)} cy={y(p.value)} r={4.5} fill={color}
                    stroke={ink.surface} strokeWidth={2} />
            <text x={x(i)} y={padT + plotH + 16} textAnchor="middle" style={axisText}>{p.label}</text>
          </g>
        ))}
        {last && (
          <text x={x(points.length - 1) + 10} y={y(last.value) + 4} style={valueText}>
            {fmtNum(last.value, 1)} {unit}
          </text>
        )}
      </svg>
    </ChartBox>
  );
}

// --- 5. delta waterfall --------------------------------------------------------

export interface WaterfallStep { key: string; label: string; value: number; kind: "total" | "delta" }

export function Waterfall({ steps, colors, unit }: {
  steps: WaterfallStep[];
  colors: { positive: string; negative: string; neutral: string };
  unit: string;
}) {
  const [ref, width] = useWidth();
  const tt = useTooltip();
  const padL = 48, padR = 12, padT = 14, padB = 54, height = 260;
  const plotW = Math.max(60, width - padL - padR);
  const plotH = height - padT - padB;

  // Running levels
  let level = 0;
  const boxes = steps.map((s) => {
    const from = s.kind === "total" ? 0 : level;
    const to = s.kind === "total" ? s.value : level + s.value;
    level = to;
    return { ...s, from, to };
  });
  const max = Math.max(...boxes.map((b) => Math.max(b.from, b.to)), 1);
  const top = niceTicks(max).slice(-1)[0] || 1;
  const y = (v: number) => padT + plotH - (v / top) * plotH;
  const band = plotW / steps.length;
  const barW = Math.min(24, band * 0.6);

  return (
    <ChartBox hostRef={ref} height={height} tipNode={tt.node}>
      <svg width="100%" height={height}>
        {niceTicks(max).map((t) => (
          <g key={t}>
            <line x1={padL} y1={y(t)} x2={padL + plotW} y2={y(t)} stroke={ink.grid} strokeWidth={1} />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" style={axisText}>{fmtNum(t)}</text>
          </g>
        ))}
        {boxes.map((b, i) => {
          const cx = padL + band * i + band / 2;
          const y1 = y(Math.max(b.from, b.to));
          const h = Math.max(Math.abs(y(b.from) - y(b.to)), b.from === b.to ? 0 : 2);
          const color = b.kind === "total" ? colors.neutral
            : b.to >= b.from ? colors.positive : colors.negative;
          const deltaTxt = b.kind === "total"
            ? `${fmtNum(b.to, 1)} ${unit}`
            : `${b.to >= b.from ? "+" : ""}${fmtNum(b.to - b.from, 1)} ${unit}`;
          return (
            <g key={b.key} onMouseMove={(e) => tt.show(e, [b.label, deltaTxt])} onMouseLeave={tt.hide}>
              <rect x={padL + band * i} y={padT} width={band} height={plotH} fill="transparent" />
              {/* connector to the previous step */}
              {i > 0 && b.kind === "delta" && (
                <line x1={cx - band / 2} y1={y(b.from)} x2={cx - barW / 2} y2={y(b.from)}
                      stroke={ink.baseline} strokeWidth={1} />
              )}
              {h > 0 && <rect x={cx - barW / 2} y={y1} width={barW} height={h} rx={2} fill={color} />}
              {(b.kind === "total" || b.from !== b.to) && (
                <text x={cx} y={y1 - 5} textAnchor="middle" style={valueText}>{deltaTxt}</text>
              )}
              <text x={cx} y={padT + plotH + 16} textAnchor="middle"
                    style={{ ...axisText, fontSize: 10 }}
                    transform={band < 70 ? `rotate(-28 ${cx} ${padT + plotH + 16})` : undefined}>
                {b.label}
              </text>
            </g>
          );
        })}
        <line x1={padL} y1={y(0)} x2={padL + plotW} y2={y(0)} stroke={ink.baseline} strokeWidth={1} />
      </svg>
    </ChartBox>
  );
}
