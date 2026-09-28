# Vissort — TODO

## 🔴 СРОЧНО (сделать сегодня)

- [ ] **Отозвать скомпрометированный DEEPSEEK_API_KEY**
      Старый: `cf7e5e754ebddf74380fca7b40474f3c6f1607da9df2e25d9e636e94e50f97d3`
      Где: https://platform.deepseek.com/api_keys → найти → Revoke/Delete
      Причина: ключ был опубликован в открытом чате 2026-09-28

- [ ] **Создать новый ключ DeepSeek**
      Там же → Create new API key → скопировать (обычно формат `sk-...`)

- [ ] **Обновить секрет в Supabase**
      https://supabase.com/dashboard/project/hzvypwdpdhsjzaclxmbm/functions/secrets
      Найти `DEEPSEEK_API_KEY` → Edit → вставить новый → Save

- [ ] **Передеплоить функцию (опционально)**
      `.\supabase.exe functions deploy generate-scenario`

## 🧪 ТЕСТЫ (после отзыва ключа)

- [ ] Сбросить Service Worker в браузере (F12 → Application → Unregister → Ctrl+Shift+R)
- [ ] Тест AI-генератора: admin.html → кнопка AI → 3 узла → «Сгенерировать»
- [ ] Тест чтения в графе: узел READING, нажать «Закончить» в последнюю секунду
- [ ] Тест камеры: включить → отойти → выключить → включить → отойти (baseline не должен «застревать»)
- [ ] Тест клавиш в compare: ArrowUp/ArrowDown — игнор, ArrowLeft/ArrowRight — работают

## 🟠 Пакет №2 — существенное (не сделано)

- [ ] `visited` в `buildGraphQueue` мешает петлям при повторных посещениях
- [ ] `_frameSkipCounter` не сбрасывается между сессиями
- [ ] Скрытые chip'ы в admin.html: при узком экране прячут ошибки доступа к папкам
- [ ] `staleWhileRevalidate` в sw.js может вернуть 503 вместо fallback
- [ ] `voice.js`: `el.innerText` → `el.textContent`
- [ ] `knightTour(12)` может не найти обход за 200 попыток
- [ ] `differences-wolf.html`: `S` ограничен 60px — при V=2.0 отличие становится больше нужного
- [ ] CSP с `unsafe-inline` во всех HTML

## 🟡 Пакет №3 — техдолг

- [ ] Разделить `player-runtime.js` (2700 строк) на модули
- [ ] Переименовать `player.js` → `player-config.js`, `user.js` → `user-config.js`
- [ ] Применить Prettier (`npm run format`)
- [ ] `package.json` `"type": "module"` конфликтует с ESLint `sourceType: 'script'`
- [ ] Вынести `_test_graph.json` и `diff.txt` из корня в `tests/` или `_archive/`
- [ ] Удалить старые патч-файлы (`patch1-*.ps1` … `patch6-*.ps1`) после проверки

## 📝 Безопасность (долгосрочно)

- [ ] Выгрузить RLS-политики в `supabase/migrations/001_init.sql` (сейчас их нет в репо)
- [ ] Выгрузить схему таблиц (`pg_dump --schema-only`)
- [ ] Проверить политики: не может ли обычный user читать чужие `test_results`
- [ ] Проверить: не может ли user удалять чужие `scenarios`

## 🎯 Завершено

- [x] Патч 1 — Edge Function `generate-scenario`: auth-проверка
- [x] Патч 2 — `app.js`: `window.supabaseClient`, `params.ppi`
- [x] Патч 3 — `vissort-ai-generator.js`: token, schema, массив/объект, мёртвый код
- [x] Патч 4 — `player-runtime.js`: sessionId, guard, disableCamera, keydown
- [x] Патч 5 — `data-layer.js`: `_reopenAttempts`, expired token, orphan cleanup
- [x] Патч 6 — HTML: адаптивный `#cam-indicator`
- [x] Патч 7 — деплой Edge Functions