# 實作任務與里程碑：名單隨機分組

狀態：**SPEC_ONLY**。本任務只定義工作，沒有任務已通過。任務以 [PRODUCT.md](PRODUCT.md)、[TECHNICAL.md](TECHNICAL.md)、[UX-SEO.md](UX-SEO.md) 和 [ACCEPTANCE.md](ACCEPTANCE.md) 為準；一個 gate 未通過，不勾選後續里程碑。

## M1 / T00：完整可用的本機雙語 MVP

**任務 ID：** `RANDOM-GROUPS-M1-LOCAL-MVP`。

**目標：**可操作的中英文靜態頁，包含固定輸入邊界、真實 crypto Fisher–Yates、均衡分組、結果、copy 和清除。隨附獨立核心測試，以及真正的本機 `dev`、`check`、`build`。完成後凍結並交主代理獨立驗收；不自行開始 M2。

**允許修改路徑（只限本專案）：**

- `package.json`、`.gitignore`（只新增 `node_modules/`、`dist/` 和必要 temp 排除）
- `public/index.html`、`public/en/index.html`、`public/styles/**`
- `public/js/app.mjs`、`public/js/i18n.mjs`、`public/js/core/random-groups.mjs`
- `scripts/serve.mjs`、`scripts/check.mjs`、`scripts/build.mjs`
- `test/random-groups.test.mjs`、`test/scaffold.test.mjs`
- `HANDOFF.md`（只記錄真實狀態和證據）
- `dist/**` 僅可由 build 產生，保持 gitignore，不人工編輯或發布。

主代理在派工前補齊M1允許範圍：本工具public/**（含preview robots）、test/**假資料與UI/tooling安全回歸、scripts/validation.mjs與必要自包含開發工具helper；project.json/START-HERE/docs/RELEASE-CANDIDATE及HANDOFF真實狀態可更新；孵化器根 .runs/random-groups/ 專用append-only證據可寫。不能建立M2正式發布工具或改變產品/精度/隱私門檻。非此列表的路徑先回報；規格實質變更仍由主代理裁定。

**不可破壞行為：**

- 原始名單≤60,000 UTF-16 units；2–500 名；正規化/trim/空行/控制碼/同名 ID 規則完全一致。
- K grammar 和範圍精確；無效輸入不消耗 RNG、不產生局部結果。
- 正式入口只有 browser `crypto.getRandomValues`；rejection-sampled Fisher–Yates，128 失敗上限，絕不 `Math.random` fallback。
- 每組切分最多相差一人，全 ID 恰出現一次；測試 expected 為獨立 literals。
- 新編輯/重洗/失敗即清結果；clear/pagehide 清所有使用者資料；copy 只有明確使用者操作並以兩層 revision guard 舊 promise。
- 雙語對等；不儲存、不讀剪貼簿、不上傳、不依賴第三方；符合鍵盤、focus、320px、200% 縮放。
- 本機伺服器只綁 loopback、只供 `public/`，拒絕路徑穿越和非 GET/HEAD；build 僅複製 allowlist，拒絕 hardlink/junction/未知 stale 資產，不動其他工具。

**實作步驟：**

1. 確認此資料夾仍是 SPEC_ONLY、Node 24+、工作樹狀態及 allowed paths；不讀 credential，不安裝套件，不更動 persistent Windows 狀態。
2. 先完成純 parser、組數 grammar、schema 驗證、uniformBelow/Fisher–Yates、切組和純文字 copy formatter，建立 A01–A44 核心可測的自動案例。
3. 再完成語意雙語 Product App、真實空/錯誤/成功狀態、範例、清除、clip promise revision guard、pagehide。
4. 完成狹義 static preview server、完整 check 和 build；保留 preview noindex，不添加 production routing/header 假設。
5. 執行 acceptance M1 gate 和可操作的 B01–B21；每個沒跑的瀏覽器項逐條 NOT_RUN。
6. 更新 HANDOFF，列實際檔案、命令/exit、測試輸出、人工觀察、known risks、commit/owner 狀態；停止等主代理驗收。

**命令與完成條件：**

Node 必須為 24+。執行 `npm test`、`npm run check`、`npm run build` 和 `npm run dev`；至少一個真瀏覽器兩語完成B02/B03/B04/B05/B06主流程、錯誤與過期結果清除，再做可用的B01–B21。其他browser、完整Network/Storage、原生clipboard/真機/zoom/讀屏無法觀察時可按既有授權逐項NOT_RUN，不能冒稱全通過。Node固定演算法和輸入拒絕以及本機工具鏈FAIL不能略過。命令須由實作者和主代理各自有證據地記錄，不把owner自述當主驗。

**停止條件：**

- Node 不是 24+、路徑不在允許範圍、有他人新修改將被覆蓋、埠衝突需要停止既有程序。
- 規格與 browser API 行為矛盾；依賴缺失/錯誤 fallback 使分組可退回非密碼學 RNG；任一邊界只能靠截斷或捨入放行。
- 需要安裝依賴、外部 API、帳號、憑證、新權限、額外付費服務，或碰其他工具／首頁／正式主機。
- 同一必要 gate 失敗兩次且沒有新證據；停止盲目重試，提交具體 command、input、expected/actual 和 code location。
- 發現 persistent Windows environment fingerprint 在此任務前已異常，或本任務造成任何不明漂移；依全域 AGENTS 安全規則處理，不猜測覆寫。

## M2 / T01：正式產物、SEO 與公開來源

**前置：**主代理已明確核准 M1/T00，且必要本機 gate 通過。沒有核准就保持 `BLOCKED_PENDING_PRIMARY_M1_ACCEPTANCE`。

**目標：**設定固定 origin `https://groups.glossquote.com` 的 production build/check、正式靜態 SEO/404/security headers，建立可重現並通過檢查的 reviewed public source copy；依固定目標 `KYStr/glossquote-labs-random-groups` 發布/更新公開來源並核對 visibility、remote commit、來源 ZIP。使用既有授權時不讀取或輸出憑證、不擴大權限、不碰 root repository。

**M2主驗放行後允許路徑：**本工具public/**固定SEO/404/_headers、scripts/check.mjs/build.mjs及release/manifest helper、test/release.test.mjs、package.json、wrangler.jsonc、docs/RELEASE.md/RELEASE-CANDIDATE.md、HANDOFF.md/README.md/project.json。公開副本僅孵化器 .runs/github-publish/glossquote-labs-random-groups/，證據 .runs/random-groups/；先核對現存副本並保留，不force/刪除重建。原功能對話依既有授權完成reviewed copy的來源公開，主代理親驗remote與部署；只有M1主驗放行才進入這些路徑，不需另找發布授權。

**必要驗收：**既有 test/check/build 和 `npm run build:production`、`npm run check:production`；固定雙語 URL/canonical/hreflang/x-default/robots/sitemap/JSON-LD；preview noindex；public source allowlist 無 `.runs`、dist、node_modules、secrets、個人名單或兄弟工具。公開 repo 的 remote visibility、commit/HEAD 與 source ZIP blob bytes 必須實際驗證。正式部署仍不在本任務內。

**停止條件：**正式來源 URL 不一致；需付費或新權限；GitHub 目標不是授權 repo；發布內容含個人資料/憑證；驗收 gate 失敗；要求修改首頁或部署 Cloudflare。把原因與解鎖條件記錄並交主代理，不 force push、不自改首頁。

## M3 / T02：正式部署、首頁與外部驗收（主代理負責）

主代理在 M2 source 固定後，依已授權免費 Cloudflare 流程部署 `groups.glossquote.com`，實測雙語頁、headers、canonical、robots/sitemap、network/storage、頁面互返和 GlossQuote 雙語首頁 catalog/backlinks。來源正式 commit、部署版本與 homepage commit 分開記錄。主代理把可重現驗收包交使用者，狀態標「已上線，待外部複驗」。功能對話不可自行改共用首頁、讀 token 或把 preview 當正式站。

收到外部回報後，由主代理確認證據並透過原功能對話交 T03 具體修正；原對話先重現問題，更新測試與 source commit，主代理重新部署與驗收。只有使用者／驗收者確認該固定版本通過後，才標記完成。

## T03：外部回報修正（只有收到具體報告後）

**allowed paths：**主代理在原對話任務中明列受影響檔案；不憑空重寫整款。先按報告重現，修正產品/規格對應測試；重新跑受影響的 M1/M2 gates，更新 source commit 與 HANDOFF，再等主代理整合。部署權仍屬主代理。沒有外部回報時此任務保持未開始。
