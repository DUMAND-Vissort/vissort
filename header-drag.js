// ============================================================
// header-drag.js
// Перетаскивание кнопок в шапке. ПКМ → перетащил → отпустил.
// Порядок сохраняется в localStorage.
// ============================================================
(function installHeaderDrag() {
    'use strict';

    const LS_KEY = 'vissort_header_order';

    function init() {
        const header = document.querySelector('header .header-row');
        if (!header) return;

        let dragEl = null;
        let ghost = null;
        let startX = 0, startY = 0;

        header.addEventListener('contextmenu', (e) => {
            if (e.target.closest('.btn, .status-chip, .counter')) {
                e.preventDefault();
            }
        });

        header.addEventListener('mousedown', (e) => {
            if (e.button !== 2) return;
            const target = e.target.closest('.btn, .status-chip, .counter');
            if (!target) return;
            e.preventDefault();
            e.stopPropagation();

            dragEl = target;
            startX = e.clientX;
            startY = e.clientY;

            const rect = target.getBoundingClientRect();

            ghost = target.cloneNode(true);
            ghost.style.cssText = `
                position: fixed;
                left: ${rect.left}px;
                top: ${rect.top}px;
                width: ${rect.width}px;
                height: ${rect.height}px;
                pointer-events: none;
                z-index: 99999;
                opacity: 0.85;
                transform: scale(1.08);
                box-shadow: 0 8px 20px rgba(0,0,0,0.5);
            `;
            document.body.appendChild(ghost);

            target.style.opacity = '0.25';

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
            document.addEventListener('keydown', onKey);
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'grabbing';
        });

        function onMove(e) {
            if (!ghost || !dragEl) return;
            const rect = dragEl.getBoundingClientRect();
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            ghost.style.left = rect.left + dx + 'px';
            ghost.style.top = rect.top + dy + 'px';
        }

        function onUp(e) {
            if (!dragEl) return;

            const el = dragEl;
            if (ghost) ghost.style.display = 'none';

            const under = document.elementFromPoint(e.clientX, e.clientY);

            cleanup();

            if (!under) return;

            const target = under.closest('.btn, .status-chip, .counter');
            const section = under.closest('.header-section');

            if (target && target !== el) {
                const tr = target.getBoundingClientRect();
                const midX = tr.left + tr.width / 2;
                try {
                    if (e.clientX < midX) {
                        target.parentNode.insertBefore(el, target);
                    } else {
                        target.parentNode.insertBefore(el, target.nextSibling);
                    }
                    saveOrder();
                } catch (err) {
                    console.warn('[header-drag] insertBefore failed:', err);
                }
            } else if (section && section !== el.parentNode) {
                try {
                    section.appendChild(el);
                    saveOrder();
                } catch (err) {
                    console.warn('[header-drag] appendChild failed:', err);
                }
            }
        }

        function onKey(e) {
            if (e.key === 'Escape') cleanup();
        }

        function cleanup() {
            if (ghost) { ghost.remove(); ghost = null; }
            if (dragEl) dragEl.style.opacity = '';
            dragEl = null;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            document.removeEventListener('keydown', onKey);
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        }

        function saveOrder() {
            try {
                const ids = Array.from(header.querySelectorAll('[id]')).map(el => el.id).filter(Boolean);
                localStorage.setItem(LS_KEY, JSON.stringify(ids));
            } catch (_) {}
        }

        function restoreOrder() {
            try {
                const saved = localStorage.getItem(LS_KEY);
                if (!saved) return;
                const ids = JSON.parse(saved);
                ids.forEach(id => {
                    const el = document.getElementById(id);
                    if (!el) return;
                    const parentSection = el.parentNode;
                    if (parentSection && parentSection.classList.contains('header-section')) {
                        parentSection.appendChild(el);
                    }
                });
            } catch (_) {}
        }

        restoreOrder();
        console.log('[header-drag] установлен — ПКМ для перетаскивания');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();