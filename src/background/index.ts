/// <reference types="chrome" />
import { SYSTEM_PROMPT } from '../lib/gemini';

const MENU_ID = "gemini-english-tutor-analyze";

// ウィンドウモード管理
let activeWindowId: number | null = null;
let activeSourceTabId: number | null = null;
let pendingWindowData: { sourceText: string; content: string; isDone: boolean; sourceTabId: number | null; error: string | null } | null = null;

// 外部拡張機能ID (English Words)
const OTHER_EXTENSION_ID = 'flcegccpdpakepgieeeiimdpolhcdjdf';


// 解析状態保持（モード切り替え時の同期用）
let currentAnalysisSourceText = '';
let currentAnalysisContent = '';
let currentAnalysisIsDone = false;
let currentAnalysisError: string | null = null;
let activeAnalysisController: AbortController | null = null;

// ヘルパー: キャッシュからの読み込み
async function initCachedAnalysisState() {
    const result = await new Promise<any>(r => chrome.storage.local.get(['appAnalysisState'], r));
    const s = result.appAnalysisState || {};
    currentAnalysisSourceText = s.sourceText || '';
    currentAnalysisContent = s.content || '';
    currentAnalysisIsDone = s.isDone || false;
    currentAnalysisError = s.error || null;
}

// 状態更新と保存
async function updateAnalysisState(updates: Partial<{ sourceText: string; content: string; isDone: boolean; error: string | null }>) {
    if (updates.sourceText !== undefined) currentAnalysisSourceText = updates.sourceText;
    if (updates.content !== undefined) currentAnalysisContent = updates.content;
    if (updates.isDone !== undefined) currentAnalysisIsDone = updates.isDone;
    if (updates.error !== undefined) currentAnalysisError = updates.error;

    await chrome.storage.local.set({
        appAnalysisState: {
            sourceText: currentAnalysisSourceText,
            content: currentAnalysisContent,
            isDone: currentAnalysisIsDone,
            error: currentAnalysisError
        }
    });
}

// キャッシュ設定（直近10件を保持）
const CACHE_SIZE = 10;
const analysisCache: Map<string, string> = new Map();

// インストール・更新時の初期設定
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
            id: MENU_ID,
            title: "Geminiで英語解析",
            contexts: ["selection"]
        });
    });

    console.log('[Background] Extension installed/updated.');

    // refresh-usage のみ残す（check-model と rpd-sync は削除：ステルスウィンドウを防止）
    chrome.alarms.create('refresh-usage', { periodInMinutes: 0.5 });
    chrome.alarms.clear('rpd-sync');
    chrome.alarms.clear('check-model');

    // 初期実行
    refreshUsageOnly(false);
    initCachedAnalysisState();
});

// Service Worker 起動時の初期設定
chrome.runtime.onStartup.addListener(() => {
    chrome.alarms.create('refresh-usage', { periodInMinutes: 0.5 });
    chrome.alarms.clear('rpd-sync');
    chrome.alarms.clear('check-model');

    refreshUsageOnly(false);
    initCachedAnalysisState();
});

// アラームリスナー
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'refresh-usage') {
        refreshUsageOnly(false);
    }
    // check-model と rpd-sync は削除済み（ステルスウィンドウを防止）
});


chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === MENU_ID && info.selectionText) {
        const text = info.selectionText || '';
        const targetTabId = tab?.id ?? null;

        try {
            // PDFや制限ページ（chrome-extension:// など）の検出を強化
            const isPdf = (tab?.url || '').toLowerCase().endsWith('.pdf') || (tab?.url || '').startsWith('blob:');
            const isFileUrl = (tab?.url || '').startsWith('file://');
            const isRestrictedUrl = (tab?.url || '').startsWith('chrome-extension://') || (tab?.url || '').startsWith('chrome://');
            const requiresWindow = isPdf || isFileUrl || isRestrictedUrl || !targetTabId;

            // 表示モードを考慮
            const result = await chrome.storage.local.get(['displayMode']);
            const displayMode = result.displayMode || 'popup';

            if (displayMode === 'window' || activeWindowId !== null || requiresWindow) {
                // 別ウィンドウが開いているか、ウィンドウモード設定、またはPDF/ローカルファイルの場合はそちらを優先
                if (activeWindowId !== null) {
                    try {
                        await chrome.windows.update(activeWindowId, { focused: true });
                    } catch (e) {
                        activeWindowId = null;
                    }
                }

                if (activeWindowId === null) {
                    await openInWindow(text, '', false, targetTabId ?? undefined);
                } else {
                    // 元のタブにポップアップがあれば消去させる
                    if (targetTabId) {
                        chrome.tabs.sendMessage(targetTabId, { type: 'CLOSE_POPUP' }).catch(() => { });
                    }

                    // ウィンドウで解析開始
                    chrome.runtime.sendMessage({
                        type: 'WINDOW_INIT',
                        sourceText: text,
                        content: '',
                        isDone: false,
                        sourceTabId: activeSourceTabId
                    }).catch(() => { });
                }
                handleStreamAnalysis(text, null);
            } else {
                if (targetTabId) {
                    processNormalPopup(text, targetTabId);
                } else {
                    await openInWindow(text, '', false, undefined);
                    handleStreamAnalysis(text, null);
                }
            }
        } catch (e) {
            console.error('[Background] Context menu error:', e);
            if (targetTabId) {
                processNormalPopup(text, targetTabId);
            } else {
                openInWindow(text, '', false, undefined);
                handleStreamAnalysis(text, null);
            }
        }
    }
});

// ストレージ変更を監視して即座に反映
chrome.storage.onChanged.addListener((changes) => {
    if (changes.geminiModel || changes.geminiApiKey || changes.geminiDailyLimit) {
        console.log('[Background] Settings changed, refreshing usage display...');
        refreshUsageOnly(false);

        // 制限値が変更された場合は他方にも通知する
        if (changes.geminiDailyLimit) {
            const newLimit = changes.geminiDailyLimit.newValue;
            if (newLimit) {
                chrome.storage.local.get(['usageData', 'geminiModel'], (result) => {
<<<<<<<<< Temporary merge branch 1
                    const model = result.geminiModel as string || 'gemini-2.5-flash';
=========
                    const model = result.geminiModel as string || 'gemini-2.0-flash';
>>>>>>>>> Temporary merge branch 2
                    const data = (result.usageData as UsageData) || { date: new Date().toLocaleDateString('ja-JP'), count: 0, models: {} };
                    const modelCount = data.models?.[model]?.count || 0;

                    chrome.runtime.sendMessage(OTHER_EXTENSION_ID, {
                        type: 'EXTERNAL_SYNC_USAGE',
                        count: data.count, // 互換性のための合計
                        modelCount: modelCount,
                        model: model,
                        date: data.date,
                        limit: newLimit
                    }).catch(() => { });
                });
            }
        }
    }
});

function processNormalPopup(text: string, tabId: number) {
    // 表示前に使用量を最新化
    refreshUsageOnly();

    // content scriptにポップアップ表示を指示
    chrome.tabs.sendMessage(tabId, {
        type: "SHOW_POPUP",
        text: text,
        content: currentAnalysisSourceText === text ? currentAnalysisContent : '',
        isDone: currentAnalysisSourceText === text ? currentAnalysisIsDone : false,
        error: currentAnalysisSourceText === text ? currentAnalysisError : null
    }).then(() => {
        // 成功した場合は通常通りストリーミング開始
        handleStreamAnalysis(text, tabId);
    }).catch((e) => {
        // コンテンツスクリプトが存在しない場合（PDF等）はウィンドウモードにフォールバック
        console.warn('[Background] Failed to send SHOW_POPUP, falling back to window mode:', e);
        openInWindow(text, '', false, tabId);
        handleStreamAnalysis(text, null);
    });
}

// 起動時に最新モデルをチェックしてアップグレードを促す（将来用）
// @ts-ignore unused
async function checkAndUpgradeModel() {
    const settings = await getSettings();
    if (!settings.apiKey) return;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${settings.apiKey}`
        );
        if (!response.ok) return;

        const data = await response.json();
        const models = (data.models || [])
            .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
            .map((m: any) => m.name.replace('models/', ''));

        const currentModel = settings.model;

        // 【重要】ユーザーの選択を尊重：2.5/3シリーズやPro系を使っている場合は自動変更しない
        if (currentModel.includes('2.5') || currentModel.includes('3-flash') || currentModel.includes('pro')) {
            console.log(`[Background] Modern model ${currentModel} already in use. Skipping auto-upgrade.`);
            return;
        }

        // 旧世代（1.5等）の場合のみ、利用可能な最新Flashへ引き上げる
<<<<<<<<< Temporary merge branch 1
        const flashPriority = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
=========
        const flashPriority = ['gemini-2.0-flash', 'gemini-1.5-flash'];
>>>>>>>>> Temporary merge branch 2
        for (let i = 0; i < flashPriority.length; i++) {
            const candidate = flashPriority[i];
            if (models.includes(candidate)) {
                if (candidate !== currentModel) {
                    console.log(`[Background] Legacy model detected: ${currentModel}. Upgrading to ${candidate}.`);
                    await chrome.storage.local.set({ geminiModel: candidate });
                    refreshUsageOnly(false);
                }
                break;
            }
        }
    } catch (err) {
        console.error('[Background] Failed to check for model updates:', err);
    }
}

// 以前の top-level 呼び出しは onInstalled/onStartup に移行
// checkAndUpgradeModel();
// setInterval(checkAndUpgradeModel, 30 * 60 * 1000);
// refreshUsageOnly(false);


// メッセージ受信
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'ANALYZE_TEXT_STREAM' && sender.tab?.id) {
        activeSourceTabId = sender.tab.id;
        handleStreamAnalysis(message.text, sender.tab.id);
    }
    if (message.type === 'SHOW_POPUP' && sender.tab?.id) {
        // タブから再開リクエストがあった場合（モード切り替え）
        activeSourceTabId = sender.tab.id;
    }
    if (message.type === 'REQUEST_ANALYSIS_RESUME') {
        // 現在の解析状況を送信元に送る、もしくはキャッシュがあればそれを送る
        const target = sender.tab?.id;

        let msg: any = null;
        if (currentAnalysisSourceText) {
            msg = {
                type: currentAnalysisIsDone ? 'ANALYSIS_DONE' : 'ANALYSIS_CHUNK',
                text: currentAnalysisContent,
                sourceText: currentAnalysisSourceText,
                isDone: currentAnalysisIsDone,
                error: currentAnalysisError
            };
        }

        if (msg) {
            if (target) {
                chrome.tabs.sendMessage(target, msg).catch(() => { });
            } else {
                chrome.runtime.sendMessage(msg).catch(() => { });
            }
        }
    }
    if (message.type === 'CHUNK_TEXT') {
        const tabId = sender.tab?.id;
        processChunkText(message.text, tabId || null);
    }
    if (message.type === 'OPEN_IN_WINDOW') {
        openInWindow(message.sourceText, message.content, message.isDone, sender.tab?.id);
    }
    if (message.type === 'REQUEST_SWITCH_TO_POPUP') {
        const targetTabId = message.tabId || activeSourceTabId;

        // メッセージを送信したウィンドウのIDを取得して閉じる
        if (activeWindowId !== null) {
            chrome.windows.remove(activeWindowId).catch(() => { });
            activeWindowId = null;
        }

        if (targetTabId) {
            activeSourceTabId = targetTabId;
            chrome.tabs.sendMessage(targetTabId, {
                type: 'SHOW_POPUP',
                text: message.text,
                content: currentAnalysisContent,
                isDone: currentAnalysisIsDone,
                error: currentAnalysisError
            }).catch(() => { });
        }

        // 応答を返すことで呼び出し側（App.tsx）の完了コールバックを確実に発火させる
        sendResponse({ success: true });
        return; // sendResponse を使ったのでここで終了
    }
    if (message.type === 'WINDOW_READY') {
        // ウィンドウが準備完了 → 保持していたデータを送信
        if (pendingWindowData) {
            chrome.runtime.sendMessage({
                type: 'WINDOW_INIT',
                sourceText: pendingWindowData.sourceText,
                content: pendingWindowData.content,
                isDone: pendingWindowData.isDone,
                error: pendingWindowData.error,
                sourceTabId: pendingWindowData.sourceTabId
            }).catch(() => { });
            pendingWindowData = null;
        }
    }
    if (message.type === 'REFRESH_USAGE') {
        refreshUsageOnly(false);
    }
    if (message.type === 'GENERATE_EXPLANATION_STREAM_POPUP') {
        const targetTabId = sender.tab?.id || activeSourceTabId;
        handleWordStreamAnalysis(message.word, message.mode, targetTabId || null);
    }
    if (message.type === 'FETCH_VALID_MODELS_REQUEST') {
        console.log('[Background] Received FETCH_VALID_MODELS_REQUEST');
        fetchAllValidModelsFromAIStudio().then((models) => {
            console.log('[Background] Sending models response:', models?.length);
            sendResponse({ models });
        }).catch(err => {
            console.error('[Background] fetchAllValidModelsFromAIStudio error:', err);
            sendResponse({ models: [] });
        });
        return true;
    }
    if (message.type === 'SYNC_RPD_REQUEST') {
        console.log('[Background] Received SYNC_RPD_REQUEST for:', message.model);
        syncRPDFromAIStudio(message.model).then((rpd) => {
            console.log('[Background] Sending RPD response:', rpd);
            sendResponse({ rpd });
        }).catch(err => {
            console.error('[Background] syncRPDFromAIStudio error:', err);
            sendResponse({ rpd: null });
        });
        return true;
    }
    if (message.type === 'SYNC_RPD_DATA') {
        console.log('[Background] Received SYNC_RPD_DATA:', message.used, '/', message.limit, 'for model:', message.model);
        refreshUsageWithCount(false, message.used, message.limit, message.model).then(() => {
            sendResponse({ success: true });
        });
        return true;
    }
    return false;
});

const AI_STUDIO_URL = "https://aistudio.google.com/rate-limit?timeRange=last-1-day&hl=ja&project=gen-lang-client-0006121659";

// AI Studioから利用可能な全ての有効なモデル（Gemini系 かつ RPD制限あり）を取得する
async function fetchAllValidModelsFromAIStudio() {
<<<<<<<<< Temporary merge branch 1
    console.log('[Background] Fetching models via stealth window...');
    let winId: number | null = null;

    try {
        const win = await chrome.windows.create({
            url: AI_STUDIO_URL,
            type: 'popup',
            state: 'normal',
            focused: false,
            left: -5000,
            top: -5000,
            width: 1,
            height: 1
        });
        if (!win || !win.id) throw new Error('Sync window creation failed');
        winId = win.id;

        let tabId: number | null = null;
        for (let i = 0; i < 10; i++) {
            const tabs = await chrome.tabs.query({ windowId: winId });
            if (tabs && tabs.length > 0) {
                tabId = tabs[0].id!;
                break;
            }
            await new Promise(r => setTimeout(r, 200));
        }

        if (!tabId) throw new Error('Tab ID not found');
        await new Promise(r => setTimeout(r, 10000));

        // 「さらに表示」ボタンがあればクリックして全モデルを展開
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: () => {
                const btn = document.querySelector('.see-more-button') as HTMLElement;
                if (btn) btn.click();
            }
        });
        await new Promise(r => setTimeout(r, 2000));

        const results = await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: () => {
                const models: { studioName: string; rpd: string }[] = [];
                const rows = Array.from(document.querySelectorAll('tr'));
                for (const row of rows) {
                    const cells = Array.from(row.querySelectorAll('td'));
                    if (cells.length === 0) continue;

                    // カテゴリ列で「テキスト出力モデル」のみに絞り込む
                    const categoryCell = cells.find(c => c.classList.contains('cdk-column-Category'));
                    const categoryText = categoryCell ? categoryCell.textContent!.trim() : '';
                    if (!categoryText.includes('テキスト出力モデル')) continue;

                    const nameCell = cells.find(c => c.classList.contains('cdk-column-Model'));
                    const rpdCell = cells.find(c => c.classList.contains('cdk-column-RPD'));

                    if (nameCell && rpdCell && rpdCell.textContent!.includes('/')) {
                        const name = nameCell.textContent!.trim();
                        const rpd = rpdCell.textContent!.trim();
                        const rpdParts = rpd.split('/');
                        const limitStr = rpdParts.length > 1 ? rpdParts[1].trim() : '0';
                        const limit = parseInt(limitStr) || 0;

                        // RPDのlimit（右側の数値）が0より大きいもののみ
                        if (name && name !== 'check' && limit > 0) {
                            models.push({ studioName: name, rpd: rpd });
                        }
                    }
                }
                return models;
            }
        });

        const models = results[0]?.result as any[] || [];
        console.log('[Background] Stealth result (models):', models.length);
        return models;
    } catch (error) {
        console.error('[Background Fetch Models] Error:', error);
        return [];
    } finally {
        if (winId !== null) {
            chrome.windows.remove(winId).catch(() => { });
        }
    }
}

async function syncRPDFromAIStudio(targetModel: string) {
    console.log('[Background] Syncing RPD via stealth window for:', targetModel);
    let winId: number | null = null;

    try {
        const win = await chrome.windows.create({
            url: AI_STUDIO_URL,
            type: 'popup',
            state: 'normal',
            focused: false,
            left: -5000,
            top: -5000,
            width: 1,
            height: 1
        });
        if (!win || !win.id) throw new Error('Sync window creation failed');
        winId = win.id;

        let tabId: number | null = null;
        for (let i = 0; i < 10; i++) {
            const tabs = await chrome.tabs.query({ windowId: winId });
            if (tabs && tabs.length > 0) {
                tabId = tabs[0].id!;
                break;
            }
            await new Promise(r => setTimeout(r, 200));
        }

        if (!tabId) throw new Error('Tab ID not found');
        await new Promise(r => setTimeout(r, 10000));

        // 「さらに表示」ボタンがあればクリックして全モデルを展開
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: () => {
                const btn = document.querySelector('.see-more-button') as HTMLElement;
                if (btn) btn.click();
            }
        });
        await new Promise(r => setTimeout(r, 2000));

        const results = await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: (modelId) => {
                const getVariants = (id: string) => {
                    const parts = id.split('-');
                    let family = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
                    let version = parts[1];
                    let tier = parts[2] ? parts[2].charAt(0).toUpperCase() + parts[2].slice(1) : '';
                    const v = [];
                    v.push(`${family} ${version} ${tier}`.trim());
                    if (version === '2.0') v.push(`${family} 2 ${tier}`.trim());
                    else if (version === '2') v.push(`${family} 2.0 ${tier}`.trim());
                    if (version === '1.5') v.push(`${family} 1.5 ${tier}`.trim());
                    return v;
                };

                const variants = getVariants(modelId);
                const rows = Array.from(document.querySelectorAll('tr'));
                for (const row of rows) {
                    const rowText = row.textContent || '';
                    if (rowText.includes('Gemini')) {
                        const cells = Array.from(row.querySelectorAll('td'));
                        const nameCell = cells.find(c => c.classList.contains('cdk-column-Model')) || cells[1];
                        const rpdCell = cells.find(c => c.classList.contains('cdk-column-RPD')) || cells[5];

                        if (nameCell && rpdCell && rpdCell.textContent.includes('/')) {
                            const name = nameCell.textContent.trim();
                            const rpd = rpdCell.textContent.trim();
                            const isMatch = variants.some(v => name.includes(v)) || name.includes(modelId);

                            if (isMatch) {
                                const match = rpd.match(/(\d+)\s*\/\s*(\d+)/);
                                if (match) return { used: parseInt(match[1]), limit: parseInt(match[2]) };
                            }
                        }
                    }
                }
                return null;
            },
            args: [targetModel]
        });

        const rpdResult = results[0]?.result as { used: number; limit: number } | null;
        console.log('[Background] Stealth result (RPD):', rpdResult);

        if (rpdResult) {
            await refreshUsageWithCount(false, rpdResult.used, rpdResult.limit, targetModel);
            return rpdResult.limit;
        }
        return null;
    } catch (error) {
        console.error('[Background Sync] Error:', error);
        return null;
    } finally {
        if (winId !== null) {
            chrome.windows.remove(winId).catch(() => { });
        }
    }
}

=========
    console.log('[Background] fetchAllValidModelsFromAIStudio called (auto-sync disabled to prevent popups)');
    // ユーザー報告の勝手なポップアップを防ぐため、自動同期ウィンドウの作成を停止します。
    // 必要に応じて、将来的に別の非侵襲的な方法（SDKのエラーから学習するなど）を検討します。
    return [];
}

async function syncRPDFromAIStudio(targetModel: string) {
    console.log('[Background] syncRPDFromAIStudio called for:', targetModel, '(auto-sync disabled)');
    // 同様に自動同期ウィンドウの作成を停止します。
    return null;
}


>>>>>>>>> Temporary merge branch 2
// 外部からのメッセージ（別の拡張機能からの同期）
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
    if (sender.id !== OTHER_EXTENSION_ID) return;

    if (message.type === 'EXTERNAL_SYNC_USAGE') {
        const today = new Date().toLocaleDateString('ja-JP');
        // 入力バリデーション
        const msgCount = typeof message.count === 'number' ? message.count : 0;
        const msgModelCount = typeof message.modelCount === 'number' ? message.modelCount : 0;
        const msgLimit = typeof message.limit === 'number' && message.limit > 0 ? message.limit : null;
        const msgModel = typeof message.model === 'string' ? message.model : null;
        const msgDate = typeof message.date === 'string' ? message.date : '';

        if (msgDate === today) {
            chrome.storage.local.get(['usageData', 'geminiDailyLimit'], (result) => {
                let data = (result.usageData as UsageData) || { date: today, count: 0, history: [], models: {} };
                if (!data.models) data.models = {};
                let needsUpdate = false;

                // モデル別カウントの同期（相手より大きい値のみ採用）
                if (msgModel && msgModelCount >= 0) {
                    if (!data.models[msgModel] || data.models[msgModel].count < msgModelCount) {
                        data.models[msgModel] = { count: msgModelCount };
                        needsUpdate = true;
                    }
                }

                // 全体カウントのフォールバック
                if (data.count < msgCount) {
                    data.count = msgCount;
                    data.date = today;
                    needsUpdate = true;
                }

                // 制限（Limit）も同期対象とする
                if (msgLimit && msgLimit !== result.geminiDailyLimit) {
                    chrome.storage.local.set({ geminiDailyLimit: msgLimit });
                    needsUpdate = true;
                }

                if (needsUpdate) {
                    chrome.storage.local.set({ usageData: data }, () => {
                        refreshUsageOnly(false); // UI更新
                    });
                }
            });
        }
    } else if (message.type === 'GET_USAGE') {
        chrome.storage.local.get(['usageData', 'geminiDailyLimit', 'geminiModel'], (result) => {
            const today = new Date().toLocaleDateString('ja-JP');
            const data = (result.usageData as UsageData) || { date: today, count: 0, history: [], models: {} };
<<<<<<<<< Temporary merge branch 1
            const model = result.geminiModel as string || 'gemini-2.5-flash';
=========
            const model = result.geminiModel as string || 'gemini-2.0-flash';
>>>>>>>>> Temporary merge branch 2
            const modelCount = data.models?.[model]?.count || 0;

            sendResponse({
                count: data.count,
                modelCount: modelCount,
                model: model,
                date: data.date,
                limit: result.geminiDailyLimit || 20
            });
        });
        return true; // 非同期レスポンス
    }
    return true;
});

// 起動時に他方の使用状況を確認して同期
async function syncOnStartup() {
    chrome.runtime.sendMessage(OTHER_EXTENSION_ID, { type: 'GET_USAGE' }, (response) => {
        if (chrome.runtime.lastError || !response) return;
        const today = new Date().toLocaleDateString('ja-JP');
        if (response.date === today) {
            chrome.storage.local.get(['usageData'], (result) => {
                let data = (result.usageData as UsageData) || { date: today, count: 0, history: [], models: {} };
                if (!data.models) data.models = {};
                let needsUpdate = false;

                if (response.model && response.modelCount !== undefined) {
                    if (!data.models[response.model] || data.models[response.model].count < response.modelCount) {
                        data.models[response.model] = { count: response.modelCount };
                        needsUpdate = true;
                    }
                }

                if (data.count < response.count) {
                    data.count = response.count;
                    needsUpdate = true;
                }

                if (needsUpdate) {
                    chrome.storage.local.set({ usageData: data }, () => {
                        refreshUsageOnly(false);
                    });
                }
            });
        }
    });
}
syncOnStartup();


// ウィンドウ閉じ時のリスナー（グローバルに一度だけ登録）
chrome.windows.onRemoved.addListener((windowId) => {
    if (windowId === activeWindowId) {
        activeWindowId = null;
        activeSourceTabId = null;
    }
});

function getDailyLimit(_model: string, customLimit?: number): number {
    if (customLimit !== undefined && customLimit > 0) return customLimit;
    return 20;
}

interface UsageData {
    date: string;
    count: number;
    history: number[]; // タイムスタンプの配列（ミリ秒）
    models: {
        [modelName: string]: {
            count: number;
        }
    };
}

async function updateGeminiUsage() {
    await refreshUsageOnly(true);
}

async function refreshUsageWithCount(isRequest: boolean, forcedCount: number | null = null, forcedLimit: number | null = null, forcedModelName: string | null = null) {
    const today = new Date().toLocaleDateString('ja-JP');
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    return new Promise<void>((resolve) => {
        chrome.storage.local.get(['usageData', 'gemini1MinUsage', 'geminiModel', 'geminiDailyLimit'], (result) => {
            let data = (result.usageData as UsageData) || { date: today, count: 0, history: [], models: {} };

            if (!data.history) data.history = [];
            if (!data.models) data.models = {};

            // 日付が変わっていたらリセット
            if (data.date !== today) {
                data.count = 0;
                data.date = today;
                data.models = {};
            }

            // 1分以上前の履歴を削除
            data.history = data.history.filter(timestamp => timestamp > oneMinuteAgo);

            const { geminiModel, geminiDailyLimit } = result;
<<<<<<<<< Temporary merge branch 1
            const modelName = forcedModelName || (geminiModel as string) || 'gemini-2.5-flash';
=========
            const modelName = forcedModelName || (geminiModel as string) || 'gemini-2.0-flash';
>>>>>>>>> Temporary merge branch 2
            if (!data.models[modelName]) data.models[modelName] = { count: 0 };

            // 強制的なカウント更新があれば適用 (AI Studioからの同期など)
            if (forcedCount !== null) {
                data.models[modelName].count = forcedCount;
                // 全体カウントもこのモデルに合わせて調整（簡易版）
                data.count = forcedCount;
            } else if (isRequest) {
                // 通常のリクエスト時のみ加算
                data.history.push(now);
                data.count += 1;
                data.models[modelName].count += 1;
            }

            const modelCount = data.models[modelName].count;
            const customLimit = forcedLimit !== null ? forcedLimit : (geminiDailyLimit as number | undefined);
            const DAILY_LIMIT = getDailyLimit(modelName, customLimit);

            const dailyRemaining = Math.max(0, DAILY_LIMIT - modelCount);

            const requestsInLastMinute = data.history.length;
            const ONE_MIN_LIMIT = 15;
            let oneMinRemaining = Math.max(0, ONE_MIN_LIMIT - requestsInLastMinute);

            // もし制限中であった場合
            if (result.gemini1MinUsage === 0 && requestsInLastMinute > 0) {
                oneMinRemaining = 0;
            }

            const displayUsage = dailyRemaining;

            chrome.storage.local.set({
                usageData: data,
                geminiUsage: dailyRemaining,
                gemini1MinUsage: oneMinRemaining,
                geminiDisplayUsage: displayUsage,
                geminiLimit: DAILY_LIMIT,
                geminiDailyLimit: DAILY_LIMIT // 確実にストレージに保存
            }, () => {
                // 変更をブロードキャスト
                broadcastUsage(displayUsage);
                // 外部拡張機能へ同期メッセージを送信（無限ループ防止のため isRequest 時のみ）
                if (isRequest) {
                    chrome.runtime.sendMessage(OTHER_EXTENSION_ID, {
                        type: 'EXTERNAL_SYNC_USAGE',
                        count: data.count,
                        modelCount: data.models[modelName].count,
                        model: modelName,
                        date: data.date,
                        limit: DAILY_LIMIT
                    }).catch(() => { });
                }
                resolve();
            });
        });
    });
}

async function refreshUsageOnly(isRequest: boolean = false) {
    return refreshUsageWithCount(isRequest);
}

// ヘルパー: 使用量を全タブに通知
function broadcastUsage(usage: number) {
    chrome.runtime.sendMessage({ type: 'UPDATE_USAGE', usage }).catch(() => { });
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            if (tab.id) {
                chrome.tabs.sendMessage(tab.id, { type: 'UPDATE_USAGE', usage }).catch((err) => {
                    // 通常、受信側がいないだけで発生することが多いため、デバッグ時以外は無視
                    console.debug('[Background] broadcastUsage to tab failed:', err);
                });
            }
        });
    });
}


// 30秒ごとに使用量表示を自動リフレッシュ（自然回復させる） - chrome.alarmsに移行
// setInterval(() => {
//     refreshUsageOnly(false);
// }, 30000);


/**
 * API側が制限（429）を返した際、手元のカウントに関わらず強制的に表示を0%（実効制限中）にする。
 * これにより「%はあるのに使えない」という表示の不整合を解消する。
 */
function forceSetUsageZero() {
    chrome.storage.local.set({
        gemini1MinUsage: 0
    });
}

// 設定取得
function getSettings(): Promise<{ apiKey: string; model: string }> {
    return new Promise((resolve) => {
        chrome.storage.local.get(['geminiApiKey', 'geminiModel'], (result) => {
            const model = (result.geminiModel as string) || 'gemini-2.5-flash';
            resolve({
                apiKey: (result.geminiApiKey as string) || '',
                model: model
            });
        });
    });
}


// ストリーミング解析処理
async function handleStreamAnalysis(text: string, tabId: number | null) {
    const sendMsg = (msg: any) => {
        if (msg.type === 'ANALYSIS_CHUNK' || msg.type === 'ANALYSIS_DONE') {
            updateAnalysisState({
                sourceText: text,
                content: msg.text,
                isDone: msg.type === 'ANALYSIS_DONE',
                error: null
            });
        } else if (msg.type === 'ANALYSIS_ERROR') {
            updateAnalysisState({
                sourceText: text,
                error: msg.error,
                isDone: true
            });
        }

        if (activeWindowId !== null) {
            chrome.runtime.sendMessage(msg).catch(() => { });
        }
        const targetTabId = tabId || activeSourceTabId;
        if (targetTabId) {
            chrome.tabs.sendMessage(targetTabId, msg).catch(() => { });
        }
    };

    // 1. 同一テキストでの進行中ストリームが存在する場合は、そのまま結果だけを流す（要求を無視）
    if (currentAnalysisSourceText === text && !currentAnalysisIsDone && !currentAnalysisError && activeAnalysisController) {
        // キャッシュや既存ストリームがあるため、新規通信は行わず現在の結果のみ即座に送る
        sendMsg({
            type: 'ANALYSIS_CHUNK',
            text: currentAnalysisContent
        });
        return;
    }

    // 2. キャッシュが存在するか確認（API節約）
    if (analysisCache.has(text)) {
        const cachedContent = analysisCache.get(text)!;
        sendMsg({ type: 'ANALYSIS_DONE', text: cachedContent });
        return;
    }

    // 状態のクリアと初期化
    if (activeAnalysisController) {
        activeAnalysisController.abort();
        activeAnalysisController = null;
    }

    activeAnalysisController = new AbortController();
    const { signal } = activeAnalysisController;

    await updateAnalysisState({
        sourceText: text,
        content: '',
        isDone: false,
        error: null
    });

    try {
        const { apiKey, model } = await getSettings();
        if (!apiKey) {
            throw new Error('APIキーが設定されていません。拡張機能アイコンをクリックして設定してください。');
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

        // 制限チェック（事前に行う）
        await updateGeminiUsage();

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
                contents: [{ parts: [{ text }] }],
                generationConfig: { temperature: 0.3, maxOutputTokens: 8192 }
            }),
            signal
        });

        if (!response.ok) {
            const errData = await response.text();
            if (response.status === 429) {
                forceSetUsageZero();

                let isRPM = false;
                try {
                    const parsedErr = JSON.parse(errData);
                    const errMsg = parsedErr?.error?.message || '';
                    if (errMsg.includes('RPM') || errMsg.includes('Requests per minute')) {
                        isRPM = true;
                    }
                } catch (e) { }

                if (isRPM) {
                    throw new Error('1分間あたりのリクエスト数制限に達しました。数十秒待ってから再度お試しください。');
                } else {
                    throw new Error('1日あたりのリクエスト上限、または同時実行数制限に達しました。しばらく待ってから再度お試しください。');
                }
            } else if (response.status === 401) {
                throw new Error('APIキーが無効です。設定画面で再確認してください。');
            }
            throw new Error(`API Error ${response.status}: ${errData}`);
        }

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let accumulated = '';
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const jsonStr = line.slice(6).trim();
                    if (jsonStr === '[DONE]') continue;
                    try {
                        const parsed = JSON.parse(jsonStr);
                        const chunkText = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (chunkText) {
                            accumulated += chunkText;
                            sendMsg({ type: 'ANALYSIS_CHUNK', text: accumulated });
                        }
                    } catch { /* ignore JSON error */ }
                }
            }
        }

        // キャッシュに保存
        updateCache(analysisCache, text, accumulated);
        sendMsg({ type: 'ANALYSIS_DONE', text: accumulated });

    } catch (error: any) {
        if (error.name === 'AbortError') {
            console.log('[Background] Stream aborted by newer request');
            return;
        }
        sendMsg({ type: 'ANALYSIS_ERROR', error: error.message || '解析中にエラーが発生しました。' });
    } finally {
        if (activeAnalysisController?.signal.aborted === false) {
            activeAnalysisController = null;
        }
    }
}

function updateCache(cacheMap: Map<string, string>, key: string, value: string) {
    if (cacheMap.has(key)) {
        cacheMap.delete(key);
    } else if (cacheMap.size >= CACHE_SIZE) {
        const firstKey = cacheMap.keys().next().value;
        if (firstKey) cacheMap.delete(firstKey);
    }
    cacheMap.set(key, value);
}

// チャンク区切り処理（統合・キャッシュ対応版: チャンクは既存プロンプトで生成済み扱いとする）
async function processChunkText(text: string, tabId: number | null) {
    const sendMsg = (msg: any) => {
        if (activeWindowId !== null) {
            chrome.runtime.sendMessage(msg).catch(() => { });
        }
        const targetTabId = tabId || activeSourceTabId;
        if (targetTabId) {
            chrome.tabs.sendMessage(targetTabId, msg).catch(() => { });
        }
    };

    // 新仕様では初回の翻訳リクエスト時点ですでに"／"が含まれているため、
    // ここでは新たにバックグラウンド通信を行わず、UI側にそのまま「完了」とだけ通知する。
    // UI側がCSSで"／"の表示・非表示を切り替えるようになります。
    sendMsg({ type: 'CHUNK_RESULT', text: text });
}

// ========== ウィンドウモード ==========

// 別ウィンドウを開く
async function openInWindow(sourceText: string, content: string, isDone: boolean, tabId?: number) {
    activeSourceTabId = tabId ?? null;

    // ウィンドウが存在するか確認
    let windowExists = false;
    if (activeWindowId !== null) {
        try {
            await chrome.windows.get(activeWindowId);
            windowExists = true;
        } catch {
            activeWindowId = null;
        }
    }

    if (windowExists && activeWindowId !== null) {
        // すでに開いている場合はデータを送信してフォーカス
        try {
            await chrome.windows.update(activeWindowId, { focused: true });
            chrome.runtime.sendMessage({
                type: 'WINDOW_INIT',
                sourceText,
                content,
                isDone,
                error: currentAnalysisError,
                sourceTabId: activeSourceTabId
            }).catch(() => { });
        } catch {
            activeWindowId = null;
            await createWindow(sourceText, content, isDone, activeSourceTabId);
        }
    } else {
        await createWindow(sourceText, content, isDone, activeSourceTabId);
    }

    // content scriptのポップアップを閉じる処理は、WINDOW_READYを受け取ってからか、
    // あるいはopenInWindow呼び出し側で安全に処理させるべきですが、
    // ここで即座にCLOSE_POPUPを送るとストリーミングが途切れる原因になります。
    // そのため、ここでは何もしません（ウィンドウが開いたことで自動的にフォーカスが外れて閉じるか、
    // またはウィンドウへの通信が確立した後に閉じるようにします）。
}

async function createWindow(sourceText: string, content: string, isDone: boolean, sourceTabId: number | null) {
    // データを一時保持（WINDOW_READY待ち）
    pendingWindowData = { sourceText, content, isDone, sourceTabId, error: currentAnalysisError };

    const windowUrl = chrome.runtime.getURL('src/window/index.html');
    const win = await chrome.windows.create({
        url: windowUrl,
        type: 'popup',
        width: 560,
        height: 520,
        focused: true
    });

    activeWindowId = win?.id ?? null;
}

// ========== 単語解説用ポップアップ (English Words 同等) ==========

let currentWordAnalysisWord = '';
let currentWordAnalysisMode = '';
let currentWordAnalysisContent = '';
let currentWordAnalysisIsDone = false;
let currentWordAnalysisError: string | null = null;
let activeWordAnalysisController: AbortController | null = null;

function buildWordPrompt(word: string, mode: string): string {
    if (mode === 'long') {
        return `英単語「${word}」を以下の形式で簡潔に解説。Markdown不可、プレーンテキストのみ。セクション名は【】で囲む。

【発音記号】
/UK発音/ / /US発音/

【英和辞典】
品詞ごとにカテゴリ別の意味を記載

【英英辞典】
英語定義文
→ 日本語訳

【用例】
各用例は「▶」で始めて、場面を短く示してから例文と訳を並べる。「場面：」「例文：」「日本語訳：」等のラベルは使わない。
形式例:
▶ ビジネス会議で: The composition of the team is crucial.（チームの構成は重要だ。）

【コロケーション】
各項目は「▸」で始める。
形式例:
▸ chemical composition（化学成分）
▸ musical composition（音楽作品）

【同意語】
各項目は「▸」で始め、発音記号と使い分けを記載。
形式例:
▸ structure /ˈstrʌktʃər/（構造）― 物理的な配置を強調`;
    } else {
        return `英単語「${word}」を以下の形式で簡潔に解説。Markdown不可、プレーンテキストのみ。セクション名は【】で囲む。

【発音記号】
/UK発音/ / /US発音/

【英和辞典】
品詞と主要な意味

【英英辞典】
・英語の説明
・日本語訳`;
    }
}

async function handleWordStreamAnalysis(word: string, mode: string, tabId: number | null) {
    const sendMsg = (msg: any) => {
        if (msg.type === 'POPUP_CHUNK' || msg.type === 'POPUP_DONE') {
            currentWordAnalysisWord = word;
            currentWordAnalysisMode = mode;
            currentWordAnalysisContent = msg.text;
            currentWordAnalysisIsDone = msg.type === 'POPUP_DONE';
            currentWordAnalysisError = null;
        } else if (msg.type === 'POPUP_ERROR') {
            currentWordAnalysisWord = word;
            currentWordAnalysisMode = mode;
            currentWordAnalysisError = msg.error;
            currentWordAnalysisIsDone = true;
        }

        // 送り元(Window or Tab)へ返す
        chrome.runtime.sendMessage(msg).catch(() => { });
        if (tabId) {
            chrome.tabs.sendMessage(tabId, msg).catch((err) => {
                // コンテンツスクリプトが存在しない場合のエラーは無視する
                console.debug('[Background] Tab message failed (often normal for Window mode):', err);
            });
        }
    };

    if (currentWordAnalysisWord === word && currentWordAnalysisMode === mode && !currentWordAnalysisIsDone && activeWordAnalysisController) {
        return;
    }
    if (currentWordAnalysisWord === word && currentWordAnalysisMode === mode && currentWordAnalysisIsDone) {
        sendMsg({
            type: currentWordAnalysisError ? 'POPUP_ERROR' : 'POPUP_DONE',
            text: currentWordAnalysisContent,
            error: currentWordAnalysisError
        });
        return;
    }

    if (activeWordAnalysisController) {
        activeWordAnalysisController.abort();
    }
    activeWordAnalysisController = new AbortController();
    const { signal } = activeWordAnalysisController;

    currentWordAnalysisWord = word;
    currentWordAnalysisMode = mode;
    currentWordAnalysisContent = '';
    currentWordAnalysisIsDone = false;
    currentWordAnalysisError = null;

    try {
        const { apiKey, model } = await getSettings();
        if (!apiKey) {
            throw new Error('APIキーが設定されていません。拡張機能アイコンをクリックして設定してください。');
        }

        await updateGeminiUsage();

        const prompt = buildWordPrompt(word, mode);
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 2048,
                }
            }),
            signal
        });

        if (!response.ok) {
            const errData = await response.text();
            if (response.status === 429) {
                forceSetUsageZero();
                broadcastUsage(0);

                let isRPM = false;
                try {
                    const parsedErr = JSON.parse(errData);
                    const errMsg = parsedErr?.error?.message || '';
                    if (errMsg.includes('RPM') || errMsg.includes('Requests per minute')) {
                        isRPM = true;
                    }
                } catch (e) { }

                if (isRPM) {
                    throw new Error('1分間あたりのリクエスト数制限に達しました。数十秒待ってから再度お試しください。');
                } else {
                    throw new Error('1日あたりのリクエスト上限に達しました。しばらく待ってから再度お試しください。');
                }
            }
            throw new Error(`API Error ${response.status}`);
        }

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let accumulated = '';
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const jsonStr = line.slice(6).trim();
                    if (jsonStr === '[DONE]') continue;
                    try {
                        const parsed = JSON.parse(jsonStr);
                        const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (text) {
                            accumulated += text;
                            sendMsg({
                                type: 'POPUP_CHUNK',
                                text: accumulated
                            });
                        }
                    } catch (e) { }
                }
            }
        }

        sendMsg({
            type: 'POPUP_DONE',
            text: accumulated
        });

    } catch (error: any) {
        if (error.name === 'AbortError') return;
        sendMsg({
            type: 'POPUP_ERROR',
            error: error.message || '解説の生成中にエラーが発生しました。'
        });
    } finally {
        if (activeWordAnalysisController?.signal.aborted === false) {
            activeWordAnalysisController = null;
        }
    }
}


// Note: chunk処理は processChunkText に統合されたため、 handleChunkTextForWindow は削除します。
