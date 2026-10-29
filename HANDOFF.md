# Vissort — HANDOFF (Итоги сессии 29.10.2026)

## 🚨 ТЕКУЩАЯ ПРОБЛЕМА (с чего начать)
В инспекторе стимула (`admin.html` → узел «Стимул») **не отображается** галочка «👁️ Ожидать ответы».
- В коде (`app-inspector.js`, строка 149) она **есть** с `display:block`.
- В браузере (DevTools) у неё **`display: none`** (inline-стиль).
- **Причина:** дубль строки или кэш Service Worker.
- **Что проверить:** `Select-String -Path app-inspector.js -Pattern "inp-active" -Context 2,2`
- **Как починить:** удалить дубль или очистить кэш (DevTools → Application → Clear storage).

**Также:** блок «✨ Живой стимул» (кадры) внизу инспектора **не отображается**, потому что в `applyStimulusInspectorChanges` мы ищем `inp-dyn-enabled`, которой нет (мы её удалили). Нужно принудительно ставить `node.params.stimulusDynamic.active = true` при сохранении.

## ✅ ЧТО СДЕЛАНО ЗА СЕССИЮ (НЕ ЛОМАТЬ!)
1. **Создан новый движок `AppPlayer` (`app-player.js`)** — заменяет старый `app-player-preview.js`.
2. **`AppPlayer` умеет:** запускать ЖС, обычные стимулы, серии, переходы между узлами.
3. **`vissort-core.js`** — `playDynamicStimulus` играет один кадр за раз (принимает `frameIndex`). Исправлен баг с цветом (`stimR/G/B = 0`).
4. **Инспектор** — скрыты блоки «Цвета», «Цикл показа», «Динамика», «Круг». Галочка «Активная тренировка» → «👁️ Ожидать ответы». «Адаптивная острота» → в блок «Острота зрения».
5. **`admin.html`** — подключены `player-core.js` и `app-player.js`.

## 📁 СПИСОК ФАЙЛОВ ДЛЯ НОВОГО ЧАТА
1. `app-inspector.js` (проблема с галочкой)
2. `app-player.js` (новый движок)
3. `vissort-core.js` (ядро, ЖС)
4. `player-core.js` (обертка)
5. `HANDOFF.md` (этот файл)

## 🎯 ЧТО ОСТАЛОСЬ (Фаза 3)
1. Починить галочку «Ожидать ответы» и блок ЖС.
2. Ветвление (Логика): чекбокс + 3 точки на узле + выбор ветки в плеере.
3. Перенос COMPARE в AppPlayer.
4. Перенос READING в AppPlayer.
5. Удаление старого кода (app-player-preview.js, player-single.js, player-graph.js).
6. Тесты (npx playwright test).