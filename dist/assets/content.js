(function(){let d=null,r=null,h="",w="",b=!1,p=null;chrome.runtime.onMessage.addListener(e=>{console.log("[Content] Message received:",e.type),e.type==="SHOW_POPUP"?C(e.text,e.content,e.isDone,e.error):e.type==="ANALYSIS_CHUNK"?e.error?m(e.error):y(e.text,!1):e.type==="ANALYSIS_DONE"?e.error?m(e.error):y(e.text,!0):e.type==="ANALYSIS_ERROR"?m(e.error):e.type==="CHUNK_RESULT"?H(e.text):e.type==="CHUNK_ERROR"?I(e.error):e.type==="CLOSE_POPUP"&&f()}),chrome.storage.onChanged.addListener(e=>{(e.gemini1MinUsage||e.geminiUsage)&&z(),e.fontSize&&x()}),document.addEventListener("keydown",e=>{e.key==="Escape"&&d&&f()});function C(e,t,n,o){console.log("[Content] showPopup called:",{text:e,initialIsDone:n}),f(),w=e,h=t||"",b=n||!1,p=new AbortController,console.log("[Content] Creating popup..."),d=document.createElement("div"),d.id="get-popup-host",d.style.cssText="position: absolute; top: 0; left: 0; width: 0; height: 0; pointer-events: none; z-index: 2147483647; margin: 0; padding: 0; border: none;",r=d.attachShadow({mode:"open"});const a=document.createElement("style");a.textContent=U(),r.appendChild(a);const l=document.createElement("link");l.href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+JP:wght@400;500;600;700&display=swap",l.rel="stylesheet",r.appendChild(l);const i=document.createElement("div");i.className="get-popup";const c=e.length>50?e.substring(0,50)+"…":e;if(i.innerHTML=`
      <div class="get-header">
        <div class="get-header-left">
          <svg class="get-header-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
          </svg>
          <div class="get-title-group">
            <span class="get-title">Gemini English Tutor</span>
            <div class="get-usage-container" id="get-usage-container">
              <div class="get-usage-bar">
                <div class="get-usage-fill" id="get-usage-fill" style="width: 100%"></div>
              </div>
              <span class="get-usage-text" id="get-usage-text">残り 20回</span>
            </div>
          </div>
        </div>
        <div class="get-header-right">
          <button class="get-header-btn" id="get-font-minus" title="文字を小さく">A-</button>
          <button class="get-header-btn" id="get-font-plus" title="文字を大きく">A+</button>
          <button class="get-header-btn get-chunk-btn" title="チャンク区切り（意味の単位で／区切り）">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 6h16"></path>
              <path d="M4 12h16"></path>
              <path d="M4 18h16"></path>
            </svg>
            <span>／</span>
          </button>
          <button class="get-header-btn get-popout-btn" title="別ウィンドウで表示">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </button>
          <button class="get-header-btn get-close-btn" title="閉じる (Esc)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
      <div class="get-source">${g(c)}</div>
      <div class="get-body" id="get-popup-body">
        <div class="get-content">
          ${t||o?o?"error_placeholder":E(t):`
          <div class="get-loading">
            <div class="get-spinner"></div>
            <span>解析中...</span>
          </div>`}
        </div>
      </div>
      <div class="get-resize-handle"></div>
    `,o){const s=i.querySelector(".get-content");s&&(s.innerHTML=`
          <div class="get-error">
            <div class="get-error-icon">⚠️</div>
            <div class="get-error-text">${g(o)}</div>
            <div class="get-error-hint">拡張機能アイコンをクリックしてAPIキーを設定してください。</div>
          </div>
        `)}r.appendChild(i),document.body.appendChild(d),M(i),P(i),B(i),r.querySelector(".get-close-btn")?.addEventListener("click",f),r.querySelector(".get-chunk-btn")?.addEventListener("click",()=>{q()}),r.getElementById("get-font-plus")?.addEventListener("click",()=>{S(1)}),r.getElementById("get-font-minus")?.addEventListener("click",()=>{S(-1)}),r.querySelector(".get-popout-btn")?.addEventListener("click",()=>{chrome.runtime.sendMessage({type:"OPEN_IN_WINDOW",sourceText:w,content:h,isDone:b}),f()}),z(),x(),chrome.runtime.sendMessage({type:"REQUEST_ANALYSIS_RESUME"})}function S(e){chrome.storage.local.get(["fontSize"],t=>{const n=t.fontSize!==void 0?t.fontSize:14,o=Math.max(10,Math.min(32,n+e));chrome.storage.local.set({fontSize:o},()=>{r&&x()})})}function x(){chrome.storage.local.get(["fontSize"],e=>{if(!r)return;const t=e.fontSize!==void 0?e.fontSize:14,n=r.getElementById("get-popup-body");n&&n.style.setProperty("--popup-font-size",`${t}px`)})}function z(){chrome.storage.local.get(["geminiDisplayUsage","geminiUsage","gemini1MinUsage","geminiLimit","geminiModel"],e=>{if(!r)return;const t=e.geminiLimit,n=t&&t>0?t:20,o=e.geminiDisplayUsage!==void 0?e.geminiDisplayUsage:n,a=e.geminiUsage!==void 0?e.geminiUsage:n,l=r.getElementById("get-usage-fill"),i=r.getElementById("get-usage-text"),c=r.getElementById("get-usage-container");l&&(l.style.width=`${Math.min(100,Math.max(0,o/n*100))}%`,l.style.backgroundColor=o/n>.6?"#10b981":o/n>.2?"#fbbf24":"#ef4444"),i&&(i.textContent=`残り ${o}回`),c&&(c.title=`Gemini API 使用状況:
・本日残り: ${a}回 / ${n}回
※無料枠の性質上、回数が残っていてもサーバー側で制限される場合があります。`)})}function M(e){const t=window.scrollX,n=window.scrollY,o=window.innerWidth,a=window.innerHeight,l=520,i=480;let c=t+o/2-l/2,s=n+Math.max(40,(a-i)/3);c+l>t+o-16&&(c=t+o-l-16),c<t+16&&(c=t+16),s+i>n+a-16&&(s=n+a-i-16),s<n+16&&(s=n+16),console.log("[Content] Positioning popup at:",{left:c,top:s,scrollX:t,scrollY:n}),e.style.left=c+"px",e.style.top=s+"px"}function q(){if(!r||!h)return;const e=r.querySelector(".get-body"),t=r.querySelector(".get-chunk-btn");e&&(e.classList.toggle("show-chunks"),t&&t.classList.toggle("active",e.classList.contains("show-chunks")))}function H(e){if(!r)return;const t=r.querySelector(".get-chunk-btn");t&&(t.classList.remove("loading"),t.removeAttribute("disabled")),y(e,!0)}function I(e){if(!r)return;const t=r.querySelector(".get-chunk-btn");t&&(t.classList.remove("loading"),t.removeAttribute("disabled"))}function y(e,t){if(!r)return;const n=r.querySelector(".get-content");if(n&&((e||t)&&(n.innerHTML=E(e)),h=e,b=t,!t&&(e||t))){const o=r.querySelector(".get-body");o&&(o.scrollTop=o.scrollHeight)}}function E(e){const t=e.split(`
`),n=[];let o=!1,a=[];for(let l=0;l<t.length;l++){const i=t[l];if(i.trim()==="---"||i.trim()==="***"||i.trim()==="___"){o&&(n.push(v(a)),a=[],o=!1),n.push('<hr class="get-hr">');continue}if(i.startsWith("> ")){o=!0,a.push(i.slice(2));continue}else o&&(n.push(v(a)),a=[],o=!1);if(i.trim()===""){n.length>0&&!n[n.length-1].includes("get-spacer")&&n.push('<div class="get-spacer"></div>');continue}if(i.startsWith("💡")){const s=g(i.slice(2).trim());n.push(`<div class="get-tip"><span class="get-tip-icon">💡</span><span>${L(s)}</span></div>`);continue}const c=L(g(i));n.push(`<div class="get-line">${c}</div>`)}return o&&a.length>0&&n.push(v(a)),n.join("")}function v(e){return`<blockquote class="get-blockquote">${e.map(n=>{let o=g(n);return o=o.replace(/／/g,'<span class="get-chunk-slash">／</span>'),o}).join("<br>")}</blockquote>`}function L(e){return e=e.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>"),e=e.replace(/\*(.+?)\*/g,"<em>$1</em>"),e=e.replace(/`(.+?)`/g,'<code class="get-code">$1</code>'),e=e.replace(/"([^"]+)"/g,'<span class="get-phrase">"$1"</span>'),e=e.replace(/／/g,'<span class="get-chunk-slash">／</span>'),e}function m(e){if(!r)return;const t=r.querySelector(".get-content");t&&(t.innerHTML=`
      <div class="get-error">
        <div class="get-error-icon">⚠️</div>
        <div class="get-error-text">${g(e)}</div>
        <div class="get-error-hint">拡張機能アイコンをクリックしてAPIキーを設定してください。</div>
      </div>
    `)}function f(){const e=document.getElementById("get-popup-host");e&&e.remove(),p&&(p.abort(),p=null),d&&(d.parentNode&&d.remove(),d=null,r=null)}function P(e){const t=e.querySelector(".get-header");if(!t)return;const n=p?.signal;let o=!1,a,l,i,c;t.addEventListener("mousedown",s=>{if(s.target.closest("button"))return;o=!0,a=s.clientX,l=s.clientY;const u=window.getComputedStyle(e);i=parseInt(u.left)||0,c=parseInt(u.top)||0,t.style.cursor="grabbing",s.preventDefault()},{signal:n}),document.addEventListener("mousemove",s=>{if(!o)return;const u=s.clientX-a,k=s.clientY-l;e.style.left=i+u+"px",e.style.top=c+k+"px"},{signal:n}),document.addEventListener("mouseup",()=>{o&&(o=!1,t.style.cursor="grab")},{signal:n})}function B(e){const t=e.querySelector(".get-resize-handle");if(!t)return;const n=p?.signal;let o=!1,a,l,i,c;t.addEventListener("mousedown",s=>{o=!0,a=s.clientX,l=s.clientY,i=e.offsetWidth,c=e.offsetHeight,s.preventDefault(),s.stopPropagation()},{signal:n}),document.addEventListener("mousemove",s=>{if(!o)return;const u=Math.max(320,i+(s.clientX-a)),k=Math.max(200,c+(s.clientY-l));e.style.width=u+"px",e.style.height=k+"px"},{signal:n}),document.addEventListener("mouseup",()=>{o=!1},{signal:n})}function g(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}function U(){return`
      :host {
        all: initial;
        font-family: 'Inter', 'Noto Sans JP', -apple-system, BlinkMacSystemFont, sans-serif;
      }

      .get-popup {
        position: absolute;
        pointer-events: auto; /* ホストの none を打ち消し、自分自身へのクリックを有効化 */
        z-index: 2147483647;
        width: 520px;
        height: 480px;
        min-width: 320px;
        min-height: 200px;
        display: flex;
        flex-direction: column;
        background: linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.98) 100%);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(148, 163, 184, 0.2);
        border-radius: 14px;
        box-shadow:
          0 4px 6px -1px rgba(0, 0, 0, 0.05),
          0 10px 15px -3px rgba(0, 0, 0, 0.08),
          0 25px 50px -12px rgba(0, 0, 0, 0.15);
        overflow: hidden;
        animation: get-popup-in 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        font-family: 'Inter', 'Noto Sans JP', -apple-system, BlinkMacSystemFont, sans-serif;
        font-size: 13px;
        line-height: 1.55;
        color: #1e293b;
        --popup-font-size: 14px;
      }

      @keyframes get-popup-in {
        from { opacity: 0; transform: translateY(6px) scale(0.98); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }

      /* ========== Header ========== */
      .get-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 50%, #3b82f6 100%);
        cursor: grab;
        user-select: none;
        flex-shrink: 0;
      }
      .get-header:active {
        cursor: grabbing;
      }

      .get-header-left {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
        flex: 1;
      }

      .get-header-right {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
      }
      
      .get-header-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 26px;
        height: 26px;
        border: none;
        background: rgba(255, 255, 255, 0.12);
        color: rgba(255, 255, 255, 0.85);
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.15s ease;
        font-size: 11px;
        font-weight: 700;
        padding: 0;
      }

      .get-header-btn:hover {
        background: rgba(255, 255, 255, 0.25);
        color: #ffffff;
      }

      .get-header-icon {
        color: rgba(255,255,255,0.8);
        flex-shrink: 0;
      }

      .get-title {
        font-size: 13px;
        font-weight: 600;
        color: #ffffff;
        letter-spacing: 0.2px;
      }

      .get-chunk-btn svg { margin-bottom: 0px; }
      .get-chunk-btn span { margin-left: -2px; }

      .get-chunk-btn.active {
        background: rgba(255, 255, 255, 0.28);
        color: #ffffff;
      }

      .get-close-btn:hover {
        background: rgba(239, 68, 68, 0.6) !important;
      }

      /* ========== Usage Display ========== */
      .get-title-group {
        display: flex;
        flex-direction: column;
        gap: 1px;
        min-width: 0;
      }

      .get-usage-container {
        display: flex;
        align-items: center;
        gap: 5px;
        opacity: 0.9;
      }

      .get-usage-bar {
        width: 60px;
        height: 3px;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 2px;
        overflow: hidden;
      }

      .get-usage-fill {
        height: 100%;
        background: #10b981;
        transition: width 0.3s ease, background-color 0.3s ease;
      }

      .get-usage-text {
        font-size: 9px;
        font-weight: 700;
        color: rgba(255, 255, 255, 0.9);
        min-width: 24px;
      }

      /* ========== Source text ========== */
      .get-source {
        padding: 6px 14px;
        background: rgba(37, 99, 235, 0.04);
        border-bottom: 1px solid rgba(37, 99, 235, 0.08);
        font-size: 11px;
        color: #64748b;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        flex-shrink: 0;
      }

      /* ========== Chunk inline styles ========== */
      .get-chunked {
        background: rgba(37, 99, 235, 0.04);
      }

      .get-chunk-part {
        color: #1e293b;
      }

      .get-body:not(.show-chunks) .get-chunk-slash {
        display: none;
      }

      .get-body.show-chunks .get-chunk-slash {
        display: inline-block;
        color: #2563eb;
        font-weight: 700;
        margin: 0 2px;
      }

      /* ========== Body ========== */
      .get-body {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 10px 14px 12px;
        scrollbar-width: thin;
        scrollbar-color: #cbd5e1 transparent;
        font-size: var(--popup-font-size, 14px);
      }

      .get-body::-webkit-scrollbar { width: 5px; }
      .get-body::-webkit-scrollbar-track { background: transparent; }
      .get-body::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
      .get-body::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

      /* ========== Content ========== */
      .get-content {
        font-size: var(--popup-font-size, 14px);
        color: #334155;
        word-break: break-word;
        overflow-wrap: break-word;
        line-height: 1.65;
      }

      .get-line { padding: 0; }
      .get-spacer { height: 4px; }

      /* ========== Blockquote ========== */
      .get-blockquote {
        border-left: 3px solid #3b82f6;
        background: rgba(59, 130, 246, 0.05);
        padding: 8px 12px;
        border-radius: 0 6px 6px 0;
        margin: 8px 0;
        line-height: 1.6;
        font-size: var(--popup-font-size, 14px);
        color: #1e40af;
        font-style: normal;
      }

      /* ========== Tip ========== */
      .get-tip {
        display: flex;
        gap: 6px;
        margin: 6px 0;
        padding: 6px 10px;
        background: rgba(251, 191, 36, 0.05);
        border-left: 3px solid #f59e0b;
        border-radius: 0 6px 6px 0;
        line-height: 1.6;
        font-size: var(--popup-font-size, 12px);
        color: #78350f;
      }

      .get-tip-icon { flex-shrink: 0; font-size: 13px; }

      /* ========== HR ========== */
      .get-hr {
        border: none;
        height: 1px;
        background: linear-gradient(90deg, transparent, #e2e8f0, transparent);
        margin: 10px 0;
      }

      /* ========== Inline ========== */
      .get-phrase { color: #1d4ed8; font-weight: 500; }
      .get-code {
        background: rgba(37, 99, 235, 0.06);
        color: #1d4ed8;
        padding: 0 4px;
        border-radius: 3px;
        font-size: 12px;
        font-family: 'SF Mono', 'Fira Code', monospace;
      }
      strong { font-weight: 600; color: #0f172a; }
      em { font-style: italic; color: #475569; }

      /* ========== Loading ========== */
      .get-loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 40px 0;
        color: #94a3b8;
        font-size: 12px;
      }

      .get-spinner {
        width: 28px;
        height: 28px;
        border: 2.5px solid rgba(37, 99, 235, 0.12);
        border-top-color: #2563eb;
        border-radius: 50%;
        animation: get-spin 0.8s linear infinite;
      }

      @keyframes get-spin { to { transform: rotate(360deg); } }

      /* ========== Error ========== */
      .get-error { text-align: center; padding: 28px 14px; }
      .get-error-icon { font-size: 28px; margin-bottom: 10px; }
      .get-error-text { 
        color: #ef4444; 
        font-size: var(--popup-font-size, 12px); 
        margin-bottom: 8px; 
        line-height: 1.5; 
      }
      .get-error-hint { color: #94a3b8; font-size: 11px; }

      /* ========== Resize Handle ========== */
      .get-resize-handle {
        position: absolute;
        bottom: 0;
        right: 0;
        width: 18px;
        height: 18px;
        cursor: nwse-resize;
        background: linear-gradient(135deg, transparent 50%, rgba(148,163,184,0.3) 50%);
        border-radius: 0 0 14px 0;
      }
      .get-resize-handle:hover {
        background: linear-gradient(135deg, transparent 50%, rgba(37,99,235,0.3) 50%);
      }
    `}})();
