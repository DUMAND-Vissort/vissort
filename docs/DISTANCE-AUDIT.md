# Vissort — аудит системы дистанции

> Дата: 2026-10-12.
> Цель: свести три системы дистанции в единый `player-distance.js`.
> Связано: PROJECT-MAP.md §7, §15.1.3.

---

## §1. Общая картина

В проекте — 3 подсистемы контроля дистанции, работающие параллельно:

| # | Где | Назначение | Потребитель |
|---|---|---|---|
| **A** | `app.js` | Редактор (врач настраивает) | admin.html |
| **B** | `player-camera.js` | Плеер (пациент занимается) | player.html, user.html |
| **C** | `player-invalid-detection.js` | Аннулирование ответов | player.html, user.html |

B и C **взаимодействуют** через мосты в `window._recordDeviation` / `window._updateStimulusDim` / `window._isAnswerInvalid`.
A — **отдельная** (в admin.html своего плеера нет).

---

## §2. Поля состояния

### PlayerState (player-state.js)

| Поле | По умолчанию | Назначение |
|---|---|---|
| `_distControlMode` | `'return'` | `'return'` (вернуть) / `'auto'` (пересчитать) |
| `_tolNearCm` | 10 | Допуск приближения (см) |
| `_tolFarCm` | 15 | Допуск отдаления (см) |
| `_stimulusDistance` | null | Дистанция в момент показа стимула |
| `_lastDistWarnAt` | 0 | Антиспам UI-warning |
| `_distWarnArmed` | true | Флаг вооружения предупреждения |
| `_lastSeenDist` | null | Последняя валидная дистанция |
| `_waitingStable` | false | Ждём стабилизации |
| `_stableSince` | 0 | Timestamp начала стабилизации |
| `_stableBuf` | [] | Буфер стабильных кадров |
| `lastEyeDistPx` | null | IPD в пикселях |
| `curDistanceM` | null | Текущая дистанция (м) |
| `camBaseline` | null | Baseline (м) |

### app.js (локальные)

| Поле | Строка | Назначение |
|---|---|---|
| `_distanceBaseline` | 129 | Baseline редактора |
| `_distanceOutOfBoundsSince` | 130 | Timestamp выхода за пределы |

---

## §3. Функции по системам

### A — app.js

| Функция | Строка | Назначение |
|---|---|---|
| `resetDistanceTracking()` | 793 | Сброс baseline |
| `setDistanceBaselineIfNeeded()` | 800 | Установка baseline |
| `evaluateDistanceDeviation()` | 804 | Проверка отклонения |
| `recalcSizesForNewDistance()` | 1181 | Пересчёт размеров стимула |

### B — player-camera.js

| Функция | Строка | Назначение |
|---|---|---|
| `_checkHardLimit()` | 194 | Hard limit 1.0 м |
| `evaluateDistance()` | 450 | Проверка отклонения (дистанция) |
| `_recalcStimulusSize()` | — | (через callback) |

### C — player-invalid-detection.js

| Функция | Строка | Назначение |
|---|---|---|
| `_recordDeviation(pct)` | 77 | Запись отклонения в историю |
| `_isAnswerInvalid()` | 110 | Проверка валидности ответа |
| `_updateStimulusDim()` | 137 | Притухание стимула |

---

## §4. UI-элементы

| ID | Где (HTML) | Кто управляет | Назначение |
|---|---|---|---|
| `#dist-warning` | player.html, user.html | player-dist-warning.js | Мягкое предупреждение |
| `#dist-hard-banner` | player.html, user.html | player-dist-warning.js | Жёсткий баннер |
| `#cam-indicator` | player.html, user.html (шапка) | player-camera.js | Индикатор дистанции |
| `#live-distance-indicator` | admin.html | app.js | Индикатор редактора |
| `#distance-warning` | admin.html | app.js | Модалка редактора |

---

## §5. Пороги — сводка

| Что | A (editor) | B (player) | C (invalid) |
|---|---|---|---|
| Baseline | `_distanceBaseline` | `PlayerState.camBaseline` | — |
| Порог | 10–15 % | 10/15 см от baseline | 15 % |
| Hard limit | нет | 1.0 м | нет |
| Авто-пересчёт | `recalcSizesForNewDistance` | `_recalcStimulusSize` | — |
| Пауза до стабилизации | нет | `_waitingStable` + `_stableBuf` | `_waitingStable` |
| UI | `#live-distance-indicator`, `#distance-warning` | `#dist-warning`, `#dist-hard-banner` | `#cam-indicator` |

**Рассинхрон:** врач настраивает пороги в инспекторе (`_tolNearCm`, `_tolFarCm`),
тренировка реагирует по-разному в редакторе и плеере.

---

## §6. Целевая архитектура

Единый модуль `player-distance.js`:

```
window.PlayerDistance = {
    getBaseline(), setBaseline(m), resetBaseline(),
    check(curM) → { status, deviationPct, tolNearPct, tolFarPct },
    setCallbacks({ onWarn, onHardLimit, onRecalcSize }),
    effectiveTolerance()
};
```

Все три системы используют `PlayerDistance`.

---

## §7. План миграции

| Шаг | Что | Риск |
|---|---|---|
| 2.1 | Аудит (этот документ) | низкий |
| 2.2 | Создать `player-distance.js` — каркас | низкий |
| 2.3 | Миграция `player-camera.js` | средний |
| 2.4 | Миграция `player-invalid-detection.js` | средний |
| 2.5 | Миграция `app.js` | высокий |

После каждого шага — 28 Playwright-тестов.

---

## §8. Итог миграции (2026-10-12)

### Сделано

| Система | Файл | Статус |
|---|---|---|
| **B: плеер** | `player-camera.js` | ✅ мигрировано на `PlayerDistance` |
| **C: invalid detection** | `player-invalid-detection.js` | ✅ `_isAnswerInvalid` через `PlayerDistance` |
| **A: редактор** | `app.js` | ⏸ **скип — автономна** |

### Почему `app.js` не мигрирован

`app.js` (admin.html) — **полностью автономная система**:
- Не использует `PlayerState` (работает с локальными `_distanceBaseline`, `_distanceOutOfBoundsSince`).
- Не подключает `player-state.js` / `player-distance.js`.
- Свой mini-плеер для тестов сценариев.

**Миграция невозможна** без добавления `PlayerState` в admin.html — рискованно и нецелесообразно.

**Правильная архитектура:**
- **Плеер (player.html):** строгая дистанция, abort, UI-warning → `PlayerDistance`.
- **Редактор (admin.html):** тест сценария, отладочный индикатор → своя логика.

### Итог

`PlayerDistance` — **единый источник для плеера.** Дублирование между `app.js` и `player-camera.js` устранено **частично** — оставшаяся часть оправдана разными задачами.

---

*Составлено: 2026-10-12.*
*Обновлено: 2026-10-12 (после миграции Этапа 2).*
