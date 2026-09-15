import metrics from "../data/metrics.json";

export const NAV = [
  ["Отчёты", [
    ["main-kpi", "01", "Main KPI"],
    ["new-old", "02", "New / Old"],
    ["retention", "03", "Retention"],
    ["lifecycle", "04", "Deposit Lifecycle"],
    ["marketing", "05", "Marketing"],
    ["crm", "06", "CRM / Email / SMS"],
    ["psp", "07", "PSP"],
    ["bonuses", "08", "Bonuses"],
    ["vip", "09", "VIP"],
    ["provider", "10", "Provider"],
  ]],
  ["Финансы", [["pnl", "11", "PNL / Cash Flow"]]],
  ["Данные", [
    ["sources", "12", "Источники"],
    ["mapping", "13", "Mapping"],
    ["quality", "14", "Контроль данных"],
  ]],
];

export const META = {
  "main-kpi": ["Main KPI", "Основные показатели выбранного периода по всем подключённым проектам."],
  "new-old": ["New / Old", "Те же ключевые показатели отдельно по новым и старым клиентам."],
  retention: ["Retention", "Удержание клиентов по когортам регистрации и периодам."],
  lifecycle: ["Deposit Lifecycle", "Доходимость до 2-го, 3-го, 5-го и 10-го депозита: % от когорты и % от предыдущего шага."],
  marketing: ["Marketing", "Эффективность закупки трафика: CPA, ROAS/ROMI и накопительный ROAS."],
  crm: ["CRM / Email / SMS", "Эффективность коммуникаций и последующий доход по отправкам."],
  psp: ["PSP", "Работа платёжных систем: attempts, conversion, amount и fees."],
  bonuses: ["Bonuses", "Бонусная аналитика: эмиссия, Bonus/GGR, Bonus/Deposit и типы бонусов."],
  vip: ["VIP", "VIP-сегменты, менеджеры и их показатели."],
  provider: ["Provider", "Игровые провайдеры: bet, win, GGR и RTP."],
  pnl: ["PNL / Cash Flow", "Консолидация финансовых отчётов по утверждённой структуре. Доступна только помесячно."],
  sources: ["Источники данных", "Подключённые источники, глубина истории и время последнего обновления."],
  mapping: ["Mapping", "Приведение названий метрик из разных источников к единой Standard Metric."],
  quality: ["Контроль данных", "Проблемы загрузки и сопоставления: система показывает их, а не скрывает."],
};

export const DEMO_PAGES = ["new-old", "retention", "lifecycle", "marketing", "crm", "psp", "vip", "sources", "mapping", "quality"];

export const REAL_PERIOD = metrics.realPeriodLabel || `${metrics.periodPayments}`;

export const PERIODS = ["Hour", "Day", "Week", "Month", "Custom"];
export const PROJECTS = ["Project A", "Project B", "Project C"];
export const BREAKDOWNS = ["Project", "Client", "Segment", "Traffic Source", "Partner", "Buyer", "Campaign", "GEO", "UTM", "PSP", "Game Provider", "Bonus Type"];

export const REAL = metrics;
REAL.totals.ngr = REAL.totals.ggr - REAL.totals.bonusDepositAmount - REAL.totals.fees;
REAL.totals.bonusOverGgr = REAL.totals.ggr ? (REAL.totals.bonusDepositAmount / REAL.totals.ggr) * 100 : null;
REAL.totals.bonusOverDeposit = REAL.totals.depositAmount ? (REAL.totals.bonusDepositAmount / REAL.totals.depositAmount) * 100 : null;
REAL.totals.wdRatio = REAL.totals.depositAmount ? (REAL.totals.withdrawAmount / REAL.totals.depositAmount) * 100 : null;
REAL.totals.depositsPerDepositor = REAL.totals.uniqueDepositors ? REAL.totals.depositCount / REAL.totals.uniqueDepositors : null;
REAL.totals.depositTurnover = REAL.totals.depositAmount ? REAL.totals.realBetAmount / REAL.totals.depositAmount : null;
REAL.totals.bonusBetShare = REAL.totals.spins ? (REAL.totals.bonusBetSpins / REAL.totals.spins) * 100 : null;

export const REAL_FORMULAS = {
  "Deposit Amount": "sum(amount) / 10^decimal_places, где currency = RUB, status = finished, type = deposit",
  GGR: "sum(bet) − sum(win) по всем спинам (Wager − Payouts)",
  NGR: "GGR − Bonus (issued) − PSP Fees. Provider Fees и налоги не входят: их нет в файлах",
  Depositors: "count(distinct user_id), где currency = RUB, status = finished, type = deposit",
  "Deposit Count": "count(*), где currency = RUB, status = finished, type = deposit",
  RTP: "sum(win) / sum(bet) × 100%",
  BET: "sum(bet) по всем спинам game_histories.json (казино, без sportsbook)",
  WIN: "sum(win) по всем спинам game_histories.json",
  Bonus: "sum(amount), где type = user_bonus_deposit, currency = RUB, status = finished",
  "Withdrawals Amount": "sum(amount) / 10^decimal_places, где currency = RUB, status = finished, type = withdraw",
  "Bonus / GGR": "Bonus / GGR × 100%",
  "PSP Fees": "sum(fee_network + fee_processor) — в этой выгрузке равно 0 у всех платежей",
};
