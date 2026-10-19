# Vissort — план унификации плееров (PLAYER-UNIFY-PLAN)

> Составлен 2026-10-19 после серии фиксов (`af6b918`, `9114a84`, `d5ac185`).
> Цель: свести к одному источнику истины дублирование `app-player-preview.js` ↔ `player-single.js`.
> Принцип: не переписывать всё, а точечно устранять **поведенческие баги** (preview ≠ prod), где расхождение влияет на клинический результат.

---

## 1. Контекст

Два плеера:
- **`player-single.js`** — прод-плеер (`player.html`, `user.html`). Работает с `PlayerState`. Обёрнут тонким слоем `player-runtime.js` (эталон паттерна: `function X(...) { return window.PlayerSingle.X(...); }`).
- **`app-player-preview.js`** — плеер-превью редактора (`admin.html`, `clinic.html`). Работает с `AppState` + локальные переменные.

10 функций дублируются. **`handleDirectionAnswer` унифицирован** (`af6b918`).

## 2. Карта расхождения (6 функций, актуально на 2026-10-19)

| Функция | preview | single | Класс | Приоритет |
|---|---|---|---|---|
| `showNextStimulus` | 667 | 87 | специфика preview | не унифицировать |
| `finishSeries` | 810 | 238 | специфика preview | не унифицировать |
| `createCellElement` | 976 | 57 | сравнение | P1 |
| `defaultCellParams` | 1000 | 43 | сравнение | P1 |
| `displayStimulus` | 11 | 21 | идентичны | не унифицировать |
| `hideStimulus` | 15 | 28 | идентичны | не унифицировать |
| `handleFindSameClick` | 932 | 286 | сравнение | P1 |
| `showDirectionComparison` | 883 | 346 | сравнение | P1 |
| `showFindSameComparison` | 897 | 332 | сравнение | P1 |
| `showFindSameComparisonInternal` | 913 | 261 | сравнение | P1 |

## 3. Специфика preview — НЕ унифицировать

**Editor-lifecycle:** `startPlayer`, `stopPlayer`, `pauseTraining`, `resumeTraining`, `togglePause`, `exitTrainingFromPause`.

**Клинические параметры превью:**
- `updateCounters` — 6 счётчиков (прод — 5).
- `finishSeries` — адаптивная острота (`currentAcuity += acuityStep`), `noAnswerSeriesStreak`, `buildBlinkReport`. Прод — `PlayerSession.showFinishedReport()`.
- `showNextStimulus` — `blinkLockShow`, `responsePhaseActive`/`responseStartTime` в хвосте, `buildDefocusFrame` 4 аргумента. `AppState`-центричный, без `PlayerCamera`/`PlayerState`. **Не унифицировать** (разведка 2026-10-19).

**Граф-узлы (только редактор):**
- `playNodesSequence`, `playStimulusNodeSeries`, `finishStimulusNodeSeries`,
- `playCompareNodeSeries`, `playNextCompareRound`, `finishCompareNodeSeries`,
- `playReadingNode`, `finishReadingNodeAuto`, `finishReadingNode`,
- `startReadingModeAuto`, `startReadingNodeTimer`, `stopReadingNodeTimer`,
- `startAutoTraining`.

## 4. Специфика прода — НЕ трогать

- `finishCompareSeries`, `processCompareAnswer`, `handleCompareAnswer`, `showNextCompareRound` — compare-режим прода.
- В preview — свой: `processComparisonAnswer` (1012), `handleCompareDirectionAnswer` (1081).

## 5. Порядок унификации

**Шаг 1 — DONE (`af6b918`):** `handleDirectionAnswer` — продвижение серии, `saveResult`, очистка таймеров, гашение анимаций.

**Шаг 2 — ЗАКРЫТО (разведка 2026-10-19): `showNextStimulus` — специфика preview.**
- `responsePhaseActive`/`responseStartTime` ставятся в хвосте (750+), flat-путь работает.
- `checkHardLimit`, `_faceLostPause`, `_waitingStable` — **неприменимы** (preview не использует `PlayerCamera`/`PlayerState`).
- `blinkLockShow`, `buildDefocusFrame` 4 аргумента — preview-специфика.
- **Вывод:** не унифицировать. Единственное реальное расхождение — `handleDirectionAnswer` — закрыто (`af6b918`).
- **Критерий готовности:** в preview то же поведение, что в prod (стимул, таймеры, `seriesStep`, `finishSeries`, `saveResult`).

**Шаг 3 — ЗАКРЫТО (2026-10-19): `displayStimulus` / `hideStimulus` — идентичны.**
**Шаг 4 — `createCellElement` + `defaultCellParams` (P1, сравнение, 976/1000 vs 57/43):**
- Сетка. Делать вместе (одна группа). Вероятно, простой перенос с сохранением сигнатуры.

**Шаг 5 — `showDirectionComparison` / `showFindSameComparison` / `showFindSameComparisonInternal` / `handleFindSameClick` (P1, группа, 883/897/913/932 vs 346/332/261/286):**
- Сравнение. Делать вместе, чтобы не разъезжались.

## 6. Правила

1. **Один коммит = одна функция** (или логическая пара, как `createCellElement` + `defaultCellParams`).
2. **Тесты после каждого** — `npx playwright test --reporter=list` (36+1).
3. **Ручная проверка** — `clinic.html` → «▶ Тест» → `user.html?test=1` → проверить режим функции (серия идёт / сравнение / чтение).
4. **Канон — `player-single.js`** (прод).
5. **Не унифицировать специфику preview** (см. §3) — оставить, только выровнять сигнатуры, если возможно.
6. **Если сигнатуры расходятся** — выровнять сначала сигнатуру, потом тело.
7. **Не подключать `player-single.js` в `admin.html`/`clinic.html`** без отдельной фазы: конфликт камер, анимаций, `setInterval`.
8. **`node --check` не ест `.tmp`** → копировать в `.check.js`.
9. **Номера строк после патча сдвигаются** → anchors (`Select-String`), не номера.

## 7. Полная унификация — отдельная фаза

Переключение preview на `PlayerState` + подключение `player-single.js` в `admin.html`/`clinic.html` — **отдельная большая фаза** (Фаза 8), с полным регрессионным прогоном. Не в этом плане.

## 8. Итог

- Дублирование: ~3000 строк, из них **реально багующих** — 6 функций (после `handleDirectionAnswer`, `displayStimulus`, `hideStimulus`).
- Приоритет: **сравнение** (`createCellElement`, `defaultCellParams`, `showDirectionComparison`, `showFindSameComparison*`, `handleFindSameClick`), затем простые (`displayStimulus`, `hideStimulus`).
- Оценка: **5–7 коммитов** по 1 функции (или паре).
- **Не трогать:** `finishSeries` (адаптивная острота), `showNextStimulus` (blinkLockShow, AppState).
