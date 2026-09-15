// Ported verbatim from the original dashboard's chart helpers.
import { fmtMoney } from "./format.js";

export function spark(values, cls) {
  const w = 120, h = 30, pad = 2;
  const min = Math.min.apply(null, values), max = Math.max.apply(null, values), d = max - min || 1;
  const pts = values.map(
    (v, i) =>
      (pad + i * ((w - pad * 2) / (values.length - 1))).toFixed(1) +
      "," +
      (h - pad - ((v - min) / d) * (h - pad * 2)).toFixed(1),
  );
  const area = "M" + pts[0] + " L" + pts.join(" L") + " L" + (w - pad) + "," + h + " L" + pad + "," + h + " Z";
  return (
    '<svg class="sparkline ' +
    (cls || "") +
    '" viewBox="0 0 ' +
    w +
    " " +
    h +
    '" preserveAspectRatio="none"><path class="area" d="' +
    area +
    '"/><polyline points="' +
    pts.join(" ") +
    '"/></svg>'
  );
}

// Monotone cubic Hermite spline (Fritsch-Carlson): passes through every point,
// never overshoots above/below neighboring values — stays smooth and "flat-safe"
// even with few points spread across a wide/stretched chart (unlike Catmull-Rom).
export function smoothPath(pts) {
  const n = pts.length;
  if (n < 2) return "M" + (pts[0] ? pts[0][0].toFixed(1) + "," + pts[0][1].toFixed(1) : "0,0");
  if (n === 2) return "M" + pts[0][0].toFixed(1) + "," + pts[0][1].toFixed(1) + " L" + pts[1][0].toFixed(1) + "," + pts[1][1].toFixed(1);
  const dx = [], d = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1][0] - pts[i][0];
    d[i] = dx[i] ? (pts[i + 1][1] - pts[i][1]) / dx[i] : 0;
  }
  const m = [d[0]];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  m[n - 1] = d[n - 2];
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }
  let path = "M" + pts[0][0].toFixed(1) + "," + pts[0][1].toFixed(1);
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i];
    const c1x = pts[i][0] + h / 3, c1y = pts[i][1] + (m[i] * h) / 3;
    const c2x = pts[i + 1][0] - h / 3, c2y = pts[i + 1][1] - (m[i + 1] * h) / 3;
    path += " C" + c1x.toFixed(1) + "," + c1y.toFixed(1) + " " + c2x.toFixed(1) + "," + c2y.toFixed(1) + " " + pts[i + 1][0].toFixed(1) + "," + pts[i + 1][1].toFixed(1);
  }
  return path;
}

export function areaChart(series, labels) {
  const W = 960, H = 260, L = 46, R = 16, T = 18, B = 34;
  const all = series.reduce((a, s) => a.concat(s.values), []);
  let max = Math.max.apply(null, all), min = Math.min.apply(null, all);
  if (min > 0) min = 0;
  if (max < 0) max = 0;
  const pad = (max - min) * 0.1 || Math.abs(max) * 0.1 || 1;
  max += pad;
  if (min < 0) min -= pad;
  const n = series[0].values.length;
  const innerW = W - L - R, innerH = H - T - B;
  const x = (i) => L + (n <= 1 ? innerW / 2 : i * (innerW / (n - 1)));
  const y = (v) => T + innerH * (1 - (v - min) / (max - min || 1));
  const crossesZero = min < 0 && max > 0;
  const baseY = crossesZero ? y(0) : H - B;
  let out = '<svg class="chart-svg" viewBox="0 0 ' + W + " " + H + '">';
  const steps = 4;
  for (let s = 0; s <= steps; s++) {
    const v = min + ((max - min) * s) / steps;
    const yy = y(v);
    out += '<line class="gridline" x1="' + L + '" x2="' + (W - R) + '" y1="' + yy.toFixed(1) + '" y2="' + yy.toFixed(1) + '"/>';
    out += '<text x="' + (L - 8) + '" y="' + (yy + 3).toFixed(1) + '" text-anchor="end">' + fmtMoney(Math.round(v)) + "</text>";
  }
  out += '<line class="baseline" x1="' + L + '" y1="' + baseY.toFixed(1) + '" x2="' + (W - R) + '" y2="' + baseY.toFixed(1) + '"/>';
  series.forEach((s, si) => {
    const pts = s.values.map((v, i) => [x(i), y(v)]);
    const linePath = smoothPath(pts);
    const dotCls = si === 0 ? "dot1" : si === 1 ? "dot2" : "dot3";
    if (si === 0) {
      const last = pts[pts.length - 1], first = pts[0];
      out += '<path class="a1" d="' + linePath + " L" + last[0].toFixed(1) + "," + baseY.toFixed(1) + " L" + first[0].toFixed(1) + "," + baseY.toFixed(1) + ' Z"/>';
    }
    out += '<path class="' + (si === 0 ? "l1" : si === 1 ? "l2" : "l3") + '" d="' + linePath + '"/>';
    pts.forEach((p) => {
      out += '<circle class="' + dotCls + '" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3"/>';
    });
  });
  labels.forEach((l) => {
    out += '<text x="' + x(l[0]).toFixed(1) + '" y="' + (H - 10) + '" text-anchor="middle">' + l[1] + "</text>";
  });
  return out + "</svg>";
}
