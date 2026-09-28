# Vissort — TODO

- [ ] sw.js: HTML fallback вместо пустого 503 (сделать вручную через Notepad++)

> Последнее обновление: 2026-09-28 (объединён с аудитом)
> Единственный актуальный TODO. Файл `TODO.md` в корне удалён.

---

## 🔴 СРОЧНО — БЕЗОПАСНОСТЬ

- [ ] **Отозвать скомпрометированный ключ DeepSeek**
      Известные скомпрометированные ключи:
        • `sk-5008ba...` (упоминался в старом TODO)
        • `cf7e5e754ebddf74380fca7b40474f3c6f1607da9df2e25d9e636e94e50f97d3` (показан 2026-09-28)
      Где отозвать: https://platform.deepseek.com/api_keys → Revoke/Delete

- [ ] **Создать новый ключ DeepSeek** (формат `sk-...`)
      https://platform.deepseek.com/api_keys → Create new API key

- [ ] **Обновить секрет в Supabase**
      `.\supabase.exe secrets set DEEPSEEK_API_KEY=sk-новый_ключ`
      Проверить: https://supabase.com/dashboard/project/hzvypwdpdhsjzaclxmbm/functions/secrets

- [ ] **Передеплоить функцию**
      `.\supabase.exe functions deploy generate-scenario`

---

## 🚧 В РАБОТЕ

### AI-генератор сценариев (Edge Function + модалка)
- [x] Аккаунт DeepSeek + баланс $2
- [x] API key получен
- [x] Edge Function `generate-scenario` создана
- [x] Секрет `DEEPSEEK_API_KEY` установлен в Supabase
- [x] Функция задеплоена (v1 без auth → v2 с auth 2026-09-28)
- [x] Модалка «🤖 AI» в `admin.html`
- [x] Кнопка + prompt-форма
- [x] Парсинг JSON → граф на холст (`createNodesFromAI`)
- [x] Auth-проверка JWT в Edge Function (патч 1)
- [x] Передача `schema` в DeepSeek (патч 3)
- [x] Принимаем и `{nodes:[]}`, и `[]` (патч 3)
- [ ] **Тест генератора после отзыва старого ключа**
- [ ] Rate-limit на стороне Edge Function (не более N запросов в час на user_id)

---

 ## 🟠 АУДИТ 2026-09-28 — ПАКЕТ №2 (существенное)

- [x] `_frameSkipCounter` не сбрасывался между сессиями → Патч 8
- [x] `voice.js`: `el.innerText` → `el.textContent` → Патч 10
- [x] `knightTour(12)` в «Пятнашках» — увеличено до 2000 попыток → Патч 11
- [x] `differences-wolf.html`: убран верхний предел S (был `Math.min(60, ...)`) → Патч 12
- [x] Скрытые chip'ы в `admin.html`: folder-status теперь всегда виден → Патч 13

### Отложено
- [ ] **`sw.js` fallback на офлайн-страницу** — патч 9 не сработал в PS 5.1 (кириллица + `<html>` в here-string). Сделать вручную в Notepad++ либо через base64-обёртку.
      Критичность низкая: пользователь видит пустую 503 только если одновременно нет сети и нет кэша.
- [ ] **`visited` в `buildGraphQueue`** — не критично для текущих сценариев (простые цепочки). Проявится только при сложных графах с петлями.
- [ ] **CSP без `unsafe-inline`** — требует выноса inline-скриптов из 3 HTML-файлов (Sentry init, installSyncUI, games-menu). Отдельная задача.
### UI-улучшения (сессия 2026-09-28, вторая половина дня)
- [x] Патч 14a — унифицированы размеры узлов (STIMULUS/READING/COMPARE → 200×180)
- [x] Патч 14b — компактный CSS для узлов (шрифты 7–10px, отступы 1–2px)
- [x] Патч 14c — автоскролл canvas к созданным AI-узлам
- [x] Патч 15a — кнопки внутри узла идут вертикально (Связать/Петля/В заготовки/Удалить)
- [x] Патч 15b — кнопки зума в шапке (`+` / `−` / `100%`)
- [x] Патч 15c — логика зума + коррекция drag/resize под масштаб (`window.__vissort_zoom`)
- [x] Патч 16 — Ctrl + колесо мыши для зума
- [x] Патч 17 — drag по всей площади узла, single-click = активация, double-click = инспектор
- [x] Патч 18a — кнопка 🆕 «Новый сценарий» в шапке
- [x] Патч 18b — логика очистки холста (`installNewScenario`)
- [x] Патч 18c — фикс эмодзи после PS 5.1 (через `[char]::ConvertFromUtf32`)
---

## 🟡 АУДИТ 2026-09-28 — ПАКЕТ №3 (техдолг)

- [ ] Разделить `player-runtime.js` (2700 строк) на модули:
      `player-core.js`, `player-flat.js`, `player-graph.js`, `player-camera.js`
- [ ] Переименовать `player.js` → `player-config.js`, `user.js` → `user-config.js`
- [ ] Применить Prettier (`npm run format`) — местами >110 символов
- [ ] `package.json` `"type": "module"` конфликтует с ESLint `sourceType: 'script'`
- [ ] Вынести `_test_graph.json`, `diff.txt` из корня в `tests/` или `_archive/`
- [ ] Удалить патч-файлы `patch1-*.ps1` … `patch6-*.ps1` после проверки
- [ ] Удалить `TODO.md` в корне (этот файл — в `docs/`)

---

## 📋 ЗАПЛАНИРОВАНО

### Адаптивность тренировки
- [ ] Собрать данные из `test_results`
- [ ] Локальная модель (TensorFlow.js) для предсказания индивидуальной кривой V
- [ ] Встроить в плеер

### MediaPipe (gaze-tracking)
- [ ] Отдельный проект `D:\PROEKT\gaze-test`
- [ ] MediaPipe Face Mesh
- [ ] Калибровка + замер точности
- [ ] Если ОК — интеграция в Vissort для игр

### Telegram-уведомления Sentry
- [ ] Sentry → Settings → Integrations → Telegram Alerts Bot
- [ ] Создать Alert Rule с действием Notify → Telegram

### Петли (приоритет низкий)
- [ ] Фикс `buildGraphQueue` — `visited` блокирует промежуточные узлы
- [ ] Динамическое наследование V (от финальной, а не от стартовой)
- [ ] Если ИИ генерирует сценарии — петли вручную могут не понадобиться

---

## ⏸ ОТЛОЖЕНО

### OCR старых книг
- [ ] Tesseract.js — локально, бесплатно
- [ ] Парсинг PDF/JPEG-сканов
- [ ] Не критично

### VPS с Ollama
- [ ] Если понадобится локальная LLM 24/7
- [ ] ~500₽/мес

---

## ✅ ГОТОВО (архив)

### Аудит 2026-09-28 — пакет №1 (критичное)
- [x] Патч 1 — Edge Function `generate-scenario`: auth-проверка JWT + admin emails
- [x] Патч 2 — `app.js`: `window.supabaseClient`, `params.ppi` в `saveGraph`
- [x] Патч 3 — `vissort-ai-generator.js`: session token, schema, массив/объект, мёртвый код
- [x] Патч 4 — `player-runtime.js`: `sessionId` fallback, guard `finishGraphReading`, `disableCamera` сброс, `keydown` в compare
- [x] Патч 5 — `data-layer.js`: `_reopenAttempts`, expired token, orphan cleanup
- [x] Патч 6 — HTML: адаптивный `#cam-indicator` (media-query 520px)
- [x] Патч 7 — деплой Edge Functions (`generate-scenario` v2 с auth)

### Инфраструктура
- [x] ESLint + Prettier (0 errors)
- [x] Sentry через Supabase-прокси (обход гео-блока)
- [x] Email-уведомления Sentry
- [x] Cloudflare R2 отложен — бэкап вручную
- [x] RLS-политики, миграции, роли БД (созданы через дашборд)

### Код
- [x] `player.js` + `user.js` → `player-runtime.js` (единый) — в последствии разбить (см. Пакет №3)
- [x] Домен-лок + меню игр через `VissortPlayerOptions`
- [x] Онбординг: калибровка экрана + камеры
- [x] Fingerprint устройства + Supabase sync
- [x] Модалка «Это то же устройство?»
- [x] Кнопка «Пропустить» в онбординге
- [x] Флаг миграции v2→v3 (localStorage fallback)
- [x] IndexedDB reconnect on close (усилено патчем 5)
- [x] `session_id` → UUID, `response_time_ms` → Math.round
- [x] CSP для Sentry + Supabase
- [x] SVG-иконки pause/stop
- [x] Автофокус + Enter в форме логина
- [x] Кнопка «← Назад» в играх
- [x] Фиксированная ширина чипа камеры (адаптив — патч 6)
- [x] Резиновая шапка + перетаскивание кнопок ПКМ
- [x] Оптимизация камеры (CPU backend, пропуск кадров)

---

## 📝 Легенда

- 🔴 — сделать сегодня
- 🚧 — в работе сейчас
- 🟠 — существенное, но не срочное
- 🟡 — техдолг
- 📋 — запланировано
- ⏸ — отложено
- ✅ — готово