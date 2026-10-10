# Vissort — TODO

> Статус: Фазы 0, 1, 2, 3 закрыты (2026-10-10)
> Связанные: PLAN.md (карта), HANDOFF.md (контекст)

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

- [ ] Устранить дублирование app.js ↔ player-runtime.js
- [ ] Уборка корня (patch*.ps1, _test_graph.json, diff.txt)

---

## ✅ ФАЗА 3 — доработки (закрыта 2026-10-10)

- [ ] ESLint: устранить 45 warnings (43 no-unused-vars межфайловых глобалов + 2 no-empty)
- [ ] ESLint: убрать временные globals (stimArea/stimDisplay/dir/direction/answer) после рефакторинга player-runtime.js
- [ ] player-runtime.js: разобрать пустые ветки чтения (строки 2472, 2481)
- [ ] H: убрать мусорный typeof direction в _logAnswer (4 места)
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

## 📋 ФАЗА 4 — безопасность и надёжность

- [ ] RLS-аудит Supabase
- [ ] Логирование Edge Functions
- [ ] Бэкап БД (cron + Storage)

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

_Обновлять после каждой сессии._
