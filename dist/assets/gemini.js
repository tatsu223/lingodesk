var T;(function(t){t.STRING="string",t.NUMBER="number",t.INTEGER="integer",t.BOOLEAN="boolean",t.ARRAY="array",t.OBJECT="object"})(T||(T={}));var N;(function(t){t.LANGUAGE_UNSPECIFIED="language_unspecified",t.PYTHON="python"})(N||(N={}));var w;(function(t){t.OUTCOME_UNSPECIFIED="outcome_unspecified",t.OUTCOME_OK="outcome_ok",t.OUTCOME_FAILED="outcome_failed",t.OUTCOME_DEADLINE_EXCEEDED="outcome_deadline_exceeded"})(w||(w={}));const b=["user","model","function","system"];var M;(function(t){t.HARM_CATEGORY_UNSPECIFIED="HARM_CATEGORY_UNSPECIFIED",t.HARM_CATEGORY_HATE_SPEECH="HARM_CATEGORY_HATE_SPEECH",t.HARM_CATEGORY_SEXUALLY_EXPLICIT="HARM_CATEGORY_SEXUALLY_EXPLICIT",t.HARM_CATEGORY_HARASSMENT="HARM_CATEGORY_HARASSMENT",t.HARM_CATEGORY_DANGEROUS_CONTENT="HARM_CATEGORY_DANGEROUS_CONTENT",t.HARM_CATEGORY_CIVIC_INTEGRITY="HARM_CATEGORY_CIVIC_INTEGRITY"})(M||(M={}));var L;(function(t){t.HARM_BLOCK_THRESHOLD_UNSPECIFIED="HARM_BLOCK_THRESHOLD_UNSPECIFIED",t.BLOCK_LOW_AND_ABOVE="BLOCK_LOW_AND_ABOVE",t.BLOCK_MEDIUM_AND_ABOVE="BLOCK_MEDIUM_AND_ABOVE",t.BLOCK_ONLY_HIGH="BLOCK_ONLY_HIGH",t.BLOCK_NONE="BLOCK_NONE"})(L||(L={}));var D;(function(t){t.HARM_PROBABILITY_UNSPECIFIED="HARM_PROBABILITY_UNSPECIFIED",t.NEGLIGIBLE="NEGLIGIBLE",t.LOW="LOW",t.MEDIUM="MEDIUM",t.HIGH="HIGH"})(D||(D={}));var G;(function(t){t.BLOCKED_REASON_UNSPECIFIED="BLOCKED_REASON_UNSPECIFIED",t.SAFETY="SAFETY",t.OTHER="OTHER"})(G||(G={}));var p;(function(t){t.FINISH_REASON_UNSPECIFIED="FINISH_REASON_UNSPECIFIED",t.STOP="STOP",t.MAX_TOKENS="MAX_TOKENS",t.SAFETY="SAFETY",t.RECITATION="RECITATION",t.LANGUAGE="LANGUAGE",t.BLOCKLIST="BLOCKLIST",t.PROHIBITED_CONTENT="PROHIBITED_CONTENT",t.SPII="SPII",t.MALFORMED_FUNCTION_CALL="MALFORMED_FUNCTION_CALL",t.OTHER="OTHER"})(p||(p={}));var x;(function(t){t.TASK_TYPE_UNSPECIFIED="TASK_TYPE_UNSPECIFIED",t.RETRIEVAL_QUERY="RETRIEVAL_QUERY",t.RETRIEVAL_DOCUMENT="RETRIEVAL_DOCUMENT",t.SEMANTIC_SIMILARITY="SEMANTIC_SIMILARITY",t.CLASSIFICATION="CLASSIFICATION",t.CLUSTERING="CLUSTERING"})(x||(x={}));var U;(function(t){t.MODE_UNSPECIFIED="MODE_UNSPECIFIED",t.AUTO="AUTO",t.ANY="ANY",t.NONE="NONE"})(U||(U={}));var F;(function(t){t.MODE_UNSPECIFIED="MODE_UNSPECIFIED",t.MODE_DYNAMIC="MODE_DYNAMIC"})(F||(F={}));class f extends Error{constructor(e){super(`[GoogleGenerativeAI Error]: ${e}`)}}class v extends f{constructor(e,n){super(e),this.response=n}}class P extends f{constructor(e,n,s,o){super(e),this.status=n,this.statusText=s,this.errorDetails=o}}class C extends f{}class q extends f{}const X="https://generativelanguage.googleapis.com",Q="v1beta",z="0.24.1",Z="genai-js";var O;(function(t){t.GENERATE_CONTENT="generateContent",t.STREAM_GENERATE_CONTENT="streamGenerateContent",t.COUNT_TOKENS="countTokens",t.EMBED_CONTENT="embedContent",t.BATCH_EMBED_CONTENTS="batchEmbedContents"})(O||(O={}));class tt{constructor(e,n,s,o,i){this.model=e,this.task=n,this.apiKey=s,this.stream=o,this.requestOptions=i}toString(){var e,n;const s=((e=this.requestOptions)===null||e===void 0?void 0:e.apiVersion)||Q;let i=`${((n=this.requestOptions)===null||n===void 0?void 0:n.baseUrl)||X}/${s}/${this.model}:${this.task}`;return this.stream&&(i+="?alt=sse"),i}}function et(t){const e=[];return t?.apiClient&&e.push(t.apiClient),e.push(`${Z}/${z}`),e.join(" ")}async function nt(t){var e;const n=new Headers;n.append("Content-Type","application/json"),n.append("x-goog-api-client",et(t.requestOptions)),n.append("x-goog-api-key",t.apiKey);let s=(e=t.requestOptions)===null||e===void 0?void 0:e.customHeaders;if(s){if(!(s instanceof Headers))try{s=new Headers(s)}catch(o){throw new C(`unable to convert customHeaders value ${JSON.stringify(s)} to Headers: ${o.message}`)}for(const[o,i]of s.entries()){if(o==="x-goog-api-key")throw new C(`Cannot set reserved header name ${o}`);if(o==="x-goog-api-client")throw new C(`Header name ${o} can only be set using the apiClient field`);n.append(o,i)}}return n}async function st(t,e,n,s,o,i){const a=new tt(t,e,n,s,i);return{url:a.toString(),fetchOptions:Object.assign(Object.assign({},rt(i)),{method:"POST",headers:await nt(a),body:o})}}async function m(t,e,n,s,o,i={},a=fetch){const{url:r,fetchOptions:c}=await st(t,e,n,s,o,i);return ot(r,c,a)}async function ot(t,e,n=fetch){let s;try{s=await n(t,e)}catch(o){it(o,t)}return s.ok||await at(s,t),s}function it(t,e){let n=t;throw n.name==="AbortError"?(n=new q(`Request aborted when fetching ${e.toString()}: ${t.message}`),n.stack=t.stack):t instanceof P||t instanceof C||(n=new f(`Error fetching from ${e.toString()}: ${t.message}`),n.stack=t.stack),n}async function at(t,e){let n="",s;try{const o=await t.json();n=o.error.message,o.error.details&&(n+=` ${JSON.stringify(o.error.details)}`,s=o.error.details)}catch{}throw new P(`Error fetching from ${e.toString()}: [${t.status} ${t.statusText}] ${n}`,t.status,t.statusText,s)}function rt(t){const e={};if(t?.signal!==void 0||t?.timeout>=0){const n=new AbortController;t?.timeout>=0&&setTimeout(()=>n.abort(),t.timeout),t?.signal&&t.signal.addEventListener("abort",()=>{n.abort()}),e.signal=n.signal}return e}function y(t){return t.text=()=>{if(t.candidates&&t.candidates.length>0){if(t.candidates.length>1&&console.warn(`This response had ${t.candidates.length} candidates. Returning text from the first candidate only. Access response.candidates directly to use the other candidates.`),S(t.candidates[0]))throw new v(`${_(t)}`,t);return ct(t)}else if(t.promptFeedback)throw new v(`Text not available. ${_(t)}`,t);return""},t.functionCall=()=>{if(t.candidates&&t.candidates.length>0){if(t.candidates.length>1&&console.warn(`This response had ${t.candidates.length} candidates. Returning function calls from the first candidate only. Access response.candidates directly to use the other candidates.`),S(t.candidates[0]))throw new v(`${_(t)}`,t);return console.warn("response.functionCall() is deprecated. Use response.functionCalls() instead."),H(t)[0]}else if(t.promptFeedback)throw new v(`Function call not available. ${_(t)}`,t)},t.functionCalls=()=>{if(t.candidates&&t.candidates.length>0){if(t.candidates.length>1&&console.warn(`This response had ${t.candidates.length} candidates. Returning function calls from the first candidate only. Access response.candidates directly to use the other candidates.`),S(t.candidates[0]))throw new v(`${_(t)}`,t);return H(t)}else if(t.promptFeedback)throw new v(`Function call not available. ${_(t)}`,t)},t}function ct(t){var e,n,s,o;const i=[];if(!((n=(e=t.candidates)===null||e===void 0?void 0:e[0].content)===null||n===void 0)&&n.parts)for(const a of(o=(s=t.candidates)===null||s===void 0?void 0:s[0].content)===null||o===void 0?void 0:o.parts)a.text&&i.push(a.text),a.executableCode&&i.push("\n```"+a.executableCode.language+`
`+a.executableCode.code+"\n```\n"),a.codeExecutionResult&&i.push("\n```\n"+a.codeExecutionResult.output+"\n```\n");return i.length>0?i.join(""):""}function H(t){var e,n,s,o;const i=[];if(!((n=(e=t.candidates)===null||e===void 0?void 0:e[0].content)===null||n===void 0)&&n.parts)for(const a of(o=(s=t.candidates)===null||s===void 0?void 0:s[0].content)===null||o===void 0?void 0:o.parts)a.functionCall&&i.push(a.functionCall);if(i.length>0)return i}const lt=[p.RECITATION,p.SAFETY,p.LANGUAGE];function S(t){return!!t.finishReason&&lt.includes(t.finishReason)}function _(t){var e,n,s;let o="";if((!t.candidates||t.candidates.length===0)&&t.promptFeedback)o+="Response was blocked",!((e=t.promptFeedback)===null||e===void 0)&&e.blockReason&&(o+=` due to ${t.promptFeedback.blockReason}`),!((n=t.promptFeedback)===null||n===void 0)&&n.blockReasonMessage&&(o+=`: ${t.promptFeedback.blockReasonMessage}`);else if(!((s=t.candidates)===null||s===void 0)&&s[0]){const i=t.candidates[0];S(i)&&(o+=`Candidate was blocked due to ${i.finishReason}`,i.finishMessage&&(o+=`: ${i.finishMessage}`))}return o}function I(t){return this instanceof I?(this.v=t,this):new I(t)}function dt(t,e,n){if(!Symbol.asyncIterator)throw new TypeError("Symbol.asyncIterator is not defined.");var s=n.apply(t,e||[]),o,i=[];return o={},a("next"),a("throw"),a("return"),o[Symbol.asyncIterator]=function(){return this},o;function a(u){s[u]&&(o[u]=function(d){return new Promise(function(g,R){i.push([u,d,g,R])>1||r(u,d)})})}function r(u,d){try{c(s[u](d))}catch(g){E(i[0][3],g)}}function c(u){u.value instanceof I?Promise.resolve(u.value.v).then(h,l):E(i[0][2],u)}function h(u){r("next",u)}function l(u){r("throw",u)}function E(u,d){u(d),i.shift(),i.length&&r(i[0][0],i[0][1])}}const $=/^data\: (.*)(?:\n\n|\r\r|\r\n\r\n)/;function ut(t){const e=t.body.pipeThrough(new TextDecoderStream("utf8",{fatal:!0})),n=gt(e),[s,o]=n.tee();return{stream:ht(s),response:ft(o)}}async function ft(t){const e=[],n=t.getReader();for(;;){const{done:s,value:o}=await n.read();if(s)return y(Et(e));e.push(o)}}function ht(t){return dt(this,arguments,function*(){const n=t.getReader();for(;;){const{value:s,done:o}=yield I(n.read());if(o)break;yield yield I(y(s))}})}function gt(t){const e=t.getReader();return new ReadableStream({start(s){let o="";return i();function i(){return e.read().then(({value:a,done:r})=>{if(r){if(o.trim()){s.error(new f("Failed to parse stream"));return}s.close();return}o+=a;let c=o.match($),h;for(;c;){try{h=JSON.parse(c[1])}catch{s.error(new f(`Error parsing JSON response: "${c[1]}"`));return}s.enqueue(h),o=o.substring(c[0].length),c=o.match($)}return i()}).catch(a=>{let r=a;throw r.stack=a.stack,r.name==="AbortError"?r=new q("Request aborted when reading from the stream"):r=new f("Error reading from the stream"),r})}}})}function Et(t){const e=t[t.length-1],n={promptFeedback:e?.promptFeedback};for(const s of t){if(s.candidates){let o=0;for(const i of s.candidates)if(n.candidates||(n.candidates=[]),n.candidates[o]||(n.candidates[o]={index:o}),n.candidates[o].citationMetadata=i.citationMetadata,n.candidates[o].groundingMetadata=i.groundingMetadata,n.candidates[o].finishReason=i.finishReason,n.candidates[o].finishMessage=i.finishMessage,n.candidates[o].safetyRatings=i.safetyRatings,i.content&&i.content.parts){n.candidates[o].content||(n.candidates[o].content={role:i.content.role||"user",parts:[]});const a={};for(const r of i.content.parts)r.text&&(a.text=r.text),r.functionCall&&(a.functionCall=r.functionCall),r.executableCode&&(a.executableCode=r.executableCode),r.codeExecutionResult&&(a.codeExecutionResult=r.codeExecutionResult),Object.keys(a).length===0&&(a.text=""),n.candidates[o].content.parts.push(a)}o++}s.usageMetadata&&(n.usageMetadata=s.usageMetadata)}return n}async function V(t,e,n,s){const o=await m(e,O.STREAM_GENERATE_CONTENT,t,!0,JSON.stringify(n),s);return ut(o)}async function J(t,e,n,s){const i=await(await m(e,O.GENERATE_CONTENT,t,!1,JSON.stringify(n),s)).json();return{response:y(i)}}function W(t){if(t!=null){if(typeof t=="string")return{role:"system",parts:[{text:t}]};if(t.text)return{role:"system",parts:[t]};if(t.parts)return t.role?t:{role:"system",parts:t.parts}}}function A(t){let e=[];if(typeof t=="string")e=[{text:t}];else for(const n of t)typeof n=="string"?e.push({text:n}):e.push(n);return _t(e)}function _t(t){const e={role:"user",parts:[]},n={role:"function",parts:[]};let s=!1,o=!1;for(const i of t)"functionResponse"in i?(n.parts.push(i),o=!0):(e.parts.push(i),s=!0);if(s&&o)throw new f("Within a single message, FunctionResponse cannot be mixed with other type of part in the request for sending chat message.");if(!s&&!o)throw new f("No content is provided for sending chat message.");return s?e:n}function Ct(t,e){var n;let s={model:e?.model,generationConfig:e?.generationConfig,safetySettings:e?.safetySettings,tools:e?.tools,toolConfig:e?.toolConfig,systemInstruction:e?.systemInstruction,cachedContent:(n=e?.cachedContent)===null||n===void 0?void 0:n.name,contents:[]};const o=t.generateContentRequest!=null;if(t.contents){if(o)throw new C("CountTokensRequest must have one of contents or generateContentRequest, not both.");s.contents=t.contents}else if(o)s=Object.assign(Object.assign({},s),t.generateContentRequest);else{const i=A(t);s.contents=[i]}return{generateContentRequest:s}}function k(t){let e;return t.contents?e=t:e={contents:[A(t)]},t.systemInstruction&&(e.systemInstruction=W(t.systemInstruction)),e}function Ot(t){return typeof t=="string"||Array.isArray(t)?{content:A(t)}:t}const j=["text","inlineData","functionCall","functionResponse","executableCode","codeExecutionResult"],Rt={user:["text","inlineData"],function:["functionResponse"],model:["text","functionCall","executableCode","codeExecutionResult"],system:["text"]};function vt(t){let e=!1;for(const n of t){const{role:s,parts:o}=n;if(!e&&s!=="user")throw new f(`First content should be with role 'user', got ${s}`);if(!b.includes(s))throw new f(`Each item should include role field. Got ${s} but valid roles are: ${JSON.stringify(b)}`);if(!Array.isArray(o))throw new f("Content should have 'parts' property with an array of Parts");if(o.length===0)throw new f("Each Content should have at least one part");const i={text:0,inlineData:0,functionCall:0,functionResponse:0,fileData:0,executableCode:0,codeExecutionResult:0};for(const r of o)for(const c of j)c in r&&(i[c]+=1);const a=Rt[s];for(const r of j)if(!a.includes(r)&&i[r]>0)throw new f(`Content with role '${s}' can't contain '${r}' part`);e=!0}}function K(t){var e;if(t.candidates===void 0||t.candidates.length===0)return!1;const n=(e=t.candidates[0])===null||e===void 0?void 0:e.content;if(n===void 0||n.parts===void 0||n.parts.length===0)return!1;for(const s of n.parts)if(s===void 0||Object.keys(s).length===0||s.text!==void 0&&s.text==="")return!1;return!0}const B="SILENT_ERROR";class pt{constructor(e,n,s,o={}){this.model=n,this.params=s,this._requestOptions=o,this._history=[],this._sendPromise=Promise.resolve(),this._apiKey=e,s?.history&&(vt(s.history),this._history=s.history)}async getHistory(){return await this._sendPromise,this._history}async sendMessage(e,n={}){var s,o,i,a,r,c;await this._sendPromise;const h=A(e),l={safetySettings:(s=this.params)===null||s===void 0?void 0:s.safetySettings,generationConfig:(o=this.params)===null||o===void 0?void 0:o.generationConfig,tools:(i=this.params)===null||i===void 0?void 0:i.tools,toolConfig:(a=this.params)===null||a===void 0?void 0:a.toolConfig,systemInstruction:(r=this.params)===null||r===void 0?void 0:r.systemInstruction,cachedContent:(c=this.params)===null||c===void 0?void 0:c.cachedContent,contents:[...this._history,h]},E=Object.assign(Object.assign({},this._requestOptions),n);let u;return this._sendPromise=this._sendPromise.then(()=>J(this._apiKey,this.model,l,E)).then(d=>{var g;if(K(d.response)){this._history.push(h);const R=Object.assign({parts:[],role:"model"},(g=d.response.candidates)===null||g===void 0?void 0:g[0].content);this._history.push(R)}else{const R=_(d.response);R&&console.warn(`sendMessage() was unsuccessful. ${R}. Inspect response object for details.`)}u=d}).catch(d=>{throw this._sendPromise=Promise.resolve(),d}),await this._sendPromise,u}async sendMessageStream(e,n={}){var s,o,i,a,r,c;await this._sendPromise;const h=A(e),l={safetySettings:(s=this.params)===null||s===void 0?void 0:s.safetySettings,generationConfig:(o=this.params)===null||o===void 0?void 0:o.generationConfig,tools:(i=this.params)===null||i===void 0?void 0:i.tools,toolConfig:(a=this.params)===null||a===void 0?void 0:a.toolConfig,systemInstruction:(r=this.params)===null||r===void 0?void 0:r.systemInstruction,cachedContent:(c=this.params)===null||c===void 0?void 0:c.cachedContent,contents:[...this._history,h]},E=Object.assign(Object.assign({},this._requestOptions),n),u=V(this._apiKey,this.model,l,E);return this._sendPromise=this._sendPromise.then(()=>u).catch(d=>{throw new Error(B)}).then(d=>d.response).then(d=>{if(K(d)){this._history.push(h);const g=Object.assign({},d.candidates[0].content);g.role||(g.role="model"),this._history.push(g)}else{const g=_(d);g&&console.warn(`sendMessageStream() was unsuccessful. ${g}. Inspect response object for details.`)}}).catch(d=>{d.message!==B&&console.error(d)}),u}}async function It(t,e,n,s){return(await m(e,O.COUNT_TOKENS,t,!1,JSON.stringify(n),s)).json()}async function At(t,e,n,s){return(await m(e,O.EMBED_CONTENT,t,!1,JSON.stringify(n),s)).json()}async function mt(t,e,n,s){const o=n.requests.map(a=>Object.assign(Object.assign({},a),{model:e}));return(await m(e,O.BATCH_EMBED_CONTENTS,t,!1,JSON.stringify({requests:o}),s)).json()}class Y{constructor(e,n,s={}){this.apiKey=e,this._requestOptions=s,n.model.includes("/")?this.model=n.model:this.model=`models/${n.model}`,this.generationConfig=n.generationConfig||{},this.safetySettings=n.safetySettings||[],this.tools=n.tools,this.toolConfig=n.toolConfig,this.systemInstruction=W(n.systemInstruction),this.cachedContent=n.cachedContent}async generateContent(e,n={}){var s;const o=k(e),i=Object.assign(Object.assign({},this._requestOptions),n);return J(this.apiKey,this.model,Object.assign({generationConfig:this.generationConfig,safetySettings:this.safetySettings,tools:this.tools,toolConfig:this.toolConfig,systemInstruction:this.systemInstruction,cachedContent:(s=this.cachedContent)===null||s===void 0?void 0:s.name},o),i)}async generateContentStream(e,n={}){var s;const o=k(e),i=Object.assign(Object.assign({},this._requestOptions),n);return V(this.apiKey,this.model,Object.assign({generationConfig:this.generationConfig,safetySettings:this.safetySettings,tools:this.tools,toolConfig:this.toolConfig,systemInstruction:this.systemInstruction,cachedContent:(s=this.cachedContent)===null||s===void 0?void 0:s.name},o),i)}startChat(e){var n;return new pt(this.apiKey,this.model,Object.assign({generationConfig:this.generationConfig,safetySettings:this.safetySettings,tools:this.tools,toolConfig:this.toolConfig,systemInstruction:this.systemInstruction,cachedContent:(n=this.cachedContent)===null||n===void 0?void 0:n.name},e),this._requestOptions)}async countTokens(e,n={}){const s=Ct(e,{model:this.model,generationConfig:this.generationConfig,safetySettings:this.safetySettings,tools:this.tools,toolConfig:this.toolConfig,systemInstruction:this.systemInstruction,cachedContent:this.cachedContent}),o=Object.assign(Object.assign({},this._requestOptions),n);return It(this.apiKey,this.model,s,o)}async embedContent(e,n={}){const s=Ot(e),o=Object.assign(Object.assign({},this._requestOptions),n);return At(this.apiKey,this.model,s,o)}async batchEmbedContents(e,n={}){const s=Object.assign(Object.assign({},this._requestOptions),n);return mt(this.apiKey,this.model,e,s)}}class St{constructor(e){this.apiKey=e}getGenerativeModel(e,n){if(!e.model)throw new f("Must provide a model name. Example: genai.getGenerativeModel({ model: 'my-model-name' })");return new Y(this.apiKey,e,n)}getGenerativeModelFromCachedContent(e,n,s){if(!e.name)throw new C("Cached content must contain a `name` field.");if(!e.model)throw new C("Cached content must contain a `model` field.");const o=["model","systemInstruction"];for(const a of o)if(n?.[a]&&e[a]&&n?.[a]!==e[a]){if(a==="model"){const r=n.model.startsWith("models/")?n.model.replace("models/",""):n.model,c=e.model.startsWith("models/")?e.model.replace("models/",""):e.model;if(r===c)continue}throw new C(`Different value for "${a}" specified in modelParams (${n[a]}) and cachedContent (${e[a]})`)}const i=Object.assign(Object.assign({},n),{model:e.model,tools:e.tools,toolConfig:e.toolConfig,systemInstruction:e.systemInstruction,cachedContent:e});return new Y(this.apiKey,i,s)}}function Nt(){return new Date().toLocaleDateString("en-CA")}const wt=`
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
`,yt=`
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
`,bt=yt,Tt=["gemini-3-flash-preview","gemini-2.5-flash","gemini-2.5-flash-lite"],Mt={"gemini-3-flash-preview":20,"gemini-2.5-flash":20,"gemini-2.5-flash-lite":20},Lt={"gemini-3-flash-preview":"Gemini 3 Flash","gemini-2.5-flash":"Gemini 2.5 Flash","gemini-2.5-flash-lite":"Gemini 2.5 Flash Lite"};async function Dt(t,e,n,s="gemini-3-flash",o){const r=await new St(t).getGenerativeModel({model:s,systemInstruction:n},{apiVersion:"v1beta"}).generateContentStream(e);let c="";try{for await(const h of r.stream)try{const l=h.text();l&&(c+=l,o(c))}catch(l){console.warn(`[${s}] Chunk error:`,l)}}catch(h){console.error(`[${s}] Stream error:`,h);const l=h.message||"";let E="[ERROR]";if(l.includes("429")||l.includes("quota")||l.includes("limit")||l.includes("exhausted")?E="[RESOURCE_EXHAUSTED]":l.includes("503")||l.includes("high demand")||l.includes("overloaded")?E="[OVERLOADED]":l.includes("API key")||l.includes("401")||l.includes("403")?E="[AUTH_ERROR]":(l.includes("Safety")||l.includes("block")||l.includes("candidate"))&&(E="[SAFETY_ERROR]"),!c)throw new Error(`${E} ${l}`);console.warn(`${E} Stream stopped prematurely but some content was received. Msg: ${l}`)}if(!c)throw console.warn(`[${s}] Stream completed with empty response.`),new Error(`[ERROR] モデル "${s}" から応答が得られませんでした。モデルIDが正しいか確認してください。`);return c}async function Gt(t){return[...Tt]}export{Mt as K,Lt as M,yt as P,bt as S,Tt as T,Dt as a,wt as b,Nt as g,Gt as l};
