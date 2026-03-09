import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { BookOpen, Search, Sparkles, Settings, ArrowLeft, Key, ChevronDown } from 'lucide-react';
import {
    analyzeTextStream,
    listAvailableModels,
    PROMPT_WORDS_LONG,
    PROMPT_LEARNING,
    KNOWN_RPD_LIMITS,
    TEXT_OUTPUT_MODELS,
    MODEL_DISPLAY_NAMES,
    getLocalDateString,
} from '../lib/gemini';
import './App.css';

type FunctionType = 'words' | 'tutor';
type AppView = 'main' | 'settings' | 'result';

interface SentenceResult {
    original: string;
    natural: string;
    chunkedEn: string;
    chunkedJa: string;
}


// ==========================================
// RPD管理（モデルごと・localStorage）
// ==========================================
interface ModelUsage {
    [modelId: string]: { date: string; used: number; limit: number };
}

function getModelUsage(): ModelUsage {
    const raw = localStorage.getItem('lingodesk_model_usage');
    if (!raw) return {};
    try { return JSON.parse(raw); } catch { return {}; }
}

function getModelRemainingRPD(modelId: string): number {
    const usage = getModelUsage();
    const today = getLocalDateString();
    const entry = usage[modelId];
    if (!entry || entry.date !== today) {
        return KNOWN_RPD_LIMITS[modelId] ?? 20;
    }
    return Math.max(0, entry.limit - entry.used);
}

function incrementModelUsage(modelId: string) {
    const usage = getModelUsage();
    const today = getLocalDateString();
    const entry = usage[modelId];
    const limit = entry?.limit ?? KNOWN_RPD_LIMITS[modelId] ?? 20;

    if (!entry || entry.date !== today) {
        usage[modelId] = { date: today, used: 1, limit };
    } else {
        entry.used += 1;
    }
    localStorage.setItem('lingodesk_model_usage', JSON.stringify(usage));
    return getModelRemainingRPD(modelId);
}


// ==========================================
// Markdownフォーマッタ
// ==========================================
function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function applyInline(html: string): string {
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/`(.+?)`/g, '<code class="inline-code">$1</code>');
    html = html.replace(/"([^"]+)"/g, '<span class="phrase">"$1"</span>');
    return html;
}

function formatMarkdown(text: string): string {
    if (text.includes('error-display')) return text;

    const lines = text.split('\n');
    const parts: string[] = [];
    let inBlockquote = false;
    let blockquoteLines: string[] = [];

    for (const line of lines) {
        if (line.trim() === '---' || line.trim() === '***' || line.trim() === '___') {
            if (inBlockquote) {
                parts.push(renderBlockquote(blockquoteLines));
                blockquoteLines = [];
                inBlockquote = false;
            }
            parts.push('<hr class="result-hr">');
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
            if (parts.length > 0 && !parts[parts.length - 1].includes('spacer')) {
                parts.push('<div class="spacer"></div>');
            }
            continue;
        }

        const sectionMatch = line.match(/^【(.+?)】$/);
        if (sectionMatch) {
            parts.push(`<div class="section-header">${escapeHtml(sectionMatch[1])}</div>`);
            continue;
        }

        if (line.startsWith('## ')) {
            parts.push(`<h2 class="result-h2">${applyInline(escapeHtml(line.slice(3)))}</h2>`);
            continue;
        }

        if (line.startsWith('💡')) {
            const content = escapeHtml(line.slice(2).trim());
            parts.push(`<div class="tip"><span class="tip-icon">💡</span><span>${applyInline(content)}</span></div>`);
            continue;
        }

        if (line.startsWith('・')) {
            const content = escapeHtml(line.slice(1));
            parts.push(`<div class="bullet-item"><span class="bullet-dot">•</span><span>${applyInline(content)}</span></div>`);
            continue;
        }

        if (line.startsWith('▶')) {
            const content = escapeHtml(line.slice(1).trim());
            parts.push(`<div class="usage-example"><span class="usage-mark">▶</span><span>${applyInline(content)}</span></div>`);
            continue;
        }

        if (line.startsWith('→')) {
            const content = escapeHtml(line.slice(1).trim());
            parts.push(`<div class="arrow-line">→ ${applyInline(content)}</div>`);
            continue;
        }

        const numMatch = line.match(/^(\d+)\.\s+(.+)$/);
        if (numMatch) {
            parts.push(`<div class="numbered-item"><span class="num">${numMatch[1]}.</span><span>${applyInline(escapeHtml(numMatch[2]))}</span></div>`);
            continue;
        }

        parts.push(`<div class="text-line">${applyInline(escapeHtml(line))}</div>`);
    }

    if (inBlockquote && blockquoteLines.length > 0) {
        parts.push(renderBlockquote(blockquoteLines));
    }

    return parts.join('');
}

const memoizedSentences = new Map<string, SentenceResult>();

function parseStreamToSentences(text: string): { sentences: SentenceResult[], preamble: string } {
    const preamble = text.split('[BLOCK_START]')[0].trim();
    const blocks = text.split('[BLOCK_START]');
    const sentences: SentenceResult[] = [];

    for (let i = 1; i < blocks.length; i++) { // blocks[0] は preamble なので 1 から開始
        const block = blocks[i];
        if (!block.trim()) continue;

        const isLast = i === blocks.length - 1;
        if (!isLast && memoizedSentences.has(block)) {
            sentences.push(memoizedSentences.get(block)!);
            continue;
        }

        const original = block.match(/<original>([\s\S]*?)<\/original>/)?.[1]?.trim()
            || block.match(/<original>([\s\S]*?)(?:\[BLOCK_START]|<natural>|$)/)?.[1]?.trim() || '';
        const natural = block.match(/<natural>([\s\S]*?)<\/natural>/)?.[1]?.trim()
            || block.match(/<natural>([\s\S]*?)(?:\[BLOCK_START]|<chunked_en>|$)/)?.[1]?.trim() || '';
        const chunkedEn = block.match(/<chunked_en>([\s\S]*?)<\/chunked_en>/)?.[1]?.trim()
            || block.match(/<chunked_en>([\s\S]*?)(?:\[BLOCK_START]|<chunked_ja>|$)/)?.[1]?.trim() || '';
        const chunkedJa = block.match(/<chunked_ja>([\s\S]*?)<\/chunked_ja>/)?.[1]?.trim()
            || block.match(/<chunked_ja>([\s\S]*?)(?:\[BLOCK_START]|\[BLOCK_END]|\[\/BLOCK_END]|$)/)?.[1]?.trim() || '';

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
            <blockquote className="result-blockquote tutor-blockquote">
                <div className="tutor-line">
                    <span dangerouslySetInnerHTML={{
                        __html: applyInline(escapeHtml(showChunks ? (sentence.chunkedEn || sentence.original) : sentence.original)).replace(/／/g, '<span class="chunk-slash">／</span>')
                    }} />
                </div>
            </blockquote>
            <div
                className={`text-line ${showChunks ? 'chunked-text' : 'natural-text'}`}
                dangerouslySetInnerHTML={{
                    __html: applyInline(escapeHtml(showChunks ? (sentence.chunkedJa || sentence.natural) : sentence.natural)).replace(/／/g, '<span class="chunk-slash">／</span>')
                }}
            />
            <hr className="result-hr" />
        </div>
    );
});

function renderBlockquote(lines: string[]): string {
    const content = lines.map((text) => {
        let escaped = escapeHtml(text);
        return `<div className="tutor-line"><span>${escaped}</span></div>`;
    }).join('');
    return `<blockquote className="result-blockquote tutor-blockquote">${content}</blockquote>`;
}

// Words: Long結果からShort版を生成（API不使用）
function shortenWordsResult(longResult: string): string {
    const lines = longResult.split('\n');
    const kept: string[] = [];
    let inSection = '';

    for (const line of lines) {
        const trimmed = line.trim();
        // セパレーター行（ハイフン、アスタリスク、アンダースコア、全角横棒など）を除去
        if (trimmed.match(/^[-\*_⸻—=]{3,}$/)) continue;

        if (line.startsWith('## ')) { kept.push(line); continue; }
        if (line.match(/^【発音記号】/)) { inSection = 'pron'; kept.push(line); continue; }
        if (line.match(/^【意味】/) || line.match(/^【英和辞典】/)) { inSection = 'ja'; kept.push(line); continue; }
        if (line.match(/^【英英辞典】/)) { inSection = 'skip'; continue; }
        if (line.match(/^【コロケーション/)) { inSection = 'skip'; continue; }
        if (line.match(/^【シチュエーション/)) { inSection = 'skip'; continue; }
        if (line.match(/^【同意語/)) { inSection = 'skip'; continue; }
        if (line.match(/^【覚えておくべき/)) { inSection = 'skip'; continue; }
        if (line.match(/^【/)) { inSection = 'other'; kept.push(line); continue; }

        if (inSection === 'pron' || inSection === 'ja' || inSection === 'other') {
            kept.push(line);
        }
        if (inSection === '') {
            kept.push(line);
        }
    }
    // 空行が多すぎる場合は詰める。また末尾の空行を削除。
    return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ==========================================
// メインコンポーネント
// ==========================================
function App() {
    const [view, setView] = useState<AppView>('main');
    const [sourceText, setSourceText] = useState('');
    const [resultContent, setResultContent] = useState('');
    const [tutorSentences, setTutorSentences] = useState<SentenceResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isDone, setIsDone] = useState(false);
    const [activeFunction, setActiveFunction] = useState<FunctionType | null>(null);
    const [preambleContent, setPreambleContent] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    // Settings
    const [apiKey, setApiKey] = useState(localStorage.getItem('lingodesk_apikey') || '');
    const [model, setModel] = useState(localStorage.getItem('lingodesk_model') || 'gemini-3-flash-preview');
    const [showApiKey, setShowApiKey] = useState(false);
    const [settingsStatus, setSettingsStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Model selection
    const [availableModels, setAvailableModels] = useState<string[]>([]);
    const [loadingModels, setLoadingModels] = useState(false);
    const fetchingModelsRef = useRef(false);
    const [modelDropdownOpen, setModelDropdownOpen] = useState(false);

    // RPD
    const [currentRPD, setCurrentRPD] = useState(getModelRemainingRPD(model));

    // Tutor: チャンク表示切替
    const [showChunks, setShowChunks] = useState(false);

    // Words: Long/Short切替
    const [wordsMode, setWordsMode] = useState<'long' | 'short'>('long');
    const [wordsFullResult, setWordsFullResult] = useState('');

    const resultRef = useRef<HTMLDivElement>(null);

    // 初期化とメッセージ受信
    useEffect(() => {
        if (!localStorage.getItem('lingodesk_apikey')) {
            setView('settings');
        } else {
            initializeRPD();
        }

        // Backgroundからのメッセージを受信（右クリックメニュー等からの解析同期）
        const messageListener = (message: any) => {
            if (message.type === 'ANALYSIS_CHUNK') {
                setView('result');
                setActiveFunction('tutor');
                const { sentences, preamble } = parseStreamToSentences(message.text);
                setTutorSentences(sentences);
                setPreambleContent(preamble);
                setIsLoading(true);
                setIsDone(false);
            } else if (message.type === 'ANALYSIS_DONE') {
                setView('result');
                setActiveFunction('tutor');
                const { sentences, preamble } = parseStreamToSentences(message.text);
                setTutorSentences(sentences);
                setPreambleContent(preamble);
                setIsLoading(false);
                setIsDone(true);
            } else if (message.type === 'ANALYSIS_ERROR') {
                setErrorMessage(message.error);
                setIsLoading(false);
                setIsDone(true);
            } else if (message.type === 'UPDATE_USAGE') {
                setCurrentRPD(message.usage);
            }
        };

        const isExtension = typeof chrome !== 'undefined' && !!chrome.runtime?.onMessage;
        if (isExtension) {
            chrome.runtime.onMessage.addListener(messageListener);
            chrome.runtime.sendMessage({ type: 'REQUEST_ANALYSIS_RESUME' });
        }

        // Dropdownを外クリックで閉じる
        const handleClickOutside = (e: MouseEvent) => {
            if (modelDropdownOpen) {
                const container = document.getElementById('model-selector-container');
                if (container && !container.contains(e.target as Node)) {
                    setModelDropdownOpen(false);
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            if (isExtension) {
                chrome.runtime.onMessage.removeListener(messageListener);
            }
        };
    }, [modelDropdownOpen]);

    // 起動時RPD初期化：日付リセットとモデル一覧取得
    const initializeRPD = async () => {
        const key = localStorage.getItem('lingodesk_apikey');
        if (!key) return;

        const today = getLocalDateString();
        const usage = getModelUsage();

        // 日付が変わっていれば全リセット
        let needsReset = false;
        for (const m of TEXT_OUTPUT_MODELS) {
            if (usage[m] && usage[m].date !== today) {
                needsReset = true;
                break;
            }
        }
        if (needsReset) {
            localStorage.removeItem('lingodesk_model_usage');
        }

        // モデル一覧取得
        setLoadingModels(true);
        try {
            const models = await listAvailableModels(key);
            setAvailableModels(models);

            // 現在のモデルのRPDを更新
            setCurrentRPD(getModelRemainingRPD(model));

            // 現在のモデルが利用可能リストにない（古いモデル名が残っている）場合のみリセット
            if (models.length > 0 && !models.includes(model)) {
                setModel(models[0]);
                localStorage.setItem('lingodesk_model', models[0]);
                setCurrentRPD(getModelRemainingRPD(models[0]));
            }
        } catch (err) {
            console.error('RPD initialization failed:', err);
        } finally {
            setLoadingModels(false);
        }
    };

    // RPD定期更新
    useEffect(() => {
        const interval = setInterval(() => setCurrentRPD(getModelRemainingRPD(model)), 3000);
        return () => clearInterval(interval);
    }, [model]);

    useEffect(() => {
        if (!isDone && resultRef.current) {
            resultRef.current.scrollTop = resultRef.current.scrollHeight;
        }
    }, [tutorSentences, preambleContent, resultContent, isDone]);

    // APIキー保存時とメイン画面表示時にモデル取得
    const fetchModels = useCallback(async () => {
        const key = localStorage.getItem('lingodesk_apikey');
        if (!key || fetchingModelsRef.current) return;

        fetchingModelsRef.current = true;
        setLoadingModels(true);
        try {
            const models = await listAvailableModels(key);
            setAvailableModels(models);

            const usage = getModelUsage();
            const today = getLocalDateString();

            // 拡張機能環境の場合はストレージから使用量を同期
            const isExtension = typeof chrome !== 'undefined' && chrome.runtime && !!chrome.runtime.sendMessage;
            if (isExtension) {
                try {
                    const storageData = await chrome.storage.local.get(['usageData', 'knownLimits']);
                    const data = storageData.usageData as any;

                    let changed = false;
                    for (const m of models) {
                        if (!usage[m] || usage[m].date !== today) {
                            const limit = (storageData.knownLimits && (storageData.knownLimits as any)[m]) || (KNOWN_RPD_LIMITS as any)[m] || 20;
                            const used = (data && data.models && data.models[m] && data.models[m].count) || 0;
                            usage[m] = { date: today, used, limit };
                            changed = true;
                        } else if (data && data.models && data.models[m]) {
                            usage[m].used = data.models[m].count;
                            changed = true;
                        }
                    }
                    if (changed) {
                        localStorage.setItem('lingodesk_model_usage', JSON.stringify(usage));
                    }
                } catch (e) {
                    console.debug('Storage sync failed:', e);
                }
            } else {
                // Web環境での初期化
                let changed = false;
                for (const m of models) {
                    if (!usage[m] || usage[m].date !== today) {
                        usage[m] = { date: today, used: 0, limit: (KNOWN_RPD_LIMITS as any)[m] || 20 };
                        changed = true;
                    }
                }
                if (changed) {
                    localStorage.setItem('lingodesk_model_usage', JSON.stringify(usage));
                }
            }

            // 現在のモデルがリストになければ1番目にリセット
            if (models.length > 0 && !models.includes(model)) {
                setModel(models[0]);
                localStorage.setItem('lingodesk_model', models[0]);
            }

            setCurrentRPD(getModelRemainingRPD(model));
            setErrorMessage('');
        } catch (err) {
            console.error('Failed to fetch models:', err);
        } finally {
            fetchingModelsRef.current = false;
            setLoadingModels(false);
        }
    }, [model]);

    // APIキー保存時とメイン画面表示時にモデル取得
    useEffect(() => {
        if (view === 'main' && localStorage.getItem('lingodesk_apikey')) {
            fetchModels();
        }
    }, [view, fetchModels]);

    // ==========================================
    // API呼び出し
    // ==========================================
    const handleExecute = async (type: FunctionType) => {
        if (!sourceText.trim()) return;

        memoizedSentences.clear();

        const storedKey = localStorage.getItem('lingodesk_apikey');
        if (!storedKey) { setView('settings'); return; }

        // 実行開始（事前にブロックせず、まずは試みる）
        const activeModel = model;

        setActiveFunction(type);
        setView('result');
        setResultContent('');
        setWordsFullResult('');
        setWordsMode('long');
        setShowChunks(false);
        setIsLoading(true);
        setIsDone(false);
        setErrorMessage('');
        const promptMap: Record<FunctionType, string> = {
            words: PROMPT_WORDS_LONG,
            tutor: PROMPT_LEARNING,
        };

        try {

            const finalResultRaw = await analyzeTextStream(
                storedKey,
                sourceText,
                promptMap[type],
                activeModel,
                (accumulated) => {
                    if (type === 'tutor') {
                        const { sentences, preamble } = parseStreamToSentences(accumulated);
                        setTutorSentences(sentences);
                        setPreambleContent(preamble);
                    } else {
                        setResultContent(accumulated);
                    }
                }
            );

            // 最終確定の状態を反映
            if (type === 'tutor') {
                const { sentences, preamble } = parseStreamToSentences(finalResultRaw);
                setTutorSentences(sentences);
                setPreambleContent(preamble);
            } else {
                setResultContent(finalResultRaw);
            }

            // 冒頭の「はい、承知いたしました」等のAIフィラーを念のため除去
            const finalResult = finalResultRaw.replace(/^(はい、承知いたしました。|承知いたしました。|かしこまりました。|OK、|Certainly!|Sure!|Here is the analysis:|以下の解説を生成します:|各単語について解説します:)\n*\s*/i, '');
            setResultContent(finalResult);

            // Words用：Longの全文を保存
            if (type === 'words') {
                setWordsFullResult(finalResult);
            }

            const remaining = incrementModelUsage(activeModel);
            setCurrentRPD(remaining);

            setIsDone(true);
        } catch (err: any) {
            console.error('handleExecute Error:', err);
            const msg = err?.message || '不明なエラーが発生しました';

            const isQuotaError = msg.includes('[RESOURCE_EXHAUSTED]') || msg.includes('429') || msg.includes('quota') || msg.includes('exhausted');
            const isAuthError = msg.includes('[AUTH_ERROR]') || msg.includes('API key') || msg.includes('401') || msg.includes('403');
            const isOverloaded = msg.includes('[OVERLOADED]') || msg.includes('503') || msg.includes('overloaded');

            if (isAuthError) {
                setErrorMessage('APIキーが無効です。設定画面でAPIキーを確認してください。');
            } else if (msg.includes('parse stream')) {
                setErrorMessage('データの受信中に問題が発生しました。インターネット接続を確認し、もう一度お試しください。');
            } else if (isQuotaError) {
                console.log('Real 429 detected, marking model as exhausted.');
                const usage = getModelUsage();
                const today = getLocalDateString();
                const limit = KNOWN_RPD_LIMITS[activeModel] || 20;
                usage[activeModel] = { date: today, used: limit, limit };
                localStorage.setItem('lingodesk_model_usage', JSON.stringify(usage));
                setCurrentRPD(0);
                setErrorMessage(`${MODEL_DISPLAY_NAMES[activeModel] || activeModel} の本日の使用回数（${limit}回）が上限に達しました。別のモデルをドロップダウンから選択してください。`);
            } else if (isOverloaded) {
                setErrorMessage(`${MODEL_DISPLAY_NAMES[activeModel] || activeModel} は現在混雑しています。しばらく待ってから再試行するか、別のモデルをお試しください。`);
            } else if (msg.includes('[SAFETY_ERROR]')) {
                setErrorMessage('安全フィルターにより内容がブロックされました。入力を調整してもう一度お試しください。');
            } else if (msg.includes('404') || msg.includes('not found')) {
                setErrorMessage(`モデル「${MODEL_DISPLAY_NAMES[activeModel] || activeModel}」が見つかりません。別のモデルを選択してください。`);
            } else {
                setErrorMessage('エラーが発生しました。しばらく待ってからもう一度お試しください。');
            }
        } finally {
            setIsLoading(false);
        }
    };

    // ==========================================
    // 設定保存
    // ==========================================
    const handleSaveSettings = () => {
        if (!apiKey.trim()) {
            setSettingsStatus({ type: 'error', text: 'APIキーを入力してください' });
            return;
        }
        localStorage.setItem('lingodesk_apikey', apiKey.trim());
        localStorage.setItem('lingodesk_model', model);
        setSettingsStatus({ type: 'success', text: '✓ 設定を保存しました！' });
        setTimeout(() => {
            setSettingsStatus(null);
            setView('main');
        }, 1500);
    };

    // ブラウザの戻るボタン対策
    useEffect(() => {
        if (view !== 'main') {
            window.history.pushState(null, '', window.location.href);
        }
    }, [view]);

    useEffect(() => {
        const handlePopState = () => {
            setView('main');
            setResultContent('');
            setTutorSentences([]);
            setActiveFunction(null);
            setIsLoading(false); // 解析中ステートをリセット
            setIsDone(false);
            setErrorMessage('');

            if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
                chrome.runtime.sendMessage({ type: 'ABORT_ANALYSIS' }).catch(() => { });
            }
        };
        window.addEventListener('popstate', handlePopState);
        return () => { window.removeEventListener('popstate', handlePopState); }
    }, []);


    // ==========================================
    // 表示用ヘルパー
    // ==========================================
    const displayModel = MODEL_DISPLAY_NAMES[model] || model;
    const modelLimit = KNOWN_RPD_LIMITS[model] || 20;
    const usagePercent = Math.min(100, Math.max(0, (currentRPD / modelLimit) * 100));
    const usageColor = usagePercent > 60 ? '#10b981' : usagePercent > 20 ? '#f59e0b' : '#ef4444';

    const functionLabel: Record<FunctionType, string> = {
        words: 'English Words',
        tutor: 'English Tutor',
    };

    // ==========================================
    // 設定画面
    // ==========================================
    if (view === 'settings') {
        return (
            <div className="lingodesk-container">
                <header className="lingodesk-header">
                    <div className="header-brand">
                        <div className="logo-icon"><Sparkles size={24} /></div>
                        <h1>LingoDesk</h1>
                    </div>
                    {localStorage.getItem('lingodesk_apikey') && (
                        <button className="back-btn" onClick={() => {
                            setView('main');
                            setIsLoading(false);
                            setErrorMessage('');
                        }}>
                            <ArrowLeft size={18} /><span>戻る</span>
                        </button>
                    )}
                </header>
                <main className="lingodesk-main">
                    <div className="canvas-card settings-card">
                        <div className="canvas-header">
                            <h2><Key size={20} /> API設定</h2>
                        </div>
                        <div className="settings-form">
                            <div className="form-group">
                                <label>Gemini API Key</label>
                                <p className="form-hint">
                                    <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">Google AI Studio</a> でAPIキーを取得して入力してください。
                                </p>
                                <div className="input-row">
                                    <input type={showApiKey ? 'text' : 'password'} value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="AIza..." className="api-input" />
                                    <button type="button" className="toggle-btn" onClick={() => setShowApiKey(!showApiKey)}>
                                        {showApiKey ? '隠す' : '表示'}
                                    </button>
                                </div>
                            </div>
                            <button className="save-btn" onClick={handleSaveSettings}>保存して開始</button>
                            {settingsStatus && (
                                <div className={`settings-status ${settingsStatus.type}`}>{settingsStatus.text}</div>
                            )}
                        </div>
                    </div>
                </main>
                <footer className="lingodesk-footer">
                    <span className="footer-glow">LINGODESK • NEURAL LANGUAGE WORKSTATION</span>
                </footer>
            </div>
        );
    }

    // ==========================================
    // 結果画面
    // ==========================================
    if (view === 'result' && activeFunction) {
        // Words: Long/Short切替で表示内容を切り替え
        const displayContent = activeFunction === 'words' && wordsMode === 'short' && wordsFullResult
            ? shortenWordsResult(wordsFullResult)
            : resultContent;

        return (
            <div className="lingodesk-container">
                <header className="lingodesk-header result-header">
                    <div className="header-brand">
                        <button className="back-btn" onClick={() => {
                            setView('main');
                            setResultContent('');
                            setActiveFunction(null);
                            setIsLoading(false);
                            setIsDone(false);
                            setErrorMessage('');
                            if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
                                chrome.runtime.sendMessage({ type: 'ABORT_ANALYSIS' }).catch(() => { });
                            }
                        }}>
                            <ArrowLeft size={18} />
                        </button>
                        <div className="logo-icon small"><Sparkles size={18} /></div>
                        <h1>{functionLabel[activeFunction]}</h1>
                    </div>
                    <div className="header-right">
                        {/* Tutor: チャンク切替 (解析中でも出す) */}
                        {activeFunction === 'tutor' && (
                            <button className={`mode-toggle-btn ${showChunks ? 'active' : ''}`} onClick={() => setShowChunks(!showChunks)}>
                                ／ Chunk {showChunks ? 'ON' : 'OFF'}
                            </button>
                        )}
                        {/* Words: Long/Short切替 */}
                        {activeFunction === 'words' && isDone && (
                            <button className={`mode-toggle-btn ${wordsMode === 'short' ? 'active' : ''}`} onClick={() => setWordsMode(wordsMode === 'long' ? 'short' : 'long')}>
                                {wordsMode === 'long' ? '📖 Long' : '📋 Short'}
                            </button>
                        )}
                        <div className="usage-bar-container" title={`${displayModel}: 残り ${currentRPD}回`}>
                            <div className="usage-bar">
                                <div className="usage-fill" style={{ width: `${usagePercent}%`, backgroundColor: usageColor }} />
                            </div>
                            <span className="usage-text">残り {currentRPD}回</span>
                        </div>
                    </div>
                </header>

                <div className="source-preview">
                    {sourceText.length > 100 ? sourceText.substring(0, 100) + '…' : sourceText}
                </div>

                <main className="result-main" ref={resultRef}>
                    {errorMessage ? (
                        <div className="error-display">
                            <div className="error-icon">⚠️</div>
                            <div className="error-text">{errorMessage}</div>
                            <button className="retry-btn" onClick={() => handleExecute(activeFunction)}>再試行</button>
                        </div>
                    ) : activeFunction === 'tutor' ? (
                        <div className="result-content">
                            {preambleContent && (
                                <div className="result-preamble text-line" style={{ fontStyle: 'italic', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                                    {applyInline(escapeHtml(preambleContent))}
                                </div>
                            )}
                            {tutorSentences.map((s, i) => (
                                <SentenceBlock
                                    key={i}
                                    sentence={s}
                                    showChunks={showChunks}
                                />
                            ))}
                            {!isDone && (
                                <div className="loading-display mini">
                                    <div className="spinner small" />
                                    <span>解析中...</span>
                                </div>
                            )}
                        </div>
                    ) : displayContent ? (
                        <div className="result-content" dangerouslySetInnerHTML={{
                            __html: formatMarkdown(displayContent)
                        }} />
                    ) : isDone ? (
                        <div className="error-display">
                            <div className="error-icon">⚠️</div>
                            <div className="error-text">結果を取得できませんでした。モデルを変更するか、再試行してください。</div>
                            <button className="retry-btn" onClick={() => handleExecute(activeFunction)}>再試行</button>
                        </div>
                    ) : (
                        <div className="loading-display">
                            <div className="spinner" />
                            <span>解析中...</span>
                        </div>
                    )}
                </main>

                <footer className="lingodesk-footer">
                    <span className="footer-glow">LINGODESK • {functionLabel[activeFunction].toUpperCase()} • {displayModel}</span>
                </footer>
            </div>
        );
    }

    // ==========================================
    // メイン画面
    // ==========================================
    return (
        <div className="lingodesk-container">
            <header className="lingodesk-header">
                <div className="header-brand">
                    <div className="logo-icon"><Sparkles size={24} /></div>
                    <h1>LingoDesk</h1>
                </div>
                <div className="header-right">
                    <div className="usage-bar-container" title={`${displayModel}: 残り ${currentRPD}回`}>
                        <div className="usage-bar">
                            <div className="usage-fill" style={{ width: `${usagePercent}%`, backgroundColor: usageColor }} />
                        </div>
                        <span className="usage-text">残り {currentRPD}回</span>
                    </div>
                    <button className="settings-btn" onClick={() => setView('settings')} title="設定">
                        <Settings size={20} />
                    </button>
                </div>
            </header>

            <main className="lingodesk-main">
                <div className="canvas-card">
                    <div className="canvas-header">
                        <h2>INPUT TEXT</h2>
                        {/* モデル選択ドロップダウン */}
                        <div className="model-selector" id="model-selector-container">
                            <button className="model-selector-btn" onClick={() => {
                                setModelDropdownOpen(!modelDropdownOpen);
                                if (!modelDropdownOpen) fetchModels();
                            }}>
                                <span className="model-name">{displayModel}</span>
                                <ChevronDown size={14} className={modelDropdownOpen ? 'rotate-180' : ''} />
                            </button>
                            {modelDropdownOpen && (
                                <div className="model-dropdown">
                                    <div className="model-dropdown-header">
                                        <span>Select AI Model</span>
                                    </div>
                                    {loadingModels ? (
                                        <div className="model-dropdown-loading">更新中...</div>
                                    ) : (
                                        availableModels.map(m => {
                                            const remaining = getModelRemainingRPD(m);
                                            const limit = KNOWN_RPD_LIMITS[m] ?? 20;
                                            const isSelected = m === model;
                                            const isDisabled = remaining <= 0;

                                            return (
                                                <button
                                                    key={m}
                                                    className={`model-option ${isSelected ? 'active' : ''} ${isDisabled ? 'disabled' : ''}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        // 残り0でも選択を許可（Late Binding方式: 実際に叩いてみるまで制限を確定させない）
                                                        // ローカルカウンターが0の場合はリセット（実際のAPI側はまだ使える可能性があるため）
                                                        if (remaining <= 0) {
                                                            const usage = getModelUsage();
                                                            const today = getLocalDateString();
                                                            const lim = KNOWN_RPD_LIMITS[m] ?? 20;
                                                            usage[m] = { date: today, used: 0, limit: lim };
                                                            localStorage.setItem('lingodesk_model_usage', JSON.stringify(usage));
                                                        }
                                                        setModel(m);
                                                        localStorage.setItem('lingodesk_model', m);
                                                        setCurrentRPD(remaining <= 0 ? (KNOWN_RPD_LIMITS[m] ?? 20) : remaining);
                                                        setModelDropdownOpen(false);
                                                    }}
                                                >
                                                    <span className="model-option-name">{MODEL_DISPLAY_NAMES[m] || m}</span>
                                                    <span className="model-option-rpd">残り {remaining}/{limit}</span>
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="input-workspace">
                        <textarea className="main-textarea" placeholder="ここに学習・解析したい英文をコピー＆ペーストしてください..." value={sourceText} onChange={(e) => setSourceText(e.target.value)} />
                    </div>

                    <div className="action-panel">
                        <h3 className="panel-title">CHOOSE AI FUNCTION</h3>
                        <div className="button-group">
                            <button className="action-btn words-btn" onClick={() => handleExecute('words')} disabled={!sourceText.trim() || isLoading}>
                                <Search size={20} />
                                <span>English Words<br /><small>単語と熟語の解説</small></span>
                            </button>
                            <button className="action-btn tutor-btn" onClick={() => handleExecute('tutor')} disabled={!sourceText.trim() || isLoading}>
                                <BookOpen size={20} />
                                <span>English Tutor<br /><small>英文解析</small></span>
                            </button>
                        </div>
                    </div>

                    {errorMessage && view === 'main' && (
                        <div className="error-toast">⚠️ {errorMessage}</div>
                    )}
                </div>
            </main >

            <footer className="lingodesk-footer">
                <span className="footer-glow">LINGODESK • NEURAL LANGUAGE WORKSTATION</span>
            </footer>
        </div >
    );
}

export default App;
