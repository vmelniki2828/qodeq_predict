// Ported page-for-page from the original dashboard's `pageXxx()` methods.
// Each function still returns an HTML string (rendered via dangerouslySetInnerHTML
// in App.jsx), exactly like the original — this keeps the port mechanical and
// guarantees pixel-identical markup instead of risking drift from a manual JSX rewrite.
import { REAL, REAL_PERIOD } from "./data.js";
import { fmtMoney, fmtInt, fmtPct, delta } from "./format.js";
import { spark, areaChart } from "./charts.js";
import { panel, metricCell } from "./panel.js";
import { lineageFor } from "./lineage.js";

const flat6 = [1, 1, 1, 1, 1, 1];
const sparkGGR = REAL.gDaily.map((d) => d.bet - d.win);
const sparkNGR = REAL.gDaily.map((d, i) => d.bet - d.win - REAL.pDaily[i].bonus_deposit_amount);
const sparkRTP = REAL.gDaily.map((d) => (d.bet ? (d.win / d.bet) * 100 : 0));

export function buildKPI(t) {
  return [
    ["Deposit Amount", t.depositAmount, null, "money", REAL.pDaily.map((d) => d.deposit_amount)],
    ["GGR", t.ggr, null, "money", sparkGGR],
    ["NGR", t.ngr, null, "money", sparkNGR],
    ["Depositors", t.uniqueDepositors, null, "int", REAL.pDaily.map((d) => d.depositors)],
    ["Deposit Count", t.depositCount, null, "int", REAL.pDaily.map((d) => d.deposit_count)],
    ["RTP", t.rtp * 100, null, "pct", sparkRTP],
    ["BET", t.bet, null, "money", REAL.gDaily.map((d) => d.bet)],
    ["WIN", t.win, null, "money", REAL.gDaily.map((d) => d.win)],
    ["Bonus", t.bonusDepositAmount, null, "money", REAL.pDaily.map((d) => d.bonus_deposit_amount)],
    ["Withdrawals Amount", t.withdrawAmount, null, "money", REAL.pDaily.map((d) => d.withdraw_amount)],
    ["Bonus / GGR", t.bonusOverGgr, null, "pct", flat6],
    ["PSP Fees", t.fees, null, "money", flat6],
    ["Registrations", null, null, "int", flat6],
    ["FTD", null, null, "int", flat6],
    ["Reg → FTD", null, null, "pct", flat6],
  ];
}

// Период "Day" считается по последнему доступному дню, "Week" — по всему периоду данных.
// Часовых и месячных данных в payments.json / game_histories.json нет, поэтому Hour/Month/Custom
// на странице Main KPI недоступны (см. filterbar()/effectivePeriod() в App.jsx).
export function kpiTotalsForPeriod(period) {
  if (period === "Day") {
    const pd = REAL.pDaily[REAL.pDaily.length - 1];
    const gd = REAL.gDaily[REAL.gDaily.length - 1];
    const ggr = gd.bet - gd.win;
    const rtp = gd.bet ? gd.win / gd.bet : 0;
    return {
      label: pd.date,
      depositAmount: pd.deposit_amount,
      depositCount: pd.deposit_count,
      withdrawAmount: pd.withdraw_amount,
      uniqueDepositors: pd.depositors,
      bonusDepositAmount: pd.bonus_deposit_amount,
      fees: 0,
      bet: gd.bet,
      win: gd.win,
      ggr,
      rtp,
      ngr: ggr - pd.bonus_deposit_amount,
      bonusOverGgr: ggr ? (pd.bonus_deposit_amount / ggr) * 100 : null,
    };
  }
  return Object.assign({}, REAL.totals, { label: REAL_PERIOD });
}

export const KPI = buildKPI(REAL.totals);
export const KPI_MAP = {};
KPI.forEach((k) => {
  KPI_MAP[k[0]] = k;
});

export function pageMainKpi(ctx) {
  const period = ctx.effectivePeriod();
  const totals = kpiTotalsForPeriod(period);
  const kpi = buildKPI(totals);
  const periodLabel = period === "Day" ? "за " + totals.label.slice(8, 10) + "." + totals.label.slice(5, 7) + "." + totals.label.slice(0, 4) : "за " + totals.label;
  const hero = kpi
    .slice(0, 3)
    .map(
      (k) =>
        '<div data-metric="' + k[0] + '"><div class="kpi-label">' + k[0] + '</div><div class="kpi-value num">' + fmtMoney(k[1]) + "</div>" +
        (ctx.compare && k[2] !== null
          ? "<div>" + delta(k[1], k[2]) + ' <span class="delta">было ' + fmtMoney(k[2]) + "</span></div>"
          : '<div class="delta flat">' + periodLabel + "</div>") +
        spark(k[4], "gold") +
        "</div>",
    )
    .join("");
  const mini = kpi
    .slice(3, 6)
    .map(
      (k) =>
        '<div data-metric="' + k[0] + '"><div class="kpi-label">' + k[0] + '</div><div class="kpi-value num">' + (k[3] === "pct" ? fmtPct(k[1]) : fmtInt(k[1])) + "</div>" + spark(k[4]) + "</div>",
    )
    .join("");
  const rows = kpi
    .map((k) => {
      const f = k[3] === "money" ? fmtMoney : k[3] === "int" ? fmtInt : fmtPct;
      const barBase = k[1] === null ? 0 : k[2] === null ? k[1] : Math.max(k[1], k[2]);
      const barPct = barBase ? Math.min(100, Math.round(((k[1] || 0) / barBase) * 100)) : 0;
      return (
        '<tr><td class="k">' + metricCell(k[0], k[0]) + '</td><td class="r">' + f(k[1]) + "</td>" +
        (ctx.compare ? '<td class="r" style="color:#8A8579">' + f(k[2]) + '</td><td class="r">' + delta(k[1], k[2], k[0] === "Bonus / GGR") + "</td>" : "") +
        '<td style="width:120px"><div class="bar' + (k[1] !== null && k[2] !== null && k[1] < k[2] ? " red" : "") + '"><span style="width:' + barPct + '%"></span></div></td></tr>'
      );
    })
    .join("");
  const byProject = REAL.byProcessor.map((p) => [p.processor, p.amount, p.count]);
  return (
    '<div class="kpi-strip"><div class="kpi-hero">' + hero + '</div><div class="kpi-mini">' + mini + "</div></div>" +
    panel(
      "Динамика",
      "Deposit Amount, GGR и NGR по дням — весь период данных (" + REAL_PERIOD + "), вне зависимости от Day/Week выше",
      '<div class="legend"><span><i style="background:var(--acc)"></i>Deposit Amount</span><span><i style="background:var(--blue)"></i>GGR</span><span><i style="background:#6E6A61"></i>NGR</span></div>' +
        areaChart(
          [
            { values: REAL.pDaily.map((d) => d.deposit_amount) },
            { values: REAL.gDaily.map((d) => d.bet - d.win) },
            { values: REAL.gDaily.map((d, i) => d.bet - d.win - REAL.pDaily[i].bonus_deposit_amount) },
          ],
          REAL.pDaily.map((d, i) => [i, d.date.slice(8, 10) + "." + d.date.slice(5, 7)]),
        ),
    ) +
    '<div class="grid grid-2">' +
    panel(
      "Стандартные метрики",
      "Каждое значение можно раскрыть до источника и формулы",
      '<div class="table-wrap"><table><thead><tr><th>Standard Metric</th><th class="r">Период</th>' +
        (ctx.compare ? '<th class="r">Прошлый</th><th class="r">Δ</th>' : "") +
        "<th></th></tr></thead><tbody>" + rows + "</tbody></table></div>",
    ) +
    panel(
      "Разбивка: платёжные процессоры (PSP)",
      'Единственный реальный разрез, доступный в payments.json — выбор "' + ctx.breakdown + '" выше на эту таблицу не влияет',
      '<div class="table-wrap"><table><thead><tr><th>PSP</th><th class="r">Оборот (все статусы)</th><th class="r">Платежей</th></tr></thead><tbody>' +
        byProject.map((r) => '<tr><td class="k">' + r[0] + '</td><td class="r">' + fmtMoney(r[1]) + '</td><td class="r">' + fmtInt(r[2]) + "</td></tr>").join("") +
        "</tbody></table></div>",
    ) +
    "</div>"
  );
}

export function pageNewOld() {
  const rows = [
    ["Deposit Amount", 3840000, 8990000],
    ["Deposit Count", 84210, 234330],
    ["AVG Deposit", 45.6, 38.4],
    ["GGR", 1030000, 2250000],
    ["NGR", 620000, 1360000],
    ["Depositors", 12842, 32395],
    ["Bonus", 214800, 271400],
    ["Bonus / Deposit", 5.6, 3.0],
    ["Retention D7", 23.7, 31.4],
    ["Withdrawals Amount", 1740000, 6900000],
  ];
  return (
    '<div class="grid grid-2">' +
    panel(
      "New / Old",
      "Одни и те же Standard Metrics в двух срезах клиента",
      '<div class="table-wrap"><table><thead><tr><th>Metric</th><th class="r">New</th><th class="r">Old</th><th class="r">Доля New</th></tr></thead><tbody>' +
        rows
          .map((r) => {
            const share = typeof r[1] === "number" && typeof r[2] === "number" && r[1] + r[2] ? (r[1] / (r[1] + r[2])) * 100 : null;
            const f = r[0].indexOf("AVG") === 0 || r[0].indexOf("/") > 0 || r[0].indexOf("Retention") === 0 ? (v) => fmtPct(v) : r[1] > 100000 ? fmtMoney : fmtInt;
            return '<tr><td class="k">' + metricCell(r[0], r[0]) + '</td><td class="r">' + f(r[1]) + '</td><td class="r">' + f(r[2]) + '</td><td class="r">' + fmtPct(share) + "</td></tr>";
          })
          .join("") +
        "</tbody></table></div>",
      "span-2",
    ) +
    panel(
      "Динамика по клиенту",
      "Deposit Amount: новые против старых",
      '<div class="legend"><span><i style="background:var(--acc)"></i>New</span><span><i style="background:var(--blue)"></i>Old</span></div>' +
        areaChart(
          [{ values: [12, 16, 14, 21, 24, 22, 29, 27, 33, 31, 36, 40] }, { values: [30, 34, 32, 41, 44, 48, 54, 52, 58, 60, 64, 68] }],
          [[0, "01.08"], [5, "12.08"], [11, "31.08"]],
        ),
    ) +
    panel(
      "Первые 30 дней",
      "Поведение новой когорты после регистрации",
      '<div class="kv"><div><span>Registrations</span><strong>42 184</strong></div><div><span>FTD</span><strong>12 842</strong></div><div><span>Reg → FTD</span><strong>30.4%</strong></div><div><span>D2 депозит</span><strong>61.2%</strong></div><div><span>D7 активность</span><strong>23.7%</strong></div><div><span>AVG первый депозит</span><strong>$36.18</strong></div></div>',
    ) +
    "</div>"
  );
}

export function pageRetention() {
  const cohorts = [
    ["Aug W1", 10420, [100, 38.2, 27.4, 22.1, 18.6, 15.2, 13.4, 11.8]],
    ["Aug W2", 11380, [100, 36.9, 26.1, 21.4, 17.8, 14.6, 12.9, null]],
    ["Aug W3", 9840, [100, 39.4, 28.6, 23.2, 19.1, 15.8, null, null]],
    ["Aug W4", 10544, [100, 35.1, 24.8, 20.2, 16.4, null, null, null]],
  ];
  const heads = ["D0", "D1", "D3", "D7", "D14", "D21", "D30", "D60"];
  const cell = (v) => {
    if (v === null) return '<div class="heat-cell null" style="background:rgba(255,255,255,.02)" title="Данных нет — период не закрыт">—</div>';
    const a = Math.max(0.05, Math.min(0.55, v / 100));
    return '<div class="heat-cell" style="background:rgba(232,178,58,' + a.toFixed(3) + ')">' + v.toFixed(1) + "%</div>";
  };
  return (
    panel(
      "Retention по когортам",
      "Когорта — неделя регистрации. Пустая ячейка означает, что период ещё не закрыт, а не нулевое удержание.",
      '<div class="table-wrap"><div class="heat"><div class="heat-row heat-head"><div class="heat-label">Когорта</div><div class="heat-cell">Клиенты</div>' +
        heads.map((h) => '<div class="heat-cell">' + h + "</div>").join("") +
        "</div>" +
        cohorts.map((c) => '<div class="heat-row"><div class="heat-label">' + c[0] + '</div><div class="heat-cell" style="color:#8A8579">' + fmtInt(c[1]) + "</div>" + c[2].map(cell).join("") + "</div>").join("") +
        "</div></div>",
    ) +
    '<div class="grid grid-2">' +
    panel(
      "Кривая удержания",
      "Средневзвешенно по выбранным проектам",
      areaChart([{ values: [100, 38, 31, 27, 22, 19, 16, 14, 13, 12, 11, 11] }], [[0, "D0"], [3, "D7"], [7, "D30"], [11, "D90"]]),
    ) +
    panel(
      "Комментарий к данным",
      "Что влияет на трактовку цифр",
      '<div class="notice">Project C отдаёт retention только по месячным когортам. Для недельного разреза его данные не участвуют — значение помечено как «нет данных», а не приведено к нулю.</div>' +
        '<div class="kv section-gap"><div><span>Источников в расчёте</span><strong>2 из 3</strong></div><div><span>Гранулярность</span><strong>Week</strong></div><div><span>Глубина истории</span><strong>18 месяцев</strong></div></div>',
    ) +
    "</div>"
  );
}

export function pageLifecycle() {
  const steps = [
    ["FTD", 12842, 100, 100],
    ["2-й депозит", 7861, 61.2, 61.2],
    ["3-й депозит", 5420, 42.2, 68.9],
    ["4-й депозит", 4128, 32.1, 76.2],
    ["5-й депозит", 3284, 25.6, 79.6],
    ["7-й депозит", 2216, 17.3, 67.5],
    ["10-й депозит", 1428, 11.1, 64.4],
  ];
  return (
    '<div class="grid grid-2">' +
    panel(
      "Доходимость по депозитам",
      "% от первоначальной когорты и % от предыдущего шага",
      '<div class="funnel"><div class="funnel-row" style="border-bottom:1px solid var(--line)"><div class="eyebrow">Шаг</div><div class="eyebrow">Клиенты</div><div class="eyebrow" style="text-align:right">% когорты</div><div class="eyebrow" style="text-align:right">% пред.</div></div>' +
        steps
          .map(
            (s) =>
              '<div class="funnel-row"><div style="font-size:12.5px;color:#F5F2EC">' + s[0] + "</div>" +
              '<div><div class="funnel-bar"><span style="width:' + s[2] + '%"></span></div><div class="delta" style="margin-top:8px">' + fmtInt(s[1]) + " клиентов</div></div>" +
              '<div class="r num" style="text-align:right;font-size:13px;color:#F5F2EC">' + fmtPct(s[2]) + "</div>" +
              '<div class="r num" style="text-align:right;font-size:13px;color:#8A8579">' + fmtPct(s[3]) + "</div></div>",
          )
          .join("") +
        "</div>",
      "span-2",
    ) +
    panel(
      "Где теряем больше всего",
      "Разница между шагами воронки",
      '<div class="kv"><div><span>FTD → 2-й депозит</span><strong style="color:#D9645B">−38.8 pp</strong></div><div><span>2-й → 3-й</span><strong>−19.0 pp</strong></div><div><span>3-й → 5-й</span><strong>−16.6 pp</strong></div><div><span>5-й → 10-й</span><strong>−14.5 pp</strong></div></div>',
    ) +
    panel(
      "Срок до следующего депозита",
      "Медиана по когорте",
      '<div class="kv"><div><span>FTD → 2-й</span><strong>2.4 дня</strong></div><div><span>2-й → 3-й</span><strong>3.1 дня</strong></div><div><span>3-й → 5-й</span><strong>6.8 дня</strong></div><div><span>5-й → 10-й</span><strong>14.2 дня</strong></div></div>',
    ) +
    "</div>"
  );
}

export function pageMarketing() {
  const rows = [
    ["Partner A", "Buyer 3", "Summer Push", 128400, 9840, 3120, 41.2, 286400, 223, "ok"],
    ["Partner B", "Buyer 1", "Search Brand", 84200, 6110, 2240, 37.6, 214800, 255, "ok"],
    ["Partner C", "Buyer 2", "Affiliate Mix", 62800, 4820, 1180, 53.2, 96400, 154, "warn"],
    ["Partner D", "Buyer 4", "Display Retarget", 41200, 2140, 480, 85.8, 38200, 93, "bad"],
    ["Partner E", "Buyer 3", "Push Network", 28600, 1980, 620, 46.1, 61400, 215, "ok"],
  ];
  return (
    panel(
      "Закупка трафика",
      "Spend, CPA и ROAS по партнёрам и buyer. Predict — прогноз накопительного ROAS на 90 дней.",
      '<div class="table-wrap"><table><thead><tr><th>Partner</th><th>Buyer</th><th>Campaign</th><th class="r">Spend</th><th class="r">Regs</th><th class="r">FTD</th><th class="r">CPA</th><th class="r">NGR</th><th class="r">ROAS</th><th class="r">Predict 90d</th></tr></thead><tbody>' +
        rows
          .map(
            (r) =>
              '<tr><td class="k">' + r[0] + "</td><td>" + r[1] + "</td><td>" + r[2] + '</td><td class="r">' + fmtMoney(r[3]) + '</td><td class="r">' + fmtInt(r[4]) + '</td><td class="r">' + fmtInt(r[5]) +
              '</td><td class="r">$' + r[6].toFixed(1) + '</td><td class="r">' + fmtMoney(r[7]) + '</td><td class="r">' + r[8] + "%</td>" +
              '<td class="r"><span class="tag ' + (r[9] === "ok" ? "gold" : r[9] === "warn" ? "warm" : "red") + '">' +
              (r[9] === "ok" ? "↑ " + (r[8] + 40) + "%" : r[9] === "warn" ? "→ " + (r[8] + 12) + "%" : "↓ " + (r[8] - 8) + "%") +
              "</span></td></tr>",
          )
          .join("") +
        "</tbody></table></div>",
    ) +
    '<div class="grid grid-2">' +
    panel(
      "Накопительный ROAS",
      "По дням от старта закупки",
      '<div class="legend"><span><i style="background:var(--acc)"></i>Факт</span><span><i style="background:var(--blue)"></i>Прогноз</span></div>' +
        areaChart(
          [{ values: [12, 28, 44, 61, 78, 96, 118, 134, 152, 168, 186, 204] }, { values: [10, 24, 40, 56, 72, 88, 104, 120, 138, 154, 172, 190] }],
          [[0, "D1"], [3, "D14"], [7, "D45"], [11, "D90"]],
        ),
    ) +
    panel(
      "Сводно по маркетингу",
      "Выбранный период",
      "<div class=\"kv\"><div><span>Spend</span><strong>" + fmtMoney(345200) + "</strong></div><div><span>Registrations</span><strong>24 890</strong></div><div><span>FTD</span><strong>7 640</strong></div><div><span>CPA</span><strong>$45.2</strong></div><div><span>CAC</span><strong>$52.8</strong></div><div><span>NGR</span><strong>" +
        fmtMoney(697200) +
        '</strong></div><div><span>ROAS</span><strong>202%</strong></div><div><span>ROMI</span><strong>102%</strong></div><div><span>UTM без mapping</span><strong style="color:#E58C82">2 источника</strong></div></div>',
    ) +
    "</div>"
  );
}

export function pageCrm() {
  const funnel = [
    ["Sent", 184200, 100],
    ["Delivered", 176840, 96.0],
    ["Opened", 62410, 33.9],
    ["Clicked", 18240, 9.9],
    ["Confirmed", 4820, 2.6],
  ];
  const camp = [
    ["Welcome Series", "Email", 42180, 38.4, 11.2, 3.1, 84200],
    ["Reactivation 14d", "Email", 28640, 31.2, 8.6, 2.4, 46800],
    ["Deposit Reminder", "SMS", 18420, null, 14.8, 4.2, 61400],
    ["Bonus Expiry", "Email", 22840, 34.1, 9.4, 2.8, 38600],
    ["VIP Invite", "Email", 3120, 52.6, 21.4, 8.6, 128400],
  ];
  return (
    '<div class="grid grid-2">' +
    panel(
      "Воронка коммуникаций",
      "Sent → Delivered → Opened → Clicked → Confirmed",
      '<div class="funnel">' +
        funnel
          .map(
            (f) =>
              '<div class="funnel-row"><div style="font-size:12.5px;color:#F5F2EC">' + f[0] + '</div><div><div class="funnel-bar"><span style="width:' + f[2] + '%"></span></div></div><div class="r num" style="text-align:right;font-size:13px">' +
              fmtInt(f[1]) + '</div><div class="r num" style="text-align:right;color:#8A8579">' + fmtPct(f[2]) + "</div></div>",
          )
          .join("") +
        "</div>",
    ) +
    panel(
      "Доход после коммуникации",
      "Связь отправки и последующего депозита доступна для Email; для SMS источник не отдаёт open-события",
      '<div class="kv"><div><span>Депозиты после клика</span><strong>' + fmtMoney(359400) + "</strong></div><div><span>NGR после клика</span><strong>" + fmtMoney(94200) +
        '</strong></div><div><span>Средний чек</span><strong>$74.6</strong></div><div><span>Окно атрибуции</span><strong>72 часа</strong></div><div><span>SMS: Opened</span><strong class="null">нет данных</strong></div></div>',
    ) +
    panel(
      "Кампании",
      "Показатели по каналам и кампаниям",
      '<div class="table-wrap"><table><thead><tr><th>Кампания</th><th>Канал</th><th class="r">Sent</th><th class="r">Open %</th><th class="r">Click %</th><th class="r">Confirm %</th><th class="r">NGR</th></tr></thead><tbody>' +
        camp
          .map(
            (c) =>
              '<tr><td class="k">' + c[0] + '</td><td><span class="tag ' + (c[1] === "SMS" ? "blue" : "") + '">' + c[1] + '</span></td><td class="r">' + fmtInt(c[2]) + '</td><td class="r">' + fmtPct(c[3]) +
              '</td><td class="r">' + fmtPct(c[4]) + '</td><td class="r">' + fmtPct(c[5]) + '</td><td class="r">' + fmtMoney(c[6]) + "</td></tr>",
          )
          .join("") +
        "</tbody></table></div>",
      "span-2",
    ) +
    "</div>"
  );
}

export function pagePsp() {
  const rows = [
    ["Provider Alpha", "Card", "Primary", 84210, 71420, 12790, 4180000, 62400],
    ["Provider Beta", "Card", "Secondary", 42180, 32640, 9540, 1840000, 34200],
    ["Provider Gamma", "Crypto", "Primary", 18420, 17640, 780, 2140000, 8600],
    ["Provider Delta", "Wallet", "Primary", 26840, 24120, 2720, 1240000, 18400],
    ["Provider Epsilon", "Bank", "Secondary", 12480, 8420, 4060, 620000, 11200],
  ];
  return (
    panel(
      "Платёжные системы",
      "Attempts, conversion, amount и fees по провайдерам и методам",
      '<div class="table-wrap"><table><thead><tr><th>Provider</th><th>Method</th><th>Роль</th><th class="r">Attempts</th><th class="r">Success</th><th class="r">Failed</th><th class="r">Conversion</th><th class="r">Amount</th><th class="r">Fees</th></tr></thead><tbody>' +
        rows
          .map((r) => {
            const conv = (r[4] / r[3]) * 100;
            return (
              '<tr><td class="k">' + r[0] + "</td><td>" + r[1] + '</td><td><span class="tag ' + (r[2] === "Primary" ? "gold" : "") + '">' + r[2] + '</span></td><td class="r">' + fmtInt(r[3]) +
              '</td><td class="r">' + fmtInt(r[4]) + '</td><td class="r">' + fmtInt(r[5]) + '</td><td class="r"><span style="color:' + (conv < 70 ? "#E58C82" : "#F5F2EC") + '">' + fmtPct(conv) +
              '</span></td><td class="r">' + fmtMoney(r[6]) + '</td><td class="r">' + fmtMoney(r[7]) + "</td></tr>"
            );
          })
          .join("") +
        "</tbody></table></div>",
    ) +
    '<div class="grid grid-2">' +
    panel("Conversion по дням", "Все провайдеры, выбранный период", areaChart([{ values: [82, 84, 81, 79, 74, 76, 71, 73, 78, 80, 83, 84] }], [[0, "01.08"], [5, "12.08"], [11, "31.08"]])) +
    panel(
      "Сводно",
      "Выбранный период",
      '<div class="kv"><div><span>Attempts</span><strong>184 130</strong></div><div><span>Successful</span><strong>154 240</strong></div><div><span>Failed</span><strong>29 890</strong></div><div><span>Conversion</span><strong>83.8%</strong></div><div><span>Amount</span><strong>' +
        fmtMoney(10020000) +
        '</strong></div><div><span>Fees</span><strong>' + fmtMoney(134800) + "</strong></div><div><span>Fees / Amount</span><strong>1.35%</strong></div></div>",
    ) +
    "</div>"
  );
}

export function pageBonuses() {
  const rows = [
    ["Welcome Bonus", 142800, 18420, 4.4, 11.6, 6420],
    ["Cashback", 96400, 12840, 2.9, 7.8, 8210],
    ["Free Spins", 84200, 24180, 2.6, 6.8, 14620],
    ["Reload", 78600, 9240, 2.4, 6.4, 4180],
    ["VIP Bonus", 62400, 1240, 1.9, 5.1, 980],
    ["Tournament", 21800, 6420, 0.7, 1.8, 3240],
  ];
  const dailyBonusGgr = REAL.pDaily.map((d, i) => {
    const ggr = REAL.gDaily[i].bet - REAL.gDaily[i].win;
    return ggr ? (d.bonus_deposit_amount / ggr) * 100 : 0;
  });
  return (
    '<div class="grid grid-2">' +
    panel(
      'Бонусная эмиссия по типам <span class="tag warm" style="font-size:11px;vertical-align:middle">ДЕМО</span>',
      "В payments.json нет разбивки бонусов по типам (Welcome/Cashback/Free Spins/...) — строки ниже иллюстративные",
      '<div class="table-wrap"><table><thead><tr><th>Bonus Type</th><th class="r">Amount</th><th class="r">Игроков</th><th class="r">Bonus / Deposit</th><th class="r">Bonus / GGR</th><th class="r">Ставок бонусом</th></tr></thead><tbody>' +
        rows
          .map((r) => '<tr><td class="k">' + r[0] + '</td><td class="r">' + fmtMoney(r[1]) + '</td><td class="r">' + fmtInt(r[2]) + '</td><td class="r">' + fmtPct(r[3]) + '</td><td class="r">' + fmtPct(r[4]) + '</td><td class="r">' + fmtInt(r[5]) + "</td></tr>")
          .join("") +
        "</tbody></table></div>",
      "span-2",
    ) +
    panel(
      "Эмиссия по дням",
      "Bonus Amount (user_bonus_deposit) и Bonus / GGR — реальные данные, " + REAL_PERIOD,
      '<div class="legend"><span><i style="background:var(--acc)"></i>Bonus Amount</span><span><i style="background:var(--blue)"></i>Bonus / GGR</span></div>' +
        areaChart([{ values: REAL.pDaily.map((d) => d.bonus_deposit_amount) }, { values: dailyBonusGgr }], REAL.pDaily.map((d, i) => [i, d.date.slice(8, 10) + "." + d.date.slice(5, 7)])),
    ) +
    panel(
      "Сводно по бонусам",
      "Реальные данные за " + REAL_PERIOD + ", кроме отмеченного как demo",
      '<div class="kv"><div><span>' + metricCell("Bonus", "Bonus Amount") + "</span><strong>" + fmtMoney(REAL.totals.bonusDepositAmount) + "</strong></div><div><span>" +
        metricCell("Bonus / GGR", "Bonus / GGR") + "</span><strong>" + fmtPct(REAL.totals.bonusOverGgr) + "</strong></div><div><span>Bonus / Deposit</span><strong>" + fmtPct(REAL.totals.bonusOverDeposit) +
        "</strong></div><div><span>Игроков с бонусом (депозит)</span><strong>" + fmtInt(REAL.totals.uniqueBonusUsers) + "</strong></div><div><span>Доля бонусных ставок (спины)</span><strong>" +
        fmtPct(REAL.totals.bonusBetShare) + '</strong></div><div><span>Wagering выполнен <span class="tag warm" style="font-size:10px">demo</span></span><strong>' + fmtPct(null) + "</strong></div></div>",
    ) +
    "</div>"
  );
}

export function pageVip() {
  const seg = [
    ["VIP", "Manager K.", 1642, 4180000, 2840000, 1240000, 742000, 128400],
    ["PreVIP", "Manager K.", 4820, 2640000, 1620000, 684000, 412000, 86200],
    ["VIP", "Manager L.", 1180, 3120000, 2180000, 918000, 548000, 94800],
    ["PreVIP", "Manager M.", 3240, 1840000, 1080000, 462000, 284000, 62400],
    ["Regular", "—", 34355, 1240000, 920000, 216000, 142000, 114400],
  ];
  return (
    panel(
      "VIP-аналитика",
      "Сегменты, менеджеры и их показатели за выбранный период",
      '<div class="table-wrap"><table><thead><tr><th>Segment</th><th>VIP Manager</th><th class="r">Клиентов</th><th class="r">Deposits</th><th class="r">Withdrawals</th><th class="r">GGR</th><th class="r">NGR</th><th class="r">Bonus</th></tr></thead><tbody>' +
        seg
          .map(
            (s) =>
              '<tr><td class="k"><span class="tag ' + (s[0] === "VIP" ? "gold" : s[0] === "PreVIP" ? "warm" : "") + '">' + s[0] + "</span></td><td>" + s[1] + '</td><td class="r">' + fmtInt(s[2]) +
              '</td><td class="r">' + fmtMoney(s[3]) + '</td><td class="r">' + fmtMoney(s[4]) + '</td><td class="r">' + fmtMoney(s[5]) + '</td><td class="r">' + fmtMoney(s[6]) + '</td><td class="r">' + fmtMoney(s[7]) + "</td></tr>",
          )
          .join("") +
        "</tbody></table></div>",
    ) +
    '<div class="grid grid-2">' +
    panel(
      "Доля VIP в результате",
      "Часть NGR, которую приносят VIP и PreVIP",
      '<div class="kv"><div><span>VIP + PreVIP клиентов</span><strong>10 882 (24.1%)</strong></div><div><span>Доля в Deposit Amount</span><strong>72.4%</strong></div><div><span>Доля в NGR</span><strong>68.9%</strong></div><div><span>Bonus / GGR у VIP</span><strong>10.4%</strong></div><div><span>Withdrawals / Deposits</span><strong>67.9%</strong></div></div>',
    ) +
    panel(
      "Ограничение источника",
      "Что нужно учитывать при чтении отчёта",
      '<div class="notice">Project C не передаёт VIP Manager. Для его клиентов разрез по менеджеру недоступен, а не пуст: фильтр к этим данным не применяется.</div>',
    ) +
    "</div>"
  );
}

export function pageProvider() {
  const rows = REAL.providers.map((p) => ["Provider " + p.provider_id, null, p.bet, p.win, p.bet - p.win, p.bet ? (p.win / p.bet) * 100 : null, p.uniquePlayers]);
  return (
    panel(
      "Игровые провайдеры",
      "BET, WIN, GGR и RTP по provider_id из game_histories.json, " + REAL_PERIOD + ". Названия провайдеров и тип игр в файле не переданы (только числовой ID)",
      '<div class="table-wrap"><table><thead><tr><th>Provider</th><th>Тип</th><th class="r">BET</th><th class="r">WIN</th><th class="r">GGR</th><th class="r">RTP</th><th class="r">Игроков</th></tr></thead><tbody>' +
        rows.map((r) => '<tr><td class="k">' + r[0] + "</td><td>" + fmtInt(r[1]) + '</td><td class="r">' + fmtMoney(r[2]) + '</td><td class="r">' + fmtMoney(r[3]) + '</td><td class="r">' + fmtMoney(r[4]) + '</td><td class="r">' + fmtPct(r[5]) + '</td><td class="r">' + fmtInt(r[6]) + "</td></tr>").join("") +
        "</tbody></table></div>",
    ) +
    '<div class="grid grid-2">' +
    panel(
      "Топ провайдеров по GGR",
      "Реальные данные, " + REAL_PERIOD,
      '<div class="kv">' + REAL.providers.slice(0, 4).map((p) => "<div><span>Provider " + p.provider_id + "</span><strong>" + fmtMoney(p.bet - p.win) + "</strong></div>").join("") + "</div>",
    ) +
    panel(
      "Ограничение данных",
      "Тип игр (Slots/Live/Crash/Table)",
      '<div class="notice">В game_histories.json нет столбца с категорией игры (Slots/Live/Crash/Table) и нет справочника имён провайдеров — колонка "Тип" помечена как — (нет данных), а не ERROR: данные просто отсутствуют, загрузка прошла без ошибок.</div>',
    ) +
    "</div>"
  );
}

export function pagePnl() {
  const rows = [
    ["Revenue", "NGR", REAL.totals.ngr, null],
    ["Revenue", "Прочие доходы", null, null],
    ["Costs", "Marketing Spend", null, null],
    ["Costs", "Bonus Cost", -REAL.totals.bonusDepositAmount, null],
    ["Costs", "PSP Fees", -REAL.totals.fees, null],
    ["Costs", "Платформа и провайдеры", null, null],
    ["Costs", "Персонал", null, null],
    ["Result", "EBITDA", null, null],
  ];
  return (
    panel(
      "Консолидированный PNL",
      "Реальные строки — из payments.json/game_histories.json за " + REAL_PERIOD + ". Строки с — требуют данных о маркетинге, платформенных и кадровых расходах, которых нет в загруженных файлах",
      "<div class=\"table-wrap\"><table><thead><tr><th>Блок</th><th>Строка</th><th class=\"r\">" + REAL_PERIOD + '</th><th class="r">Пред. период</th><th class="r">Δ</th></tr></thead><tbody>' +
        rows.map((r) => '<tr><td style="color:#635F57">' + r[0] + '</td><td class="k">' + r[1] + '</td><td class="r">' + fmtMoney(r[2]) + '</td><td class="r" style="color:#8A8579">' + fmtMoney(r[3]) + '</td><td class="r">' + delta(r[2], r[3], r[2] < 0) + "</td></tr>").join("") +
        "</tbody></table></div>",
    ) +
    '<div class="grid grid-2">' +
    panel(
      "Cash Flow",
      "Реальные данные, " + REAL_PERIOD + ". Без учёта маркетинга и опекс (нет данных)",
      '<div class="kv"><div><span>Поступления (депозиты)</span><strong>' + fmtMoney(REAL.totals.depositAmount) + "</strong></div><div><span>Выплаты (выводы)</span><strong>" + fmtMoney(-REAL.totals.withdrawAmount) +
        "</strong></div><div><span>PSP fees</span><strong>" + fmtMoney(-REAL.totals.fees) + "</strong></div><div><span>Маркетинг</span><strong>" + fmtMoney(null) + "</strong></div><div><span>Операционные расходы</span><strong>" +
        fmtMoney(null) + "</strong></div><div><span>Net Cash Flow (депозиты − выводы − PSP fees)</span><strong>" + fmtMoney(REAL.totals.depositAmount - REAL.totals.withdrawAmount - REAL.totals.fees) + "</strong></div></div>",
    ) +
    panel(
      'Сверка с аналитикой <span class="tag warm" style="font-size:11px;vertical-align:middle">ДЕМО</span>',
      "Требует нескольких независимых источников/BI-отчётов — в этом дашборде только один источник данных",
      '<div class="kv"><div><span>' + metricCell("NGR", "NGR · аналитика") + "</span><strong>" + fmtMoney(1980000) + "</strong></div><div><span>NGR · PNL</span><strong>" + fmtMoney(1980000) +
        '</strong></div><div><span>Расхождение</span><strong style="color:#E8B23A">0.0%</strong></div><div><span>Правило конвертации</span><strong>курс дня операции</strong></div></div>' +
        '<div class="notice section-gap">Демо-иллюстрация: показывает, как выглядела бы сверка одной Standard Metric между двумя отчётами. В загруженных файлах второго источника нет.</div>',
    ) +
    "</div>"
  );
}

export function pageSources() {
  const rows = [
    ["Project A · Power BI", "Power BI", "Finance Daily, Marketing, VIP", "07 Sep 04:15", "ok", "24 мес"],
    ["Project A · ClickHouse", "База данных", "game_histories, payments", "07 Sep 04:05", "ok", "36 мес"],
    ["Project B · Power BI", "Power BI", "Main KPI, Retention", "06 Sep 04:10", "stale", "18 мес"],
    ["Project B · Google Sheets", "Google Sheets", "Marketing Spend", "07 Sep 03:40", "ok", "12 мес"],
    ["Project C · CSV", "Excel / CSV", "Депозиты, Бонусы", "05 Sep 22:00", "error", "9 мес"],
    ["PSP API", "API", "Attempts, Fees", "07 Sep 04:12", "ok", "14 мес"],
  ];
  const tagFor = (s) => (s === "ok" ? '<span class="tag gold">Обновлено</span>' : s === "stale" ? '<span class="tag warm">Не обновился</span>' : '<span class="tag red">Ошибка загрузки</span>');
  return (
    panel(
      "Подключённые источники",
      "Новый проект подключается в существующие отчёты: источник → поля → mapping. Отдельный отчёт создавать не нужно.",
      '<div class="table-wrap"><table><thead><tr><th>Источник</th><th>Тип</th><th>Что отдаёт</th><th>Последнее обновление</th><th>Статус</th><th class="r">История</th></tr></thead><tbody>' +
        rows.map((r) => '<tr><td class="k">' + r[0] + "</td><td>" + r[1] + '</td><td style="color:#8A8579">' + r[2] + '</td><td class="num">' + r[3] + "</td><td>" + tagFor(r[4]) + '</td><td class="r">' + r[5] + "</td></tr>").join("") +
        "</tbody></table></div>",
      null,
      '<button class="primary-button">Подключить источник</button>',
    ) +
    '<div class="grid grid-2">' +
    panel(
      "Как подключается новый проект",
      "Четыре шага без создания отчётов с нуля",
      '<div class="lineage">' +
        [
          ["Подключить источник", "База, Power BI, Sheets, CSV или API", ""],
          ["Прочитать поля", "Сервис показывает список доступных метрик и разрезов", ""],
          ["Заполнить mapping", "Название в источнике → Standard Metric", ""],
          ["Данные в отчётах", "Проект появляется во всех стандартных отчётах и фильтрах", ""],
        ]
          .map((s) => '<div class="lineage-step"><div class="lineage-dot"></div><div><strong>' + s[0] + "</strong><small>" + s[1] + "</small></div></div>")
          .join("") +
        "</div>",
    ) +
    panel(
      "Частота обновления",
      "Определяется возможностями источника",
      '<div class="kv"><div><span>ClickHouse</span><strong>каждые 15 минут</strong></div><div><span>Power BI</span><strong>1 раз в сутки</strong></div><div><span>Google Sheets</span><strong>каждый час</strong></div><div><span>CSV</span><strong>по загрузке файла</strong></div><div><span>API</span><strong>каждые 30 минут</strong></div></div>',
    ) +
    "</div>"
  );
}

export function pageMapping(ctx) {
  const rows = [
    ["Project A", "Total Deposits", "Deposit Amount", "DEP-01", "ok"],
    ["Project B", "TOTAL 3. Deposit", "Deposit Amount", "DEP-01", "ok"],
    ["Project C", "Депозиты", "Deposit Amount", "DEP-01", "ok"],
    ["Project A", "Regs", "Registrations", "REG-01", "ok"],
    ["Project B", "Signups", "Registrations", "REG-01", "ok"],
    ["Project C", "Регистрации", "Registrations", "REG-01", "ok"],
    ["Project A", "GGR SUM", "GGR", "GGR-02", "ok"],
    ["Project B", "Gross Gaming Revenue", "GGR", "GGR-02", "ok"],
    ["Project C", "Bonus Emission", "—", "—", "missing"],
    ["Project B", "Retention w/o FTD", "—", "—", "new"],
    ["PSP API", "fee_network + fee_processor", "PSP Fees", "PSP-03", "formula"],
  ];
  const q = (ctx.mappingSearch || "").toLowerCase();
  const filtered = rows.filter((r) => !q || (r[0] + " " + r[1] + " " + r[2]).toLowerCase().indexOf(q) >= 0);
  const tagFor = (s) => (s === "ok" ? '<span class="tag gold">Сопоставлено</span>' : s === "missing" ? '<span class="tag red">Нет mapping</span>' : s === "new" ? '<span class="tag warm">Новая метрика</span>' : '<span class="tag blue">Формула</span>');
  return (
    panel(
      "Правила mapping",
      "Одна бизнес-метрика может называться по-разному в каждом источнике. Здесь эти названия сводятся к единой Standard Metric.",
      '<div class="toolbar"><input id="mappingSearch" class="field search" placeholder="Поиск по источнику, названию или Standard Metric" value="' + (ctx.mappingSearch || "") + '"><button class="ghost-button">Импорт правил</button><button class="primary-button">Добавить правило</button></div>' +
        '<div class="table-wrap"><table><thead><tr><th>Источник / проект</th><th>Название сейчас</th><th>Standard Metric</th><th>Правило</th><th>Статус</th></tr></thead><tbody>' +
        filtered.map((r) => '<tr><td style="color:#8A8579">' + r[0] + '</td><td class="k">' + r[1] + "</td><td>" + (r[2] === "—" ? '<span class="null">не задано</span>' : metricCell(r[2], r[2])) + '</td><td class="num" style="color:#8A8579">' + r[3] + "</td><td>" + tagFor(r[4]) + "</td></tr>").join("") +
        "</tbody></table></div>",
    ) +
    '<div class="grid grid-2">' +
    panel(
      "Требует решения",
      "Пока правило не задано, метрика не попадает в отчёты",
      '<div class="kv"><div><span>Project C · Bonus Emission</span><strong style="color:#E58C82">нет mapping</strong></div><div><span>Project B · Retention w/o FTD</span><strong style="color:#D8B463">новая метрика</strong></div><div><span>Project C · VIP Manager</span><strong class="null">поля нет в источнике</strong></div></div>' +
        '<div class="notice section-gap">Новая неизвестная метрика не удаляется и не приравнивается к нулю: она остаётся в списке до тех пор, пока для неё не задано правило.</div>',
    ) +
    panel(
      "Пример правила",
      "DEP-01 · Deposit Amount",
      '<div class="lineage">' + lineageFor("Deposit Amount").map((s) => '<div class="lineage-step"><div class="lineage-dot"></div><div><strong>' + s[0] + "</strong><small>" + s[1] + "</small>" + (s[2] ? "<code>" + s[2] + "</code>" : "") + "</div></div>").join("") + "</div>",
    ) +
    "</div>"
  );
}

export function pageQuality() {
  const issues = [
    ["Источник не обновился", "Project B · Power BI", "Последняя загрузка 06 Sep 04:10, ожидалась 07 Sep", "stale", "Main KPI, Retention"],
    ["Данные не загрузились", "Project C · CSV", "Файл за 06–07 Sep не поступил", "error", "Main KPI, Bonuses"],
    ["Нет mapping", "Project C · Bonus Emission", "Метрика есть в источнике, правило не задано", "error", "Bonuses"],
    ["Новая неизвестная метрика", "Project B · Retention w/o FTD", "Появилась 05 Sep, требует решения", "warn", "—"],
    ["Дубли", "PSP API · payments", "284 записи с одинаковым external_payment_id", "warn", "PSP, PNL"],
    ["Изменилась структура источника", "Project A · Power BI", "Удалён столбец Bonus Type", "warn", "Bonuses"],
    ["Ошибка расчёта / конвертации", "Provider Six · RTP", "Отсутствует поле win за 28–31 Aug", "error", "Provider"],
  ];
  const tagFor = (s) => (s === "error" ? '<span class="tag red">ERROR</span>' : s === "stale" ? '<span class="tag warm">Не обновился</span>' : '<span class="tag warm">Требует решения</span>');
  return (
    panel(
      "Состояние данных",
      "Система показывает проблемы загрузки и сопоставления, а не скрывает их за нулями.",
      '<div class="table-wrap"><table><thead><tr><th>Тип проблемы</th><th>Где</th><th>Детали</th><th>Статус</th><th>Влияет на отчёты</th></tr></thead><tbody>' +
        issues.map((i) => '<tr><td class="k">' + i[0] + '</td><td style="color:#8A8579">' + i[1] + "</td><td>" + i[2] + "</td><td>" + tagFor(i[3]) + '</td><td style="color:#8A8579">' + i[4] + "</td></tr>").join("") +
        "</tbody></table></div>",
    ) +
    '<div class="grid grid-3">' +
    panel(
      "Как читать значения",
      "Три разных состояния, которые нельзя путать",
      '<div class="kv"><div><span>0</span><strong>реальное нулевое значение</strong></div><div><span>—</span><strong class="null">данных нет / NULL</strong></div><div><span>ERROR</span><strong class="err">не загрузилось или нет mapping</strong></div></div>',
    ) +
    panel(
      "Покрытие периода",
      "Сколько данных получено за 01–31 Aug",
      '<div class="kv"><div><span>Project A</span><strong>31 / 31 дней</strong></div><div><span>Project B</span><strong style="color:#D8B463">30 / 31 дней</strong></div><div><span>Project C</span><strong style="color:#E58C82">27 / 31 дней</strong></div><div><span>PSP API</span><strong>31 / 31 дней</strong></div></div>',
    ) +
    panel(
      "Второй этап",
      "После стабильного сбора и mapping",
      '<div class="panel-subtitle" style="margin-top:0">Автоматический контроль отклонений и AI-объяснение причин: просадка FTD, ухудшение PSP conversion, рост Bonus/GGR, падение retention, отклонение ROAS.</div>' +
        '<div class="notice section-gap">AI не рассчитывает базовые финансовые метрики — они считаются по утверждённым формулам.</div>',
    ) +
    "</div>"
  );
}

export const PAGES = {
  "main-kpi": pageMainKpi,
  "new-old": pageNewOld,
  retention: pageRetention,
  lifecycle: pageLifecycle,
  marketing: pageMarketing,
  crm: pageCrm,
  psp: pagePsp,
  bonuses: pageBonuses,
  vip: pageVip,
  provider: pageProvider,
  pnl: pagePnl,
  sources: pageSources,
  mapping: pageMapping,
  quality: pageQuality,
};
