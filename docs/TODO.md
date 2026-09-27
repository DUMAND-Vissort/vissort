# Vissort — TODO

> Последнее обновление: 2026-09-27

---

## 🔴 СРОЧНО

- [ ] **Перегенерировать DeepSeek API key** — старый `sk-5008ba...` был показан в открытом чате. После того как текущая интеграция заработает:
  1. Открыть https://platform.deepseek.com/ → API Keys
  2. Revoke старый ключ
  3. Create new
  4. Обновить в Supabase: `.\supabase.exe secrets set DEEPSEEK_API_KEY=sk-новый_ключ`
  5. Redeploy: `.\supabase.exe functions deploy generate-scenario --project-ref hzvypwdpdhsjzaclxmbm --no-verify-jwt`

---

## 🚧 В РАБОТЕ

### Генератор сценариев через DeepSeek
- [x] Аккаунт DeepSeek + баланс $2
- [x] API key получен
- [x] Edge Function `generate-scenario` создана
- [ ] Секрет `DEEPSEEK_API_KEY` установлен в Supabase
- [ ] Функция задеплоена
- [ ] Тест функции (curl/Invoke-RestMethod)
- [ ] Модалка «🤖 Сгенерировать» в `admin.html`
- [ ] Кнопка + prompt-форма
- [ ] Парсинг JSON → граф на холст

---

## 📋 ЗАПЛАНИРОВАНО

### Адаптивность
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

### Петли (только если понадобится)
- [ ] Фикс `buildQueue` — `visited` блокирует промежуточные узлы
- [ ] Динамическое наследование V (от финальной, а не от стартовой)
- [ ] **Приоритет низкий** — если ИИ генерирует сценарии, петли вручную могут не понадобиться

---

## ⏸ ОТЛОЖЕНО

### OCR старых книг
- [ ] Tesseract.js — локально, бесплатно
- [ ] Парсинг PDF/JPEG-сканов
- [ ] Отложено — не критично

### VPS с Ollama
- [ ] Если понадобится локальная LLM 24/7
- [ ] ~500₽/мес

---

## ✅ ГОТОВО (архив)

### Инфраструктура
- [x] ESLint + Prettier (0 errors)
- [x] Sentry через Supabase-прокси (обход гео-блока)
- [x] Email-уведомления Sentry
- [x] Cloudflare R2 отложен — бэкап вручную
- [x] RLS-политики, миграции, роли БД

### Код
- [x] `player.js` + `user.js` → `player-runtime.js` (единый)
- [x] Домен-лок + меню игр через `VissortPlayerOptions`
- [x] Онбординг: калибровка экрана + камеры
- [x] Fingerprint устройства + Supabase sync
- [x] Модалка «Это то же устройство?»
- [x] Кнопка «Пропустить» в онбординге
- [x] Флаг миграции v2→v3 (localStorage fallback)
- [x] IndexedDB reconnect on close
- [x] `session_id` → UUID, `response_time_ms` → Math.round
- [x] CSP для Sentry + Supabase
- [x] SVG-иконки pause/stop
- [x] Автофокус + Enter в форме логина
- [x] Кнопка «← Назад» в играх
- [x] Фиксированная ширина чипа камеры
- [x] Резиновая шапка + перетаскивание кнопок ПКМ
- [x] Оптимизация камеры (CPU backend, пропуск кадров)