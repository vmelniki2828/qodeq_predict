# QODEQ Analytics — React + Vite

Точный порт `QODEQ Analytics (standalone).original.bak.html` (визуальный мокап,
собранный в Design Canvas) на React + Vite: та же тёмная тема, те же шрифты
(JetBrains Mono, Space Grotesk), тот же sidebar/topbar/filterbar, все те же
**14 страниц** и те же поля — просто на нормальном стеке вместо
самодостаточного HTML-бандла.

Оригинал хранил логику страниц как строки HTML внутри одного `<script type="text/x-dc">`
(вручную найденного и распакованного из `__bundler/manifest` и `__bundler/template`
в теле бандла). Она перенесена в `src/dc/*` почти дословно — те же функции
(`fmtMoney`, `fmtPct`, `areaChart`, `panel`, `pageMainKpi`, …), тот же подход
через HTML-строки и `dangerouslySetInnerHTML` с делегированием кликов, чтобы
гарантировать пиксель-в-пиксель совпадение, а не рисковать разъехаться при
ручном переписывании на JSX.

## Структура

- `src/dc/data.js` — NAV, META, DEMO_PAGES, REAL (данные)
- `src/dc/format.js`, `charts.js`, `panel.js`, `lineage.js` — хелперы форматирования/графиков/lineage-дровера
- `src/dc/pages.js` — все 14 страниц (`pageMainKpi`, `pageNewOld`, ... `pageQuality`)
- `src/dc/App.jsx` — состояние (страница, period, projects, compare, breakdown, inspect, mappingSearch), hash-роутинг, делегирование кликов — как в оригинале
- `src/dc/styles.css` — CSS оригинала один в один (переменные `--acc`, `--bg` и т.д.)
- `public/fonts/*.woff2` — извлечённые из бандла шрифты

## Какие страницы реальные, какие демо

Как и в оригинале (см. `sidebar-note` в самом приложении и `QODEQ_metrics_report.docx`):

- **Main KPI, Bonuses, Provider, PNL / Cash Flow** — реальные данные из `payments.json` / `game_histories.json`
- **PSP** — тоже демо (вымышленные Provider Alpha/Beta/...); единственная реальная
  PSP-разбивка (оборот и число платежей по `payment_processor`) показана отдельной
  таблицей на странице **Main KPI**
- **New/Old, Retention, Deposit Lifecycle, Marketing, CRM, VIP, Sources, Mapping, Quality** — демо, как в оригинале

Единственное сознательное отличие от оригинала: там `REAL` — замороженный снимок,
здесь он пересчитывается из файлов скриптом (см. ниже), поэтому таблицы Provider/PSP
показывают все провайдеры/процессоры, а не top-12/top-10, как в зашитом снапшоте.
Числа при этом совпадают один в один там, где пересекаются.

## Данные

`game_histories.json` весит ~2.7 ГБ — грузить его целиком в браузер нельзя. Node-скрипт
`scripts/build-metrics.mjs` **потоково** (через `stream-json`, без загрузки файла в
память целиком) агрегирует оба JSON-файла в `src/data/metrics.json` в той же форме,
что и `REAL` в оригинале (`pDaily`, `gDaily`, `totals`, `byProcessor`, `providers`).

Пересчитать метрики:

```bash
npm run data:build
```

По умолчанию скрипт ищет `../payments.json` и `../game_histories.json` относительно
папки проекта. Другие пути — через `--payments`/`--games`, `--limit N` — обработать
только первые N строк `game_histories.json` (для быстрой проверки, не для прод-данных).

## Запуск

```bash
npm install
npm run data:build   # один раз, займёт ~10 минут из-за размера game_histories.json
npm run dev
```

`npm run build` собирает статику в `dist/`.
