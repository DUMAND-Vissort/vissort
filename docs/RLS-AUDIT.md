# Vissort — RLS-аудит (аудит безопасности Supabase)

> Дата: 2026-10-12.
> Проект: `hzvypwdpdhsjzaclxmbm.supabase.co`.
> Статус: **пройден**. Утечек нет. Роли `doctor`/`developer` заложены.

---

## §1. Итоги аудита

| Проверка | Результат |
|---|---|
| Все таблицы с RLS | OK 8/8 |
| anon не читает данные (тест с anon-ключом) | OK все `200 []` |
| Политики по `auth.uid()` | OK |
| `security_definer` с `search_path=public` | OK |
| Изоляция между пользователями | OK |
| Роли `doctor`/`developer` заложены в CHECK | OK |

---

## §2. Роли

| Роль | Кто | Права |
|---|---|---|
| `admin` | Администратор | Всё. Видит медданные. |
| `developer` | Разработчик | Только системные таблицы (`ping`, логи). Медданные — нет. |
| `doctor` | Врач | Свои сценарии/шаблоны; пациенты через `doctor_patients`; результаты своих пациентов. |
| `patient` | Пациент | Только свои данные (сценарии, результаты, сессии). |

Все 4 роли разрешены в `profiles_role_check`:
CHECK (role IN ('admin', 'developer', 'doctor', 'patient'))

---

## §3. Функции RLS

| Функция | Назначение |
|---|---|
| `is_admin()` | role = admin — только настоящий админ |
| `is_developer()` | role = developer |
| `is_admin_or_developer()` | role IN (admin, developer) — для системных таблиц |
| `current_role()` | Возвращает роль текущего пользователя |
| `is_my_patient(patient_id)` | Проверяет, что patient_id — пациент текущего доктора |

Все 5 — SECURITY DEFINER + search_path=public.

---

## §4. Матрица ролей × таблиц

| Таблица | admin | developer | doctor | patient |
|---|---|---|---|---|
| `scenarios` | всё | — | свои | назначенные |
| `templates` | всё | — | свои | — |
| `test_results` | всё | — | пациентов | свои |
| `training_sessions` | всё | — | пациентов | свои |
| `profiles` | всё | — | пациентов | свой |
| `device_calibrations` | всё | — | — | свой |
| `user_scenarios` | всё | — | свои | свои |
| `doctor_patients` | всё | — | своих пациентов | своих докторов |
| `ping` | всё | системная | — | — |

---

## §5. Ключевые политики

### scenarios

- admin: is_admin() — всё.
- doctor: created_by = auth.uid() — свои.
- patient: is_admin() OR EXISTS (SELECT 1 FROM user_scenarios WHERE user_id = auth.uid() AND scenario_id = scenarios.id) — назначенные.

### test_results

- admin: is_admin() — всё.
- doctor: is_my_patient(user_id) — результаты своих пациентов.
- patient: auth.uid() = user_id — свои.

### doctor_patients

- admin: is_admin() — всё.
- doctor: doctor_id = auth.uid() — свои пациенты.
- patient: patient_id = auth.uid() — свои врачи.

---

## §6. Тест утечки (anon-ключ)

Все 8 таблиц вернули 200 body=[]. Это ожидаемое поведение: anon auth.uid() = NULL, все условия auth.uid() = user_id дают false, 0 строк.

---

## §7. Что осталось на Фазу 6

- UI регистрации врача (роль doctor).
- UI привязки пациентов к врачу (doctor_patients).
- UI дашборда врача — список пациентов, прогресс.
- UI разделения admin / developer в редакторе.

RLS-фундамент готов. Остальное — интерфейс.

---

*Составлено: 2026-10-12.*
