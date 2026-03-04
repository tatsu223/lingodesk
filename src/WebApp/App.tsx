import { useState, useEffect, useRef, useCallback } from 'react';
import { BookOpen, Search, Loader2, Sparkles, Settings, ArrowLeft, Key, ChevronDown } from 'lucide-react';
import {
    analyzeTextStream,
    listAvailableModels,
    PROMPT_WORDS_LONG,
    PROMPT_TUTOR,
    KNOWN_RPD_LIMITS,
    TEXT_OUTPUT_MODELS,
    MODEL_DISPLAY_NAMES,
} from '../lib/gemini';
import './App.css';

type FunctionType = 'words' | 'tutor';
type AppView = 'main' | 'settings' | 'result';

// ==========================================
// RPDリセット: 米国太平洋時間(PT)午前0時 = JST 17:00 (DST中は16:00)
// ==========================================
function getPacificDateString(): string {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
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
    const today = getPacificDateString();
    const entry = usage[modelId];
    if (!entry || entry.date !== today) {
        return KNOWN_RPD_LIMITS[modelId] ?? 20;
    }
    return Math.max(0, entry.limit - entry.used);
}

function incrementModelUsage(modelId: string) {
    const usage = getModelUsage();
    const today = getPacificDateString();
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
// TTS日次使用制限（1日10回）
// ==========================================
const TTS_DAILY_LIMIT = 10;

function getTTSUsageToday(): number {
    const raw = localStorage.getItem('lingodesk_tts_usage');
    if (!raw) return 0;
    try {
        const data = JSON.parse(raw);
        const today = getPacificDateString();
        return data.date === today ? data.count : 0;
    } catch { return 0; }
}

function incrementTTSUsage(): number {
    const today = getPacificDateString();
    const current = getTTSUsageToday();
    const newCount = current + 1;
    localStorage.setItem('lingodesk_tts_usage', JSON.stringify({ date: today, count: newCount }));
    return newCount;
}

function getTTSRemaining(): number {
    return Math.max(0, TTS_DAILY_LIMIT - getTTSUsageToday());
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

function formatMarkdown(text: string, showChunks: boolean = true): string {
    if (text.includes('error-display')) return text;

    const lines = text.split('\n');
    const parts: string[] = [];
    let inBlockquote = false;
    let blockquoteLines: { text: string; globalWordIdx: number }[] = [];
    let globalLineIdx = 0;

    for (const line of lines) {
        if (line.trim() === '---' || line.trim() === '***' || line.trim() === '___') {
            if (inBlockquote) {
                parts.push(renderBlockquote(blockquoteLines, showChunks, globalLineIdx));
                globalLineIdx += blockquoteLines.length;
                blockquoteLines = [];
                inBlockquote = false;
            }
            parts.push('<hr class="result-hr">');
            continue;
        }

        if (line.startsWith('> ')) {
            inBlockquote = true;
            blockquoteLines.push({ text: line.slice(2), globalWordIdx: -1 }); // globalWordIdx はここでは使わないが構造を統一
            continue;
        } else if (inBlockquote) {
            parts.push(renderBlockquote(blockquoteLines, showChunks, globalLineIdx));
            globalLineIdx += blockquoteLines.length;
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

        // チャンク表示の制御
        let processed = applyInline(escapeHtml(line));
        if (showChunks) {
            processed = processed.replace(/／/g, '<span class="chunk-slash">／</span>');
        } else {
            processed = processed.replace(/／/g, ' ');
        }
        parts.push(`<div class="text-line">${processed}</div>`);
    }

    if (inBlockquote && blockquoteLines.length > 0) {
        parts.push(renderBlockquote(blockquoteLines, showChunks, globalLineIdx));
    }

    return parts.join('');
}

function renderBlockquote(lines: { text: string; globalWordIdx: number }[], showChunks: boolean, startIdx: number = 0): string {
    const content = lines.map((l, idx) => {
        let escaped = escapeHtml(l.text);
        if (showChunks) {
            escaped = escaped.replace(/／/g, '<span class="chunk-slash">／</span>');
        } else {
            escaped = escaped.replace(/／/g, ' ');
        }

        // TTS用: ／ を除いたプレーンな英文テキスト
        const plainText = l.text.replace(/／/g, ' ').replace(/\s+/g, ' ').trim();
        const globalIdx = startIdx + idx;

        // スピーカーアイコン (カスタム SVG ボタン)
        const speakerSvg = `
            <svg class="icon-volume" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
            </svg>
        `;

        return `<div class="tutor-line"><button class="line-speak-btn" data-line-idx="${globalIdx}" data-line-text="${encodeURIComponent(plainText)}" title="この行を再生">${speakerSvg}</button><span>${escaped}</span></div>`;
    }).join('');
    return `<blockquote class="result-blockquote tutor-blockquote">${content}</blockquote>`;
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
    const [isLoading, setIsLoading] = useState(false);
    const [isDone, setIsDone] = useState(false);
    const [activeFunction, setActiveFunction] = useState<FunctionType | null>(null);
    const [errorMessage, setErrorMessage] = useState('');

    // Settings
    const [apiKey, setApiKey] = useState(localStorage.getItem('lingodesk_apikey') || '');
    const [model, setModel] = useState(localStorage.getItem('lingodesk_model') || 'gemini-2.5-flash');
    const [showApiKey, setShowApiKey] = useState(false);
    const [settingsStatus, setSettingsStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Model selection
    const [availableModels, setAvailableModels] = useState<string[]>([]);
    const [loadingModels, setLoadingModels] = useState(false);
    const [modelDropdownOpen, setModelDropdownOpen] = useState(false);

    // RPD
    const [currentRPD, setCurrentRPD] = useState(getModelRemainingRPD(model));

    // Tutor: チャンク表示切替
    const [showChunks, setShowChunks] = useState(false);

    // Words: Long/Short切替
    const [wordsMode, setWordsMode] = useState<'long' | 'short'>('long');
    const [wordsFullResult, setWordsFullResult] = useState('');

    // Tutor: Gemini TTS ナレーター
    const GEMINI_VOICES = [
        { name: 'Kore', label: 'Kore (Balanced)' },
        { name: 'Zephyr', label: 'Zephyr (Deep)' },
        { name: 'Puck', label: 'Puck (Cheerful)' },
        { name: 'Charon', label: 'Charon (Formal)' },
        { name: 'Leda', label: 'Leda (Soft)' },
        { name: 'Aoede', label: 'Aoede (Expressive)' },
        { name: 'Callirrhoe', label: 'Callirrhoe' },
        { name: 'Enceladus', label: 'Enceladus' },
        { name: 'Iapetus', label: 'Iapetus' },
        { name: 'Algieba', label: 'Algieba' },
    ];
    const [selectedVoice, setSelectedVoice] = useState('Kore');
    const [isLoadingTTS, setIsLoadingTTS] = useState(false);

    // stale closure 防止: DOM イベントハンドラから最新値を参照するためのref
    const isSpeakingRef = useRef(false);
    const activePlayingIndexRef = useRef<number | null>(null);
    // 全行プリロード済みフラグ（新規解析・ボイス変更でリセット）
    const preloadedRef = useRef(false);
    // プリロード中フラグ（並列プリロードの競合防止）
    const preloadingRef = useRef(false);

    // Tutor: 再生状態管理
    const playbackStateRef = useRef({
        isPlaying: false,
        audioElement: null as HTMLAudioElement | null,
    });
    const ttsCacheRef = useRef<Record<string, string>>({});

    const resultRef = useRef<HTMLDivElement>(null);

    // 初期化
    useEffect(() => {
        if (!localStorage.getItem('lingodesk_apikey')) {
            setView('settings');
        } else {
            // 起動時にRPD状態を確認
            initializeRPD();
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
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [modelDropdownOpen]);

    // 起動時RPD初期化：日付リセットとモデル一覧取得
    const initializeRPD = async () => {
        const key = localStorage.getItem('lingodesk_apikey');
        if (!key) return;

        const today = getPacificDateString();
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

            // 現在のモデルが利用可能リストにない（古いモデル名が残っている）場合はリセット
            if (models.length > 0 && !models.includes(model)) {
                setModel(models[0]);
                localStorage.setItem('lingodesk_model', models[0]);
                setCurrentRPD(getModelRemainingRPD(models[0]));
            }

            // 現在のモデルがRPD切れなら自動切替
            if (getModelRemainingRPD(model) <= 0) {
                const available = models.filter(m => getModelRemainingRPD(m) > 0);
                if (available.length > 0) {
                    setModel(available[0]);
                    localStorage.setItem('lingodesk_model', available[0]);
                    setCurrentRPD(getModelRemainingRPD(available[0]));
                }
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

    // ストリーミング中の自動スクロール
    useEffect(() => {
        if (!isDone && resultRef.current) {
            resultRef.current.scrollTop = resultRef.current.scrollHeight;
        }
    }, [resultContent, isDone]);

    // モデル一覧取得
    const fetchModels = useCallback(async () => {
        const key = localStorage.getItem('lingodesk_apikey');
        if (!key) return;

        setLoadingModels(true);
        try {
            const models = await listAvailableModels(key);
            setAvailableModels(models);

            // 現在のモデルがリストになければ1番目にリセット
            if (models.length > 0 && !models.includes(model)) {
                setModel(models[0]);
                localStorage.setItem('lingodesk_model', models[0]);
            }

            setCurrentRPD(getModelRemainingRPD(model));
        } catch (err) {
            console.error('Failed to fetch models:', err);
            setErrorMessage('モデル一覧の取得に失敗しました。APIキーを確認してください。');
        } finally {
            setLoadingModels(false);
        }
    }, [model]);

    // APIキー保存時とメイン画面表示時にモデル取得
    useEffect(() => {
        if (view === 'main' && localStorage.getItem('lingodesk_apikey')) {
            fetchModels();
        }
    }, [view, fetchModels]);

    // RPD切れ時の自動モデル切替
    const autoSwitchModel = useCallback(() => {
        if (getModelRemainingRPD(model) > 0) return model;

        for (const m of TEXT_OUTPUT_MODELS) {
            if (availableModels.includes(m) && getModelRemainingRPD(m) > 0) {
                setModel(m);
                localStorage.setItem('lingodesk_model', m);
                setCurrentRPD(getModelRemainingRPD(m));
                return m;
            }
        }
        return null; // 全モデル切れ
    }, [model, availableModels]);

    // ==========================================
    // API呼び出し
    // ==========================================
    const handleExecute = async (type: FunctionType) => {
        if (!sourceText.trim()) return;

        const storedKey = localStorage.getItem('lingodesk_apikey');
        if (!storedKey) { setView('settings'); return; }

        // 自動モデル切替
        const activeModel = autoSwitchModel();
        if (!activeModel) {
            setErrorMessage('全てのモデルの本日のAPI使用回数が上限に達しました。明日リセットされます。');
            return;
        }

        setActiveFunction(type);
        setView('result');
        setResultContent('');
        setWordsFullResult('');
        setWordsMode('long');
        setShowChunks(false);
        setIsLoading(true);
        setIsDone(false);
        setErrorMessage('');
        stopAudio();

        // キャッシュのクリア（必要に応じて）
        for (const url of Object.values(ttsCacheRef.current)) {
            URL.revokeObjectURL(url);
        }
        ttsCacheRef.current = {};
        preloadedRef.current = false;
        const promptMap: Record<FunctionType, string> = {
            words: PROMPT_WORDS_LONG,
            tutor: PROMPT_TUTOR,
        };

        try {
            const finalResultRaw = await analyzeTextStream(
                storedKey,
                sourceText,
                promptMap[type],
                activeModel,
                (accumulated) => {
                    setResultContent(accumulated);
                }
            );

            // 冒頭の「はい、承知いたしました」等のAIフィラーを念のため除去
            const finalResult = finalResultRaw.replace(/^(はい、承知いたしました。|承知いたしました。|かしこまりました。|OK、|Certainly!|Sure!|Here is the analysis:|以下の解説を生成します:|各単語について解説します:)\n*\s*/i, '');
            setResultContent(finalResult);

            // Words用：Longの全文を保存
            if (type === 'words') {
                setWordsFullResult(finalResult);
            }

            const remaining = incrementModelUsage(activeModel);
            setCurrentRPD(remaining);

            // RPD切れたら自動切替を再度チェック
            if (remaining <= 0) {
                autoSwitchModel();
                fetchModels();
            }

            setIsDone(true);
        } catch (err: any) {
            const msg = err?.message || '不明なエラーが発生しました';
            if (msg.includes('API key') || msg.includes('401') || msg.includes('403')) {
                setErrorMessage('APIキーが無効です。設定画面でAPIキーを確認してください。');
            } else if (msg.includes('parse stream')) {
                setErrorMessage(`解析エラー: データの受信中に問題が発生しました。インターネット接続を確認し、もう一度お試しください。(${msg})`);
            } else if (msg.includes('429') || msg.includes('quota') || msg.includes('rate')) {
                // ... (existing 429 logic)
                incrementModelUsage(activeModel);
                const nextModel = autoSwitchModel();
                const usage = getModelUsage();
                const today = getPacificDateString();
                const limit = KNOWN_RPD_LIMITS[activeModel] || 20;
                usage[activeModel] = { date: today, used: limit, limit };
                localStorage.setItem('lingodesk_model_usage', JSON.stringify(usage));
                if (nextModel && nextModel !== activeModel) {
                    setErrorMessage(`${MODEL_DISPLAY_NAMES[activeModel] || activeModel} のAPIレート制限に達しました。${MODEL_DISPLAY_NAMES[nextModel] || nextModel} に自動切替しました。もう一度お試しください。`);
                } else {
                    setErrorMessage('API呼び出しの上限に達しました。しばらく待ってからお試しください。');
                }
                fetchModels();
            } else {
                setErrorMessage(`エラー: ${msg}`);
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

    // ==========================================
    // 読み上げ
    // ==========================================

    // ボイス変更時にプリロードをリセット
    useEffect(() => {
        preloadedRef.current = false;
    }, [selectedVoice]);

    const stopAudio = () => {
        playbackStateRef.current.isPlaying = false;
        if (playbackStateRef.current.audioElement) {
            playbackStateRef.current.audioElement.pause();
            playbackStateRef.current.audioElement.currentTime = 0;
            playbackStateRef.current.audioElement = null;
        }
        isSpeakingRef.current = false;
        activePlayingIndexRef.current = null;
        setIsLoadingTTS(false);
    };

    // TTS音声をキャッシュ付きで取得（gemini-2.0-flash-exp は responseModalities:AUDIO をサポート）
    // ※TTS使用回数のカウントはhandleLineSpeakClick側で一括管理（ここではカウントしない）
    const fetchTTSAudio = async (text: string, voice: string): Promise<string> => {
        const cacheKey = `${voice}_${text}`;
        if (ttsCacheRef.current[cacheKey]) return ttsCacheRef.current[cacheKey];

        const key = localStorage.getItem('lingodesk_apikey');
        if (!key) throw new Error('API key not set');

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${key}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text }] }],
                    generationConfig: {
                        responseModalities: ['AUDIO'],
                        speechConfig: {
                            voiceConfig: {
                                prebuiltVoiceConfig: { voiceName: voice }
                            }
                        }
                    }
                })
            }
        );

        if (!response.ok) {
            const errBody = await response.text().catch(() => '');
            throw new Error(`TTS API ${response.status}: ${errBody.slice(0, 200)}`);
        }

        const data = await response.json();
        const audioData = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
        if (!audioData?.data) {
            const part = data?.candidates?.[0]?.content?.parts?.[0];
            const errMsg = data?.error?.message || JSON.stringify(part).slice(0, 150);
            throw new Error(`No audio in response: ${errMsg}`);
        }

        const binaryStr = atob(audioData.data);
        const pcmBytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
            pcmBytes[i] = binaryStr.charCodeAt(i);
        }

        const wavBlob = pcmToWav(pcmBytes, 24000, 1, 16);
        const url = URL.createObjectURL(wavBlob);
        ttsCacheRef.current[cacheKey] = url;
        return url;
    };

    // スピーカーボタンクリック: 初回は全行プリロード → 対象行を再生
    const handleLineSpeakClick = async (lineText: string, lineIndex: number, voice: string) => {
        if (!isDone || activeFunction !== 'tutor') return;

        // トグル停止: 同じ行を再クリック → 停止
        if (isSpeakingRef.current && activePlayingIndexRef.current === lineIndex) {
            stopAudio();
            return;
        }

        stopAudio();
        if (!lineText) return;

        // プリロード中に別のスピーカーが押された場合はガード
        if (preloadingRef.current) return;

        // TTS日次制限チェック（プリロード未済 かつ キャッシュなしの場合のみ）
        if (!preloadedRef.current && getTTSRemaining() <= 0) {
            setErrorMessage(`本日のTTS音声変換は${TTS_DAILY_LIMIT}回の上限に達しました。明日リセットされます。`);
            return;
        }

        isSpeakingRef.current = true;
        activePlayingIndexRef.current = lineIndex;
        playbackStateRef.current.isPlaying = true;

        // 初回: 全行の音声を並列プリロード（1回のプリロード = TTS 1回分としてカウント）
        if (!preloadedRef.current) {
            preloadingRef.current = true;
            setIsLoadingTTS(true);

            const allBtns = Array.from(document.querySelectorAll<HTMLElement>('.line-speak-btn'));
            const allTexts = [...new Set(
                allBtns
                    .map(btn => decodeURIComponent(btn.getAttribute('data-line-text') || ''))
                    .filter(t => t.length > 0)
            )];

            const results = await Promise.allSettled(allTexts.map(t => fetchTTSAudio(t, voice)));

            preloadingRef.current = false;
            setIsLoadingTTS(false);

            if (!playbackStateRef.current.isPlaying) return;

            // 全て失敗した場合はエラー表示（リトライ可能にするためpreloadedRefはfalseのまま）
            const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
            if (failed.length === results.length) {
                const reason = failed[0]?.reason as Error;
                setErrorMessage(`音声生成エラー: ${reason?.message || '不明なエラー'}`);
                stopAudio();
                return;
            }

            // プリロード成功: TTS使用を1回としてカウント
            incrementTTSUsage();
            preloadedRef.current = true;
        }

        // キャッシュから再生
        const url = ttsCacheRef.current[`${voice}_${lineText}`];
        if (!url) {
            setErrorMessage('この行の音声生成に失敗しました。もう一度お試しください。');
            stopAudio();
            preloadedRef.current = false; // リトライ許可
            return;
        }

        const audio = new Audio(url);
        playbackStateRef.current.audioElement = audio;
        audio.onended = () => stopAudio();
        audio.onerror = () => stopAudio();
        audio.play().catch(() => stopAudio());
    };

    // Reactイベント外（DOM注入）からの呼び出し対応
    useEffect(() => {
        const handleTutorLineSpeakClick = (e: MouseEvent) => {
            const btn = (e.target as HTMLElement).closest('.line-speak-btn');
            if (btn) {
                const lineIdx = parseInt(btn.getAttribute('data-line-idx') || '0', 10);
                const lineText = decodeURIComponent(btn.getAttribute('data-line-text') || '');
                handleLineSpeakClick(lineText, lineIdx, selectedVoice);
            }
        };

        if (view === 'result' && activeFunction === 'tutor') {
            document.addEventListener('click', handleTutorLineSpeakClick);
            return () => document.removeEventListener('click', handleTutorLineSpeakClick);
        }
    }, [view, activeFunction, isDone, selectedVoice]);

    // PCM → WAV変換ヘルパー
    function pcmToWav(pcmData: Uint8Array, sampleRate: number, numChannels: number, bitsPerSample: number): Blob {
        const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
        const blockAlign = numChannels * (bitsPerSample / 8);
        const dataSize = pcmData.length;
        const buffer = new ArrayBuffer(44 + dataSize);
        const view = new DataView(buffer);

        // RIFF header
        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + dataSize, true);
        writeString(view, 8, 'WAVE');

        // fmt chunk
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true); // PCM
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, byteRate, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitsPerSample, true);

        // data chunk
        writeString(view, 36, 'data');
        view.setUint32(40, dataSize, true);

        const wavBytes = new Uint8Array(buffer);
        wavBytes.set(pcmData, 44);

        return new Blob([wavBytes], { type: 'audio/wav' });
    }

    function writeString(view: DataView, offset: number, str: string) {
        for (let i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i));
        }
    }

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
                        <button className="back-btn" onClick={() => setView('main')}>
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
                            speechSynthesis.cancel();
                            stopAudio();
                            setView('main');
                            setResultContent('');
                            setActiveFunction(null);
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
                        {/* Tutor: ナレーター選択 (解析中でも出す) */}
                        {activeFunction === 'tutor' && (
                            <select className="voice-select" value={selectedVoice} onChange={(e) => setSelectedVoice(e.target.value)}>
                                {GEMINI_VOICES.map((v) => (
                                    <option key={v.name} value={v.name}>{v.label}</option>
                                ))}
                            </select>
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
                    {isLoadingTTS && (
                        <div className="audio-loading-overlay">
                            <div className="loader-box">
                                <Loader2 className="spin-icon" size={24} />
                                <span>Generating Audio...</span>
                            </div>
                        </div>
                    )}
                    {errorMessage ? (
                        <div className="error-display">
                            <div className="error-icon">⚠️</div>
                            <div className="error-text">{errorMessage}</div>
                            <button className="retry-btn" onClick={() => handleExecute(activeFunction)}>再試行</button>
                        </div>
                    ) : displayContent ? (
                        <div className="result-content" dangerouslySetInnerHTML={{
                            __html: formatMarkdown(displayContent, activeFunction === 'tutor' ? showChunks : true)
                        }} />
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
                                <ChevronDown size={14} />
                            </button>
                            {modelDropdownOpen && (
                                <div className="model-dropdown">
                                    {loadingModels ? (
                                        <div className="model-dropdown-loading">読み込み中...</div>
                                    ) : availableModels.length > 0 ? (
                                        availableModels
                                            .filter(m => {
                                                const remaining = getModelRemainingRPD(m);
                                                const limit = KNOWN_RPD_LIMITS[m] ?? 20;
                                                return limit > 0 && remaining > 0;
                                            })
                                            .map(m => {
                                                const remaining = getModelRemainingRPD(m);
                                                const limit = KNOWN_RPD_LIMITS[m] ?? 20;
                                                return (
                                                    <button key={m} className={`model-option ${m === model ? 'active' : ''}`} onClick={(e) => {
                                                        e.stopPropagation();
                                                        setModel(m);
                                                        localStorage.setItem('lingodesk_model', m);
                                                        setCurrentRPD(getModelRemainingRPD(m));
                                                        setModelDropdownOpen(false);
                                                    }}>
                                                        <span className="model-option-name">{MODEL_DISPLAY_NAMES[m] || m}</span>
                                                        <span className="model-option-rpd">残り{remaining}/{limit}</span>
                                                    </button>
                                                );
                                            })
                                    ) : (
                                        <div className="model-dropdown-loading">利用可能なモデルがありません</div>
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
