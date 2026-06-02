//=============================================================================
// OllamaLiveTranslator.js — NW.js standalone draggable overlay window
//=============================================================================
/*:
 * @plugindesc Ollama实时翻译 (日→中)
 * @author Cline
 * @target MZ
 * @param ollamaHost
 * @text Ollama API address
 * @type string
 * @default http://localhost:11434
 * @param model
 * @text Model name
 * @type string
 * @default qwen3.5:4b
 * @param opacityPct
 * @text Window opacity (%)
 * @type number
 * @min 30
 * @max 100
 * @default 85
 * @param fontSize
 * @text Font size
 * @type number
 * @min 12
 * @max 32
 * @default 22
 * @param maxTranslations
 * @text Cache size
 * @type number
 * @min 10
 * @max 500
 * @default 200
 * @param requestTimeout
 * @text API timeout (s)
 * @type number
 * @min 5
 * @max 60
 * @default 15
 */

(() => {
    'use strict';

    // =========================================================================
    // File logger
    // =========================================================================
    function _log(msg) {
        try {
            var fs = require('fs');
            var path = require('path');
            var p = path.join(process.cwd(), 'ollama_trans.log');
            fs.appendFileSync(p, new Date().toISOString() + ' ' + msg + '\n');
        } catch (e) { }
    }
    _log('--- Plugin loaded ---');

    // =========================================================================
    // Config
    // =========================================================================
    const config = {
        ollamaHost: 'http://localhost:11434',
        model: 'qwen3.5:4b',
        opacityPct: 85,
        fontSize: 20,
        maxTranslations: 200,
        requestTimeout: 15000,
    };

    // =========================================================================
    // Simple LRU cache
    // =========================================================================
    class TranslationCache {
        constructor(max) { this._m = new Map(); this._max = max; this._pend = new Map(); }
        get(k) { return this._m.get(k); }
        set(k, v) { if (this._m.size >= this._max) this._m.delete(this._m.keys().next().value); this._m.set(k, v); }
        pending(k) { return this._pend.has(k); }
        setPending(k, p) { this._pend.set(k, p); p.finally(() => this._pend.delete(k)); }
    }

    // =========================================================================
    // Strip escape codes
    // =========================================================================
    const Escape = {
        strip(s) {
            if (!s) return '';
            return s.replace(/\\+[CNVIPW]\[.*?\]/gi, '')
                .replace(/\\+[Gg\.\|!\>\<\^\$\{\}Ff](\[.*?\])?/g, '')
                .replace(/\s+/g, ' ').trim();
        },
        hasJapanese(s) { return /[\u3040-\u309F\u30A0-\u30FF]/.test(s); }
    };

    // =========================================================================
    // Ollama caller
    // =========================================================================
    class OllamaTranslator {
        constructor(cache) { this._cache = cache; }
        async translate(text) {
            var raw = Escape.strip(text);
            if (!raw || !Escape.hasJapanese(raw)) return null;
            var c = this._cache.get(raw);
            if (c !== undefined) return c;
            if (this._cache.pending(raw)) {
                try { return await this._cache._pend.get(raw); } catch (e) { return null; }
            }
            var p = this._do(raw);
            this._cache.setPending(raw, p);
            try { var r = await p; this._cache.set(raw, r); return r; }
            catch (e) { return null; }
        }
        async _do(text) {
            var ctrl = new AbortController();
            var tid = setTimeout(() => ctrl.abort(), config.requestTimeout);
            try {
                var resp = await fetch(config.ollamaHost + '/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: config.model,
                        messages: [
                            { role: 'system', content: '你是日→中翻译器。直接输出中文译文，不要思考、不要解释、不要分析。' },
                            { role: 'user', content: text }
                        ],
                        stream: false,
                        think: false  // ✅ 关键：将 think 参数提升到最外层
                    }),
                    signal: ctrl.signal
                });
                if (!resp.ok) throw new Error('HTTP ' + resp.status);
                var d = await resp.json();
                var c = d.message?.content || d.message?.thinking || '';
                c = c.replace(/^Think(ing)?[\s\S]*?:?\s*/i, '')
                    .replace(/^分析[\s\S]*?:?\s*/i, '')
                    .replace(/^思考[\s\S]*?:?\s*/i, '')
                    .replace(/\b(Thinking Process|翻译思路|思考过程|步骤分析)\b[\s\S]*?(?:\n\n|$)/gi, '')
                    .replace(/\`\`\`[\s\S]*?\`\`\`/g, '')
                    .trim();
                return c;
            } finally { clearTimeout(tid); }
        }
    }

    // =========================================================================
    // NW.js standalone draggable translation window
    // =========================================================================
    class TranslationWindow {
        constructor() {
            this._win = null;
            this._doc = null;
            this._ready = false;
            this._queue = [];
            this._history = [];         // { jp: ..., zh: ... }
            this._historyIdx = -1;
            this._fixedHeight = 280;
            this._init();
        }
        _init() {
            try {
                var gui = require('nw.gui');
                var W = 960, H = this._fixedHeight;
                var barH = 28;
                var bodyPad = 18;
                var opts = {
                    frame: false, transparent: true, always_on_top: true, show: false,
                    width: W, height: H,
                    x: (screen.width - W) / 2, y: screen.height - H - 60
                };
                gui.Window.open('about:blank', opts, (win) => {
                    this._win = win;
                    this._doc = win.window.document;
                    this._doc.write(
                        '<!DOCTYPE html><html><head><meta charset="utf-8"><style>' +
                        // ── Reset & base ──
                        'html,body{margin:0;padding:0;overflow:hidden;' +
                        '-webkit-app-region:drag;' +
                        'font-family:"Microsoft YaHei","PingFang SC","SimHei","Noto Sans SC",sans-serif;' +
                        'font-size:' + config.fontSize + 'px;}' +
                        // ── Solid panel background ──
                        'body{' +
                        'background:rgba(18,18,26,0.94);' +
                        'border-radius:12px;' +
                        'box-shadow:0 4px 24px rgba(0,0,0,0.55),0 0 0 1px rgba(255,255,255,0.08) inset;' +
                        'border:1px solid rgba(255,255,255,0.10);' +
                        'margin:0;' +
                        '}' +
                        // ── Title bar ──
                        '#bar{' +
                        'height:' + barH + 'px;' +
                        'background:linear-gradient(180deg,rgba(255,255,255,0.06) 0%,rgba(255,255,255,0.02) 100%);' +
                        'border-bottom:1px solid rgba(255,255,255,0.07);' +
                        'display:flex;align-items:center;' +
                        'padding:0 14px;' +
                        'font-size:11px;color:rgba(255,255,255,0.45);' +
                        'letter-spacing:0.5px;' +
                        'border-radius:12px 12px 0 0;' +
                        '}' +
                        '#bar span{flex:1;}' +
                        '#bar .badge{' +
                        'display:inline-block;' +
                        'background:rgba(99,200,120,0.18);' +
                        'color:rgba(120,230,150,0.85);' +
                        'border-radius:3px;padding:1px 6px;margin-left:6px;' +
                        'font-size:10px;' +
                        '}' +
                        '#bar button{' +
                        '-webkit-app-region:no-drag;' +
                        'background:rgba(255,255,255,0.04);' +
                        'border:1px solid rgba(255,255,255,0.06);' +
                        'border-radius:4px;' +
                        'color:rgba(255,255,255,0.5);' +
                        'cursor:pointer;font-size:12px;' +
                        'padding:2px 8px;margin-left:4px;' +
                        'transition:all 0.15s;' +
                        '}' +
                        '#bar button:hover{' +
                        'background:rgba(255,255,255,0.12);' +
                        'color:rgba(255,255,255,0.9);' +
                        'border-color:rgba(255,255,255,0.2);' +
                        '}' +
                        '#bar button.danger:hover{' +
                        'background:rgba(255,60,60,0.3);' +
                        'border-color:rgba(255,80,80,0.4);' +
                        '}' +
                        // ── Content area ──
                        '#log{' +
                        'max-height:' + (H - barH - bodyPad * 2) + 'px;' +
                        'overflow-y:auto;' +
                        'padding:' + bodyPad + 'px;' +
                        '}' +
                        '#log::-webkit-scrollbar{width:4px;}' +
                        '#log::-webkit-scrollbar-track{background:transparent;}' +
                        '#log::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.12);border-radius:2px;}' +
                        // ── Translation item ──
                        '.item{' +
                        'line-height:1.6;' +
                        'padding:6px 0;' +
                        '}' +
                        '.jp{' +
                        'color:rgba(200,200,210,0.70);' +
                        'font-size:' + Math.max(config.fontSize - 2, 14) + 'px;' +
                        'margin-bottom:4px;' +
                        '}' +
                        '.zh{' +
                        'color:rgba(255,255,255,0.97);' +
                        'font-weight:500;' +
                        'text-shadow:0 1px 3px rgba(0,0,0,0.5);' +
                        'font-size:' + config.fontSize + 'px;' +
                        '}' +
                        // ── Separator ──
                        '.sep{' +
                        'height:1px;' +
                        'background:linear-gradient(90deg,transparent,rgba(255,255,255,0.06),transparent);' +
                        'margin:2px 0 8px 0;' +
                        '}' +
                        // ── Empty state ──
                        '#log .empty{' +
                        'color:rgba(255,255,255,0.25);' +
                        'text-align:center;' +
                        'padding:20px 0;' +
                        'font-size:13px;' +
                        '}' +
                        '</style></head><body>' +
                        '<div id="bar">' +
                        '<span>实时翻译<span class="badge">日→中</span></span>' +
                        '<button title="上一条 (滚轮▲)" onclick="parent._nav(-1)">◂</button>' +
                        '<button title="下一条 (滚轮▼)" onclick="parent._nav(1)">▸</button>' +
                        '<button class="danger" title="清除历史" onclick="parent._clear()">✕</button>' +
                        '</div>' +
                        '<div id="log"><div class="empty">等待对话开始…</div></div>' +
                        '<script>window._nav=null;window._clear=null;</script>' +
                        '</body></html>'
                    );
                    // expose functions to the popup
                    var self = this;
                    this._doc.defaultView._nav = function (d) { self._navigate(d); };
                    this._doc.defaultView._clear = function () { self._clearHistory(); };
                    // wheel scroll to navigate
                    this._doc.defaultView.addEventListener('wheel', function (e) {
                        if (e.deltaY > 30) self._navigate(1);
                        else if (e.deltaY < -30) self._navigate(-1);
                    }, { passive: true });
                    this._ready = true;
                    win.show();
                    win.setAlwaysOnTop(true);
                    // flush queued items
                    for (var i = 0; i < this._queue.length; i++) {
                        var q = this._queue[i];
                        this._showEntry(q.jp, q.zh);
                    }
                    this._queue = [];
                });
            } catch (e) { _log('TranslationWindow error: ' + e.message); }
        }

        _setText(text) {
            // legacy — now unused, kept for safety
            if (!this._ready || !this._doc) { this._queue.push({ jp: '', zh: text }); return; }
            this._showEntry('', text);
        }

        _showEntry(jpText, zhText) {
            if (!this._ready || !this._doc) return;
            var log = this._doc.getElementById('log');
            if (!log) return;
            // remove empty placeholder on first real entry
            var emptyEl = log.querySelector('.empty');
            if (emptyEl) emptyEl.remove();
            // build entry
            var div = this._doc.createElement('div');
            div.className = 'item';
            if (jpText) {
                var j = this._doc.createElement('div');
                j.className = 'jp';
                j.textContent = jpText;
                div.appendChild(j);
                var sep = this._doc.createElement('div');
                sep.className = 'sep';
                div.appendChild(sep);
            }
            var z = this._doc.createElement('div');
            z.className = 'zh';
            z.textContent = zhText;
            div.appendChild(z);
            log.appendChild(div);
            log.scrollTop = log.scrollHeight;
        }

        show(text, jpText) {
            if (!text) return;
            _log('Show: ' + text);
            this._history.push({ jp: jpText || '', zh: text });
            if (this._history.length > 100) this._history.shift();
            this._historyIdx = this._history.length - 1;
            this._renderCurrent();
        }

        _renderCurrent() {
            if (this._historyIdx < 0 || this._historyIdx >= this._history.length) return;
            var entry = this._history[this._historyIdx];
            this._showEntry(entry.jp, entry.zh);
        }

        _navigate(delta) {
            var newIdx = this._historyIdx + delta;
            if (newIdx < 0 || newIdx >= this._history.length) return;
            this._historyIdx = newIdx;
            this._renderCurrent();
        }

        _clearHistory() {
            this._history = [];
            this._historyIdx = -1;
            if (this._doc) {
                var log = this._doc.getElementById('log');
                if (log) {
                    log.innerHTML = '<div class="empty">已清除，等待新对话…</div>';
                }
            }
        }

        hide() {
            if (!this._ready || !this._doc) return;
            if (this._history.length > 0) {
                var log = this._doc.getElementById('log');
                if (log) log.style.opacity = '0.35';
            }
        }

        close() {
            try { if (this._win) this._win.close(true); } catch (e) { }
        }
    }

    // =========================================================================
    // Polling interceptor
    // =========================================================================
    class Interceptor {
        constructor(translator, transWin) {
            this._t = translator; this._w = transWin; this._text = ''; this._tid = null;
        }
        start() { this._tid = setInterval(() => this._scan(), 250); }
        _scan() {
            try {
                if (!SceneManager._scene) return;
                if (typeof $gameMessage === 'undefined') return;
                var win = SceneManager._scene._messageWindow;
                if (!win || !win.visible || !win.openness || win.openness < 255) {
                    this._w.hide(); return;
                }
                var texts = $gameMessage.allText();
                if (!texts) { this._w.hide(); return; }
                var raw = '';
                if (Array.isArray(texts)) { if (texts.length === 0) { this._w.hide(); return; } raw = texts.join(''); }
                else if (typeof texts === 'string') raw = texts;
                else raw = String(texts);
                if (!raw || raw.trim() === '') { this._w.hide(); return; }
                if (raw === this._text) return;
                this._text = raw;
                this._translate(raw);
            } catch (e) { }
        }
        async _translate(raw) {
            this._w.show('...', raw);
            try {
                var s = Escape.strip(raw);
                if (!Escape.hasJapanese(s)) { this._w.hide(); return; }
                var r = await this._t.translate(raw);
                if (r) this._w.show(r, s);
            } catch (e) { _log('_translate err: ' + e.message); }
        }
    }

    // =========================================================================
    // Init
    // =========================================================================
    var _initDone = false;
    var _timer = setInterval(() => {
        if (_initDone) { clearInterval(_timer); return; }
        if (typeof SceneManager === 'undefined') return;
        if (typeof $gameMessage === 'undefined') return;
        if (typeof Window_Message === 'undefined') return;
        _initDone = true;
        try {
            var cache = new TranslationCache(config.maxTranslations);
            var tl = new OllamaTranslator(cache);
            var tw = new TranslationWindow();
            var ic = new Interceptor(tl, tw);
            ic.start();
            console.log('[Ollama] Ready (draggable window mode)');
        } catch (e) { _log('Init error: ' + e.message); }
    }, 500);

})();