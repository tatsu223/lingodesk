// content.ts - Content Script
// 右クリックコンテキストメニュー → ポップアップ表示 + ストリーミング解析結果表示

(function () {
  'use strict';

  let popup: HTMLElement | null = null;
  let shadowRoot: ShadowRoot | null = null;
  let currentContent = ''; // ポップアウト用に解析内容を保持
  let currentSourceText = ''; // ポップアウト用にソーステキストを保持
  let contentDone = false;
  let popupAbortController: AbortController | null = null;

  // Background Scriptからのメッセージリスナー
  chrome.runtime.onMessage.addListener((message) => {
    console.log('[Content] Message received:', message.type);
    if (message.type === 'SHOW_POPUP') {
      showPopup(message.text, message.content, message.isDone, message.error);
    } else if (message.type === 'ANALYSIS_CHUNK') {
      if (message.error) {
        showError(message.error);
      } else {
        updatePopupContent(message.text, false);
      }
    } else if (message.type === 'ANALYSIS_DONE') {
      if (message.error) {
        showError(message.error);
      } else {
        updatePopupContent(message.text, true);
      }
    } else if (message.type === 'ANALYSIS_ERROR') {
      showError(message.error);
    } else if (message.type === 'CHUNK_RESULT') {
      showChunkResult(message.text);
    } else if (message.type === 'CHUNK_ERROR') {
      showChunkError(message.error);
    } else if (message.type === 'CLOSE_POPUP') {
      closePopup();
    }
  });

  // ストレージ変更監視（使用量・フォントサイズ更新用）
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.gemini1MinUsage || changes.geminiUsage) {
      updateUsageDisplay();
    }
    if (changes.fontSize) {
      updateFontSize();
    }
  });

  // ESCキーで閉じる
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && popup) {
      closePopup();
    }
  });

  function showPopup(text: string, initialContent?: string, initialIsDone?: boolean, initialError?: string | null) {
    console.log('[Content] showPopup called:', { text, initialIsDone });
    closePopup();
    currentSourceText = text;
    currentContent = initialContent || '';
    contentDone = initialIsDone || false;
    popupAbortController = new AbortController();

    // ポップアップホスト作成（Shadow DOM）
    console.log('[Content] Creating popup...');
    popup = document.createElement('div');
    popup.id = 'get-popup-host';
    // ホスト自体がページ上のクリックを邪魔しないように、ポインタイベントを無効化（子要素で有効化）
    popup.style.cssText = 'position: absolute; top: 0; left: 0; width: 0; height: 0; pointer-events: none; z-index: 2147483647; margin: 0; padding: 0; border: none;';
    shadowRoot = popup.attachShadow({ mode: 'open' });

    // スタイル注入
    const style = document.createElement('style');
    style.textContent = getPopupStyles();
    shadowRoot.appendChild(style);

    // Google Fonts読み込み
    const fontLink = document.createElement('link');
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+JP:wght@400;500;600;700&display=swap';
    fontLink.rel = 'stylesheet';
    shadowRoot.appendChild(fontLink);

    // ポップアップ本体
    const container = document.createElement('div');
    container.className = 'get-popup';

    // 表示テキストを短縮（ソースバー用）
    const displayText = text.length > 50 ? text.substring(0, 50) + '…' : text;

    container.innerHTML = `
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
      <div class="get-source">${escapeHtml(displayText)}</div>
      <div class="get-body" id="get-popup-body">
        <div class="get-content">
          ${initialContent || initialError ? (initialError ? 'error_placeholder' : formatMarkdown(initialContent!)) : `
          <div class="get-loading">
            <div class="get-spinner"></div>
            <span>解析中...</span>
          </div>`}
        </div>
      </div>
      <div class="get-resize-handle"></div>
    `;

    // エラー時の特殊処理
    if (initialError) {
      const contentEl = container.querySelector('.get-content');
      if (contentEl) {
        contentEl.innerHTML = `
          <div class="get-error">
            <div class="get-error-icon">⚠️</div>
            <div class="get-error-text">${escapeHtml(initialError)}</div>
            <div class="get-error-hint">拡張機能アイコンをクリックしてAPIキーを設定してください。</div>
          </div>
        `;
      }
    }

    shadowRoot.appendChild(container);
    document.body.appendChild(popup);

    // 位置計算（viewport基準、fixed positioning）
    positionPopup(container);

    // ドラッグ機能
    enableDrag(container);

    // リサイズ機能
    enableResize(container);

    // 閉じるボタン
    shadowRoot.querySelector('.get-close-btn')?.addEventListener('click', closePopup);

    // チャンクボタン
    shadowRoot.querySelector('.get-chunk-btn')?.addEventListener('click', () => {
      handleChunkRequest();
    });

    // フォントサイズ調整
    shadowRoot.getElementById('get-font-plus')?.addEventListener('click', () => {
      adjustFontSize(1);
    });
    shadowRoot.getElementById('get-font-minus')?.addEventListener('click', () => {
      adjustFontSize(-1);
    });

    // ポップアウトボタン
    shadowRoot.querySelector('.get-popout-btn')?.addEventListener('click', () => {
      chrome.runtime.sendMessage({
        type: 'OPEN_IN_WINDOW',
        sourceText: currentSourceText,
        content: currentContent,
        isDone: contentDone
      });
      // ウィンドウを開いた後は自分（ポップアップ）を消去する
      closePopup();
    });


    // 初期状態読み込み
    updateUsageDisplay();
    updateFontSize();

    // 現在進行中の解析があれば再開リクエスト
    chrome.runtime.sendMessage({ type: 'REQUEST_ANALYSIS_RESUME' });
  }

  function adjustFontSize(delta: number) {
    chrome.storage.local.get(['fontSize'], (result) => {
      const currentSize = result.fontSize !== undefined ? result.fontSize as number : 14;
      const newSize = Math.max(10, Math.min(32, currentSize + delta));
      chrome.storage.local.set({ fontSize: newSize }, () => {
        if (shadowRoot) {
          updateFontSize();
        }
      });
    });
  }

  function updateFontSize() {
    chrome.storage.local.get(['fontSize'], (result) => {
      if (!shadowRoot) return;
      const size = result.fontSize !== undefined ? result.fontSize as number : 14;
      const body = shadowRoot.getElementById('get-popup-body') as HTMLElement;
      if (body) {
        body.style.setProperty('--popup-font-size', `${size}px`);
      }
    });
  }

  function updateUsageDisplay() {
    chrome.storage.local.get(['geminiDisplayUsage', 'geminiUsage', 'gemini1MinUsage', 'geminiLimit', 'geminiModel'], (result) => {
      if (!shadowRoot) return;

      // ストレージ制限取得
      const storageLimit = result.geminiLimit as number;
      const limit = storageLimit && storageLimit > 0 ? storageLimit : 20;

      const combined = result.geminiDisplayUsage !== undefined ? result.geminiDisplayUsage as number : limit;
      const daily = result.geminiUsage !== undefined ? result.geminiUsage as number : limit;

      const fill = shadowRoot.getElementById('get-usage-fill');
      const text = shadowRoot.getElementById('get-usage-text');
      const container = shadowRoot.getElementById('get-usage-container');

      if (fill) {
        fill.style.width = `${Math.min(100, Math.max(0, (combined / limit) * 100))}%`;
        fill.style.backgroundColor = (combined / limit) > 0.6 ? '#10b981' : (combined / limit) > 0.2 ? '#fbbf24' : '#ef4444';
      }
      if (text) {
        text.textContent = `残り ${combined}回`;
      }
      if (container) {
        container.title = `Gemini API 使用状況:\n・本日残り: ${daily}回 / ${limit}回\n※無料枠の性質上、回数が残っていてもサーバー側で制限される場合があります。`;
      }
    });
  }

  function positionPopup(container: HTMLElement) {
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const popupW = 520;
    const popupH = 480;

    // 画面中央やや上に配置 (absolute positioning なのでスクロール位置を加算)
    let left = scrollX + (viewportW / 2) - (popupW / 2);
    let top = scrollY + Math.max(40, (viewportH - popupH) / 3);

    // 画面範囲内に収める
    if (left + popupW > scrollX + viewportW - 16) left = scrollX + viewportW - popupW - 16;
    if (left < scrollX + 16) left = scrollX + 16;
    if (top + popupH > scrollY + viewportH - 16) top = scrollY + viewportH - popupH - 16;
    if (top < scrollY + 16) top = scrollY + 16;

    console.log('[Content] Positioning popup at:', { left, top, scrollX, scrollY });
    container.style.left = left + 'px';
    container.style.top = top + 'px';
  }

  function handleChunkRequest() {
    if (!shadowRoot || !currentContent) return;
    const bodyEl = shadowRoot.querySelector('.get-body') as HTMLElement;
    const chunkBtn = shadowRoot.querySelector('.get-chunk-btn') as HTMLElement;

    if (bodyEl) {
      bodyEl.classList.toggle('show-chunks');
      if (chunkBtn) {
        chunkBtn.classList.toggle('active', bodyEl.classList.contains('show-chunks'));
      }
    }
  }

  function showChunkResult(chunkedText: string) {
    if (!shadowRoot) return;

    const chunkBtn = shadowRoot.querySelector('.get-chunk-btn') as HTMLElement;
    if (chunkBtn) {
      chunkBtn.classList.remove('loading');
      chunkBtn.removeAttribute('disabled');
    }

    updatePopupContent(chunkedText, true);
  }

  function showChunkError(_error: string) {
    if (!shadowRoot) return;

    const chunkBtn = shadowRoot.querySelector('.get-chunk-btn') as HTMLElement;
    if (chunkBtn) {
      chunkBtn.classList.remove('loading');
      chunkBtn.removeAttribute('disabled');
    }
  }

  function updatePopupContent(text: string, isDone: boolean) {
    if (!shadowRoot) return;
    const contentEl = shadowRoot.querySelector('.get-content');
    if (!contentEl) return;

    // textが空の場合は初期のローディング状態（解析中...）を維持するため上書きしない
    if (text || isDone) {
      contentEl.innerHTML = formatMarkdown(text);
    }

    currentContent = text;
    contentDone = isDone;

    if (!isDone && (text || isDone)) {
      const bodyEl = shadowRoot.querySelector('.get-body');
      if (bodyEl) bodyEl.scrollTop = bodyEl.scrollHeight;
    }
  }

  function formatMarkdown(text: string): string {
    const lines = text.split('\n');
    const parts: string[] = [];
    let inBlockquote = false;
    let blockquoteLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.trim() === '---' || line.trim() === '***' || line.trim() === '___') {
        if (inBlockquote) {
          parts.push(renderBlockquote(blockquoteLines));
          blockquoteLines = [];
          inBlockquote = false;
        }
        continue;
      }

      if (line.startsWith('> ')) {
        inBlockquote = true;
        blockquoteLines.push(line.slice(2));
        continue;
      } else if (inBlockquote) {
        parts.push(renderBlockquote(blockquoteLines));
        blockquoteLines = [];
        inBlockquote = false;
      }

      if (line.trim() === '') {
        if (parts.length > 0 && !parts[parts.length - 1].includes('get-spacer')) {
          parts.push('<div class="get-spacer"></div>');
        }
        continue;
      }

      if (line.startsWith('💡')) {
        const content = escapeHtml(line.slice(2).trim());
        parts.push(`<div class="get-tip"><span class="get-tip-icon">💡</span><span>${applyInlineStyles(content)}</span></div>`);
        continue;
      }

      const formatted = applyInlineStyles(escapeHtml(line));
      parts.push(`<div class="get-line">${formatted}</div>`);
    }

    if (inBlockquote && blockquoteLines.length > 0) {
      parts.push(renderBlockquote(blockquoteLines));
    }

    return parts.join('');
  }

  function renderBlockquote(lines: string[]): string {
    const content = lines.map(l => {
      let escaped = escapeHtml(l);
      escaped = escaped.replace(/／/g, '<span class="get-chunk-slash">／</span>');
      return escaped;
    }).join('<br>');
    return `<blockquote class="get-blockquote">${content}</blockquote>`;
  }

  function applyInlineStyles(html: string): string {
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/`(.+?)`/g, '<code class="get-code">$1</code>');
    html = html.replace(/"([^"]+)"/g, '<span class="get-phrase">"$1"</span>');
    html = html.replace(/／/g, '<span class="get-chunk-slash">／</span>');
    return html;
  }

  function showError(errorMessage: string) {
    if (!shadowRoot) return;
    const contentEl = shadowRoot.querySelector('.get-content');
    if (!contentEl) return;

    contentEl.innerHTML = `
      <div class="get-error">
        <div class="get-error-icon">⚠️</div>
        <div class="get-error-text">${escapeHtml(errorMessage)}</div>
        <div class="get-error-hint">拡張機能アイコンをクリックしてAPIキーを設定してください。</div>
      </div>
    `;
  }

  function closePopup() {
    // IDを使って確実に削除
    const existing = document.getElementById('get-popup-host');
    if (existing) existing.remove();

    if (popupAbortController) {
      popupAbortController.abort();
      popupAbortController = null;
    }
    if (popup) {
      if (popup.parentNode) popup.remove();
      popup = null;
      shadowRoot = null;
    }
  }

  function enableDrag(element: HTMLElement) {
    const header = element.querySelector('.get-header') as HTMLElement;
    if (!header) return;

    const signal = popupAbortController?.signal;

    let isDragging = false;
    let startX: number, startY: number, initialLeft: number, initialTop: number;

    header.addEventListener('mousedown', (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('button')) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      // getComputedStyleを使って実際の数値を確実に取得
      const style = window.getComputedStyle(element);
      initialLeft = parseInt(style.left) || 0;
      initialTop = parseInt(style.top) || 0;
      header.style.cursor = 'grabbing';
      e.preventDefault();
    }, { signal });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      element.style.left = (initialLeft + dx) + 'px';
      element.style.top = (initialTop + dy) + 'px';
    }, { signal });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        header.style.cursor = 'grab';
      }
    }, { signal });
  }

  function enableResize(element: HTMLElement) {
    const handle = element.querySelector('.get-resize-handle') as HTMLElement;
    if (!handle) return;

    const signal = popupAbortController?.signal;

    let isResizing = false;
    let startX: number, startY: number, startW: number, startH: number;

    handle.addEventListener('mousedown', (e: MouseEvent) => {
      isResizing = true;
      startX = e.clientX;
      startY = e.clientY;
      startW = element.offsetWidth;
      startH = element.offsetHeight;
      e.preventDefault();
      e.stopPropagation();
    }, { signal });

    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      const newW = Math.max(320, startW + (e.clientX - startX));
      const newH = Math.max(200, startH + (e.clientY - startY));
      element.style.width = newW + 'px';
      element.style.height = newH + 'px';
    }, { signal });

    document.addEventListener('mouseup', () => {
      isResizing = false;
    }, { signal });
  }

  function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function getPopupStyles(): string {
    return `
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
    `;
  }
})();
