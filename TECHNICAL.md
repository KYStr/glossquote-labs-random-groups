# 技術規格：名單隨機分組

狀態：**SPEC_ONLY**。這份契約由 [PRODUCT.md](PRODUCT.md) 與 [ACCEPTANCE.md](ACCEPTANCE.md) 定義；所有程式介面是預期行為，不表示已有實作。

## 架構與允許的 runtime

正式產品是原生 HTML、CSS、瀏覽器 ESM 靜態頁。Node.js 24+ 只用於離線測試、受限的本機預覽與 build。MVP 不需 Worker：名單最多 500 人，Fisher–Yates 只執行 499 個索引；沒有上傳或 server-side 計算。不得加入 runtime 或開發依賴、framework、bundler、CDN、遠端字型或第三方圖示。

## M1 檔案樹

```text
package.json
.gitignore
public/
  index.html                     # 繁體中文
  en/index.html                  # English
  styles/app.css
  js/app.mjs
  js/i18n.mjs
  js/core/random-groups.mjs
scripts/
  serve.mjs
  check.mjs
  build.mjs
test/
  random-groups.test.mjs
  scaffold.test.mjs
HANDOFF.md
dist/                            # 只由 build 生成，gitignore
```

正式語言網址預定為 `/index.html` 和 `/en/index.html`，符合工具家族目前首頁路徑。M1 不建立 Cloudflare 設定，也不冒稱已有 production canonical、robots、sitemap、正式 headers 或首頁 catalog 項目。

## 核心介面

核心模組 `public/js/core/random-groups.mjs` 提供純邏輯介面：

```js
parseRoster(source)
parseGroupCount(source, participantCount)
generateGroups(participants, groupCount)
generateGroupsWithUint32Source(participants, groupCount, nextUint32)
createCopyText(groups, locale)
```

- `parseRoster(source)` 回 `{ ok:true, participants, ignoredLineCount }` 或 `{ ok:false, code, lineNumber, ignoredLineCount }`。空字串是 0 個輸入列、ignored 0；非空輸入的正規化與掃描遵守 FR-02。錯誤只回固定 code 與必要行號，不回原文。按順序遇到第一個錯誤即停止，不回傳部分名單；`ROSTER_TOO_FEW`、`ROSTER_TOO_MANY` 是整體人數錯誤。
- 成功的 `participants` 是依非空列順序編號的陣列：`{ id: 1..N, name: trimmedString }`。ID 連續、不重複，同名不合併。不得以輸入來源行號取代連續 ID。
- `parseGroupCount(source, participantCount)` 先驗證字串及原始 UTF-16 長度，依 FR-03 做 ASCII trim、digits grammar 和範圍判斷。回 `{ok:true,value:number}` 或固定錯誤物件；不得先用 Number 寬鬆解析、捨棄前導內容或默默修正輸入。
- `generateGroups(participants, groupCount)` 是產品唯一正式入口。它從目前瀏覽器 `globalThis.crypto.getRandomValues` 建立 source，缺少或失敗時回 `RANDOM_SOURCE_FAILED`，絕不 fallback。它不接受 caller 提供的 RNG、seed 或 `Math.random`。
- `generateGroupsWithUint32Source(...)` 是明確的 deterministic test seam；產品 `app.mjs` 不可匯入或呼叫它。測試可用固定 callback 檢查取樣、拒絕重抽及分組邊界。它接受 callback 回傳的 unsigned integer，任何 callback 例外或非法值都映成 `RANDOM_SOURCE_FAILED`。
- 兩個 generate 入口都重新驗證 participants 結構、ID 唯一及連續性、每個 name 的 trim/長度/control 條件、groupCount 範圍。輸入不得被排序或突變。非法結構回 `INPUT_SCHEMA_INVALID`；不呼叫 RNG。
- 成功輸出 `{ok:true, groups:[{groupNumber, participants:[{id,name}], count}], participantCount}`。`groups` 順序、參與者順序和每組人數遵守 FR-04。錯誤時不回傳部分 groups。
- `createCopyText(groups, locale)` 只接受已驗證結果和 `zh-Hant`／`en`；產生逐組標題、人數、原名及 `#id` 的LF純文字，最後一個LF。姓名含尖括號的字面內容也保留；禁止HTML格式剪貼簿或用姓名建立DOM標籤，不是刪除姓名看似HTML的文字。不得混入未驗證自由欄位或機器stack。

## uint32 來源與無偏取樣

正式 adapter 每次取一個整數：

```js
const slot = new Uint32Array(1);
crypto.getRandomValues(slot);
const sample = slot[0];
```

不要先解構/綁定成會失去 `Crypto` receiver 的方法；呼叫擲例外就映為 `RANDOM_SOURCE_FAILED`。`getRandomValues` 本身可在不安全 context 使用；工具 production 使用 HTTPS 是站點政策，不是宣稱此 API 強制 HTTPS。若 `globalThis.crypto.getRandomValues` 不可用，關閉產生功能並顯示可重試說明，不降級成其他隨機源。[MDN Crypto.getRandomValues](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues) 是此 API 契約的官方參考。

對每個 `n=i+1`（2..N），`2^32=4294967296` 是可精確表示的 Number 整數。計算 `limit=Math.floor(4294967296/n)*n`。每個呼叫最多嘗試 128 次：每次讀一個 `sample` 並先確認其為整數且在 `[0,4294967295]`；`sample < limit` 才回 `sample % n`，否則拒絕並重抽。第 128 次仍被拒絕就立刻錯誤，不作第 129 次。`%` 只有在 rejection test 通過後使用。對一般 `n` 會接受恰好可整除範圍，其餘值重新取樣，因此不偏向較小 index。

`N=2` 時 Fisher–Yates 仍會處理 `i=1`、抽取 `n=2` 的 index，再將兩人分到兩組；不得把這個最小案例當成不用隨機來源。正式入口在驗證通過後才啟動洗牌，API 缺少、無法呼叫或拋例外一律回 `RANDOM_SOURCE_FAILED`。

## Fisher–Yates 與均衡切分

1. 從通過 parser 的 participants 複製 ID 順序，不改原陣列。
2. 對 `i=N−1,...,1` 依序取得 `j=uniformBelow(i+1)`，交換 `ids[i]` 和 `ids[j]`。
3. 令 `q=floor(N/K)`、`r=N mod K`。按洗牌後順序，前 r 組各取 q+1 個，其餘組各取 q 個。
4. 依 ID 映回未改寫的原名，產生完整結果；ID 只作同名區分，不透露額外個資。

手算 fixture：`[甲,乙,丙,丁,戊]`、K=2、每次 uint32 sample 為 0。洗牌逐步為 `[戊,乙,丙,丁,甲]`、`[丁,乙,丙,戊,甲]`、`[丙,乙,丁,戊,甲]`、`[乙,丙,丁,戊,甲]`。切分為第 1 組 `[乙（#2）,丙（#3）,丁（#4）]`，第 2 組 `[戊（#5）,甲（#1）]`。這是測試 oracle，不能當產品中固定結果。

取樣案例：`n=3` 時 `limit=4294967295`。sample `4294967295` 必須拒絕；下一個 sample `5` 接受並得到 index 2。禁止只做 `sample % n`，也禁止用 0..2 的範圍直接捨棄不足以檢查抽樣流程。

## 頁面狀態與 copy 競態

App state 至少持有名單原稿、組數原稿、目前解析錯誤/ignored count、已驗證 participants、結果、copy status、`contentRevision` 和 `copyRequestId`。不保存 RNG state、seed 或歷史結果。

- 每次輸入變更即遞增內容 revision、重算驗證、清除結果和 copy fallback；即使文字最後回到原值，也不能復活舊結果。
- 產生／重新分組操作一開始即清除舊結果與 copy 提示。驗證失敗或 `RANDOM_SOURCE_FAILED` 都沒有舊結果。成功後只展示新完整結果。
- 「載入範例」/「清除」依 FR-06/08 同步重設。`pagehide` 清輸入、結果、copy fallback 和 JS 引用；不得用 `visibilitychange` 偷取使用者資料或清空臨時遮罩狀態。
- 每次 Copy 先增加 `copyRequestId` 並捕捉兩個 revision，再呼叫 `navigator.clipboard.writeText`。只有 sequence 和 content revision 仍相同的 promise completion 才能寫入 UI state；新輸入/新結果使舊 completion inert。clipboard 的 native write 無法撤回，介面不保證取消已送出的舊寫入。
- 不用 async progress UI 包裝同步運算，不建立 fake timer、Worker 或取消功能。

## HTML、網路、錯誤和 browser boundary

所有姓名是 untrusted plain text。使用 `value`、`textContent`、靜態語意標籤；不准 `innerHTML`、`eval`、`new Function`、動態 script URL、fetch/XHR/WebSocket/beacon、storage、service worker 或網路隨機 API。開發 server 僅供 `public/`，`127.0.0.1:4197`，只 `GET`/`HEAD`。沒有 `/api`、表單提交或 server-side 名單副本。

每個可見錯誤只由固定 code 對應本地雙語文案；lineNumber 顯示整數，不將輸入行轉成 HTML。`RANDOM_SOURCE_FAILED` 不得附 `error.message`。密碼學 API 是 browser CSPRNG，不等同公開可稽核抽籤或法院級公平證明。

## Node 自動測試與人工界線

純解析、grammar、無偏取樣、固定 shuffle、切分、copy formatting 可用 Node 24 `node:test` 與假名單測試；期望順序必須寫 literal，不能由被測函式或同演算法重新計算成 expected。可以注入 uint32 callback 的測試不等同真瀏覽器 Crypto 測試。真 Chrome/Edge 表單操作、瀏覽器 clipboard、focus、響應式、Network/Storage 與正式 HTTP 必須在 acceptance 明記人工證據或 NOT_RUN。
