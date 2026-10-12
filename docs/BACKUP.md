# Vissort — автобэкап БД

> Настроен: 2026-10-12.
> Файл workflow: `.github/workflows/backup-db.yml`.
> Статус: работает (первый успешный запуск 2026-10-12, 1m 5s).

---

## §1. Что делает

Ежедневно в **03:00 UTC** (06:00 MSK):

1. GitHub Actions запускает workflow `Backup Database`.
2. Устанавливает PostgreSQL client 17 (из PGDG repo — для совместимости с Supabase PG 17.6).
3. Разбирает `SUPABASE_DB_URL` из GitHub Secrets на компоненты.
4. `pg_dump --format=custom --compress=9` — создаёт `.dump` файл.
5. Загружает в **Artifacts** с retention **90 дней**.

---

## §2. Где дампы

GitHub → Actions → Backup Database → **последний run** → внизу **Artifacts**.

Файл: `db-backup-YYYY-MM-DD.zip` (внутри — `vissort-YYYY-MM-DD_HH-MM-SS.dump`).

Retention: 90 дней (GitHub удаляет автоматически).

---

## §3. Ручной запуск

GitHub → Actions → Backup Database → **Run workflow** → Run.

Полезно:
- Перед крупной миграцией.
- При подозрении на потерю данных.
- При отладке изменений схемы.

---

## §4. Восстановление из дампа

### 4.1. Скачать дамп

Artifacts → скачать `.zip` → распаковать → `.dump` файл.

### 4.2. Установить PostgreSQL client 17

Windows: https://www.postgresql.org/download/windows/
Linux: `apt install postgresql-client-17` (PGDG repo).

### 4.3. Восстановить

Внимание: восстановление перезапишет существующие данные.

Полное восстановление в новую БД:
```bash
pg_restore \
  --host=aws-1-eu-west-1.pooler.supabase.com \
  --port=5432 \
  --username=postgres.hzvypwdpdhsjzaclxmbm \
  --dbname=postgres \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  vissort-2026-10-12_09-20-29.dump
```

Пароль — тот же, что в `SUPABASE_DB_URL` (GitHub Secrets).

Восстановление только одной таблицы:
```bash
pg_restore ... --table=test_results ...
```

Посмотреть содержимое дампа без восстановления:
```bash
pg_restore --list vissort-2026-10-12_09-20-29.dump
```

---

## §5. Обслуживание

### 5.1. Пароль БД сменился

Если был **Reset database password**:
1. GitHub → Settings → Secrets → Actions → `SUPABASE_DB_URL`.
2. Update → вставить новый URL с новым паролем.
3. Проверить: Actions → Backup Database → Run workflow.

### 5.2. Ошибка `server version mismatch`

Значит, версия `pg_dump` в workflow **старше** версии Supabase.
Решение: обновить **шаг установки** в `backup-db.yml` до `postgresql-client-N`.

### 5.3. Ошибка `password authentication failed`

Пароль в `SUPABASE_DB_URL` неверный.
Решение: **Reset database password** в Supabase → обновить secret.

---

## §6. Retention

**90 дней** — задано в workflow (`retention-days: 90`).
Изменить: `backup-db.yml` → `retention-days: 180` (макс для GitHub Free — 90; для Pro — 400).

---

*Составлено: 2026-10-12.*
