# Vissort — контекст (CONTEXT)

> Единый источник инструкций: что за проект, как работать, грабли.
> Актуально на HEAD `7cca9b3` (2026-10-19). Тесты: 36 passed + 1 skipped.
> Связанные: `docs/PROJECT-MAP.md` (архитектура), `docs/NOTES.md` (журнал решений), `docs/IDEAS.md` (идеи).
> **Для нового чата:** приложить `CONTEXT.md` + `PROJECT-MAP.md` + `NOTES.md`.

## 1. Что такое Vissort

Веб-платформа для тренировки зрительного анализатора. Браузер. Три задачи: повышение остроты зрения, снятие спазма аккомодации, снятие астенопии.

**История:** преемник ColorEyesKeeper (настольная программа). 3 месяца.

**Аудитория:** B2B клиники (врач назначает, клиника платит), B2B частные врачи, B2C индивидуалы.

**Цель:** 100 000 активных пользователей. Простое добавление фич. Генератор типов сценариев. Минимум программистов.

**Ключевой принцип:** ядро для роста **без переделок архитектуры**.

## 2. Технический стек

- **Frontend:** Vanilla JS, HTML, CSS. Service Worker (офлайн). Web Speech API. face-api.js (TinyFaceDetector, inputSize 320, scoreThreshold 0.25). Canvas.
- **Backend:** Supabase (PostgreSQL + Auth + Edge Functions на Deno). RLS — 8 таблиц, 17 политик, 4 роли (admin/developer/doctor/patient).
- **AI:** DeepSeek через Edge Function `generate-scenario` (rate-limit 20/час на user_id).
- **Sentry:** через Supabase-прокси (tunnel key).
- **CI/CD:** GitHub Actions — 36+1 Playwright-тестов + ежедневный `pg_dump` БД.
- **Инфраструктура:** Supabase project `hzvypwdpdhsjzaclxmbm.supabase.co`; прод `vissort.com`; репозиторий `github.com/DUMAND-Vissort/vissort` (приватный); локальный стенд `D:\PROEKT\vissort` (`npx --yes http-server -p 5500 -c-1`).

## 3. Три HTML-файла

| Файл | Для кого | Что внутри |
|---|---|---|
| `admin.html` | врач / методист | редактор сценариев, граф узлов |
| `clinic.html` | врач (Фаза 6) | `admin.html` + `#protocol-panel` (5 полей) |
| `user.html` | пациент | вход, выбор сценария, тренировка, история |
| `player.html` | разработчик | быстрая проверка, `?test=1` |

**Логика плеера** — в `player-*.js` (bootstrap в `player-runtime.js`, режимы в `player-single.js` / `player-graph.js` / `player-reading-mode.js`). **Логика редактора** — в `app-*.js`.

## 4. Структура проекта (кратко)

**Общие модули:** `vissort-logger.js` (VLog, первым), `vissort-env.js` (URL, ANON_KEY, RELEASE), `vissort-dialog.js` (VissortDialog), `vissort-core.js` (утилиты, 26 ключей), `voice.js` (Web Speech), `data-layer.js` (IndexedDB + Supabase + syncQueue, 48 методов), `vissort-device.js` (fingerprint + калибровка), `vissort-onboarding.js` (мастер калибровки), `vissort-ai-generator.js` (DeepSeek), `sw.js` (Service Worker), `header-drag.js`.

**Плеер:** `player-runtime.js` (910, bootstrap + обёртки), `player-graph.js` (803, граф), `player-single.js` (608, плоский + сравнение), `player-session.js` (328), `player-reading-mode.js` (254), `player-auth.js` (240), `player-scenarios.js` (125), `player-state.js` (177), `player-camera.js` (542), `player-animation.js` (534), `player-invalid-detection.js` (215), `player-reading.js` (255), `player-utils.js` (92), `player-dist-warning.js` (54), `player-distance.js` (103), `player-overlay.js` (50), `player-installers.js` (225).

**Редактор:** `app.js` (1850, bootstrap + init + auth + обёртки), `app-state.js` (206), `app-editor.js` (1101), `app-inspector.js` (926), `app-generator.js` (882), `app-scenarios.js` (864), `app-utils.js` (683), `app-blink-camera.js` (572), `app-auth.js` (259), `app-player-preview.js` (1311).

**Клиника:** `clinic.html` (~3050), `clinic.js` (107).

**Полная карта** — `docs/PROJECT-MAP.md` §1 + Приложение А (62 файла).

## 5. Что работает

**Продукт:** редактор сценариев (5 типов узлов: STIMULUS, DYNAMIC, READING, LOGIC_IF, COMPARE), плеер (офлайн-first), камера (face-api, IPD-калибровка, дистанция, hard limit 1.0 м + баннер), устойчивость распознавания (3 состояния), rate-limit AI (20/час), офлайн (SW + IndexedDB + syncQueue), калибровка (2 шага: PPI + камера, синхронизация по fingerprint+userId), моргание (EAR), кнопка 📐 (повторная калибровка), роли (admin/developer/doctor/patient), VissortDialog/VissortLog/VissortEnv.

**Инфраструктура:** Supabase (Auth, RLS, Edge Functions, миграции), RLS 8 таблиц / 17 политик, Edge Functions (CORS, retry, timeout 60s, Sentry-хук), автобэкап (GitHub Actions, pg_dump 17, 90 дней), CI (36+1 Playwright), schemaVersion 2 + migrateScenario.

## 6. Статус (HEAD `7cca9b3`, 2026-10-19)

**Закрыто:** Фазы 0–6 (Playwright + CI, 7 модулей плеера, 228 PATCH-комментариев, RLS + роли doctor/developer, Edge Functions, автобэкап, **Фаза 5** — `app.js` 7900 → 1850, **Фаза 6 MVP** — `clinic.html` + `clinic.js` + авто-дерево `Vissort/Сценарии`). **Все P0/P1** (3 + 6 после Фазы 4, 2 + 2 + 1 — сессия 2026-10-19). **PLAYER-UNIFY-PLAN** — закрыт (0 функций к унификации). **PROJECT-MAP** — актуализирован (§1–§16 + Приложение А). **NOTES** — сессия 2026-10-19 записана.

**Отложено:**
- **Фаза 7** (мультитенантность: `tenants`, `tenant_id`, RLS, роли `clinic_admin`/`nurse`, аналитика, PDF, приглашения) — **до заказчиков**. Пилот — 1 клиника. Триггер — второй заказчик.
- **§A2-v9b** (`init` → `app-init.js`) — высокий риск, `init()` не покрыт тестами. `app.js` ~1850 — приемлемо.
- **§4.3.5** — `PlayerState` ~150 полей (описание верное, детали — не критично).

**Следующее:** новый функционал (по запросу) — «Найди вживую» (`player-find-real.js` + тип `FIND_REAL`), экспресс-тест «Индекс Зрительного Ресурса» (`player-express-test.js`, приоритет **высокий** — точка входа + мотиватор).

## 7. Идеи (в `docs/IDEAS.md`)

1. **«Найди вживую»** — фрагмент комнаты/вида → пациент ищет вживую. Внимание, сличение, периферия, аккомодация. Приоритет средний.
2. **Экспресс-тест «Индекс Зрительного Ресурса»** — 4 субтеста (аккомодация, Шульте-Vissort, глазодвигательный трекинг, астигматизм), интегральный %, до/после. Приоритет **высокий**.
## 8. Принципы работы (обязательны)

1. **Прод не ломаем.** Каждое изменение — отдельный коммит.
2. **После правок — тесты:** `npx playwright test --reporter=list` (36+1).
3. **Никаких новых PATCH* комментариев.**
4. **Один коммит = одна задача.**
5. **Перед push — `git status` и `git diff` глазами.**
6. **Кириллица: UTF-8 без BOM.**
7. **Файл заблокирован** → `.tmp` + `Move-Item -Force`.
8. **Порядок загрузки:** `vissort-logger.js` → `vissort-env.js` → `vissort-dialog.js` → `vissort-core.js` → модули.
9. **Тонкие обёртки — не модули.** Одна строка `return window.X.y()` — не выносить.
10. **Регионы объявлений — построчно.** Regex `^\s*(let|var|const)` не ловит продолжения через запятую.

## 9. Антипаттерны и грабли (16)

### Технически

| # | Грабля | Триггер | Как избежать |
|---|---|---|---|
| 1 | `Add-Content` с here-string зависает/обрезает | длинный блок (>20 строк) с кириллицей | `AppendAllText` с `UTF8Encoding(false)` |
| 2 | `WriteAllLines` пишет часть | замена/вставка | сверять `(Get-Content).Count` до/после |
| 3 | `cd docs` → `Get-Content .\docs\...` | 404 «не удается найти путь» | `$PWD`, не дублировать `docs\` |
| 4 | Сдвиг индексов при вставке | `$lines[N..M]` | вставлять **после anchor** (`Select-String`), не по индексу |
| 5 | `node --check` не ест `.tmp` | проверка синтаксиса | копировать в `.check.js` |
| 6 | `Select-String` с regex-спецсимволами | `` ` ``, `.`, `§` | `-SimpleMatch:$false` |
| 7 | `Select-Object -Last 6` скрывает пустые | проверка пустых строк | `ForEach-Object { "[{0}]" -f $_ }` |
| 8 | Нет пустой перед `###` | заголовок после списка/абзаца | проверять после каждой правки |
| 9 | Нет пустой перед `---` | конец раздела | `Select-Object -Last 10` + `[{}]` |
| 10 | Нет пустой перед списком | `- item` после абзаца | `[{}]` формат |
| 11 | Двойная пустая | вставка не туда | убрать (`$lines[0..$idx+1]` + `$lines[$idx+3..]`) |
| 12 | `git diff --stat` ≠ Count | оценка объёма | сверять `(Get-Content).Count` |
| 13 | `serve` редиректит `.html` → 404 | локальный стенд | `npx --yes http-server -p 5500 -c-1` |
| 14 | `cd docs` + `git add docs/...` | двойной `docs\docs` | `git -C D:\PROEKT\vissort` |
| 15 | `count()` до рендера | флак Playwright | `waitForFunction` / `expect.poll` |
| 16 | Не выносить функции за `})();` | вынос модуля | `Select-String -Pattern '^\}\)\(\);'`, все `function` **до** закрытия |

### Продуктово

- Не обещать излечения.
- Не делать публичные рейтинги.
- Не продавать клиникам до пилота.
- Не идти к федеральным клиникам без медизделия.

### В работе с ИИ

- Не просить сделать всё сразу.
- Не пересказывать контекст — он уже здесь.
- Не молчать, если что-то не работает — показать ошибку.
## 10. Формат работы с ИИ

**Что делает ИИ:**
- Даёт PowerShell-команды для правок (однострочные или блоки).
- Пишет SQL-миграции, HTML, CSS, документацию, JS-модули.
- Диагностирует ошибки по выводу команд.

**Что ИИ НЕ делает:**
- Не имеет доступа к интернету, не запускает код, не видит файлы.
- Не создаёт файлы сам — только через команды пользователя.
- Не работает с чувствительными ключами.

**Что нужно от пользователя:**
- Точные выводы команд (не пересказ).
- Скриншоты, если проблема визуальная.
- Если патч — сказать, применился или нет, показать node --check и Select-String.
- Если ошибка — первый красный текст из Console.

**Стиль ответа:**
- Максимальная плотность. Одна мысль — одна строка. Один путь, а не три.
- **Формат:** Заголовок → патч / команда → проверка → что скинуть. Без преамбул.

## 11. Команды проверки состояния

**Git:**
```
git log --oneline -10
git status
git -C D:\PROEKT\vissort diff --stat
```

**Тесты:**
```
npx playwright test --reporter=list
```

**Синтаксис:**
```
node --check D:\PROEKT\vissort\app.js
node --check D:\PROEKT\vissort\player-runtime.js
node --check D:\PROEKT\vissort\vissort-env.js
node --check D:\PROEKT\vissort\vissort-onboarding.js
node --check D:\PROEKT\vissort\vissort-device.js
```

**Локальный сервер:**
```
npx --yes http-server -p 5500 -c-1
# http://127.0.0.1:5500/player.html или http://localhost:5500/user.html
```

---

*Составлено: 2026-10-19. HEAD: `7cca9b3`. Тесты: 36 passed + 1 skipped.*
*Связанные: `docs/PROJECT-MAP.md`, `docs/NOTES.md`, `docs/IDEAS.md`.*