import { useState, useEffect, useRef, memo } from 'react';

interface SentenceResult {
    original: string;
    natural: string;
    chunkedEn: string;
    chunkedJa: string;
}

const memoizedSentences = new Map<string, SentenceResult>();

function parseStreamToSentences(raw: string): { sentences: SentenceResult[], preamble: string } {
    const preamble = raw.split('[BLOCK_START]')[0].trim();
    const blocks = raw.split('[BLOCK_START]');
    const sentences: SentenceResult[] = [];

    for (let i = 1; i < blocks.length; i++) {
        const block = blocks[i].trim();
        if (!block) continue;

        const isLast = i === blocks.length - 1;
        if (!isLast && memoizedSentences.has(block)) {
            sentences.push(memoizedSentences.get(block)!);
            continue;
        }

        const original = block.match(/<original>([\s\S]*?)<\/original>/)?.[1]?.trim()
            || block.match(/<original>([\s\S]*?)$/)?.[1]?.trim() || '';
        const natural = block.match(/<natural>([\s\S]*?)<\/natural>/)?.[1]?.trim()
            || block.match(/<natural>([\s\S]*?)$/)?.[1]?.trim() || '';
        const chunkedEn = block.match(/<chunked_en>([\s\S]*?)<\/chunked_en>/)?.[1]?.trim()
            || block.match(/<chunked_en>([\s\S]*?)$/)?.[1]?.trim() || '';
        const chunkedJa = block.match(/<chunked_ja>([\s\S]*?)<\/chunked_ja>/)?.[1]?.trim()
            || block.match(/<chunked_ja>([\s\S]*?)$/)?.[1]?.trim() || '';

        const result = { original, natural, chunkedEn, chunkedJa };
        if (!isLast && (block.includes('[/BLOCK_END]') || block.includes('[BLOCK_END]'))) {
            memoizedSentences.set(block, result);
        }
        sentences.push(result);
    }
    return { sentences, preamble };
}

const SentenceBlock = memo(({
    sentence,
    showChunks
}: {
    sentence: SentenceResult;
    showChunks: boolean;
}) => {
    return (
        <div className="sentence-block">
            <blockquote className="get-blockquote">
                <div className="tutor-line">
                    <span dangerouslySetInnerHTML={{
                        __html: applyInline(escapeHtml(showChunks ? (sentence.chunkedEn || sentence.original) : sentence.original))
                    }} />
                </div>
            </blockquote>
            <div
                className={`text-line ${showChunks ? 'chunked-text' : 'natural-text'}`}
                dangerouslySetInnerHTML={{
                    __html: applyInline(escapeHtml(showChunks ? (sentence.chunkedJa || sentence.natural) : sentence.natural))
                }}
            />
            <hr className="result-hr" />
        </div>
    );
});

function App() {
    const [tutorSentences, setTutorSentences] = useState<SentenceResult[]>([]);
    const [preambleContent, setPreambleContent] = useState('');
    const [isDone, setIsDone] = useState(false);
    const [sourceText, setSourceText] = useState('');
    const [sourceTabId, setSourceTabId] = useState<number | null>(null);
    const [fontSize, setFontSize] = useState<number>(14);
    const [isChunkMode, setIsChunkMode] = useState(false);
    const [usageDisplay, setUsageDisplay] = useState<number>(20); // For the bar value
    const [geminiLimit, setGeminiLimit] = useState<number>(20); // For the bar max
    const [usageBreakdown, setUsageBreakdown] = useState({ daily: 20, minutely: 15 }); // For the tooltip
    const bodyRef = useRef<HTMLDivElement>(null);

    const [popupWord, setPopupWord] = useState('');
    const [popupMode, setPopupMode] = useState('');
    const [popupRect, setPopupRect] = useState<{ left: number, top: number, bottom: number } | null>(null);
    const [popupContent, setPopupContent] = useState('');
    const [popupError, setPopupError] = useState<string | null>(null);
    const popupRef = useRef<HTMLDivElement>(null);

    const updateUsage = () => {
        chrome.storage.local.get(['geminiDisplayUsage', 'geminiUsage', 'gemini1MinUsage', 'geminiLimit'], (result) => {
            const limit = (result.geminiLimit as number) || 20;
            setGeminiLimit(limit);

            if (result.geminiDisplayUsage !== undefined) {
                setUsageDisplay(result.geminiDisplayUsage as number);
            } else {
                setUsageDisplay(limit);
            }

            setUsageBreakdown({
                daily: result.geminiUsage !== undefined ? result.geminiUsage as number : limit,
                minutely: result.gemini1MinUsage !== undefined ? result.gemini1MinUsage as number : 15
            });
        });
    };

    const updateFontSize = () => {
        chrome.storage.local.get(['fontSize'], (result) => {
            if (result.fontSize !== undefined) {
                setFontSize(result.fontSize as number);
            }
        });
    };

    useEffect(() => {
        // Background scriptからのメッセージを受信
        chrome.runtime.onMessage.addListener((message) => {
            if (message.type === 'WINDOW_INIT') {
                setSourceText(message.sourceText || '');
                setSourceTabId(message.sourceTabId || null);
                if (message.error) {
                    setPopupError(message.error);
                    setIsDone(true);
                } else {
                    const { sentences, preamble } = parseStreamToSentences(message.content ?? '');
                    setTutorSentences(sentences);
                    setPreambleContent(preamble);
                    setIsDone(message.isDone || false);
                }
            } else if (message.type === 'ANALYSIS_CHUNK') {
                const { sentences, preamble } = parseStreamToSentences(message.text);
                setTutorSentences(sentences);
                setPreambleContent(preamble);
                setIsDone(false);
            } else if (message.type === 'ANALYSIS_DONE') {
                const { sentences, preamble } = parseStreamToSentences(message.text);
                setTutorSentences(sentences);
                setPreambleContent(preamble);
                setIsDone(true);
            } else if (message.type === 'ANALYSIS_ERROR') {
                setPopupError(message.error);
                setIsDone(true);
            }
            else if (message.type === 'CHUNK_RESULT') {
                applyChunks(message.text);
            } else if (message.type === 'CHUNK_ERROR') {
                console.error('Chunk error:', message.error);
                alert(`チャンク作成に失敗しました: ${message.error}`);
            } else if (message.type === 'POPUP_CHUNK') {
                setPopupContent(message.text);
            } else if (message.type === 'POPUP_DONE') {
                setPopupContent(message.text);
            } else if (message.type === 'POPUP_ERROR') {
                setPopupContent('');
                setPopupError(message.error);
            }
        });

        // ウィンドウ準備完了を通知
        chrome.runtime.sendMessage({ type: 'WINDOW_READY' });

        // 初期状態読み込み
        updateUsage();
        updateFontSize();

        // ストレージ変更監視
        const storageListener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
            if (changes.geminiDisplayUsage) {
                setUsageDisplay(changes.geminiDisplayUsage.newValue as number);
            }
            if (changes.geminiLimit) {
                setGeminiLimit(changes.geminiLimit.newValue as number);
            }
            if (changes.geminiUsage || changes.gemini1MinUsage) {
                setUsageBreakdown(prev => ({
                    daily: changes.geminiUsage ? (changes.geminiUsage.newValue as number) : prev.daily,
                    minutely: changes.gemini1MinUsage ? (changes.gemini1MinUsage.newValue as number) : prev.minutely
                }));
            }
            if (changes.fontSize) {
                setFontSize(changes.fontSize.newValue as number);
            }
        };
        chrome.storage.onChanged.addListener(storageListener);
        return () => chrome.storage.onChanged.removeListener(storageListener);
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (target && (target.tagName.toLowerCase() === 'input' || target.tagName.toLowerCase() === 'textarea' || target.isContentEditable)) return;

            const isKey1 = e.key === '1' || e.key === '１' || e.code === 'Digit1';
            const isKey2 = e.key === '2' || e.key === '２' || e.code === 'Digit2';

            if (!isKey1 && !isKey2) {
                if (e.key === 'Escape') setPopupWord('');
                return;
            }

            const selection = window.getSelection();
            const text = selection ? selection.toString().trim() : '';

            if (text && text.length > 0 && text.length < 300) {
                e.preventDefault();
                e.stopPropagation();

                const mode = isKey1 ? 'long' : 'short';
                setPopupWord(text);
                setPopupMode(mode);
                setPopupContent('');
                setPopupError(null);

                let left = 20;
                let top = 20;
                let bottom = 20;
                if (selection && selection.rangeCount > 0) {
                    const rect = selection.getRangeAt(0).getBoundingClientRect();
                    left = rect.left + rect.width / 2;
                    top = rect.bottom + 10;
                    bottom = rect.bottom;
                }
                setPopupRect({ left, top, bottom });

                chrome.runtime.sendMessage({
                    type: 'GENERATE_EXPLANATION_STREAM_POPUP',
                    word: text,
                    mode: mode
                });
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    // ストリーミング中は自動スクロール
    useEffect(() => {
        if (!isDone && bodyRef.current) {
            bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
        }
    }, [tutorSentences, popupContent, isDone]);

    function applyChunks(chunkedText: string) {
        const { sentences, preamble } = parseStreamToSentences(chunkedText);
        setTutorSentences(sentences);
        setPreambleContent(preamble);
        setIsDone(true);
    }

    function handleChunk() {
        if (tutorSentences.length === 0) return;
        setIsChunkMode(!isChunkMode);
    }

    function handleReturnToPopup() {
        if (!sourceText) {
            window.close();
            return;
        }

        // バックグラウンドにポップアップへの切り替えを依頼
        chrome.runtime.sendMessage({
            type: 'REQUEST_SWITCH_TO_POPUP',
            text: sourceText,
            tabId: sourceTabId
        }, () => {
            // メッセージ送信完了後に確実に閉じる
            window.close();
        });
    }

    function adjustFontSize(delta: number) {
        const newSize = Math.max(10, Math.min(32, fontSize + delta));
        chrome.storage.local.set({ fontSize: newSize });
    }

    function handlePopupDragStart(e: React.MouseEvent) {
        if ((e.target as HTMLElement).closest('button')) return;

        const popup = popupRef.current;
        if (!popup) return;

        let startX = e.clientX;
        let startY = e.clientY;
        let initialLeft = parseInt(popup.style.left) || 0;
        let initialTop = parseInt(popup.style.top) || 0;

        const onMouseMove = (moveEvent: MouseEvent) => {
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;
            popup.style.left = (initialLeft + dx) + 'px';
            popup.style.top = (initialTop + dy) + 'px';
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        e.preventDefault();
    }

    function speakWord(word: string) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = 'en-US';
        utterance.rate = 0.85;

        const voices = window.speechSynthesis.getVoices();
        const enVoice = voices.find(v => v.lang === 'en-US' && v.name.includes('Samantha'))
            || voices.find(v => v.lang === 'en-US')
            || voices.find(v => v.lang.startsWith('en'));
        if (enVoice) utterance.voice = enVoice;

        window.speechSynthesis.speak(utterance);
    }



    return (
        <div className="window-container">
            <header className="window-header">
                <div className="window-header-left">
                    <button className="icon-btn return-btn" onClick={handleReturnToPopup} title="ポップアップに戻る">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="11 17 6 12 11 7"></polyline>
                            <polyline points="18 17 13 12 18 7"></polyline>
                        </svg>
                    </button>
                    <div className="window-title-group">
                        <span className="window-title">Gemini English Tutor</span>
                        <div
                            className="window-usage-container"
                            title={`Gemini API 使用状況:\n・本日残り: ${usageBreakdown.daily}回 / ${geminiLimit}回\n・直近1分間: ${usageBreakdown.minutely}回 / 15回\n※無料枠の性質上、回数が残っていてもサーバー側で制限される場合があります。`}
                            onClick={updateUsage}
                        >
                            <div className="window-usage-bar">
                                <div
                                    className="window-usage-fill"
                                    style={{
                                        width: `${Math.min(100, Math.max(0, (usageDisplay / geminiLimit) * 100))}%`,
                                        backgroundColor: (usageDisplay / geminiLimit) > 0.6 ? '#10b981' : (usageDisplay / geminiLimit) > 0.2 ? '#fbbf24' : '#ef4444'
                                    }}
                                ></div>
                            </div>
                            <span className="window-usage-text">残り {usageDisplay}回</span>
                        </div>
                    </div>
                </div>
                <div className="window-header-right">
                    <button className="icon-btn" onClick={() => adjustFontSize(-1)} title="文字を小さく">A-</button>
                    <button className="icon-btn" onClick={() => adjustFontSize(1)} title="文字を大きく">A+</button>
                    <button className={`window-btn ${isChunkMode ? 'active' : ''}`} onClick={handleChunk} title="チャンク区切り">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 6h16"></path>
                            <path d="M4 12h16"></path>
                            <path d="M4 18h16"></path>
                        </svg>
                        <span>／</span>
                    </button>
                </div>
            </header>

            {sourceText && (
                <div className="window-source">{sourceText.length > 80 ? sourceText.substring(0, 80) + '…' : sourceText}</div>
            )}

            <div className={`window-body ${isChunkMode ? 'show-chunks' : ''}`} ref={bodyRef} style={{ '--window-font-size': `${fontSize}px` } as any}>
                <div className="window-content">
                    {preambleContent && (
                        <div className="result-preamble text-line" style={{ fontStyle: 'italic', opacity: 0.8, marginBottom: '20px' }}>
                            {preambleContent}
                        </div>
                    )}
                    {tutorSentences.length > 0 ? (
                        tutorSentences.map((s, i) => (
                            <SentenceBlock key={i} sentence={s} showChunks={isChunkMode} />
                        ))
                    ) : (
                        !isDone && <div dangerouslySetInnerHTML={{ __html: renderLoading() }} />
                    )}
                    {popupError && (
                        <div className="window-error">
                            <div className="window-error-icon">⚠️</div>
                            <div className="window-error-text">{popupError}</div>
                            <div className="window-error-hint">拡張機能アイコンをクリックしてAPIキーを設定してください。</div>
                        </div>
                    )}
                </div>
            </div>

            {popupWord && (
                <div
                    className="ew-popup"
                    ref={popupRef}
                    style={{
                        left: popupRect ? Math.min(Math.max(10, popupRect.left - 240), window.innerWidth - 490) + 'px' : '50%',
                        top: popupRect ? (popupRect.bottom + 500 > window.innerHeight ? popupRect.top - 520 : popupRect.top) + 'px' : '50%',
                        position: 'absolute'
                    }}
                >
                    <div className="ew-header" onMouseDown={handlePopupDragStart} style={{ cursor: 'grab' }}>
                        <div className="ew-header-left">
                            <div className="ew-title-group">
                                <div className="ew-word-row">
                                    <span className="ew-word">{popupWord}</span>
                                    <button className="ew-speak-btn" onClick={() => speakWord(popupWord)} title="発音を聞く">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                                            <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
                                            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                                        </svg>
                                    </button>
                                    <span className={`ew-mode-badge ${popupMode === 'long' ? 'mode-long' : 'mode-short'}`}>
                                        {popupMode === 'long' ? 'Long' : 'Short'}
                                    </span>
                                </div>
                                <div className="ew-usage-container">
                                    <div className="ew-usage-bar">
                                        <div className="ew-usage-fill" style={{ width: `${Math.min(100, Math.max(0, (usageDisplay / geminiLimit) * 100))}%`, backgroundColor: (usageDisplay / geminiLimit) > 0.6 ? '#10b981' : (usageDisplay / geminiLimit) > 0.2 ? '#fbbf24' : '#ef4444' }}></div>
                                    </div>
                                    <span className="ew-usage-text">残り {usageDisplay}回</span>
                                </div>
                            </div>
                        </div>
                        <div className="ew-header-right">
                            <button className="ew-header-btn" onClick={() => adjustFontSize(-1)}>A-</button>
                            <button className="ew-header-btn" onClick={() => adjustFontSize(1)}>A+</button>
                            <button className="ew-header-btn ew-close-btn" onClick={() => setPopupWord('')}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div className="ew-body" style={{ fontSize: `${fontSize}px` }}>
                        <div className="ew-content">
                            {popupError ? (
                                <div className="ew-error">
                                    <div className="ew-error-icon">⚠️</div>
                                    <div className="ew-error-text" style={{ color: '#ef4444' }}>{popupError}</div>
                                </div>
                            ) : popupContent ? (
                                <div dangerouslySetInnerHTML={{ __html: formatExplanation(popupContent) }} />
                            ) : (
                                <div className="ew-loading">
                                    <div className="ew-spinner"></div>
                                    <span>解説を生成中...</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function renderLoading(): string {
    return `<div class="window-loading"><div class="window-spinner"></div><span style="font-size: 13px;">解析中...</span></div>`;
}


function applyInline(html: string): string {
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/`(.+?)`/g, '<code class="inline-code">$1</code>');
    html = html.replace(/"([^"]+)"/g, '<span class="phrase">"$1"</span>');
    html = html.replace(/／/g, '<span class="chunk-slash">／</span>');
    return html;
}

function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ポップアップ詳細用のフォーマッタ (English Words と同等)
function formatExplanation(text: string): string {
    if (!text) return '';
    const lines = text.split('\n');
    const parts: string[] = [];

    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        const line = escapeHtml(raw);

        if (line.trim() === '') {
            if (parts.length > 0 && !parts[parts.length - 1].includes('ew-spacer')) {
                parts.push('<div class="ew-spacer"></div>');
            }
            continue;
        }

        const sectionMatch = raw.match(/^【(.+?)】$/);
        if (sectionMatch) {
            parts.push(`<div class="ew-section-header">${escapeHtml(sectionMatch[1])}</div>`);
            continue;
        }

        if (raw.startsWith('・')) {
            const content = escapeHtml(raw.slice(1));
            parts.push(`<div class="ew-bullet"><span class="ew-bullet-dot">•</span><span>${applyInlineStyles(content)}</span></div>`);
            continue;
        }

        if (raw.startsWith('→')) {
            const content = escapeHtml(raw.slice(1).trim());
            parts.push(`<div class="ew-arrow-line">→ ${content}</div>`);
            continue;
        }

        if (raw.startsWith('▶')) {
            const content = escapeHtml(raw.slice(1).trim());
            parts.push(`<div class="ew-usage"><span class="ew-usage-mark">▶</span><span>${applyInlineStyles(content)}</span></div>`);
            continue;
        }

        if (raw.startsWith('▸')) {
            const content = escapeHtml(raw.slice(1).trim());
            parts.push(`<div class="ew-marker-item"><span class="ew-marker">▸</span><span>${applyInlineStyles(content)}</span></div>`);
            continue;
        }

        const numMatch = raw.match(/^(\d+)\.\s+(.+)$/);
        if (numMatch) {
            parts.push(`<div class="ew-numbered"><span class="ew-num">${numMatch[1]}.</span><span>${applyInlineStyles(escapeHtml(numMatch[2]))}</span></div>`);
            continue;
        }

        const exMatch = raw.match(/^例[:：]\s*(.*)$/);
        if (exMatch) {
            const content = exMatch[1] ? escapeHtml(exMatch[1]) : '';
            parts.push(`<div class="ew-example-label">例: ${content}</div>`);
            continue;
        }

        parts.push(`<div class="ew-line">${applyInlineStyles(line)}</div>`);
    }

    return parts.join('');
}

function applyInlineStyles(html: string): string {
    html = html.replace(/\(([^)]*(?:名詞|動詞|形容詞|副詞|前置詞|接続詞|他動詞|自動詞|noun|verb|adj|adv|prep|conj)[^)]*)\)/g, '<span class="ew-pos-tag">($1)</span>');
    html = html.replace(/\/([\u0020-\u007E\u0250-\u02FF\u0300-\u036F\u1DC0-\u1DFF\u2000-\u206Fˈˌːɑɒæɐɓʙβɔɕçɗɖðʤəɘɚɛɜɝɞɟʄɡɠɢʛɦɧħɥʜɨɪʝɭɬɫɮʟɱɯɰŋɳɲɴøɵɸθœɶʘɹɺɾɻʀʁɽʂʃʈʧʉʊʋⱱʌɣɤʍχʎʏʑʐʒʔʡʕʢǀǁǂǃˈˌːˑ]+)\//g, '<span class="ew-phonetic">/$1/</span>');
    return html;
}

export default App;
