// ============================================================
// voice.js — голосовое сопровождение тренировки + чтение вслух.
// Web Speech API, русские системные голоса, без интернета.
// Публичный интерфейс: window.Voice
// ============================================================
(function installVoice() {
    'use strict';

    const LS = {
        enabled: 'vissort_voice_enabled',
        voice:   'vissort_voice_name',
        rate:    'vissort_voice_rate',
        volume:  'vissort_voice_volume',
        readingRate: 'vissort_voice_readingRate'
    };

    const Voice = {
        enabled: true,
        voiceName: null,
        rate: 1.0,
        volume: 1.0,
        readingRate: 1.0,
        _voices: [],
        _lastText: '',
        _lastTime: 0,

        reading: {
            active: false,
            paused: false,
            sentences: [],
            index: 0,
            currentUtterance: null
        },

        init() {
            if (!('speechSynthesis' in window)) {
                console.warn('[voice] Web Speech API не поддерживается');
                this.enabled = false;
                return;
            }
            const e = localStorage.getItem(LS.enabled);
            if (e !== null) this.enabled = e === 'true';
            const v = localStorage.getItem(LS.voice); if (v) this.voiceName = v;
            const r = parseFloat(localStorage.getItem(LS.rate));
            if (!isNaN(r) && r >= 0.5 && r <= 2) this.rate = r;
            const vol = parseFloat(localStorage.getItem(LS.volume));
            if (!isNaN(vol) && vol >= 0 && vol <= 1) this.volume = vol;
            const rr = parseFloat(localStorage.getItem(LS.readingRate));
            if (!isNaN(rr) && rr >= 0.5 && rr <= 2) this.readingRate = rr;
            this._loadVoices();
            if (window.speechSynthesis.onvoiceschanged !== undefined) {
                window.speechSynthesis.onvoiceschanged = () => this._loadVoices();
            }
        },

        _loadVoices() {
            const all = window.speechSynthesis.getVoices();
            this._voices = all.filter(v => /^ru/i.test(v.lang));
            if (this._voices.length === 0) this._voices = all;
            console.log('[voice] голосов:', this._voices.length,
                this._voices.map(v => v.name + ' (' + v.lang + ')').join(', '));
        },

        _pickVoice() {
            if (!this._voices.length) return null;
            if (this.voiceName) {
                const f = this._voices.find(v => v.name === this.voiceName);
                if (f) return f;
            }
            const ru = this._voices.filter(v => /^ru/i.test(v.lang));
            if (ru.length) {
                const female = ru.find(v => /female|женск|milena|alena|irina|katya|svetlana/i.test(v.name));
                if (female) return female;
                const local = ru.find(v => v.localService);
                return local || ru[0];
            }
            return this._voices[0];
        },

        say(text, opts = {}) {
            if (!this.enabled) return;
            if (!('speechSynthesis' in window)) return;
            if (!text) return;
            const now = performance.now();
            if (!opts.allowRepeat && text === this._lastText && now - this._lastTime < 700) return;
            this._lastText = text; this._lastTime = now;
            if (opts.cancel) { try { window.speechSynthesis.cancel(); } catch (_) {} }
            const u = new SpeechSynthesisUtterance(text);
            const v = this._pickVoice();
            if (v) u.voice = v;
            u.lang = (v && v.lang) || 'ru-RU';
            u.rate = (opts.rate != null ? opts.rate : this.rate);
            u.volume = (opts.volume != null ? opts.volume : this.volume);
            u.pitch = (opts.pitch != null ? opts.pitch : 1.0);
            try { window.speechSynthesis.speak(u); } catch (e) { console.warn('[voice] speak:', e); }
        },

        cancel() { try { window.speechSynthesis.cancel(); } catch (_) {} },

        mute(flag) {
            this.enabled = !flag;
            localStorage.setItem(LS.enabled, String(this.enabled));
            if (!this.enabled) { this.cancel(); this.stopReading(); }
        },
        toggle() { this.mute(this.enabled); return this.enabled; },

        setVoice(name) {
            this.voiceName = name || null;
            if (name) localStorage.setItem(LS.voice, name);
            else localStorage.removeItem(LS.voice);
        },
        setRate(r) { r = Math.max(0.5, Math.min(2, parseFloat(r) || 1)); this.rate = r; localStorage.setItem(LS.rate, String(r)); },
        setVolume(v) { v = Math.max(0, Math.min(1, parseFloat(v) || 1)); this.volume = v; localStorage.setItem(LS.volume, String(v)); },
        setReadingRate(r) { r = Math.max(0.5, Math.min(2, parseFloat(r) || 1)); this.readingRate = r; localStorage.setItem(LS.readingRate, String(r)); },
        listVoices() { return this._voices.slice(); },

        // ============================================================
        // ЧТЕНИЕ ВСЛУХ
        // ============================================================

        _splitSentences(text) {
            if (!text) return [];
            // Без lookbehind — совместимо с Safari < 16.4
            const rough = [];
            const re = /[^.!?…]+[.!?…]+|[^.!?…]+$/g;
            const norm = text.replace(/\s+/g, ' ').trim();
            let m;
            while ((m = re.exec(norm)) !== null) {
                const s = m[0].trim();
                if (s) rough.push(s);
            }
            const result = [];
            const MAX = 220;
            for (const s of rough) {
                if (s.length <= MAX) { result.push(s); continue; }
                let buf = '';
                const parts = s.split(/(?<=,)\s+/);
                for (const part of parts) {
                    if ((buf + ' ' + part).trim().length > MAX && buf) {
                        result.push(buf.trim()); buf = part;
                    } else {
                        buf = (buf + ' ' + part).trim();
                    }
                }
                if (buf) result.push(buf.trim());
            }
            return result;
        },

        readText(text, startIndex = 0) {
            if (!this.enabled) { console.warn('[voice] озвучивание выключено'); return; }
            if (!('speechSynthesis' in window)) return;
            this.stopReading();
            const sentences = this._splitSentences(text);
            if (sentences.length === 0) return;
            this.reading.active = true;
            this.reading.paused = false;
            this.reading.sentences = sentences;
            this.reading.index = Math.max(0, Math.min(startIndex, sentences.length - 1));
            console.log('[voice] чтение вслух, предложений:', sentences.length);
            updateReadingUI();
            this._readNext();
        },

        _readNext() {
            if (!this.reading.active || this.reading.paused) return;
            if (this.reading.index >= this.reading.sentences.length) {
                this.stopReading(true);
                return;
            }
            const text = this.reading.sentences[this.reading.index];
            const u = new SpeechSynthesisUtterance(text);
            const v = this._pickVoice();
            if (v) u.voice = v;
            u.lang = (v && v.lang) || 'ru-RU';
            u.rate = this.readingRate;
            u.volume = this.volume;
            u.pitch = 1.0;
            u.onend = () => {
                if (!this.reading.active || this.reading.paused) return;
                this.reading.index++;
                updateReadingUI();
                this._readNext();
            };
            u.onerror = (e) => {
                if (e.error === 'interrupted' || e.error === 'canceled') return;
                console.warn('[voice] utterance error:', e.error);
            };
            this.reading.currentUtterance = u;
            try { window.speechSynthesis.speak(u); } catch (e) { console.warn('[voice] speak:', e); }
        },

        pauseReading() {
            if (!this.reading.active) return;
            this.reading.paused = true;
            try { window.speechSynthesis.cancel(); } catch (_) {}
            updateReadingUI();
        },

        resumeReading() {
            if (!this.reading.active || !this.reading.paused) return;
            this.reading.paused = false;
            updateReadingUI();
            this._readNext();
        },

        stopReading(completed = false) {
            this.reading.active = false;
            this.reading.paused = false;
            try { window.speechSynthesis.cancel(); } catch (_) {}
            updateReadingUI();
        },

        nextSentence() {
            if (!this.reading.active) return;
            this.reading.index = Math.min(this.reading.index + 1, this.reading.sentences.length - 1);
            try { window.speechSynthesis.cancel(); } catch (_) {}
            updateReadingUI();
            this._readNext();
        },

        prevSentence() {
            if (!this.reading.active) return;
            this.reading.index = Math.max(0, this.reading.index - 1);
            try { window.speechSynthesis.cancel(); } catch (_) {}
            updateReadingUI();
            this._readNext();
        },

        jumpToSentence(i) {
            if (!this.reading.active) return;
            this.reading.index = Math.max(0, Math.min(i, this.reading.sentences.length - 1));
            try { window.speechSynthesis.cancel(); } catch (_) {}
            updateReadingUI();
            this._readNext();
        },

        isReading() { return this.reading.active && !this.reading.paused; },
        isReadingPaused() { return this.reading.active && this.reading.paused; },

        readReadingContent() {
            const el = document.getElementById('reading-content');
            if (!el) { console.warn('[voice] #reading-content не найден'); return; }
            const text = el.innerText || el.textContent || '';
            this.readText(text, 0);
        }
    };

    window.Voice = Voice;

    function ensureStyle() {
        if (document.getElementById('voice-style')) return;
        const st = document.createElement('style');
        st.id = 'voice-style';
        st.textContent = `
            #voice-reading-bar {
                display: none;
                align-items: center;
                gap: 8px;
                padding: 6px 10px;
                background: rgba(15, 23, 42, 0.9);
                border-radius: 6px;
                margin-left: 8px;
                color: #fff;
                font-size: 13px;
            }
            #voice-reading-bar.visible { display: flex; }
            #voice-reading-bar .vrb-btn {
                background: #334155;
                color: #fff;
                border: none;
                border-radius: 4px;
                padding: 4px 8px;
                cursor: pointer;
                font-size: 13px;
            }
            #voice-reading-bar .vrb-btn:hover { background: #475569; }
            #voice-reading-bar .vrb-progress {
                background: #1e293b;
                padding: 2px 8px;
                border-radius: 4px;
                font-size: 12px;
                min-width: 60px;
                text-align: center;
            }
        `;
        document.head.appendChild(st);
    }

    function ensureHeaderButton() {
        if (document.getElementById('btn-voice')) return;
        const anchor = document.getElementById('btn-keepalive') || document.getElementById('btn-auth');
        if (!anchor || !anchor.parentNode) return;
        const btn = document.createElement('button');
        btn.id = 'btn-voice';
        btn.className = 'btn btn-secondary';
        btn.type = 'button';
        btn.style.cssText = 'position:relative;';
        btn.textContent = Voice.enabled ? '🔊' : '🔇';
        btn.title = 'Озвучивание: вкл/выкл (M). Shift+клик — выбрать голос.';
        btn.addEventListener('click', (e) => {
            if (e.shiftKey) { openVoicePicker(); return; }
            const on = Voice.toggle();
            btn.textContent = on ? '🔊' : '🔇';
        });
        anchor.parentNode.insertBefore(btn, anchor);
    }

    function ensureReadingBar() {
        if (document.getElementById('voice-reading-bar')) return null;
        const toolbar = document.getElementById('reading-toolbar');
        if (!toolbar) return null;
        const bar = document.createElement('div');
        bar.id = 'voice-reading-bar';
        bar.innerHTML = `
            <button class="vrb-btn" id="vrb-start" title="Начать чтение вслух">🔊 Читать</button>
            <button class="vrb-btn" id="vrb-pause" title="Пауза" style="display:none;">⏸</button>
            <button class="vrb-btn" id="vrb-resume" title="Продолжить" style="display:none;">▶</button>
            <button class="vrb-btn" id="vrb-stop" title="Остановить" style="display:none;">⏹</button>
            <button class="vrb-btn" id="vrb-prev" title="Предыдущее предложение" style="display:none;">⏮</button>
            <button class="vrb-btn" id="vrb-next" title="Следующее предложение" style="display:none;">⏭</button>
            <span class="vrb-progress" id="vrb-progress" style="display:none;">— / —</span>
        `;
        toolbar.appendChild(bar);
        bar.querySelector('#vrb-start').addEventListener('click', () => Voice.readReadingContent());
        bar.querySelector('#vrb-pause').addEventListener('click', () => Voice.pauseReading());
        bar.querySelector('#vrb-resume').addEventListener('click', () => Voice.resumeReading());
        bar.querySelector('#vrb-stop').addEventListener('click', () => Voice.stopReading());
        bar.querySelector('#vrb-prev').addEventListener('click', () => Voice.prevSentence());
        bar.querySelector('#vrb-next').addEventListener('click', () => Voice.nextSentence());
        return bar;
    }

    function updateReadingUI() {
        const bar = document.getElementById('voice-reading-bar');
        if (!bar) return;
        const startBtn = bar.querySelector('#vrb-start');
        const pauseBtn = bar.querySelector('#vrb-pause');
        const resumeBtn = bar.querySelector('#vrb-resume');
        const stopBtn = bar.querySelector('#vrb-stop');
        const prevBtn = bar.querySelector('#vrb-prev');
        const nextBtn = bar.querySelector('#vrb-next');
        const prog = bar.querySelector('#vrb-progress');

        const r = Voice.reading;
        if (!r.active) {
            bar.classList.remove('visible');
            startBtn.style.display = '';
            pauseBtn.style.display = 'none';
            resumeBtn.style.display = 'none';
            stopBtn.style.display = 'none';
            prevBtn.style.display = 'none';
            nextBtn.style.display = 'none';
            prog.style.display = 'none';
            return;
        }
        bar.classList.add('visible');
        startBtn.style.display = 'none';
        stopBtn.style.display = '';
        prevBtn.style.display = '';
        nextBtn.style.display = '';
        prog.style.display = '';
        if (r.paused) { pauseBtn.style.display = 'none'; resumeBtn.style.display = ''; }
        else { pauseBtn.style.display = ''; resumeBtn.style.display = 'none'; }
        prog.textContent = `${r.index + 1} / ${r.sentences.length}`;
    }

    function openVoicePicker() {
        const m = document.getElementById('voice-picker-modal');
        if (m) { m.style.display = 'flex'; renderVoiceList(); return; }
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'voice-picker-modal';
        modal.style.cssText = 'display:flex;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:1500;justify-content:center;align-items:center;';
        modal.innerHTML = `
            <div class="modal-content" style="width:540px;max-width:92vw;max-height:80vh;overflow-y:auto;">
                <h3>🔊 Голос озвучивания</h3>
                <div id="voice-list" style="margin:10px 0;"></div>
                <label>Скорость тренировки: <span id="voice-rate-val"></span></label>
                <input type="range" id="voice-rate" min="0.5" max="2" step="0.1" style="width:100%;">
                <label>Скорость чтения: <span id="voice-rrate-val"></span></label>
                <input type="range" id="voice-rrate" min="0.5" max="2" step="0.1" style="width:100%;">
                <label>Громкость: <span id="voice-volume-val"></span></label>
                <input type="range" id="voice-volume" min="0" max="1" step="0.05" style="width:100%;">
                <div class="modal-footer" style="justify-content:flex-end;margin-top:14px;">
                    <button class="btn btn-success" id="voice-test">🔈 Проверить</button>
                    <button class="btn btn-secondary" id="voice-close">Закрыть</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target.id === 'voice-picker-modal') modal.style.display = 'none'; });
        modal.querySelector('#voice-close').addEventListener('click', () => { modal.style.display = 'none'; });
        modal.querySelector('#voice-test').addEventListener('click', () => Voice.say('Правильно. Не отклоняйтесь. Осталось пять секунд.', { cancel: true, allowRepeat: true }));
        const rateEl = modal.querySelector('#voice-rate');
        rateEl.value = Voice.rate;
        modal.querySelector('#voice-rate-val').textContent = Voice.rate.toFixed(1);
        rateEl.addEventListener('input', () => { Voice.setRate(rateEl.value); modal.querySelector('#voice-rate-val').textContent = Voice.rate.toFixed(1); });
        const rrateEl = modal.querySelector('#voice-rrate');
        rrateEl.value = Voice.readingRate;
        modal.querySelector('#voice-rrate-val').textContent = Voice.readingRate.toFixed(1);
        rrateEl.addEventListener('input', () => { Voice.setReadingRate(rrateEl.value); modal.querySelector('#voice-rrate-val').textContent = Voice.readingRate.toFixed(1); });
        const volEl = modal.querySelector('#voice-volume');
        volEl.value = Voice.volume;
        modal.querySelector('#voice-volume-val').textContent = Math.round(Voice.volume * 100) + '%';
        volEl.addEventListener('input', () => { Voice.setVolume(volEl.value); modal.querySelector('#voice-volume-val').textContent = Math.round(Voice.volume * 100) + '%'; });
        renderVoiceList();
    }

    function renderVoiceList() {
        const c = document.getElementById('voice-list');
        if (!c) return;
        const list = Voice.listVoices();
        c.innerHTML = '';
        if (list.length === 0) {
            c.innerHTML = '<div style="color:#888;font-size:13px;padding:10px;">Голоса ещё не загружены. Нажмите «Проверить».</div>';
            return;
        }
        const current = Voice._pickVoice();
        list.forEach(v => {
            const item = document.createElement('div');
            item.style.cssText = `padding:8px 12px;border-radius:4px;cursor:pointer;margin-bottom:4px;background:${current && current.name === v.name ? '#075985' : '#16161a'};color:#eee;font-size:13px;display:flex;justify-content:space-between;`;
            item.innerHTML = `<span>${v.name}</span><span style="color:#888;">${v.lang}${v.localService ? ' · offline' : ''}</span>`;
            item.addEventListener('click', () => {
                Voice.setVoice(v.name);
                renderVoiceList();
                Voice.say('Голос выбран', { cancel: true, allowRepeat: true });
            });
            c.appendChild(item);
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
        if (e.key === 'm' || e.key === 'M' || e.key === 'ь' || e.key === 'Ь') {
            const on = Voice.toggle();
            const btn = document.getElementById('btn-voice');
            if (btn) btn.textContent = on ? '🔊' : '🔇';
        }
    });

    function watchReadingViewport() {
        const vp = document.getElementById('reading-viewport');
        if (!vp || vp._voiceObserved) return;
        vp._voiceObserved = true;
        const obs = new MutationObserver(() => {
            const bar = ensureReadingBar();
            if (!bar) return;
            if (vp.style.display === 'block') {
                bar.classList.add('visible');
                updateReadingUI();
            } else {
                bar.classList.remove('visible');
                if (Voice.reading.active) Voice.stopReading();
            }
        });
        obs.observe(vp, { attributes: true, attributeFilter: ['style'] });
    }

    function boot() {
        Voice.init();
        ensureStyle();
        ensureHeaderButton();
        ensureReadingBar();
        watchReadingViewport();
        const vp = document.getElementById('reading-viewport');
        const bar = document.getElementById('voice-reading-bar');
        if (vp && vp.style.display === 'block' && bar) bar.classList.add('visible');
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
    window.addEventListener('load', () => {
        setTimeout(() => Voice._loadVoices(), 500);
        ensureReadingBar();
        watchReadingViewport();
    });

    console.log('[voice] модуль установлен');
})();