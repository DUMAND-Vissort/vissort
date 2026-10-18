# Vissort — передача контекста в новый чат

> Как использовать: скопируй **всё содержимое** этого файла в первое сообщение нового чата.
> Всё, что нужно ассистенту для продолжения работы без потери смысла.

---

# Контекст проекта Vissort
## Что такое Vissort

Веб-платформа для тренировки зрительного анализатора. Работает в браузере. Три задачи:
- Повышение остроты зрения
- Снятие спазма аккомодации
- Снятие астенопии

**История:** преемник ColorEyesKeeper — настольной программы.

**Три сегмента клиентов:**
- B2B клиники — врач назначает, пациент занимается, клиника платит
- B2B частные врачи — ведут практику, продают домашний курс
- B2C индивидуалы — родители, взрослые, прямая подписка

## Технический стек

**Frontend:** Vanilla JS, HTML, CSS. Service Worker для офлайна. Web Speech API для голоса.
**Backend:** Supabase (PostgreSQL + Auth + Edge Functions на Deno).
**AI:** DeepSeek через Edge Function (rate-limit 20/час на user_id).
**Камера:** face-api.js (TinyFaceDetector, inputSize 320, scoreThreshold 0.25).
**Sentry:** через Supabase-прокси.

**Supabase project:** hzvypwdpdhsjzaclxmbm.supabase.co
**Прод:** vissort.com
**Репозиторий:** github.com/DUMAND-Vissort/vissort (приватный)
**Локальный стенд:** D:\PROEKT\vissort (раздаётся через `npx serve -l 5500`)

## Три HTML-файла — что для чего

| Файл | Для кого | Что внутри |
|---|---|---|
| `admin.html` | врач / методист | редактор сценариев, граф узлов |
| `user.html` | пациент (внешняя) | вход, выбор сценария, тренировка, история |
| `player.html` | разработчик (внутренняя) | быстрая проверка, домен-лок, ?test=1 |

**Ключевое:** `user.html` и `player.html` почти идентичны. Разница только в entry-script и CSP. Вся логика — в модулях `player-*.js` (bootstrap в `player-runtime.js`, режимы в `player-single.js`/`player-graph.js`/`player-reading-mode.js`).

## Файлы проекта

| Файл | Назначение |
|---|---|
| `admin.html` | Редактор сценариев |
| `user.html` | Плеер для пациентов |
| `player.html` | Плеер для разработки |
| `user.js` / `player.js` | Конфиги entry-point |
| `app.js` | Логика редактора: bootstrap + init + auth + templates + сохранение (~3903 строк) |
| `player-runtime.js` | Bootstrap плеера: init, event-хендлеры, обёртки (899 строк) |
| `player-single.js` | Плоский и сравнительный режимы: showNextStimulus, finishSeries, handleDirectionAnswer, handleCompareAnswer, displayStimulus, hideStimulus (608 строк) |
| `player-graph.js` | Плеер графа (803 строки) |
| `player-session.js` | startPlayer/stopPlayer/pauseTraining/saveResult (328 строк) |
| `player-reading-mode.js` | Режим чтения (254 строки) |
| `player-auth.js` | Auth-логика плеера (254 строки) |
| `player-scenarios.js` | Загрузка сценариев (~190 строк) |
| `app-state.js` | Состояние app.js (редактор): 90 переменных + шим `window.AppState` |
| `app-player-preview.js` | Плеер-превью редактора: 34 функции (startPlayer, playStimulusNodeSeries, playCompareNodeSeries, handleDirectionAnswer, ...) 1277 строк |
| `app-editor.js` | Редактор графа: узлы, связи, drag/resize, меню связи (1073 строки) |
| `app-inspector.js` | Инспектор узлов: стимул, чтение, логика, сравнение (926 строк) |
| `app-generator.js` | Генератор режимов: UI, params, PHYSIOLOGICAL_PHASES, build* (875 строк) |
| `data-layer.js` | Прослойка UI ↔ Supabase (41 KB) |
| `vissort-env.js` | Единый источник env: SUPABASE_URL, ANON_KEY (~0.8 KB) |
| `vissort-core.js` | Общие утилиты (14 KB) |
| `voice.js` | Голосовое сопровождение (26 KB) |
| `sw.js` | Service Worker (9 KB) |
| `vissort-onboarding.js` | Мастер калибровки (~14 KB) |
| `vissort-device.js` | Fingerprint устройства + калибровка (~8 KB) |
| `vissort-env.js` | Единый источник env: SUPABASE_URL, ANON_KEY, RELEASE |
| `vissort-logger.js` | VLog — единый логгер (no-op в проде). Загружается ПЕРВЫМ |
| `vissort-dialog.js` | VissortDialog — единая модалка (alert/confirm/prompt) |
| `supabase/functions/generate-scenario/` | Edge Function: DeepSeek-прокси |
| `supabase/functions/sentry-proxy/` | Edge Function: Sentry-туннель |
| `.github/workflows/test.yml` | CI: 28 Playwright-тестов |
| `.github/workflows/backup-db.yml` | CI: ежедневный pg_dump БД |
| `docs/RLS-AUDIT.md` | Аудит RLS: матрица ролей × таблиц |
| `docs/BACKUP.md` | Автобэкап: инструкция + восстановление |
| `docs/VISION-ROADMAP.md` | **Видение и план развития (позиционирование, монетизация, партнёр, дорожная карта)** |
| `docs/NOTES.md` | **Журнал решений** — почему так, а не иначе |
| `player-state.js` | Единый объект состояния плеера |
| `player-camera.js` | Камера, детекция лица, EAR (моргание), дистанция |
| `player-animation.js` | Анимации стимула |
| `player-invalid-detection.js` | Детекция наклона, аннулирование ответов |
| `player-reading.js` | Фон чтения |
| `player-utils.js` | rate-limit, validation, distance |
| `player-dist-warning.js` | UI-предупреждения о дистанции |
| `tests/` | Playwright-тесты (28) |
| `docs/PROJECT-MAP.md` | **Полная карта архитектуры (16 разделов + Прил. А, 92 KB)** |
| `docs/ARCHITECTURE-DIAGRAMS.md` | **4 mermaid-диаграммы архитектуры** |
| `docs/ARCHITECTURE.md` | ⚠ Устарел (05.10, до Фазы 1) |
| `docs/HANDOFF.md` | ⚠ Устарел (10.10, дубль HOW-TO) |

## Что работает

### Продукт
- Редактор сценариев: граф с 5 типами узлов
- Плеер: браузер, офлайн-first
- Камера: face-api, IPD-калибровка, дистанция
- Устойчивость распознавания: 3 состояния (нет / нестабильно / устойчиво)
- Hard limit дистанции 1.0 м + баннер
- Превью камеры и бейдж лица в overlay
- Rate-limit AI-генератора (20/час на user_id)
- Офлайн-режим (SW + IndexedDB + syncQueue)
- Калибровка: 2 шага (PPI + камера), localStorage + device_calibrations
- Синхронизация калибровки: по fingerprint+userId, с облаком
- Моргание: детекция через EAR (Eye Aspect Ratio) на landmarks
- Кнопка 📐 в шапке — повторная калибровка
- Роли: admin, developer, doctor, patient (profiles.role)
- VissortDialog — единая модалка (alert/confirm/prompt)
- VissortLog — единый логгер (no-op в проде, ?debug=1 для отладки)
- VissortEnv — единый env (URL, ANON_KEY, RELEASE)
### Инфраструктура
- Supabase: Auth, RLS (4 роли: admin/developer/doctor/patient), Edge Functions, миграции
- RLS: 8 таблиц с RLS, 17 политик, doctor_patients, is_my_patient(), is_admin/is_developer
- Edge Functions: CORS whitelist, retry на 429/5xx, timeout 60s, Sentry-хук, SENTRY_TUNNEL_KEY
- Автобэкап: GitHub Actions, pg_dump 17, артефакты 90 дней (2026-10-12)
- Sentry через прокси (tunnel key)
- GitHub Actions CI: 28 Playwright-тестов + ежедневный backup-db
- schemaVersion: 2 в сценариях + migrateScenario
- PROJECT-MAP.md — полная карта (16 разделов)
- ARCHITECTURE-DIAGRAMS.md — 4 mermaid-диаграммы
## Что в работе

### Фазы 0, 1, 2 — ЗАКРЫТЫ

- Фаза 0: Playwright + CI (28 тестов), schemaVersion, документация
- Фаза 1: 7 модулей, player-runtime.js 3560 → ~2700 строк
- Фаза 2: 228 PATCH/BUG комментариев заменены, Prettier, ESLint 0 errors

### Фаза 3 — доработки (ЗАКРЫТА 2026-10-10)

Все 5 задач + NotAllowedError — закрыты. См. TODO.md.

### Фаза 4 — RLS, логирование, бэкап ✅ ЗАКРЫТА (2026-10-12)

- ✅ §11.1 ADMIN_EMAILS — закрыто 08d4c0f
- ✅ §11.2 Единый env (vissort-env.js) — закрыто c7ebfee…518ae11
- ✅ §11.3 RLS + роли doctor/developer (docs/RLS-AUDIT.md)
- ✅ §11.4 Edge Functions: CORS whitelist, retry, timeout, Sentry key
- ✅ §11.5 Автобэкап (backup-db.yml, первый запуск 2026-10-12)

### Баг-фиксы после Фазы 4 (2026-10-11)

- 3 P0 (focalLengthPx, handleDirectionAnswer, showAuthModal)
- 6 P1 (CSP, SW precache, Sentry-регекспы, deleteNode, physiological, btn-*)
- 1 refactor (createCellElement fallback)
- См. PROJECT-MAP.md §16 «История исправлений»
### Синхронизация калибровки (не в TODO, добавлено 10.10.2026)

- Калибровка привязана к `fp|userId`
- Fingerprint persist в localStorage
- Синхронизация с облаком через `device_calibrations`
- «Пропустить» — только на сессию (sessionStorage)
- Кнопка 📐 для повторной калибровки
- Убран `askAboutDevice` — не подставляем чужую калибровку

## Следующие задачи (обновлено 2026-10-15)

**Закрыто 2026-10-15:**
- §15.1.2 ч.7/7 — player-runtime.js 3002 → 899 строк (−70%)
  - Модули: player-reading-mode (254), player-auth (254), player-scenarios (~190),
    player-graph (803), player-session (328), player-single (608)

**Остаток:**
- §13.3.3 ✅ закрыто (2026-10-15)
- Prettier для docs/*.md (опционально)

### Фаза 5 — рефакторинг app.js (закрыта, 2026-10-18)

**Цель:** разбить `app.js` на модули по 300–1000 строк. **Достигнуто:** 7900 → **1846** (−77%).

**Закрыто:**
- §A1 — `app-state.js` (115 aliases).
- §A2-v2 — `app-player-preview.js` (1278 строк).
- §A2-v3 — `app-editor.js` (1100 строк).
- §A2-v4 — `app-inspector.js` (926 строк).
- §A2-v5 — `app-generator.js` (884 строки).
- §A2-v6 — `app-scenarios.js` (811 строк, 25 функций).
- §A2-v7 — `app-blink-camera.js` (572 строки, 24 функции).
- §A2-v9 — `app-auth.js` (259 строк, 15 функций).
- §A2-v8 — `app-utils.js` (681 строка, 29 функций).

**Текущее состояние:**
- HEAD: `cae7e5c`
- `app.js`: **1846 строк** (было 7900 на старте Фазы 5, −77%).
- Тесты: 28 passed.

**Отложено:**
- §A2-v9b — `init()` + 32 DOM → `app-init.js` — высокий риск (32 моста, тесты не покрывают `init`). app.js ~1846 — приемлемо.

**Правила:**
- Границы регионов — по функциям (`^function|^async function`), а не по комментариям-заголовкам.
- **Аудит констант при выносе.** §A1 (`818ee24`) потерял 7 констант (`BLINK_*`, `realIPD_MM`, `MAX_DISTANCE_LOG`) — проявились при §A2-v7.
- **Проверять, что функции не вынесены за `})();`.** §A2-v5 (`app-generator.js`) — 4 функции (`renderGridPreview`, `generateCellParamsFields`, `collectCompareParams`, `buildModeParamsFromUI`) оказались вне IIFE, `state` не видна. Проявилось при §A2-v8. Фикс: `const state = window.AppState;` в начало каждой.

**Фаза 6:** клинический редактор (6 недель)

## Принципы работы

1. Прод не ломаем. Каждое изменение — отдельный коммит.
2. После правок — прогон тестов: `npx playwright test --reporter=list`.
3. Никаких новых PATCH* комментариев.
4. Один коммит = одна задача.
5. Перед push — `git status` и `git diff` глазами.
6. Кириллица: UTF-8 без BOM.
7. Если файл заблокирован — работать через `.tmp` + `Move-Item -Force`.
8. **Порядок загрузки: vissort-logger.js → vissort-env.js → vissort-dialog.js → vissort-core.js → модули.** Все используют VLog. Если logger загружен позже — ReferenceError во всех файлах.

## Формат работы с ассистентом

**Что ассистент делает:**
- Даёт PowerShell-команды для правок (однострочные или блоки).
- Пишет SQL-миграции, HTML, CSS, документацию.
- Диагностирует ошибки по выводу команд.

**Что НЕ делает:**
- Не имеет доступа к интернету, не запускает код, не видит файлы.
- Не создаёт файлы сам — только через команды пользователя.
- Не работает с чувствительными ключами.

**Что нужно от пользователя:**
- Точные выводы команд (не пересказ).
- Скриншоты, если проблема визуальная.
- Если патч — сказать, применился или нет, показать `node --check` и `Select-String`.
- Если ошибка — первый красный текст из Console.

**Стиль:**
- Максимальная плотность.
- Одна мысль — одна строка.
- Один путь, а не три.

**Формат ответа:**
- Заголовок → патч / команда → проверка → что скинуть.
- Без преамбул.

## Команды для проверки состояния

**Git:**
git log --oneline -10
git status
git -C D:\PROEKT\vissort diff --stat

**Тесты:**
npx playwright test --reporter=list

**Синтаксис:**
node --check D:\PROEKT\vissort\app.js
node --check D:\PROEKT\vissort\vissort-env.js
node --check D:\PROEKT\vissort\player-runtime.js
node --check D:\PROEKT\vissort\vissort-onboarding.js
node --check D:\PROEKT\vissort\vissort-device.js

**Локальный сервер:**
npx --yes serve -l 5500
Затем: http://localhost:5500/player.html или http://localhost:5500/user.html

## Антипаттерны

**Технически:**
- Не загружать vissort-logger.js после vissort-env.js — VLog ещё не определён, весь bootstrap падает.
- Не рефакторить player-runtime.js без прогона тестов после каждого шага.
- Не менять структуру сценариев без schemaVersion.
- Не патчить admin.html через PowerShell here-string (кириллица ломается).
- Не пушить в прод в пятницу вечером.
- Не удалять PATCH* комментарии без замены на осмысленные.
- Не вызывать Set-Content на файл без .tmp + Move-Item обхода.
- Не менять RLS-политики без теста утечки (anon-ключ не должен читать чужие данные).
- Не редактировать Edge Functions без npx supabase functions deploy — код в репо не равен прод.
**Продуктово:**
- Не обещать излечения.
- Не делать публичные рейтинги.
- Не продавать клиникам до пилота.
- Не идти к федеральным клиникам без медизделия.

**В работе с ассистентом:**
- Не просить сделать всё сразу.
- Не пересказывать контекст — он уже здесь.
- Не молчать, если что-то не работает — показать ошибку.

---

*Дата создания: 2026-10-05*
*Обновлено: 2026-10-17 (§A2-v5 закрыт: app.js 4693 → 3903, app-generator.js 875 строк)*
*Копировать: в первое сообщение нового чата.*
