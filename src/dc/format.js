// Ported verbatim (logic-for-logic) from the original dashboard's fmt* helpers.
export function fmtMoney(v) {
  if (v === null || v === undefined) return '<span class="null" title="Данных нет">—</span>';
  if (v === "ERROR") return '<span class="err">ERROR</span>';
  const abs = Math.abs(v);
  if (abs >= 1e6) return (v / 1e6).toFixed(2) + "M ₽";
  if (abs >= 1e3) return (v / 1e3).toFixed(1) + "K ₽";
  return v.toFixed(0) + " ₽";
}

export function fmtInt(v) {
  if (v === null || v === undefined) return '<span class="null" title="Данных нет">—</span>';
  if (v === "ERROR") return '<span class="err">ERROR</span>';
  return v.toLocaleString("en-US");
}

export function fmtPct(v, digits) {
  if (v === null || v === undefined) return '<span class="null" title="Данных нет">—</span>';
  if (v === "ERROR") return '<span class="err">ERROR</span>';
  return v.toFixed(digits === undefined ? 1 : digits) + "%";
}

export function delta(now, prev, invert) {
  if (now === null || prev === null || now === "ERROR" || prev === "ERROR" || !prev) {
    return '<span class="delta flat">—</span>';
  }
  const d = ((now - prev) / Math.abs(prev)) * 100;
  const good = invert ? d < 0 : d > 0;
  const sign = d > 0 ? "+" : "";
  return '<span class="delta ' + (Math.abs(d) < 0.05 ? "flat" : good ? "up" : "down") + '">' + sign + d.toFixed(1) + "%</span>";
}
