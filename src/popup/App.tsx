import { useState, useEffect } from 'react';

const FONT_OPTIONS = [
    { value: "'Noto Sans JP', 'Segoe UI', sans-serif", label: 'Noto Sans JP (Default)' },
    { value: "'Inter', 'Segoe UI', sans-serif", label: 'Inter' },
    { value: "'Roboto', sans-serif", label: 'Roboto' },
    { value: "'Hiragino Sans', 'Yu Gothic', sans-serif", label: 'ヒラギノ角ゴ / 游ゴシック' },
    { value: "'Georgia', serif", label: 'Georgia (Serif)' },
];


function App() {
    const [apiKey, setApiKey] = useState('');
    const [model, setModel] = useState('gemini-2.5-flash');
    const [geminiDailyLimit, setGeminiDailyLimit] = useState(20);
    const [fontSize, setFontSize] = useState(14);
    const [fontFamily, setFontFamily] = useState("'Noto Sans JP', 'Segoe UI', sans-serif");
    const [displayMode, setDisplayMode] = useState<'popup' | 'window'>('popup');
    const [availableModels] = useState<{ id: string; studioName: string; limit: number }[]>([
        { id: 'gemini-2.5-flash', studioName: 'Gemini 2.5 Flash', limit: 20 },
        { id: 'gemini-3-flash-preview', studioName: 'Gemini 3 Flash', limit: 20 },
        { id: 'gemini-2.5-flash-lite', studioName: 'Gemini 2.5 Flash Lite', limit: 20 },
    ]);
    const [showApiKey, setShowApiKey] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);


    useEffect(() => {
        chrome.storage.local.get(
            ['geminiApiKey', 'geminiModel', 'geminiDailyLimit', 'fontSize', 'fontFamily', 'displayMode'],
            (result) => {
                if (result.geminiApiKey) setApiKey(result.geminiApiKey as string);
                if (result.geminiModel) setModel(result.geminiModel as string);
                // 初期ロード時にIDから表示名を逆引きしてセットする責務は fetchModels が担う
                if (result.geminiDailyLimit !== undefined) setGeminiDailyLimit(result.geminiDailyLimit as number);
                if (result.fontSize) setFontSize(result.fontSize as number);
                if (result.fontFamily) setFontFamily(result.fontFamily as string);
                if (result.displayMode) setDisplayMode(result.displayMode as 'popup' | 'window');
            }
        );
    }, []);


    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        chrome.storage.local.set({
            geminiApiKey: apiKey,
            geminiModel: model,
            geminiDailyLimit: geminiDailyLimit,
            fontSize,
            fontFamily,
            displayMode,
        }, () => {
            // バックグラウンドに使用状況の更新を依頼
            chrome.runtime.sendMessage({ type: 'REFRESH_USAGE' });

            setStatusMessage({ type: 'success', text: '✓ 設定を保存しました！（最新のRPDを反映しました）' });
            setTimeout(() => setStatusMessage(null), 3000);
        });
    };

    return (
        <div className="settings-container">
            <header className="settings-header">
                <div className="settings-header-left">
                    <div className="settings-logo">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                        </svg>
                    </div>
                    <div>
                        <h1 className="settings-title">Gemini English Tutor</h1>
                        <p className="settings-subtitle">英文解析ツール 設定</p>
                    </div>
                </div>
            </header>

            <div className="settings-body">
                <form onSubmit={handleSave}>
                    {/* API設定セクション */}
                    <div className="settings-section">
                        <div className="section-header">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
                            </svg>
                            <span>API設定</span>
                        </div>

                        <div className="form-group">
                            <label>Gemini API Key</label>
                            <div className="input-with-action">
                                <input
                                    type={showApiKey ? 'text' : 'password'}
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    placeholder="AIza..."
                                    autoComplete="off"
                                />
                                <button
                                    type="button"
                                    className="icon-btn"
                                    onClick={() => setShowApiKey(!showApiKey)}
                                    title="表示/非表示"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        {showApiKey ? (
                                            <>
                                                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"></path>
                                                <line x1="1" y1="1" x2="23" y2="23"></line>
                                            </>
                                        ) : (
                                            <>
                                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                                <circle cx="12" cy="12" r="3"></circle>
                                            </>
                                        )}
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Model</label>
                            <div className="model-controls">
                                {availableModels.length > 0 ? (
                                    <>
                                        <select
                                            value={model}
                                            onChange={(e) => {
                                                const mId = e.target.value;
                                                const selected = availableModels.find(m => m.id === mId);
                                                // selected が見つからないことは想定しないため、if文は不要
                                                setModel(selected!.id);
                                                setGeminiDailyLimit(selected!.limit);
                                            }}
                                        >
                                            {availableModels.map((m, idx) => (
                                                <option key={`${m.id}-${idx}`} value={m.id}>
                                                    {m.studioName} (Limit: {m.limit} RPD)
                                                </option>
                                            ))}
                                        </select>
                                        <p className="form-hint" style={{ color: '#059669' }}>
                                            ✓ {availableModels.length} models found
                                        </p>
                                    </>
                                ) : (
                                    <input
                                        type="text"
                                        value={model}
                                        onChange={(e) => setModel(e.target.value)}
                                        placeholder="e.g. gemini-2.5-flash"
                                    />
                                )}
                                <span>Available Models (Internal Only)</span>
                            </div>
                        </div>

                        <div className="form-group">
                            <label>1日のAPIリクエスト上限（RPD）</label>
                            <input
                                type="number"
                                min={1}
                                max={10000}
                                value={geminiDailyLimit}
                                onChange={(e) => setGeminiDailyLimit(Number(e.target.value) || 20)}
                                style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', width: '100px', fontFamily: "'Inter', sans-serif" }}
                            />
                            <p className="form-hint">初期値は20です。ご自身のAPI制限に合わせて設定してください。</p>
                        </div>
                    </div>

                    {/* 表示設定セクション */}
                    <div className="settings-section">
                        <div className="section-header">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="3"></circle>
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                            </svg>
                            <span>表示設定</span>
                        </div>

                        <div className="form-group">
                            <label>表示モード</label>
                            <select
                                value={displayMode}
                                onChange={(e) => setDisplayMode(e.target.value as 'popup' | 'window')}
                            >
                                <option value="popup">現在のページ上のポップアップ (Default)</option>
                                <option value="window">専用の別ウィンドウで表示</option>
                            </select>
                            <p className="form-hint">右クリックから解析を実行した際にどこに結果を出すかを選択します。</p>
                        </div>

                        <div className="form-group">
                            <label>文字サイズ: {fontSize}px</label>
                            <input
                                type="range"
                                min={10}
                                max={48}
                                value={fontSize}
                                onChange={(e) => setFontSize(Number(e.target.value))}
                                className="range-slider"
                            />
                            <div className="range-labels">
                                <span>10px</span>
                                <span>48px</span>
                            </div>
                        </div>

                        <div className="form-group">
                            <label>フォント</label>
                            <select
                                value={fontFamily}
                                onChange={(e) => setFontFamily(e.target.value)}
                            >
                                {FONT_OPTIONS.map((f) => (
                                    <option key={f.value} value={f.value}>{f.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* 使い方セクション */}
                    <div className="settings-section usage-section">
                        <div className="section-header">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                                <line x1="12" y1="17" x2="12.01" y2="17"></line>
                            </svg>
                            <span>使い方</span>
                        </div>
                        <div className="usage-content">
                            <div className="usage-step">
                                <div className="usage-key">1</div>
                                <div>
                                    <strong>英文テキストを選択して「1」キー</strong>
                                    <p>詳細な解説（ロングバージョン）を表示</p>
                                </div>
                            </div>
                            <div className="usage-step">
                                <div className="usage-key">2</div>
                                <div>
                                    <strong>英文テキストを選択して「2」キー</strong>
                                    <p>簡潔な解説（ショートバージョン）を表示</p>
                                </div>
                            </div>
                            <div className="usage-step">
                                <div className="usage-key">Esc</div>
                                <div>
                                    <strong>ポップアップを閉じる</strong>
                                    <p>Escキーまたはポップアップ外クリック</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 保存ボタン */}
                    <button type="submit" className="save-btn">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                            <polyline points="17 21 17 13 7 13 7 21"></polyline>
                            <polyline points="7 3 7 8 15 8"></polyline>
                        </svg>
                        <span>Save Settings</span>
                    </button>
                </form>

                {/* ステータスメッセージ */}
                {statusMessage && (
                    <div className={`status-message ${statusMessage.type}`}>
                        {statusMessage.text}
                    </div>
                )}
            </div>
        </div>
    );
}

export default App;
