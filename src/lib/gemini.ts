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
- 余計な挨拶やメタ発言（「はい、承知いたしました」「解説します」等）は一切含めず、直接【出力フォーマット】から開始すること。
- HTML/Markdown形式で出力すること（WebAppでの表示用）。セクション区切りは「---」や適宜見出しを使う。

# 出力フォーマット

---
## [ここに単語]

【発音記号】
[IPA発音記号]

【意味】
	•	(自動詞/他動詞などの分類) [意味1]
	•	(自動詞/他動詞などの分類) [意味2]

【英和辞典】

[分類]
	1.	[核心的な意味の要約]
	•	例: [英語例文]
[日本語訳]
	2.	...（必要に応じて追加）

[分類]
	1.	...

【英英辞典】
	•	[英語での定義1]
→ [定義1の日本語要約]
	•	[英語での定義2]
→ [定義2の日本語要約]

【シチュエーション】
	1. [カテゴリ名：例 学習・ビジネス等]
	•	[その状況での使い方の説明]
	•	例: [英語例文]
[日本語訳]
	2. [カテゴリ名]
    ...

【覚えておくべきこと】
	1. 語源
	•	[語源の由来と、それがどう現在の意味につながっているか]
	2. フォーマルとカジュアルの使い分け
	•	[文脈による使い分け、言い換え表現など]
	•	例:
	•	[フォーマルな例] (フォーマル)
	•	[カジュアルな例] (カジュアル)

【同意語（類義語）】
	•	[類義語1] [発音記号] [意味]
→ [ターゲット単語とのニュアンスの違いを詳しく説明]
	•	[ターゲット単語の例文]
	•	[類義語1の例文]
	•	[類義語2] ...

【コロケーション】
	•	[collocation 1] ([意味])
	•	[collocation 2] ([意味])
	•	[collocation 3] ([意味])
	•	[collocation 4] ([意味])
	•	[collocation 5] ([意味])
`;

// ==========================================
// Quick Read プロンプト（CEFRレベル別）
// ==========================================
export function buildTutorPrompt(cefrLevel: string): string {
    const annotationTargetMap: Record<string, string> = {
        'A1': 'A2・B1・B2・C1・C2',
        'A2': 'B1・B2・C1・C2',
        'B1': 'B2・C1・C2',
        'B2': 'C1・C2',
        'C1': 'C2',
        'C2': 'C2',
    };
    const targetLevels = annotationTargetMap[cefrLevel] || 'C1・C2';

    return `# Role
あなたは英文をチャンク（意味の塊）ごとに区切り、語順のまま理解させる指導を行うプロの英語講師です。

# Objective
入力された文章を「一文（ピリオド・感嘆符・疑問符・句点単位）ごと」に分割し、以下の【出力フォーマット】で出力してください。
一文の中身は、1:自然な和訳、2:詳細なチャンク分け英文、3:英語の語順に従ったチャンク和訳、を含めてください。

# Output Format
一文ごとに以下の形式で出力してください：

[BLOCK_START]
<original>元の英文（一文のみ）</original>
<natural>自然な日本語訳。注釈は一切含めず、純粋で自然な和訳のみを出力する。</natural>
<chunked_en>英文を意味の区切り「 ／ 」で分けたもの。チャンクの区切りは <chunked_ja> と必ず1:1で対応させること。</chunked_en>
<chunked_ja>英語の語順を厳守し「 ／ 」で区切った日本語訳。チャンク数は <chunked_en> と完全に一致させること。${targetLevels}レベルの単語・熟語・句動詞には必ず「日本語の意味（英語表現）」の形式で注釈を付ける（例: 不可欠な（imperative）、出発する（set out））。注釈にはレベル表記を含めないこと。それ以下の基本語には注釈不要。</chunked_ja>
[BLOCK_END]

# Rules for Mastery
0. **【最重要】全文処理**: 入力テキストに含まれる全ての文を、一つも省略・統合・スキップせずに処理すること。入力がN文なら出力もN個の[BLOCK_START]〜[BLOCK_END]でなければならない。開始前に文数を数え、終了前に全文をカバーしたか確認すること。
1. **一文の定義**: ピリオド、クエスチョンマーク、感嘆符、または句点で終わるものを一文とします。
2. **チャンク分け**: 主節・従属節・長い前置詞句などの意味の切れ目で区切る。一単語ずつになるほど細かくせず、ネイティブがスピーキングでポーズを入れる自然な長さを意識すること。
3. **語順の遵守**: <chunked_ja> は英語が流れてくる順番を絶対に維持すること。戻り読みをせず、英語チャンクに対応する断片的な日本語を当てること。
4. **注釈の対象**: ${targetLevels}レベルの単語・イディオム（熟語）・句動詞（phrasal verb）のみに「日本語の意味（英語表現）」の形式で注釈を付けること。注釈文字列の中にレベル表記を含めないこと。それ以下の基本語には注釈不要。
5. **チャンク数の一致**: <chunked_en> と <chunked_ja> の「 ／ 」の個数は必ず同じにすること。1:1対応を崩さないこと。
6. **タグの厳守**: 挨拶・メタ発言は一切不要。タグの構造のみを漏らさず出力すること。`;
}

export const PROMPT_LEARNING = `
# Role
あなたは英文をチャンク（意味の塊）ごとに区切り、語順のまま理解させる指導を行うプロの英語講師です。

# Objective
入力された文章を「一文（ピリオド・感嘆符・疑問符・句点単位）ごと」に分割し、以下の【出力フォーマット】で出力してください。
一文の中身は、1:自然な和訳、2:詳細なチャンク分け英文、3:英語の語順に従ったチャンク和訳、を含めてください。

# Output Format
一文ごとに以下の形式で出力してください：

[BLOCK_START]
<original>元の英文（一文のみ）</original>
<natural>自然な日本語訳。注釈は一切含めず、純粋で自然な和訳のみを出力する。</natural>
<chunked_en>英文を意味の区切り「 ／ 」で分けたもの。チャンクの区切りは <chunked_ja> と必ず1:1で対応させること。</chunked_en>
<chunked_ja>英語の語順を厳守し「 ／ 」で区切った日本語訳。チャンク数は <chunked_en> と完全に一致させること。C1・C2レベルの単語・熟語・句動詞には必ず「日本語の意味（英語表現）」の形式で注釈を付ける（例: 不可欠な（imperative）、出発する（set out））。注釈にはレベル表記（C1・C2等）を含めないこと。A1〜B2の基本語には注釈不要。</chunked_ja>
[BLOCK_END]

# Rules for Mastery
0. **【最重要】全文処理**: 入力テキストに含まれる全ての文を、一つも省略・統合・スキップせずに処理すること。入力がN文なら出力もN個の[BLOCK_START]〜[BLOCK_END]でなければならない。開始前に文数を数え、終了前に全文をカバーしたか確認すること。
1. **一文の定義**: ピリオド、クエスチョンマーク、感嘆符、または句点で終わるものを一文とします。
2. **チャンク分け**: 主節・従属節・長い前置詞句などの意味の切れ目で区切る。一単語ずつになるほど細かくせず、ネイティブがスピーキングでポーズを入れる自然な長さを意識すること。
3. **語順の遵守**: <chunked_ja> は英語が流れてくる順番を絶対に維持すること。戻り読みをせず、英語チャンクに対応する断片的な日本語を当てること。
4. **注釈の対象**: C1・C2レベルの単語・イディオム（熟語）・句動詞（phrasal verb）のみに「日本語の意味（英語表現）」の形式で注釈を付けること。注釈文字列の中にレベル表記（"C1"・"C2"等）を含めないこと。A1〜B2の基本語には注釈不要。
5. **チャンク数の一致**: <chunked_en> と <chunked_ja> の「 ／ 」の個数は必ず同じにすること。1:1対応を崩さないこと。
6. **タグの厳守**: 挨拶・メタ発言は一切不要。タグの構造のみを漏らさず出力すること。

# Annotation Examples（注釈にレベル表記は含めない）
- imperative → C1単語なので注釈あり → 出力: "imperative（不可欠な）"
- set out → 句動詞なので注釈あり → 出力: "set out（出発する・始める）"
- come to terms with → イディオムなので注釈あり → 出力: "come to terms with（〜を受け入れる）"
- go・big・important → A1〜B2の基本語なので注釈不要
`;


// background/index.ts 互換用エイリアス
export const SYSTEM_PROMPT = PROMPT_LEARNING;

// ==========================================
// テキスト出力モデル — 上位モデルのみ（AI Studio RPD準拠）
// ==========================================

// テキスト出力モデルのAPI ID一覧
// ※AI Studio上の表示が Gemini 2.5 や 3 になっているが、API IDとしては安定版を使用する
export const TEXT_OUTPUT_MODELS = [
    'gemini-3-flash-preview',        // Gemini 3 Flash
    'gemini-2.5-flash',              // Gemini 2.5 Flash
    'gemini-2.5-flash-lite',         // Gemini 2.5 Flash Lite
];

// AI Studio の RPD上限
export const KNOWN_RPD_LIMITS: Record<string, number> = {
    'gemini-3-flash-preview': 20,
    'gemini-2.5-flash': 20,
    'gemini-2.5-flash-lite': 20,
};

// 表示名 (AI Studio の表示名に基づいた、API IDへの逆引き用)
export const MODEL_DISPLAY_NAMES: Record<string, string> = {
    'gemini-3-flash-preview': 'Gemini 3 Flash',
    'gemini-2.5-flash': 'Gemini 2.5 Flash',
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
    modelName: string = "gemini-3-flash",
    onChunk: (accumulated: string) => void
): Promise<string> {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemPrompt
    }, { apiVersion: 'v1beta' });

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
        } else if (msg.includes("503") || msg.includes("high demand") || msg.includes("overloaded")) {
            errorType = "[OVERLOADED]";
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
    return [...TEXT_OUTPUT_MODELS];
}

