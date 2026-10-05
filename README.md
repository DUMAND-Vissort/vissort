# Vissort

Веб-платформа для тренировки зрительного анализатора. Работает в браузере. Без установки.

**Три задачи:**
- Повышение остроты зрения
- Снятие спазма аккомодации
- Снятие астенопии

**Три сегмента клиентов:**
- B2B клиники — врач назначает, пациент занимается дома
- B2B частные врачи — ведут практику и продают домашний курс
- B2C индивидуалы — родители, взрослые, прямая подписка

**История:** преемник ColorEyesKeeper — настольной программы.

## Стек

**Frontend:** Vanilla JS, HTML, CSS. Service Worker для офлайна. Web Speech API для голоса.
**Backend:** Supabase (PostgreSQL + Auth + Edge Functions на Deno).
**AI:** DeepSeek через Edge Function (rate-limit 20/час).
**Камера:** face-api.js.
**Sentry:** через Supabase-прокси.

## Быстрый старт

\`\`\`powershell
# Установка зависимостей
npm install

# Запуск локального сервера
npx serve -l 5500 .

# Открыть в браузере
start http://localhost:5500/admin.html
\`\`\`

**Требования:** Node.js 20+, npm.

## Тесты

\`\`\`powershell
# Установка Chromium (один раз)
npx playwright install chromium

# Все тесты (28 штук, ~1 минута)
npx playwright test

# Один файл
npx playwright test tests/player.spec.js --reporter=list
\`\`\`

CI запускается автоматически на каждый push в \`main\` через GitHub Actions.

## Структура проекта

\`\`\`
vissort/
├── admin.html          # Редактор сценариев (для админа)
├── user.html           # Плеер тренировок
├── player.html         # Плеер (альтернативный вход)
├── index.html          # Лендинг
├── app.js              # Логика редактора + auth
├── player-runtime.js   # Логика плеера (монолит, рефакторится)
├── data-layer.js       # Прослойка UI ↔ Supabase
├── vissort-core.js     # Общие утилиты (формулы, SVG)
├── voice.js            # Голосовое сопровождение
├── sw.js               # Service Worker
├── player.js           # Конфиг плеера
├── user.js             # Конфиг юзера
├── tests/              # Playwright-тесты (28)
├── docs/               # Документация проекта
└── supabase/           # Edge Functions, миграции
\`\`\`

## Документация

Все ключевые документы в \`docs/\`:

| Документ | Что внутри |
|---|---|
| \`docs/PLAN.md\` | **Карта проекта.** Куда идём и что делать |
| \`docs/TODO.md\` | Задачи по коду |
| \`docs/ARCHITECTURE.md\` | Карта модулей |
| \`docs/DEPLOY.md\` | Как деплоить |
| \`docs/HANDOFF.md\` | Промпт для передачи в новый чат с AI |
| \`docs/VISION.md\` | Стратегия, целевые сегменты |
| \`docs/ECONOMICS.md\` | Расчёты для клиник/врачей/индивидуалов |
| \`docs/GO-TO-MARKET.md\` | Чек-лист выхода на рынок |
| \`docs/PARTNERS.md\` | Список потенциальных заказчиков |
| \`docs/SALES-SCENARIOS.md\` | Сценарии встреч |
| \`docs/PITCH.md\` | Проспект для клиник |
| \`docs/MARKETING.md\` | План входа в интернет |

## Принципы разработки

1. **Прод не ломаем.** Каждое изменение — отдельный коммит.
2. **После правок — прогон тестов.** \`npx playwright test\`.
3. **Никаких новых \`PATCH*\` комментариев.** Осмысленные описания.
4. **Один коммит = одна задача.**
5. **Перед \`git push\` — \`git status\` и \`git diff\` глазами.**

## Что сейчас в работе

- **Фаза 0** — фундамент (Playwright ✅, schemaVersion ✅, документация ⏳)
- **Фаза 1** — рефакторинг \`player-runtime.js\` (5100 строк → 5 модулей)
- **Фаза 6** — клинический редактор (6 недель)

Полный план — в \`docs/PLAN.md\`.

## Лицензия

Проприетарная. Все права защищены.

## Контакты

- Email: hello@vissort.com
- Сайт: vissort.com
