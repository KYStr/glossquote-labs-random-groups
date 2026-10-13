# 名單隨機分組驗收

狀態：**SPEC_ONLY**；以下是驗收案例和預期值，尚未執行。純函式測試用 Node 24、假姓名與 deterministic uint32 callback；不得讀私人名單。瀏覽器 API、剪貼簿、鍵盤、Network/Storage 和正式 HTTP 必須分開記錄，不用 Node 或 source inspection 冒充真瀏覽器 PASS。

## 自動案例

| ID | 需求 | 輸入／步驟 | 精確預期 |
|---|---|---|---|
| A01 | FR-02 | `parseRoster('')` | `ROSTER_TOO_FEW`，lineNumber=null，ignoredLineCount=0；不回傳半成品 participants。 |
| A02 | FR-02 | `甲\n乙` | 成功；people=`[{id:1,name:'甲'},{id:2,name:'乙'}]`，忽略 0 行。 |
| A03 | FR-02 | `甲\r\n\r\n 乙 \r丙` | CRLF/CR 都當 LF；成功名單依序為 `(甲,#1),(乙,#2),(丙,#3)`，ignoredLineCount=1。 |
| A04 | FR-02 | `\n \t\n甲\n乙\n` | 以 JS trim 忽略首行、空白行及尾行；兩位名單成功，ignoredLineCount=3。 |
| A05 | FR-02 | `甲\n甲\n乙` | 3 位而非 2 位；ID 為 1/2/3，同名保留。 |
| A06 | FR-02 | 恰 60,000 UTF-16 units：`'甲\n乙\n' + '\n'.repeat(59996)` | 不回 `SOURCE_TOO_LONG`；解析出甲乙兩人，ignoredLineCount=59997。 |
| A07 | FR-02 | A06 再多一個 LF，原始長 60,001 | `SOURCE_TOO_LONG`，lineNumber=null；拒絕前不截短或回傳部分名單。 |
| A08 | FR-02 | 建立 500 個有效短名，以 LF 分隔 | 成功恰 500 人，ID 1..500。 |
| A09 | FR-02 | 501 個有效短名 | `ROSTER_TOO_MANY`，lineNumber=501；不可只接受前 500 人。 |
| A10 | FR-02 | 一個 100 ASCII code-unit 名稱加另一個有效名稱 | 成功；第一名稱原樣保留。 |
| A11 | FR-02 | 一個 trim 後 101 code-unit 名稱 | `NAME_TOO_LONG`，該實體行 1；不回顯名稱。 |
| A12 | FR-02 | trim 後 50 個 `😀`（100 UTF-16 units）及第二位短名 | 成功；emoji 名稱保留，確認以 `.length` 而非 Unicode code point 計數。 |
| A13 | FR-02 | trim 後 51 個 `😀`（102 units） | `NAME_TOO_LONG`，不以視覺 grapheme 數通過。 |
| A14 | FR-02 | `　甲　\n乙`（U+3000 邊界空白） | JS `trim()` 後名稱為 `甲`,`乙`。 |
| A15 | FR-02 | ` \t甲\t \n乙` | 首尾 TAB 隨 trim 移除，成功；名稱 `甲`,`乙`。 |
| A16 | FR-02 | `甲\t乙\n丙` | `NAME_CONTROL`，line 1；內部 TAB 不移除、不偷偷修正。 |
| A17 | FR-02 | 第二行含 NUL `乙\u0000丙` | `NAME_CONTROL`、line 2；不回傳可部分使用的 roster。 |
| A18 | FR-02 | 第二行含 DEL `乙\u007f丙`；另測 C1 `乙\u0085丙` | 兩者皆 `NAME_CONTROL`、line 2。 |
| A19 | FR-03 | `parseGroupCount(' 0002\t',2)` | 有效值 2；前導零和 ASCII 邊界空白接受。 |
| A20 | FR-03 | 原始 32 units：`' '.repeat(15)+'2'+' '.repeat(16)`、N=2 | 原始長度檢查通過，trim 後值 2。 |
| A21 | FR-03 | 原始 33 units：`' '.repeat(16)+'2'+' '.repeat(16)` | `GROUP_COUNT_TOO_LONG`，即使 trim 後只有 `2` 也拒絕。 |
| A22 | FR-03 | 逐項 `''`,`0`,`1`,`+2`,`-2`,`2.0`,`2e0`,`1,000`,`２`,` 2 `,`2 0`（N=10） | 全部回固定格式或範圍錯誤；不可由 Number 寬鬆解析成合法組數。 |
| A23 | FR-03 | N=50 時 K=2 與 K=50 | 兩個端點接受；K=51 回 `GROUP_COUNT_RANGE`。 |
| A24 | FR-03 | N=2 時 K=3；N=51 時 K=0 | 都回 `GROUP_COUNT_RANGE`，不觸發 RNG。 |
| A25 | FR-04 | 5 人 `[甲,乙,丙,丁,戊]`、K=2、每次 callback 回 0 | 洗牌順序恰為 `[乙,丙,丁,戊,甲]`；第 1 組 `[乙（#2）,丙（#3）,丁（#4）]`，第 2 組 `[戊（#5）,甲（#1）]`。 |
| A26 | FR-04 | 5 人、K=2；callback 依序給 `[4294967295,5,1,2,1]` | n=5 的 limit=4294967295，第一個 max 值拒絕、5→j0；其後 n=4 sample1→j1、n=3 sample2→j2、n=2 sample1→j1。最終洗牌 `[戊,丁,丙,乙,甲]`，callback 恰呼叫 5 次。 |
| A27 | FR-04 | 3 人、K=2、callback 依序 `[4294967295,5,0]` | 第一次 n=3 拒絕 max uint32，5→j=2；接著 n=2 的 0→j=0；洗牌 `[乙,甲,丙]`；切組第1組`[乙（#2）,甲（#1）]`、第2組`[丙（#3）]`。 |
| A28 | FR-04 | n=3 的第一個 uniformBelow 收到 128 個 `4294967295` | 第 128 次拒絕後 `RANDOM_SOURCE_FAILED`，callback 恰呼叫 128 次；不做第129次，不回傳部分結果。 |
| A29 | FR-04 | test callback 回 `-1`、`1.5`、`4294967296`、`NaN` 或字串 | 每種在首次讀取後固定 `RANDOM_SOURCE_FAILED`，不映成隨機 index。 |
| A30 | FR-04 | test callback 拋出 `Error('FAKE_PRIVATE_ERROR')`；production 環境不提供 `getRandomValues` | 只回 `RANDOM_SOURCE_FAILED`；不含原始訊息，不讀 `Math.random`，不產生結果。 |
| A31 | FR-04 | 4 人 K=3，固定值產生任一合法排列 | 組大小按切片順序必為 `[2,1,1]`；N=8,K=3 必為 `[3,3,2]`；N=500,K=2 為 `[250,250]`；N=500,K=50 為 50 組各10人。 |
| A32 | FR-04 | 多組固定序列逐一生成 | 每次結果組數正好 K；flatten 後每個原始 ID 1..N 恰出現一次，沒有重複或遺漏；任兩組人數差≤1。 |
| A33 | FR-04 | N=2,K=2 | 一組抽樣必須使用 n=2；兩人各分一組，亂數 API 缺失時仍回 `RANDOM_SOURCE_FAILED`，不因 Fisher–Yates 不用 sample 而靜默降級。 |
| A34 | FR-04 | 非陣列、重複／不連續 ID、額外 participant 欄位、未 trim 名稱或非法 groupCount | `INPUT_SCHEMA_INVALID`；RNG callback 呼叫 0 次，沒有部分 groups。 |
| A35 | FR-04 | 合法 5 人 input 再呼叫生成 | 原始 people 陣列及每個物件的順序/值完全不變；結果另用複製 ID 陣列。 |
| A36 | FR-05 | 先成功生成，再用應用層變更名單或組數 | UI state 結果為 null、copy disabled、內容 revision 遞增；改回舊值仍須重新產生。見 B03/B04。 |
| A37 | FR-05 | 先成功，再按重新分組，隨機 adapter 失敗 | 舊結果先消失；錯誤只 `RANDOM_SOURCE_FAILED`；不可保留舊 groups 或 copy text。 |
| A38 | FR-06 | 使用繁中／英文載入範例 | 分別填入文件指定的六個名字、組數重設2、清結果；callback 呼叫0次，按鈕是「產生分組」。 |
| A39 | FR-07 | 固定結果呼叫 `createCopyText(groups,'zh-Hant')` | 每組標題含序號/人數；每列保留原名和 `（#id）`；只有純文字行與 LF，無 HTML。English 使用對應文案和 `(#id)`。 |
| A40 | FR-07 | 名稱字面值為 `<img src=x onerror=alert(1)>` | core 保留有效名字為普通字串；UI 驗收另證實不建立 img、不執行事件。 |
| A41 | FR-07 | Clipboard API 缺少／拒絕 | UI 保留可選取 readonly copy text 和操作說明；不讀剪貼簿、不呼叫 `execCommand`、不自動下載。 |
| A42 | FR-07 | 延遲 clipboard promise；之後改輸入、開始重新分組或再按 copy，再讓舊 promise resolve/reject | 舊 request sequence/revision 不能改新頁面的 copy status 或 fallback。OS 已收到的舊 write 無法取消，不把它寫成已取消。 |
| A43 | FR-08 | clear／pagehide | 名單、組數/結果、錯誤、copy fallback 清空；組數2；頁面初始按鈕可見。BFCache 恢復亦空白。 |
| A44 | FR-09 | 在所有固定錯誤上輸入 `FAKE_PRIVATE_NAME` 或讓 API 拋帶該訊息的 error | 可見 error code/翻譯文案不含該 sentinel、姓名或 stack；測試 fixture 是假的。 |

## 真瀏覽器手動案例

每項記錄瀏覽器名稱/版本、作業系統、頁面語言、實際輸入、觀察、PASS/FAIL/NOT_RUN 和證據。人工作業無法完成就列 NOT_RUN，不從 Node mock 推論。

| ID | 需求 | 操作 | 預期／證據 |
|---|---|---|---|
| B01 | FR-01/11 | 在 Chrome 和 Edge 開繁中與英文頁，使用語言切換及同語首頁入口 | 標籤、內容、`lang` 與路徑一致；沒把英文連回中文工具頁或相反。 |
| B02 | FR-02/03/04/07 | 以假名單 5 人 K=2 產生一次 | 所有姓名各出現一次，3/2人；結果含每人序號、完整組名單和人數。實際 browser 隨機結果不預設順序。 |
| B03 | FR-05 | 成功後改一個姓名 | 舊結果即清空，copy disabled，需重新按鈕；不殘留舊名單結果。 |
| B04 | FR-03/05 | 成功後改 K，再把人數減到讓 K 超上限 | 舊結果清除；不自動改 K；欄位錯誤可見且有關聯。 |
| B05 | FR-05 | 成功後明確按「重新分組」 | 舊結果先被取代；新結果成為唯一可複製結果；說明同次結果不保證不同。 |
| B06 | FR-02 | 在兩個瀏覽器分別測空行、CRLF 貼上、首尾空白、重複名、內部 TAB、控制碼、超長姓名 | 空列計數與行號正確；重名分成獨立 ID；錯誤不回顯敏感行。 |
| B07 | FR-02 | 使用 2、500 人邊界假資料，再測 1 和 501 人 | 2 和 500 可提交；超界顯示固定錯誤，不產生部分結果。 |
| B08 | FR-03 | 測 K=2、min(50,N)、少於2及高於上限 | 可用範圍、前導零/ASCII trim 和拒絕文案符合規格。 |
| B09 | FR-04 | 使用正常 browser API 分組兩次不同假名單 | 每位恰出現一次、組別差≤1；記錄觀察但不以少數操作作統計公平證明。 |
| B10 | FR-04 | 在可控的本機測試 harness 讓 `getRandomValues` 缺失或拋例外 | UI 明確回報 random source failure、沒有 fallback、沒有舊結果。若 browser 手動環境不能安全替換 API，標 NOT_RUN。 |
| B11 | FR-06 | 按載入假名單 | 六個相應語言假名出現，明確示範標示；沒自動分組；K=2。 |
| B12 | FR-07 | 成功後複製，再貼到本機純文字編輯器 | 完整所有組、人數、姓名與序號；不含 HTML；貼上的資料只由此明確操作觸發。 |
| B13 | FR-07 | 模擬 clipboard API 拒絕或在不允許時測試 | 顯示 readonly 手動備援；頁面不讀系統 clipboard、不用隱藏 execCommand。不能模擬則 NOT_RUN。 |
| B14 | FR-07 | 可控制 clipboard promise 時延遲並改動輸入，再 resolve/reject | 舊通知/fallback 不回到新畫面；注意 OS 寫入無法撤銷。不可控制就 NOT_RUN。 |
| B15 | FR-08 | 輸入樣本/生成結果，再 Clear、刷新、返回使頁面 BFCache 恢復 | 兩次都回名單空、K=2、無結果/錯誤/fallback。 |
| B16 | FR-09 | Chrome/Edge DevTools Network 與 Storage，載入、貼假唯一姓名、分組、複製 | 沒有名單傳輸、storage、cookie、第三方呼叫或動態請求；只有明確的剪貼簿寫入。查同源及 `/cdn-cgi/rum`，不只過濾外站。若無完整觀察能力列 NOT_RUN。 |
| B17 | FR-10 | 全程只用 Tab/Shift+Tab/Enter/Space 操作兩語流程及錯誤恢復 | 控件順序合理、每個焦點有可見標示、狀態和錯誤能被辨認；不需滑鼠拖曳。 |
| B18 | FR-10 | 實際 viewport 320 CSS px 手機直向，使用 500 假名單結果 | 整頁不水平溢位；輸入、K、清除、結果與 copy 可達；50組不被裁掉。 |
| B19 | FR-10 | 真瀏覽器 200% zoom | 操作、錯誤、名單和結果保持可讀可用，不遮住主要操作。 |
| B20 | FR-10 | 比對文字/控制邊界/焦點及錯誤；切換 reduce motion | 對比和雙層焦點符合設計契約；狀態不只依顏色；無必要動畫依賴。 |
| B21 | FR-01 | 停用 JavaScript 開啟兩頁 | 明確說明需啟用 JavaScript、名單不送出；沒有可誤認成功的假表單。 |
| B22 | FR-11 | 對固定正式 URL 執行 HTTP/SEO 驗證 | 雙語 canonical/互返 hreflang/x-default、正式 sitemap/robots/404、CSP/headers 和 JSON-LD 與畫面一致。只限 M3；M1/M2 先列 NOT_RUN。 |
| B23 | FR-11 | 從正式中英文頁往返 GlossQuote 首頁再回工具 | 同語連結正確；需實際公開站才能 PASS。 |

## 任務 gate

- M1/T00 必跑 Node 24+：`npm test`、`npm run check`、`npm run build`；並執行 B01–B21 中所有可用且主要的本機流程。不得把 B10/B13/B14 不可操作時改記 PASS。
- M2/T01 才建立正式建置與 SEO gate：`npm run build:production`、`npm run check:production` 以及對固定 URL/產物的實際比對。
- M3/T02 由主代理負責真實正式發布、首頁、HTTPS/HTTP/SEO 驗證和候選包；公開 repo、部署 commit、外驗狀態逐項分開記錄。
- 外部驗收者回報的新問題只按可重現案例進入返工；修正後跑受影響 case，再更新 GitHub commit 和正式版本證據。外部確認前不是完成。
