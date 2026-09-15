// Aggregates real metrics from payments.json / game_histories.json into
// src/data/metrics.json, matching the exact `REAL` data shape used by the
// original QODEQ Analytics dashboard (see the ported page templates in
// src/dc/pages.js). The raw files (game_histories.json is ~2.7GB) are never
// shipped to the browser — only this precomputed summary is.
//
// Usage: node scripts/build-metrics.mjs [--payments <path>] [--games <path>] [--limit N]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import streamChainPkg from "stream-chain";
import streamJsonPkg from "stream-json";
import PickPkg from "stream-json/filters/Pick.js";
import StreamArrayPkg from "stream-json/streamers/StreamArray.js";

const { chain } = streamChainPkg;
const { parser } = streamJsonPkg;
const { pick } = PickPkg;
const { streamArray } = StreamArrayPkg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

function argVal(name, fallback) {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

const CURRENCY = "RUB";
const paymentsPath = path.resolve(argVal("--payments", path.join(projectRoot, "..", "payments.json")));
const gamesPath = path.resolve(argVal("--games", path.join(projectRoot, "..", "game_histories.json")));
const rowLimit = Number(argVal("--limit", "0")) || Infinity;
const outPath = path.join(projectRoot, "src", "data", "metrics.json");

console.log(`[build-metrics] payments: ${paymentsPath}`);
console.log(`[build-metrics] games:    ${gamesPath}`);

function unscale(row) {
  return Number(row.amount) / 10 ** Number(row.decimal_places);
}

function unscaleFee(row) {
  const places = Number(row.decimal_places) || 0;
  return (Number(row.fee_network || 0) + Number(row.fee_processor || 0)) / 10 ** places;
}

function dayKey(createdAt) {
  return createdAt ? createdAt.slice(0, 10) : null;
}

// ---------- payments.json (small enough to load whole) ----------

function loadPayments() {
  const raw = JSON.parse(fs.readFileSync(paymentsPath, "utf8"));
  const rows = raw.data;

  let depositAmount = 0, depositCount = 0;
  const depositors = new Set();
  let withdrawAmount = 0, withdrawCount = 0;
  let bonusDepositAmount = 0, bonusDepositCount = 0;
  const bonusUsers = new Set();
  let fees = 0;
  let minCreated = null, maxCreated = null;

  /** @type {Map<string, {deposit_amount:number, deposit_count:number, withdraw_amount:number, withdraw_count:number, bonus_deposit_amount:number, bonus_deposit_count:number, depositors:Set<string>}>} */
  const byDay = new Map();

  /** @type {Map<string, {count:number, amount:number}>} */
  const byProcessor = new Map();

  function dayBucket(day) {
    if (!byDay.has(day)) {
      byDay.set(day, {
        deposit_amount: 0, deposit_count: 0,
        withdraw_amount: 0, withdraw_count: 0,
        bonus_deposit_amount: 0, bonus_deposit_count: 0,
        depositors: new Set(),
      });
    }
    return byDay.get(day);
  }

  for (const row of rows) {
    if (row.created_at) {
      if (!minCreated || row.created_at < minCreated) minCreated = row.created_at;
      if (!maxCreated || row.created_at > maxCreated) maxCreated = row.created_at;
    }

    fees += unscaleFee(row);

    const proc = row.payment_processor || "unknown";
    if (!byProcessor.has(proc)) byProcessor.set(proc, { count: 0, amount: 0 });
    const p = byProcessor.get(proc);
    p.count += 1;
    p.amount += unscale(row); // all statuses — matches original "Оборот (все статусы)"

    if (row.currency !== CURRENCY) continue;
    const day = dayKey(row.created_at);

    if (row.type === "deposit" && row.status === "finished") {
      const amt = unscale(row);
      depositAmount += amt;
      depositCount += 1;
      depositors.add(row.user_id);
      if (day) {
        const b = dayBucket(day);
        b.deposit_amount += amt;
        b.deposit_count += 1;
        b.depositors.add(row.user_id);
      }
    } else if (row.type === "withdraw" && row.status === "finished") {
      const amt = unscale(row);
      withdrawAmount += amt;
      withdrawCount += 1;
      if (day) {
        const b = dayBucket(day);
        b.withdraw_amount += amt;
        b.withdraw_count += 1;
      }
    } else if (row.type === "user_bonus_deposit" && row.status === "finished") {
      const amt = unscale(row);
      bonusDepositAmount += amt;
      bonusDepositCount += 1;
      bonusUsers.add(row.user_id);
      if (day) {
        const b = dayBucket(day);
        b.bonus_deposit_amount += amt;
        b.bonus_deposit_count += 1;
      }
    }
  }

  const pDaily = Array.from(byDay.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, v]) => ({
      date,
      deposit_amount: v.deposit_amount,
      deposit_count: v.deposit_count,
      withdraw_amount: v.withdraw_amount,
      withdraw_count: v.withdraw_count,
      bonus_deposit_amount: v.bonus_deposit_amount,
      bonus_deposit_count: v.bonus_deposit_count,
      depositors: v.depositors.size,
    }));

  const processors = Array.from(byProcessor.entries())
    .map(([processor, v]) => ({ processor, count: v.count, amount: v.amount }))
    .sort((a, b) => b.amount - a.amount);

  return {
    depositAmount, depositCount, depositorsCount: depositors.size,
    withdrawAmount, withdrawCount,
    bonusDepositAmount, bonusDepositCount, bonusUsersCount: bonusUsers.size,
    fees, processors, pDaily,
    minCreated, maxCreated,
    rowCount: rows.length,
  };
}

// ---------- game_histories.json (streamed, do not load into memory) ----------

function loadGameHistories() {
  return new Promise((resolve, reject) => {
    let totalBet = 0, totalWin = 0, spins = 0, bonusBetSpins = 0, bonusBetAmount = 0;
    let minCreated = null, maxCreated = null;
    const allPlayers = new Set();
    /** @type {Map<string, {bet:number, win:number, spins:number, players:Set<string>}>} */
    const byProvider = new Map();
    /** @type {Map<string, {bet:number, win:number, spins:number, players:Set<string>, bonusBet:number, bonusSpins:number}>} */
    const byDay = new Map();
    let seen = 0;
    const started = Date.now();

    const pipeline = chain([
      fs.createReadStream(gamesPath, { encoding: "utf8" }),
      parser(),
      pick({ filter: "data" }),
      streamArray(),
    ]);

    pipeline.on("data", ({ value: row }) => {
      seen += 1;
      const bet = Number(row.bet) || 0;
      const win = Number(row.win) || 0;
      const isBonus = Number(row.is_bonus_bet) === 1;
      totalBet += bet;
      totalWin += win;
      spins += 1;
      allPlayers.add(row.user_id);
      if (isBonus) {
        bonusBetSpins += 1;
        bonusBetAmount += bet;
      }

      const day = dayKey(row.created_at);
      if (day) {
        if (!byDay.has(day)) {
          byDay.set(day, { bet: 0, win: 0, spins: 0, players: new Set(), bonusBet: 0, bonusSpins: 0 });
        }
        const d = byDay.get(day);
        d.bet += bet;
        d.win += win;
        d.spins += 1;
        d.players.add(row.user_id);
        if (isBonus) {
          d.bonusBet += bet;
          d.bonusSpins += 1;
        }
      }

      if (row.created_at) {
        if (!minCreated || row.created_at < minCreated) minCreated = row.created_at;
        if (!maxCreated || row.created_at > maxCreated) maxCreated = row.created_at;
      }

      const pid = row.provider_id == null ? "unknown" : String(row.provider_id);
      if (!byProvider.has(pid)) byProvider.set(pid, { bet: 0, win: 0, spins: 0, players: new Set() });
      const p = byProvider.get(pid);
      p.bet += bet;
      p.win += win;
      p.spins += 1;
      p.players.add(row.user_id);

      if (seen % 2_000_000 === 0) {
        const secs = ((Date.now() - started) / 1000).toFixed(0);
        console.log(`[build-metrics] ${seen.toLocaleString("ru-RU")} spins processed (${secs}s)`);
      }
      if (seen >= rowLimit) pipeline.destroy();
    });

    pipeline.on("end", () => finish());
    pipeline.on("close", () => finish());
    pipeline.on("error", (err) => {
      if (err.message?.includes("Controlled abort") || pipeline.destroyed) return finish();
      reject(err);
    });

    let done = false;
    function finish() {
      if (done) return;
      done = true;
      const providers = Array.from(byProvider.entries())
        .map(([providerId, v]) => ({
          provider_id: providerId,
          bet: v.bet,
          win: v.win,
          spins: v.spins,
          uniquePlayers: v.players.size,
        }))
        .sort((a, b) => (b.bet - b.win) - (a.bet - a.win));

      const gDaily = Array.from(byDay.entries())
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([date, v]) => ({
          date,
          bet: v.bet,
          win: v.win,
          spins: v.spins,
          uniquePlayers: v.players.size,
          bonusBet: v.bonusBet,
          bonusSpins: v.bonusSpins,
        }));

      resolve({
        totalBet, totalWin, spins, bonusBetSpins, bonusBetAmount,
        uniquePlayers: allPlayers.size,
        providers, gDaily, minCreated, maxCreated,
      });
    }
  });
}

const RU_MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
function formatRuPeriod(fromISO, toISO) {
  if (!fromISO || !toISO) return "";
  const [fy, fm, fd] = fromISO.split("-").map(Number);
  const [ty, tm, td] = toISO.split("-").map(Number);
  if (fy === ty && fm === tm) return `${fd}–${td} ${RU_MONTHS[tm - 1]} ${ty}`;
  if (fy === ty) return `${fd} ${RU_MONTHS[fm - 1]} – ${td} ${RU_MONTHS[tm - 1]} ${ty}`;
  return `${fd} ${RU_MONTHS[fm - 1]} ${fy} – ${td} ${RU_MONTHS[tm - 1]} ${ty}`;
}

const started = Date.now();
const payments = loadPayments();
console.log(`[build-metrics] payments.json parsed: ${payments.rowCount.toLocaleString("ru-RU")} rows`);

const games = await loadGameHistories();
console.log(`[build-metrics] game_histories.json parsed: ${games.spins.toLocaleString("ru-RU")} spins in ${((Date.now() - started) / 1000).toFixed(0)}s`);

const ggr = games.totalBet - games.totalWin;
const rtp = games.totalBet ? games.totalWin / games.totalBet : 0; // fraction, like the original (×100 at render time)

const periodFromDay = [payments.minCreated, games.minCreated].filter(Boolean).sort()[0]?.slice(0, 10) || null;
const periodToArr = [payments.maxCreated, games.maxCreated].filter(Boolean).sort();
const periodToDay = periodToArr.length ? periodToArr[periodToArr.length - 1].slice(0, 10) : null;

const metrics = {
  generatedAt: new Date().toISOString(),
  currency: CURRENCY,
  periodPayments: `${payments.minCreated?.slice(0, 10)} – ${payments.maxCreated?.slice(0, 10)}`,
  periodGames: `${games.minCreated?.slice(0, 10)} – ${games.maxCreated?.slice(0, 10)}`,
  realPeriodLabel: formatRuPeriod(periodFromDay, periodToDay),
  sourceRowCounts: { payments: payments.rowCount, gameHistories: games.spins },

  pDaily: payments.pDaily,
  gDaily: games.gDaily,

  totals: {
    depositAmount: payments.depositAmount,
    depositCount: payments.depositCount,
    withdrawAmount: payments.withdrawAmount,
    withdrawCount: payments.withdrawCount,
    bonusDepositAmount: payments.bonusDepositAmount,
    bonusDepositCount: payments.bonusDepositCount,
    fees: payments.fees,
    uniqueDepositors: payments.depositorsCount,
    uniqueBonusUsers: payments.bonusUsersCount,
    bet: games.totalBet,
    win: games.totalWin,
    ggr,
    rtp,
    spins: games.spins,
    uniquePlayers: games.uniquePlayers,
    bonusBetSpins: games.bonusBetSpins,
    bonusBetAmount: games.bonusBetAmount,
    realBetSpins: games.spins - games.bonusBetSpins,
    realBetAmount: games.totalBet - games.bonusBetAmount,
  },

  byProcessor: payments.processors,
  providers: games.providers,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(metrics), "utf8");
console.log(`[build-metrics] written to ${outPath}`);
