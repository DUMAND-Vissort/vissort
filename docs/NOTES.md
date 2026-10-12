# Vissort — журнал решений

> Сюда пишем **принятые решения** — почему сделали так, а не иначе.
> Формат: дата → контекст → решение → почему.
> НЕ заменяет `TODO.md` — там активные задачи.

---

## 2026-10-12 — TODO(phase3) в app.js / player-runtime.js

### Решение: заменить TODO на пояснение, не унифицировать

**Контекст:**
- `window.stimDisplay` / `window.stimArea` ставит player-runtime.js (экспорт в window).
- В app.js — свои const stimDisplay / stimArea. ESLint видит коллизию имён.
- Фаза 3 закрыта 2026-10-10, TODO(phase3) остался в 5 местах.

**Решение:** заменить `TODO(phase3)` на актуальное пояснение.

**Почему не унифицировать:**
- app.js (admin.html) и player-runtime.js (player.html) — разные entry.
- Вместе не загружаются. Коллизия имён иллюзорна.
- Унификация — 10+ правок в app.js, риск. Ноль функциональной пользы.

**Файлы:** app.js (219, 221), player-runtime.js (183, 185), eslint.config.js (77–80).

---

## 2026-10-12 — Авто-bump SW cache

### Решение: через GitHub Actions (не npm-скрипт)

**Контекст:**
- `CACHE_VERSION` в sw.js — хардкод `vissort-v34`. Менялся вручную.
- Прод — GitHub Pages, деплой из main.

**Решение:** workflow `.github/workflows/bump-sw.yml` — при push в main (изменения `.html`/`.js`) заменяет `CACHE_VERSION` на `vissort-YYYYMMDD-<git-hash>`, коммитит с `[skip ci]`.

**Почему не npm-скрипт:** «можно забыть». Автоматизация надёжнее.

**Почему не цикл:** коммит бота содержит `[skip ci]`, workflow пропускает.

**Файлы:** `.github/workflows/bump-sw.yml`, `sw.js`.

---

## 2026-10-12 — Роли doctor / developer (§11.3)

### Решение: doctor с doctor_id в user_scenarios; developer без медданных

**Контекст:**
- Изначально только admin + patient. Врач и разработчик — не предусмотрены.
- При добавлении ролей — вопрос: developer видит медданные?

**Решение:**
- `admin` — всё.
- `developer` — только системные (без медданных).
- `doctor` — свои сценарии/пациенты через `doctor_patients`.
- `user_scenarios.doctor_id` — nullable, только doctor ставит свой id.

**Почему doctor_id, а не через doctor_patients:** нужна атрибуция «кто назначил».

**Файлы:** `docs/RLS-AUDIT.md`, миграция SQL.

---

## 2026-10-12 — TODO.md + PROJECT-MAP §13 + inline TODO

### Правило: TODO.md — центральный; inline — минимум

- **TODO.md** — активные задачи по фазам.
- **PROJECT-MAP §13** — техдолг (что не так, но не критично).
- **Inline TODO** — только для локальных мелочей, чистить раз в квартал.
- **NOTES.md** (этот файл) — решения + почему.

**Почему:** TODO.md не ловит inline; NOTES.md — журнал «почему».

---

*Составлено: 2026-10-12.*
