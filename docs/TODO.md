# Vissort — TODO

> Статус: Фазы 0, 1, 2, 3 закрыты. Фаза 4 частично. Все P0/P1 закрыты (2026-10-11)
> Связанные: PROJECT-MAP.md (карта), PLAN.md

## ✅ ЗАКРЫТО

### Фаза 0 — фундамент

- [x] Playwright: 28 тестов + CI
- [x] schemaVersion: 2 + migrateScenario
- [x] README + ARCHITECTURE + DEPLOY

### Фаза 1 — рефакторинг player-runtime.js

- [x] player-state.js (93 переменные)
- [x] player-utils.js (rate-limit, validation, distance)
- [x] player-dist-warning.js (UI дистанции)
- [x] player-reading.js (фон чтения)
- [x] player-camera.js (камера, callbacks)
- [x] player-animation.js (анимации, callbacks)
- [x] player-invalid-detection.js (детекция наклона)
- Граф оставлен в player-runtime.js (осознанно — «дирижёр» плеера)

### Фаза 2 — чистка кода

- [x] Убрать PATCH* / BUG-* (228 вхождений)
- [x] Prettier: все файлы отформатированы, .prettierignore настроен
- [x] ESLint: 0 errors (978 → 0)
- [x] Фикс багов разметки: </form></div> в auth-модалке (3 HTML)
- [x] Фикс дубликата ключа response в app.js
- [x] Фикс getNode → gGetNode в player-runtime.js (callback onGetNode падал)

---

## 🚧 В РАБОТЕ

- [ ] Устранить дублирование app.js ↔ player-runtime.js (~3000 строк, §8 PROJECT-MAP.md)
- [ ] P2-баги (§12.3 PROJECT-MAP.md): 5 пунктов техдолга
- [ ] Техдолг (§13 PROJECT-MAP.md): 23 пункта
- [ ] Уборка корня (patch*.ps1, _test_graph.json, diff.txt)

---

## ✅ ФАЗА 3 — доработки (закрыта 2026-10-10)

- [ ] ESLint: 45 warnings — перенесено в P2 (§12.3, §13 PROJECT-MAP.md)
- [ ] ESLint: убрать временные globals (stimArea/stimDisplay/dir/direction/answer) после рефакторинга player-runtime.js
- [ ] player-runtime.js: разобрать пустые ветки чтения (строки 2472, 2481)
- [ ] H: убрать мусорный typeof direction в _logAnswer — перенесено в P2 (§12.3)
- [x] Два режима контроля дистанции (авто-пересчёт / возврат) — закрыто 09.10.2026
- [x] Reaction time → test_results (в БД) — подтверждено 2026-10-09
- [x] Порог дистанции в админке — закрыто 09.10.2026 (tolNearCm/tolFarCm в инспекторе узла)
- [x] Landmarks для моргания (EAR) — закрыто 10.10.2026 (коммит 932a702)
- [x] Порог устойчивости в редакторе — закрыто 09.10.2026 (коммит 670eb66)

### ✅ Синхронизация калибровки (закрыта 2026-10-10)

- [x] Fingerprint persist в localStorage — коммит 40f46e8
- [x] Калибровка привязана к fp|userId — коммит 78e7fb2
- [x] setCurrent передаёт userId — коммит a1964d6
- [x] Пропустить — только на сессию (sessionStorage) — коммит cbe55e3
- [x] Кнопка 📐 в player.html — коммит 899f609
- [x] Кнопка 📐 в user.html — коммит 19599c4
- [x] Убран askAboutDevice — не подставляем чужую калибровку — коммит d3bf370

---

## 🐛 ИЗВЕСТНЫЕ БАГИ

- [x] NotAllowedError при отказе от камеры — закрыто 09.10.2026 (коммит 8af761b)

---

## ✅ P0/P1 закрыты (2026-10-11)

См. PROJECT-MAP.md §16 «История исправлений».

- [x] P0 #1: handleDirectionAnswer — продвижение серии (34f8659)
- [x] P0 #2: focalLengthPx — правильный ключ LS (f8a82a9)
- [x] P0 #3: showAuthModal — удалён мёртвый код (9475205)
- [x] P1 #1: CSP admin.html — frame-ancestors (303a093)
- [x] P1 #2: SW precache — 16 новых URL (6a7cdf1)
- [x] P1 #3: Sentry-регекспы — удалены (47c8732)
- [x] P1 #4: deleteNode — точная проверка границ id (b3eaf99)
- [x] P1 #5: showFindSame — не подтверждён (бага нет)
- [x] P1 #6: physiological — режим добавлен в player-reading.js (4d0095a)
- [x] P1 #7: btn-response/btn-resp — унифицированы (24e42c0)
- [x] Refactor: createCellElement fallback = -1 (a0080d7)
- [x] PROJECT-MAP.md — 16 разделов + Прил. А (04db57d)
- [x] ARCHITECTURE-DIAGRAMS.md — 4 mermaid-диаграммы (39435a8)

---

## 📋 ФАЗА 4 — безопасность и надёжность

- [x] RLS-аудит Supabase — §11.3 (FIXED 2026-10-12: docs/RLS-AUDIT.md, миграция doctor/developer)
- [ ] Логирование Edge Functions — §11.4
- [x] Бэкап БД (cron + Storage) — §11.5 (FIXED 2026-10-12: GitHub Actions + pg_dump 17)
- [x] Убрать eremeevap@gmail.com из ADMIN_EMAILS в app.js — §11.1 (FIXED 08d4c0f)
- [x] Ротировать SUPABASE_ANON_KEY — §11.2 (FIXED 2026-10-11: vissort-env.js, коммиты c7ebfee…f61da92)

---

## 📋 ФАЗА 5 — производительность

- [ ] Аудит app.js
- [ ] Кэш SW — авто-bump версии
- [ ] Sentry performance (tracesSampleRate 0.1)

---

## 📋 ФАЗА 6 — клинический редактор

- [ ] Модель данных (organizations, methods, courses, audit_log)
- [ ] Библиотека методик (5 базовых)
- [ ] Интерфейс врача
- [ ] Интерфейс пациента
- [ ] Версионирование методик
- [ ] Аудит + PDF
- [ ] Мультитенантность

---

## 📋 ФАЗА 6.5 — новые упражнения

- [ ] **Упражнение «Чёткий / нечёткий стимул»** (blur-тренировка аккомодации)
      - Механика: стимул плавно размывается и возвращается к резкости по циклу
      - Цель: снятие спазма аккомодации через тренировку фокусировки
      - Параметры: степень размытия (blur px), длительность цикла, режим (градиент / переключение)
      - Тип узла: TBD (новый BLUR или расширение стимульного узла)
      - Ответ пациента: TBD (кнопка «вижу» / направление / молчаливое наблюдение)
      - Связь: новый узел в редакторе + логика в player-animation.js
      - Статус: идея, ТЗ не проработано

---

## 🚧 §15.1.2 — рефакторинг player-runtime.js (в работе, 2026-10-14)

**Цель:** разбить `player-runtime.js` (было 3002 строки) на модули.

### ✅ Закрыто (2026-10-14)

- [x] **ч.3/7** — `player-reading-mode.js` (254 строки)
- [x] **ч.4/7** — `player-auth.js` (254 строки)
- [x] **ч.5/7** — `player-scenarios.js` (~190 строк)
- [x] **ч.6/7** — `player-graph.js` (803 строки) — **100%** ✅
- [x] **ч.7/7 (частично)** — `player-session.js` (328 строк) — **PlayerSession завершён** ✅
      - `startPlayer`, `stopPlayer`, `pauseTraining`, `resumeTraining`, `togglePause`
      - `showFinishedReport`, `saveResult`, `scheduleVoiceCountdown`

**Прогресс:** `player-runtime.js` — 3002 → **1514** строк (**−49.6%**).

**Модули:**
- `player-reading-mode.js` — 254
- `player-auth.js` — 254
- `player-scenarios.js` — ~190
- `player-graph.js` — 803
- `player-session.js` — 328

### 🚧 Остаток — §15.1.2 ч.7/7 (`player-single.js`, ~2 ч)

**Что:** вынести одиночный режим (~500 строк) из `player-runtime.js` в `player-single.js`.

**Что вынести:**
- `showNextStimulus` (~150 строк)
- `finishSeries`
- `handleDirectionAnswer`, `handleCompareAnswer`
- `showNextCompareRound`, `showDirectionComparison`, `showFindSameComparison`, `showFindSameComparisonInternal`, `handleFindSameClick`
- `createCellElement`, `defaultCellParams`
- `processCompareAnswer`, `finishCompareSeries`

**Целевой результат:**
- `player-runtime.js`: ~1000 строк (bootstrap + init + обработчики + утилиты + ~50 тонких обёрток).
- `player-single.js`: ~500.

**Риск:** высокий (циклические зависимости между single ↔ stimulus ↔ session).

### Что НЕ выносить

- **`player-stimulus.js`** — не делать. 19 «функций» — 17 тонких обёрток над `PlayerAnimation.*`, 2 реальные (`displayStimulus`/`hideStimulus`) — вместе ~26 строк.
- **`player-camera-ui.js`** — не делать. 7 обёрток над `PlayerCamera.*`, ~21 строка.
- **~50 тонких обёрток** — оставить в runtime. Не критично.
---

## ⚠️ Уроки сессии 2026-10-14

1. **Коммит после каждого под-шага** — `git checkout` снесёт всё незакоммиченное.
2. **`$('...')` в PowerShell-патчах — экранировать** как `` `$('...') ``.
3. **Проверки границ (idx) перед записью** — если сдвиг, файл не портится.
4. **`pull --rebase` при отказе push** (bump-бот каждые 1–2 мин).
5. **При патче `};` — пропускать только заменяемую строку**, не блок.
6. **Тонкие обёртки — не модули.** Если функция = одна строка `return window.X.y()`, не выносить в отдельный модуль. Оставлять в runtime или удалять отдельной задачей.

_Обновлять после каждой сессии._
