// ==UserScript==
// @name         Luogu Redirect
// @namespace    http://tampermonkey.net/
// @version      0.6
// @description  Redirect Luogu China to international site or luogu.me
// @author       You
// @match        *://*.luogu.com.cn/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const CONFIG = {
        buttonBaseBottom: 20,
        buttonHorizontal: 20,
        buttonStyleId: 'luogu-redirect-style',
        topSectionOffset: 44, // 视觉上上区比下区高出的偏移（用于两区时的整体高度参考）
        minWidth: 120
    };

    const TEMPLATES = {
        article: {
            me: { target: 'https://luogu.me/article$1', domain: 'luogu.me', label: '前往 luogu.me' },
            intl: { target: 'https://luogu.com/article$1', domain: 'luogu.com', label: '前往 国际站' }
        },
        paste: {
            me: { target: 'https://luogu.me/paste$1', domain: 'luogu.me', label: '前往 luogu.me' },
            intl: { target: 'https://luogu.com/paste$1', domain: 'luogu.com', label: '前往 国际站' }
        },
        discuss: {
            intl: { target: 'https://luogu.com/discuss$1', domain: 'luogu.com', label: '前往 国际站' }
        }
    };

    let containerEl = null;
    let observer = null;

    // 等待 body 可用
    function ensureBody(fn) {
        if (document.body) return fn();
        const onReady = () => {
            document.removeEventListener('DOMContentLoaded', onReady);
            fn();
        };
        document.addEventListener('DOMContentLoaded', onReady);
    }

    function buildTargetUrl(template, subpath, currentUrl) {
        const path = subpath || '';
        let target = template.replace('$1', path);
        if (path === '' && target.endsWith('/')) target = target.slice(0, -1);

        try {
            const u = new URL(currentUrl);
            const qs = u.searchParams.toString();
            const hash = u.hash;
            if (qs && !target.includes('?')) target += '?' + qs;
            if (hash && !target.includes('#')) target += hash;
        } catch (e) {
            console.error('URL parse error', e);
        }
        return target;
    }

    function clearButton() {
        if (containerEl && containerEl.parentNode) {
            containerEl.parentNode.removeChild(containerEl);
        }
        containerEl = null;
    }

    function initStyle() {
        if (document.getElementById(CONFIG.buttonStyleId)) return;

        const css = `
            .luogu-redirect-button {
                position: fixed;
                right: ${CONFIG.buttonHorizontal}px;
                bottom: ${CONFIG.buttonBaseBottom}px;
                display: inline-flex;
                flex-direction: column;
                min-width: ${CONFIG.minWidth}px;
                border-radius: 12px;
                background: rgba(255,255,255,0.06);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                border: 1px solid rgba(255,255,255,0.12);
                color: #fff;
                font-weight: 500;
                z-index: 999999;
                box-shadow: 0 6px 24px rgba(0,0,0,0.18);
                overflow: hidden;
                user-select: none;
            }
            .luogu-redirect-button .section {
                padding: 10px 16px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                background: transparent;
            }
            .luogu-redirect-button .section-top {
                border-bottom: 1px solid rgba(255,255,255,0.08);
            }
            .luogu-redirect-button .section:hover {
                background: rgba(255,255,255,0.08);
            }
            @media (max-width: 768px) {
                .luogu-redirect-button { right: 12px; min-width: 100px; }
                .luogu-redirect-button .section { padding: 8px 12px; font-size: 13px; }
            }
        `;

        const attach = () => {
            if (document.getElementById(CONFIG.buttonStyleId)) return;
            const s = document.createElement('style');
            s.id = CONFIG.buttonStyleId;
            s.textContent = css;
            (document.head || document.documentElement).appendChild(s);
        };

        if (document.head) attach();
        else {
            document.addEventListener('DOMContentLoaded', attach, { once: true });
        }
    }

    // actions: [{ label, url }]
    function createUnified(actions) {
        clearButton();
        initStyle();
        containerEl = document.createElement('div');
        containerEl.className = 'luogu-redirect-button';
        containerEl.style.bottom = `${CONFIG.buttonBaseBottom}px`;

        // Single action -> still a rounded rectangle with one section
        if (actions.length === 1) {
            const a = document.createElement('div');
            a.className = 'section section-single';
            a.textContent = actions[0].label;
            a.addEventListener('click', e => {
                e.stopPropagation();
                window.open(actions[0].url, '_blank');
            }, { passive: true });
            containerEl.appendChild(a);
        } else {
            // Two actions: top = actions[0], bottom = actions[1]
            const top = document.createElement('div');
            top.className = 'section section-top';
            top.textContent = actions[0].label;
            top.addEventListener('click', e => {
                e.stopPropagation();
                window.open(actions[0].url, '_blank');
            }, { passive: true });

            const bottom = document.createElement('div');
            bottom.className = 'section section-bottom';
            bottom.textContent = actions[1].label;
            bottom.addEventListener('click', e => {
                e.stopPropagation();
                window.open(actions[1].url, '_blank');
            }, { passive: true });

            containerEl.appendChild(top);
            containerEl.appendChild(bottom);
        }

        ensureBody(() => document.body.appendChild(containerEl));
    }

    function checkAndCreateButtons() {
        // ensure body when mutating DOM or initial run
        ensureBody(() => {
            const host = window.location.hostname || '';
            if (!host.endsWith('luogu.com.cn')) {
                clearButton();
                return;
            }

            const pathname = window.location.pathname || '';
            const types = ['article', 'paste', 'discuss'];
            const matched = types.find(t => pathname === `/${t}` || pathname.startsWith(`/${t}/`));
            if (!matched) {
                clearButton();
                return;
            }

            const tpl = TEMPLATES[matched];
            // compute subpath: keep leading slash if any
            const rest = pathname.slice(matched.length + 1); // remove leading '/' and type
            const subpath = rest ? '/' + rest : '';

            const currentUrl = window.location.href;

            if (matched === 'article' || matched === 'paste') {
                const intl = tpl.intl ? buildTargetUrl(tpl.intl.target, subpath, currentUrl) : null;
                const me = tpl.me ? buildTargetUrl(tpl.me.target, subpath, currentUrl) : null;
                const intlValid = intl && intl !== currentUrl;
                const meValid = me && me !== currentUrl;

                const actions = [];
                if (intlValid) actions.push({ label: tpl.intl.label, url: intl });
                if (meValid) actions.push({ label: tpl.me.label, url: me });

                if (actions.length) createUnified(actions);
                else clearButton();
            } else if (matched === 'discuss') {
                const intl = tpl.intl ? buildTargetUrl(tpl.intl.target, subpath, currentUrl) : null;
                if (intl && intl !== currentUrl) {
                    createUnified([{ label: tpl.intl.label, url: intl }]);
                } else {
                    clearButton();
                }
            }
        });
    }

    // history / SPA handling
    function setupHistoryListeners() {
        const origPush = history.pushState;
        history.pushState = function () {
            const res = origPush.apply(this, arguments);
            setTimeout(checkAndCreateButtons, 120);
            return res;
        };
        const origReplace = history.replaceState;
        history.replaceState = function () {
            const res = origReplace.apply(this, arguments);
            setTimeout(checkAndCreateButtons, 120);
            return res;
        };
        window.addEventListener('popstate', () => setTimeout(checkAndCreateButtons, 120));
    }

    function setupObserver() {
        ensureBody(() => {
            if (observer) {
                try { observer.disconnect(); } catch (e) {}
            }
            observer = new MutationObserver(() => {
                const cur = window.location.href;
                if (observer.lastUrl !== cur) {
                    observer.lastUrl = cur;
                    checkAndCreateButtons();
                }
            });
            observer.lastUrl = window.location.href;
            try {
                observer.observe(document.body, { childList: true, subtree: true });
            } catch (e) {
                // fallback polling
                let last = observer.lastUrl;
                const id = setInterval(() => {
                    if (!document.body) return;
                    const cur = window.location.href;
                    if (cur !== last) {
                        last = cur;
                        checkAndCreateButtons();
                    }
                }, 1000);
                window.addEventListener('beforeunload', () => clearInterval(id));
            }
        });
    }

    function setupUnload() {
        window.addEventListener('beforeunload', () => {
            clearButton();
            if (observer) {
                try { observer.disconnect(); } catch (e) {}
                observer = null;
            }
        });
    }

    // start
    checkAndCreateButtons();
    setupHistoryListeners();
    setupObserver();
    setupUnload();

})();
