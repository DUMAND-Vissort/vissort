# Vissort — TODO

> Статус: Фазы 0, 1, 2 закрыты (2026-10-06)
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

---

## 🚧 В РАБОТЕ (остаток Фазы 2)

- [ ] Устранить дублирование app.js ↔ player-runtime.js
- [ ] Prettier + ESLint clean (0 warnings)
- [ ] Уборка корня (patch*.ps1, _test_graph.json, diff.txt)

---

## 📋 ФАЗА 3 — доработки

- [ ] Два режима контроля дистанции («авто-пересчёт» / «возврат»)
- [ ] Reaction time → test_results (в БД)
- [ ] Порог дистанции в админке (UI)
- [ ] Landmarks вернуть для моргания
- [ ] Порог устойчивости в редакторе

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

_Обновлять после каждой сессии._
