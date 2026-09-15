import { useCallback, useEffect, useMemo, useState } from "react";
import "./styles.css";
import { NAV, META, DEMO_PAGES, PERIODS, PROJECTS, BREAKDOWNS, REAL_PERIOD } from "./data.js";
import { fmtMoney, fmtInt, fmtPct, delta } from "./format.js";
import { PAGES, KPI_MAP } from "./pages.js";
import { lineageFor } from "./lineage.js";

const ALL_ROUTES = NAV.reduce((a, g) => a.concat(g[1].map((i) => i[0])), []);

function parseHash() {
  const raw = (location.hash || "").replace(/^#\/?/, "");
  const parts = raw.split("?");
  const q = {};
  (parts[1] || "").split("&").filter(Boolean).forEach((kv) => {
    const p = kv.split("=");
    q[p[0]] = decodeURIComponent(p[1] || "");
  });
  return {
    page: parts[0],
    period: PERIODS.indexOf(q.period) >= 0 ? q.period : null,
    projects: q.projects ? q.projects.split(",").filter((p) => PROJECTS.indexOf(p) >= 0) : null,
    compare: q.compare === undefined ? undefined : q.compare === "1",
    breakdown: BREAKDOWNS.indexOf(q.breakdown) >= 0 ? q.breakdown : null,
  };
}

export default function App({ accent = "#E8B23A", startPage = "main-kpi" }) {
  const [page, setPage] = useState(() => {
    const p = parseHash().page;
    if (ALL_ROUTES.indexOf(p) >= 0) return p;
    return ALL_ROUTES.indexOf(startPage) >= 0 ? startPage : "main-kpi";
  });
  const [period, setPeriod] = useState(() => parseHash().period || "Day");
  const [projects, setProjects] = useState(() => parseHash().projects || PROJECTS.slice());
  const [compare, setCompare] = useState(() => {
    const c = parseHash().compare;
    return c === undefined ? true : c;
  });
  const [breakdown, setBreakdown] = useState(() => parseHash().breakdown || "Project");
  const [inspect, setInspect] = useState(null);
  const [mappingSearch, setMappingSearch] = useState("");

  const go = useCallback((nextPage) => {
    if (ALL_ROUTES.indexOf(nextPage) < 0) return;
    setPage(nextPage);
    setInspect(null);
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    function onHash() {
      const p = parseHash();
      if (p.page && ALL_ROUTES.indexOf(p.page) >= 0 && p.page !== page) {
        setPage(p.page);
        setInspect(null);
        window.scrollTo(0, 0);
      }
    }
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [page]);

  useEffect(() => {
    const q = "period=" + period + "&projects=" + projects.join(",") + "&compare=" + (compare ? "1" : "0") + "&breakdown=" + encodeURIComponent(breakdown);
    const url = "#/" + page + "?" + q;
    if (location.hash !== url) history.replaceState(null, "", url);
    const m = META[page];
    if (m) document.title = "QODEQ Analytics — " + m[0];
  }, [page, period, projects, compare, breakdown]);

  const effectivePeriod = useCallback(() => {
    if (page === "pnl") return "Month";
    if (page === "main-kpi") return period === "Day" || period === "Week" ? period : "Week";
    return period;
  }, [page, period]);

  const onClick = useCallback(
    (e) => {
      const t = e.target;
      const nav = t.closest("[data-route]");
      if (nav) {
        e.preventDefault();
        go(nav.getAttribute("data-route"));
        return;
      }
      const per = t.closest("[data-period]");
      if (per) {
        if (per.disabled) return;
        setPeriod(per.getAttribute("data-period"));
        return;
      }
      const prj = t.closest("[data-project]");
      if (prj) {
        const name = prj.getAttribute("data-project");
        if (name === "ALL") {
          setProjects(PROJECTS.slice());
        } else {
          setProjects((prev) => {
            let next = prev.indexOf(name) >= 0 ? prev.filter((p) => p !== name) : prev.concat([name]);
            if (!next.length) next = [name];
            return next;
          });
        }
        return;
      }
      if (t.closest("[data-compare]")) {
        setCompare((c) => !c);
        return;
      }
      const m = t.closest("[data-metric]");
      if (m) {
        setInspect(m.getAttribute("data-metric"));
        return;
      }
      if (t.closest("[data-close-drawer]") || t.classList.contains("drawer-scrim")) {
        setInspect(null);
      }
    },
    [go],
  );

  const onInput = useCallback((e) => {
    if (e.target.id === "mappingSearch") setMappingSearch(e.target.value);
  }, []);

  const onChange = useCallback((e) => {
    if (e.target.id === "breakdown") setBreakdown(e.target.value);
  }, []);

  const sidebarHtml = useMemo(
    () =>
      '<aside class="sidebar"><div class="brand"><div class="brand-mark"></div><div class="brand-copy"><div class="brand-title">QODEQ.</div><div class="brand-sub">Единое окно аналитики</div></div></div>' +
      NAV.map(
        (g) =>
          '<div class="nav-group"><div class="nav-label eyebrow">' + g[0] + '</div><nav class="nav">' +
          g[1]
            .map(
              (i) =>
                '<a href="#/' + i[0] + '" data-route="' + i[0] + '" class="' + (page === i[0] ? "active" : "") + '"><span class="nav-icon">' + i[1] + '</span><span>' + i[2] + "</span>" +
                (i[0] === "quality" ? '<span class="nav-flag" title="3 проблемы"></span>' : "") + "</a>",
            )
            .join("") +
          "</nav></div>",
      ).join("") +
      '<div class="sidebar-note">Main KPI, Provider, Bonuses и PNL — реальные данные из payments.json / game_histories.json, период ' + REAL_PERIOD + ", валюта RUB. Остальные разделы — демо для иллюстрации возможностей.</div></aside>",
    [page],
  );

  const filterbarHtml = useMemo(() => {
    const monthOnly = page === "pnl";
    const dayWeekOnly = page === "main-kpi";
    const eff = effectivePeriod();
    const periodAllowed = (p) => (monthOnly ? p === "Month" : dayWeekOnly ? p === "Day" || p === "Week" : true);
    return (
      '<div class="filterbar">' +
      '<div class="seg">' +
      PERIODS.map(
        (p) =>
          '<button data-period="' + p + '" class="' + (eff === p ? "on" : "") + '"' + (!periodAllowed(p) ? ' disabled style="opacity:.35" title="В загруженных файлах нет данных с такой гранулярностью"' : "") + ">" + p + "</button>",
      ).join("") +
      "</div>" +
      '<div class="filter-sep"></div>' +
      '<div class="chipset"><button class="chip ' + (projects.length === PROJECTS.length ? "on" : "") + '" data-project="ALL">Все проекты</button>' +
      PROJECTS.map((p) => '<button class="chip ' + (projects.indexOf(p) >= 0 ? "on" : "") + '" data-project="' + p + '">' + p + "</button>").join("") +
      "</div>" +
      '<div class="filter-sep"></div>' +
      '<select id="breakdown" class="field">' + BREAKDOWNS.map((b) => "<option " + (b === breakdown ? "selected" : "") + ">" + b + "</option>").join("") + "</select>" +
      '<button class="chip ' + (compare ? "on" : "") + '" data-compare="1">Сравнить с прошлым периодом</button>' +
      '<div style="flex:1"></div>' +
      (monthOnly ? '<span class="tag warm">Только Month</span>' : "") +
      (dayWeekOnly ? '<span class="tag warm" title="В файлах нет почасовых и месячных данных">Day / Week из файла</span>' : "") +
      '<button class="ghost-button">Экспорт</button></div>'
    );
  }, [page, projects, compare, breakdown, effectivePeriod]);

  const topbarHtml = useMemo(() => {
    const m = META[page];
    const idx = ALL_ROUTES.indexOf(page) + 1;
    const isDemo = DEMO_PAGES.indexOf(page) >= 0;
    return (
      '<header class="topbar"><div class="topbar-inner"><div><div class="eyebrow">' + ("0" + idx).slice(-2) + " / " + m[0].toUpperCase() + "</div>" +
      '<div class="page-title">' + m[0] + (isDemo ? ' <span class="tag warm" style="font-size:11px;vertical-align:middle">ДЕМО-ДАННЫЕ</span>' : ' <span class="tag gold" style="font-size:11px;vertical-align:middle">РЕАЛЬНЫЕ ДАННЫЕ</span>') +
      '</div><div class="page-caption">' + m[1] + (isDemo ? " <strong>В загруженных файлах (payments.json, game_histories.json) нет данных для этого раздела — цифры иллюстративные.</strong>" : "") + "</div></div>" +
      '<div class="top-actions"><span class="tag gold">Обновлено 04:15</span><button class="ghost-button">Настроить отчёт</button><button class="primary-button">Сохранить вид</button></div></div>' +
      filterbarHtml +
      "</header>"
    );
  }, [page, filterbarHtml]);

  const drawerHtml = useMemo(() => {
    if (!inspect) return "";
    const name = inspect;
    const k = KPI_MAP[name];
    const steps = lineageFor(name);
    const val = k ? (k[3] === "money" ? fmtMoney(k[1]) : k[3] === "int" ? fmtInt(k[1]) : fmtPct(k[1])) : "—";
    return (
      '<div class="drawer-scrim"></div><aside class="drawer"><button class="drawer-close" data-close-drawer="1">×</button>' +
      '<div class="eyebrow">Проверка цифры</div><h3>' + name + "</h3>" +
      '<div style="display:flex;align-items:flex-end;gap:16px;margin-top:22px"><div style="font:500 34px/1 \'Space Grotesk\',sans-serif;letter-spacing:-.03em;color:#F5F2EC" class="num">' + val + "</div>" +
      (k ? '<div style="padding-bottom:6px">' + delta(k[1], k[2], name === "Bonus / GGR") + " vs прошлый период</div>" : "") +
      "</div>" +
      '<div class="lineage">' + steps.map((st) => '<div class="lineage-step"><div class="lineage-dot"></div><div><strong>' + st[0] + "</strong><small>" + st[1] + "</small>" + (st[2] ? "<code>" + st[2] + "</code>" : "") + "</div></div>").join("") + "</div>" +
      '<div class="notice section-gap">Цифра рассчитана по утверждённой формуле. AI-слой не участвует в расчёте базовых финансовых метрик.</div></aside>'
    );
  }, [inspect]);

  const contentHtml = useMemo(() => {
    const render = PAGES[page] || PAGES["main-kpi"];
    return render({ effectivePeriod, compare, breakdown, mappingSearch });
  }, [page, effectivePeriod, compare, breakdown, mappingSearch]);

  const html = '<div class="app-shell">' + sidebarHtml + '<main class="main">' + topbarHtml + '<div class="content">' + contentHtml + "</div></main></div>" + drawerHtml;

  return (
    <div style={{ minHeight: "100vh", background: "#0A0A09", color: "#DCD9D2", fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
      <div
        style={{ "--acc": accent, minHeight: "100vh" }}
        onClick={onClick}
        onInput={onInput}
        onChange={onChange}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
