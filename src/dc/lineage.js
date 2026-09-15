import { REAL_FORMULAS, REAL_PERIOD } from "./data.js";

const LINEAGE = {};

export function lineageFor(name) {
  if (REAL_FORMULAS[name]) {
    return [
      ["Источник", "Локальные файлы payments.json / game_histories.json", "экспорт ClickHouse, загружены в этот дашборд напрямую"],
      ["Формула", REAL_FORMULAS[name], ""],
      ["Валюта и период", "RUB, без конвертации", "период: " + REAL_PERIOD],
      ["Standard Metric", name, "реальное значение, не демо"],
    ];
  }
  return (
    LINEAGE[name] || [
      ["Источник", "Project A · Power BI · Project B · ClickHouse", "три источника объединены после mapping"],
      ["Исходное название", "разные названия в источниках", "приводится к единой Standard Metric"],
      ["Mapping", "правило для «" + name + "»", "формула согласована с финансовой командой"],
      ["Валюта и период", "USD, гранулярность Day", "период: 01–31 Aug 2026 (демо, не из загруженных файлов)"],
      ["Standard Metric", name, "используется в стандартных отчётах сервиса"],
    ]
  );
}
