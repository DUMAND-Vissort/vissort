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

**Ключевое:** `user.html` и `player.html` почти идентичны. Разница только в entry-script и CSP. Вся логика — в `player-runtime.js`.

## Файлы проекта

| Файл | Назначение |
|---|---|
| `admin.html` | Редактор сценариев |
| `user.html` | Плеер для пациентов |
| `player.html` | Плеер для разработки |
| `user.js` / `player.js` | Конфиги entry-point |
| `app.js` | Логика редактора + auth (366 KB) |
| `player-runtime.js` | Логика плеера (145 KB) |
| `data-layer.js` | Прослойка UI ↔ Supabase (41 KB) |
| `vissort-env.js` | Единый источник env: SUPABASE_URL, ANON_KEY (~0.8 KB) |
| `vissort-core.js` | Общие утилиты (14 KB) |
| `voice.js` | Голосовое сопровождение (26 KB) |
| `sw.js` | Service Worker (9 KB) |
| `vissort-onboarding.js` | Мастер калибровки (~14 KB) |
| `vissort-device.js` | Fingerprint устройства + калибровка (~8 KB) |
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
- Калибровка: 2 шага (PPI + камера), localStorage + `device_calibrations` в БД
- Синхронизация калибровки: по `fingerprint+userId`, с облаком
- Моргание: детекция через EAR (Eye Aspect Ratio) на landmarks
- Кнопка 📐 в шапке `player.html` и `user.html` — повторная калибровка

### Инфраструктура
- Supabase: Auth, RLS, Edge Functions, миграции
- Sentry через прокси
- GitHub Actions CI: 28 Playwright-тестов на каждый push
- schemaVersion: 2 в сценариях + migrateScenario
- PROJECT-MAP.md — полная карта архитектуры (16 разделов)
- ARCHITECTURE-DIAGRAMS.md — 4 mermaid-диаграммы

## Что в работе

### Фазы 0, 1, 2 — ЗАКРЫТЫ

- Фаза 0: Playwright + CI (28 тестов), schemaVersion, документация
- Фаза 1: 7 модулей, player-runtime.js 3560 → ~2700 строк
- Фаза 2: 228 PATCH/BUG комментариев заменены, Prettier, ESLint 0 errors

### Фаза 3 — доработки (ЗАКРЫТА 2026-10-10)

Все 5 задач + NotAllowedError — закрыты. См. TODO.md.

### Фаза 4 — RLS, логирование, бэкап (ЧАСТИЧНО)

- RLS-аудит — отложен (см. PROJECT-MAP.md §11.3)
- Логирование Edge Functions — отложено (§11.4)
- Бэкап БД — не настроен (§11.5)
- ~~ADMIN_EMAILS — eremeevap@gmail.com~~ закрыто 2026-10-11 (коммит 08d4c0f)

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

## Следующие задачи (обновлено 2026-10-11)

**P2 (техдолг из PROJECT-MAP.md §12.3):**
- RAF-анимации плеера не восстанавливаются после паузы
- Нет PlayerAnimation.stopAll()
- window._camDetecting может залипнуть
- After face_lost стимул может не возобновиться
- ESLint 45 warnings — 43 no-unused-vars + 2 no-empty

**Техдолг (PROJECT-MAP.md §13):** 23 пункта
- Архитектура: app.js монолит (360 KB), три системы дистанции
- Производительность: 7 пунктов
- Качество кода: 7 пунктов

**Фаза 5:** аудит app.js, авто-bump SW, Sentry performance (tracesSampleRate 0.1)
**Фаза 6:** клинический редактор (6 недель)

## Принципы работы

1. Прод не ломаем. Каждое изменение — отдельный коммит.
2. После правок — прогон тестов: `npx playwright test --reporter=list`.
3. Никаких новых PATCH* комментариев.
4. Один коммит = одна задача.
5. Перед push — `git status` и `git diff` глазами.
6. Кириллица: UTF-8 без BOM.
7. Если файл заблокирован — работать через `.tmp` + `Move-Item -Force`.

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
- Не рефакторить player-runtime.js без прогона тестов после каждого шага.
- Не менять структуру сценариев без schemaVersion.
- Не патчить admin.html через PowerShell here-string (кириллица ломается).
- Не пушить в прод в пятницу вечером.
- Не удалять PATCH* комментарии без замены на осмысленные.
- Не вызывать Set-Content на файл без .tmp + Move-Item обхода.

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
*Обновлено: 2026-10-11 (после Фазы 4-багфиксов: 14 коммитов, 3 P0 + 6 P1 закрыто)*
*Копировать: в первое сообщение нового чата.*
