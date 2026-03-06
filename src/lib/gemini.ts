import { GoogleGenerativeAI } from "@google/generative-ai";

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
Analyze English text sentence by sentence. Horizontal line (---) between sentences.
You MUST insert " ／ " (full-width slash) into BOTH the English sentences AND the Japanese translations to break them into meaningful chunks.

# Chunking Rules
- Chunk at **English syntactic boundaries**: subject / verb phrase / object / prepositional phrase / clause boundary.
- The Japanese translation MUST have the **same number of chunks** as the English (1:1 mapping).
- Each Japanese chunk corresponds to its English counterpart.
- Japanese word order should **follow the English order as closely as possible**, while still being natural and comprehensible Japanese.

# Output Format
> English with " ／ " chunks (Blockquote is MANDATORY)
Natural Japanese translation with " ／ " chunks. ONLY key C1/C2 phrases stay in English: "phrase (meaning)".
💡 Minimal grammar tip (optional).

# Rules
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
export const TEXT_OUTPUT_MODELS = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-3-flash-preview',
];

// AI Studio の RPD上限（実際の値に合わせて設定）
export const KNOWN_RPD_LIMITS: Record<string, number> = {
    'gemini-2.5-flash': 20,
    'gemini-2.5-flash-lite': 20,
    'gemini-3-flash-preview': 20,
};

// 表示名（公式の名前に統一）
export const MODEL_DISPLAY_NAMES: Record<string, string> = {
    'gemini-2.5-flash': 'Gemini 2.5 Flash',
    'gemini-2.5-flash-lite': 'Gemini 2.5 Flash Lite',
    'gemini-3-flash-preview': 'Gemini 3 Flash',
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
                console.warn("Chunk processing error (possible partial content):", chunkError);
                // 一部のチャンクに問題があっても、中断せずに続行を試みる
                // ただし、完全に解析不能な場合は上位でキャッチされる
            }
        }
    } catch (streamError: any) {
        console.error("Stream execution error:", streamError);
        // ストリーム全体が失敗した場合は、それまでに蓄積されたものがあるか確認
        if (!accumulated) {
            throw new Error(`[GoogleGenerativeAI Error]: Failed to parse stream. ${streamError.message || ""}`);
        }
        // 蓄積があればそれを返して終了とする（中途半端な出力になる可能性があるため警告）
        console.warn("Stream stopped prematurely but some content was received.");
    }

    return accumulated;
}

// 利用可能なテキスト出力モデル一覧取得
// TEXT_OUTPUT_MODELS に定義されたモデルを常に返す（API一覧にないpreviewモデルも確実に含めるため）
export async function listAvailableModels(_apiKey: string): Promise<string[]> {
    return [...TEXT_OUTPUT_MODELS];
}

// 各モデルのRPD状態をチェック（countTokensはRPDを消費しない）
// 429が返ったモデルは使い切りと判定
export async function checkModelsRPDStatus(
    apiKey: string,
    models: string[]
): Promise<Record<string, boolean>> {
    const status: Record<string, boolean> = {};

    await Promise.all(
        models.map(async (modelId) => {
            try {
                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:countTokens?key=${apiKey}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ contents: [{ parts: [{ text: "test" }] }] })
                    }
                );
                // 429 = RPD上限、それ以外のエラー（404等）は利用可能扱い
                status[modelId] = response.status !== 429;
            } catch {
                status[modelId] = true; // ネットワークエラー時はとりあえず利用可能扱い
            }
        })
    );

    return status;
}
