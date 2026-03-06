import { GoogleGenerativeAI } from "@google/generative-ai";

// ==========================================
// 共通ユーティリティ
// ==========================================

/**
 * ブラウザのローカル時間での日付文字列を取得 (YYYY-MM-DD形式)
 */
export function getLocalDateString(): string {
    return new Date().toLocaleDateString('en-CA');
}

// ==========================================
// LingoDesk 機能別システムプロンプト
// ==========================================

export const PROMPT_WORDS_LONG = `
# Role
あなたはプロの英語講師および言語学者です。対象の英文から、重要・難解な英単語や熟語を全てピックアップし、以下の【出力フォーマット】を厳守して、その単語の深い理解を助ける解説を生成してください。

# Constraints
- 意味、語法、ニュアンスの違いを正確に説明すること。
- 例文は実用的で自然なものを作成すること。
- 日本語と英語を併記すること。
- 区切り線「⸻」を使用して視認性を高めること。
- 余計な挨拶やメタ発言（「はい、承知いたしました」「解説します」等）は一切含めず、直接【出力フォーマット】から開始すること。
- HTML/Markdown形式で出力すること（WebAppでの表示用）。セクション区切りは「---」や適宜見出しを使う。

# 出力フォーマット

---
## [ここに単語]

【発音記号】
[IPA発音記号]

⸻

【意味】
	•	(自動詞/他動詞などの分類) [意味1]
	•	(自動詞/他動詞などの分類) [意味2]

⸻

【英和辞典】

([分類])
	1.	([核心的な意味の要約])
	•	例: [英語例文]
（[日本語訳]）
	2.	...（必要に応じて追加）

([分類])
	1.	...

⸻

【英英辞典】
	•	[英語での定義1]
→ [定義1の日本語要約]
	•	[英語での定義2]
→ [定義2の日本語要約]

⸻

【シチュエーション】
	1. [カテゴリ名：例 学習・ビジネス等]
	•	[その状況での使い方の説明]
	•	例: [英語例文]
（[日本語訳]）
	2. [カテゴリ名]
    ...

⸻

【覚えておくべきこと】
	1. 語源
	•	[語源の由来と、それがどう現在の意味につながっているか]
	2. フォーマルとカジュアルの使い分け
	•	[文脈による使い分け、言い換え表現など]
	•	例:
	•	[フォーマルな例] (フォーマル)
	•	[カジュアルな例] (カジュアル)

⸻

【同意語（類義語）】
	•	[類義語1] [発音記号] （[意味]）
→ [ターゲット単語とのニュアンスの違いを詳しく説明]
	•	[ターゲット単語の例文]
	•	[類義語1の例文]
	•	[類義語2] ...

⸻

【コロケーション】
	•	[collocation 1] ([意味])
	•	[collocation 2] ([意味])
	•	[collocation 3] ([意味])
	•	[collocation 4] ([意味])
	•	[collocation 5] ([意味])
`;

export const PROMPT_TUTOR = `
# Role: English Tutor
Process EVERY sentence in the input, one by one, without exception. Separate each sentence's output with a horizontal line (---).
You MUST insert " ／ " (full-width slash) into BOTH the English sentences AND the Japanese translations to break them into meaningful chunks.

# Critical Rules (MUST follow)
- **NEVER skip, omit, or merge any sentence.** Every single sentence in the input MUST appear in the output.
- If the input has N sentences, the output MUST have exactly N sections separated by ---.
- Count all sentences before starting, and verify all are covered before finishing.

# Chunking Rules
- Chunk at **English syntactic boundaries**: subject / verb phrase / object / prepositional phrase / clause boundary.
- The Japanese translation MUST have the **same number of chunks** as the English (1:1 mapping).
- Each Japanese chunk corresponds to its English counterpart.
- Japanese word order should **follow the English order as closely as possible**, while still being natural and comprehensible Japanese.

# Output Format
> English with " ／ " chunks (Blockquote is MANDATORY)
Natural Japanese translation with " ／ " chunks. ONLY key C1/C2 phrases stay in English: "phrase (meaning)".
💡 Minimal grammar tip (optional).

# Additional Rules
- Markdown only. No headers.
- One line gap between blockquote and translation.
- ALL English phrases MUST be translated into Japanese. Do not leave the entire sentence in English.
- BOTH English and Japanese MUST contain matching " ／ " chunk separators.
- **IMPORTANT**: The number of chunks in English and Japanese MUST be exactly the same (1:1 mapping).
- **IMPORTANT**: Each Japanese chunk must correspond directly to the meaning of its English counterpart.

# Example
> A grand bargain ／ could go some distance ／ toward satiating Trump's need ／ to declare a public triumph.

大きなgrand bargain（取引）は ／ ある程度go some distance（貢献する）かもしれない ／ トランプの欲求を満たすことに ／ 公にtriumph（勝利）を宣言したいという。

💡 "go some distance toward" は「ある程度貢献する」という意味。
`;


// background/index.ts 互換用エイリアス
export const SYSTEM_PROMPT = PROMPT_TUTOR;

// ==========================================
// テキスト出力モデル — 上位モデルのみ（AI Studio RPD準拠）
// ==========================================

// テキスト出力モデルのAPI ID一覧
// ※AI Studio上の表示が Gemini 2.5 や 3 になっているが、API IDとしては安定版を使用する
export const TEXT_OUTPUT_MODELS = [
    'gemini-2.5-flash',                  // Gemini 2.5 Flash
    'gemini-3-flash-preview',            // Gemini 3 Flash
    'gemini-2.5-flash-lite',             // Gemini 2.5 Flash Lite
];

// AI Studio の RPD上限
export const KNOWN_RPD_LIMITS: Record<string, number> = {
    'gemini-2.5-flash': 20,
    'gemini-3-flash-preview': 20,
    'gemini-2.5-flash-lite': 20,
};

// 表示名 (AI Studio の表示名に基づいた、API IDへの逆引き用)
export const MODEL_DISPLAY_NAMES: Record<string, string> = {
    'gemini-2.5-flash': 'Gemini 2.5 Flash',
    'gemini-3-flash-preview': 'Gemini 3 Flash',
    'gemini-2.5-flash-lite': 'Gemini 2.5 Flash Lite',
};

// ==========================================
// API通信
// ==========================================

// ストリーミング解析
export async function analyzeTextStream(
    apiKey: string,
    text: string,
    systemPrompt: string,
    modelName: string = "gemini-2.5-flash",
    onChunk: (accumulated: string) => void
): Promise<string> {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemPrompt
    });

    const result = await model.generateContentStream(text);
    let accumulated = "";

    try {
        for await (const chunk of result.stream) {
            try {
                const chunkText = chunk.text();
                if (chunkText) {
                    accumulated += chunkText;
                    onChunk(accumulated);
                }
            } catch (chunkError: any) {
                console.warn(`[${modelName}] Chunk error:`, chunkError);
                // 安全フィルター等で一部がブロックされた場合の処理をここで行うことも可能
            }
        }
    } catch (streamError: any) {
        console.error(`[${modelName}] Stream error:`, streamError);
        const msg = streamError.message || "";
        
        let errorType = "[ERROR]";
        if (msg.includes("429") || msg.includes("quota") || msg.includes("limit") || msg.includes("exhausted")) {
            errorType = "[RESOURCE_EXHAUSTED]";
        } else if (msg.includes("API key") || msg.includes("401") || msg.includes("403")) {
            errorType = "[AUTH_ERROR]";
        } else if (msg.includes("Safety") || msg.includes("block") || msg.includes("candidate")) {
            errorType = "[SAFETY_ERROR]";
        }

        // 蓄積が全くない場合のみ致命的なエラーとして投げる
        if (!accumulated) {
            throw new Error(`${errorType} ${msg}`);
        }
        
        console.warn(`${errorType} Stream stopped prematurely but some content was received. Msg: ${msg}`);
    }

    if (!accumulated) {
        console.warn(`[${modelName}] Stream completed with empty response.`);
        throw new Error(`[ERROR] モデル "${modelName}" から応答が得られませんでした。モデルIDが正しいか確認してください。`);
    }

    return accumulated;
}

// 利用可能なテキスト出力モデル一覧取得
export async function listAvailableModels(_apiKey: string): Promise<string[]> {
    try {
        const isExtension = typeof chrome !== 'undefined' && !!chrome?.storage?.local;
        if (!isExtension) return [...TEXT_OUTPUT_MODELS];

        // 過去のプレビュー版のIDがストレージに残存し404エラーを引き起こすのを防ぐため、
        // TEXT_OUTPUT_MODELS に含まれる「安全と分かっているID」のみを返す
        const result = await chrome.storage.local.get(['availableModels']);
        if (result.availableModels && Array.isArray(result.availableModels)) {
            // ストレージにあるモデルのうち、TEXT_OUTPUT_MODELS に定義されているものだけに絞る
            // (RPDが0のものはバックグラウンド側で既に除外されている想定)
            const safeModels = result.availableModels.filter((m: string) => TEXT_OUTPUT_MODELS.includes(m));
            if (safeModels.length > 0) {
                return safeModels;
            }
        }
        
        // ストレージにない、または安全なモデルが見つからない場合はデフォルトを返す
        return [...TEXT_OUTPUT_MODELS];
    } catch (err) {
        console.error('Error fetching available models:', err);
        return [...TEXT_OUTPUT_MODELS];
    }
}

// モデルの状態チェック（外部API呼び出しを削除）
export async function checkModelsRPDStatus(
    _apiKey: string,
    models: string[]
): Promise<Record<string, boolean>> {
    const status: Record<string, boolean> = {};
    
    // 全てのモデルを一旦利用可能として返す
    // 実際の回数はストレージから別途取得される
    models.forEach(m => status[m] = true);
    return status;
}
