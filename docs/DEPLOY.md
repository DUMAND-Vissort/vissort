# Vissort — деплой

> Как развернуть и обновить проект.
> Связанные: ARCHITECTURE.md, HANDOFF.md

## Что где живёт

| Компонент              | Где                        | Как обновляется                                    |
| ---------------------- | -------------------------- | -------------------------------------------------- |
| Frontend (HTML/JS/CSS) | GitHub Pages (vissort.com) | Автоматически при push в main                      |
| Edge Functions         | Supabase                   | Вручную: \`supabase functions deploy\`             |
| Миграции БД            | Supabase                   | Вручную: \`supabase db push\` или через SQL Editor |
| Secrets                | Supabase                   | Вручную: \`supabase secrets set\`                  |
| SW-кэш                 | Браузер пользователя       | Автоматически при \`CACHE_VERSION++\`              |

## Первоначальная настройка

### 1. Клонирование

\`\`\`powershell
git clone https://github.com/DUMAND-Vissort/vissort.git
cd vissort
npm install
\`\`\`

### 2. Playwright

\`\`\`powershell
npx playwright install chromium
\`\`\`

### 3. Локальный запуск

\`\`\`powershell
npx serve -l 5500 .
\`\`\`

Открой \`http://localhost:5500/admin.html\`.

### 4. Supabase CLI

\`\`\`powershell

# Supabase CLI лежит в корне проекта (supabase.exe)

.\supabase.exe --version

# Привязка к проекту

.\supabase.exe link --project-ref hzvypwdpdhsjzaclxmbm
\`\`\`

## Деплой frontend

**Автоматически через GitHub Actions** (pages-build-deployment).

Любой push в \`main\` → GitHub Pages публикует файлы → vissort.com обновляется за 1-2 минуты.

**Проверка:**

1. https://github.com/DUMAND-Vissort/vissort/actions
2. Workflow \`pages build and deployment\` — должен быть зелёный.

## Деплой Edge Functions

### generate-scenario

\`\`\`powershell
cd D:\PROEKT\vissort
.\supabase.exe functions deploy generate-scenario
\`\`\`

Или через дашборд: https://supabase.com/dashboard/project/hzvypwdpdhsjzaclxmbm/functions

### sentry-proxy

\`\`\`powershell
.\supabase.exe functions deploy sentry-proxy
\`\`\`

## Миграции БД

### Через CLI

\`\`\`powershell
cd D:\PROEKT\vissort
.\supabase.exe db push
\`\`\`

**Внимание:** если файл миграции пустой или содержит ошибки — БД не изменится, но миграция будет помечена как применённая. Проверяй через SQL Editor:

\`\`\`sql
SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5;
\`\`\`

### Через SQL Editor (если CLI не сработал)

1. Открой https://supabase.com/dashboard/project/hzvypwdpdhsjzaclxmbm/sql/new
2. Скопируй содержимое файла миграции
3. Run
4. Проверь результат через \`SELECT\`.

## Секреты

### DEEPSEEK_API_KEY

\`\`\`powershell
.\supabase.exe secrets set DEEPSEEK_API_KEY=sk-новый_ключ
\`\`\`

**Проверка:** https://supabase.com/dashboard/project/hzvypwdpdhsjzaclxmbm/functions/secrets

### AI_RATE_LIMIT_PER_HOUR (опционально)

\`\`\`powershell
.\supabase.exe secrets set AI_RATE_LIMIT_PER_HOUR=20
\`\`\`

Дефолт — 20, если не задано.

## Service Worker (офлайн-кэш)

При любом изменении \`sw.js\` или файлов, которые он кэширует:

1. Открой \`sw.js\`.
2. Увеличь \`CACHE_VERSION\` (например, \`vissort-v34\` → \`vissort-v35\`).
3. Запушь.

**Проверка:** у пользователя новый SW активируется при следующем визите. Старый кэш удаляется.

## Git push

### Настройка токена

**Один раз:** создай Personal Access Token (classic) с scopes \`repo\` + \`workflow\`.

https://github.com/settings/tokens/new

Настрой git:

\`\`\`powershell
cd D:\PROEKT\vissort
git remote set-url origin https://github.com/DUMAND-Vissort/vissort.git
git config credential.helper manager
\`\`\`

При первом push git спросит логин/пароль. Введи:

- Username: \`DUMAND-Vissort\`
- Password: токен

Git сохранит в Credential Manager — дальше push без ввода.

### Обычный push

\`\`\`powershell
cd D:\PROEKT\vissort
git status
git add <файлы>
git commit -m "тип(область): описание"
git push
\`\`\`

### Формат коммитов

- \`feat(...)\` — новая фича
- \`fix(...)\` — баг-фикс
- \`test(...)\` — тесты
- \`docs(...)\` — документация
- \`chore(...)\` — рутина

Пример: \`feat(player): add camera preview in overlay\`

## CI

**Автоматически при push в main:** GitHub Actions запускает Playwright-тесты.

https://github.com/DUMAND-Vissort/vissort/actions

Если CI упал — посмотри лог, исправь, запусти push снова.

**Локальный прогон перед push:**

\`\`\`powershell
npx playwright test --reporter=list
\`\`\`

Ожидай 28+ passed за ~1 минуту.

## Проверка после деплоя

### Frontend

1. Открой https://vissort.com/admin.html
2. Проверь вход
3. Создай тестовый узел
4. Сохрани
5. Открой https://vissort.com/player.html
6. Проверь старт

### Edge Function

\`\`\`javascript
// В Console на admin.html (залогинен как админ)
const token = JSON.parse(localStorage.getItem('sb-hzvypwdpdhsjzaclxmbm-auth-token')).access_token;
const r = await fetch('https://hzvypwdpdhsjzaclxmbm.supabase.co/functions/v1/generate-scenario', {
method: 'POST',
headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
body: JSON.stringify({ prompt: 'test' })
});
console.log(r.status, await r.text());
\`\`\`

Ожидай 200 или 429 (rate-limit).

### Service Worker

DevTools → Application → Service Workers. Должен быть активен \`vissort-vXX\`.

## Откат

### Frontend

\`\`\`powershell
git revert <hash>
git push
\`\`\`

GitHub Pages пересоберёт за 1-2 минуты.

### Edge Function

Через дашборд: https://supabase.com/dashboard/project/hzvypwdpdhsjzaclxmbm/functions — можно задеплоить старую версию из истории (если есть).

### Миграция БД

SQL Editor → выполни обратный SQL вручную. Или восстанови БД из бэкапа (если настроен).

## Бэкап

**Сейчас:** вручную через Supabase Dashboard → Database → Backups.

**В планах (Фаза 4):** автоматический через Edge Function раз в сутки → Supabase Storage, retention 7-30 дней.

## Мониторинг

- **Sentry:** https://sentry.io — ошибки фронта
- **Supabase Logs:** https://supabase.com/dashboard/project/hzvypwdpdhsjzaclxmbm/logs — Auth, Edge Functions, Postgres
- **GitHub Actions:** статус CI
- **UptimeRobot:** (не настроен) — можно добавить проверку vissort.com

---

_Дата: 2026-10-05_
