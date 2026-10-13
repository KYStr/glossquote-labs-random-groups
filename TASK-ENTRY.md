# THREAD-17-random-groups

功能對話名稱：**名單隨機分組**。模型請求：`gpt-6.1-sol`，推理強度 `max`；如果平台沒有回報後端身份證據，必須寫「未獨立確認」，不得靠自述推定已切換。

## 完整目標

在本資料夾規格範圍內製作可用的繁體中文／英文名單隨機分組工具。使用者貼一人一行的 2–500 人名單、選擇 2–min(50,N) 組，得到每人恰出現一次且組間人數差≤1的完整結果。正式運算只在瀏覽器記憶體進行，使用 `crypto.getRandomValues` 與 rejection-sampled Fisher–Yates；無亂數 API 時 fail closed。名單不保存、不上傳、不讀取剪貼簿。具體值域、流程、雙語 copy、SEO、非目標和錯誤請以本資料夾文件為準，不要向對話記憶猜補。

按里程碑完成：M1/T00 完整本機核心、UI、精確測試與 dev/check/build，凍結等主代理驗收。M1 未通過不進 M2。主代理明確放行後再做 M2 production SEO/release/公開來源；主代理負責 M3 Cloudflare 部署、首頁整合和外部驗收包。GitHub 來源目標為 `https://github.com/KYStr/glossquote-labs-random-groups`；正式網址為 `https://groups.glossquote.com/index.html` 和 `/en/index.html`。目標存在性與發布狀態尚未確認。

可用 Goal 時建立此工具自己的有界目標，包含必要外部回報後的修正；若存在不可替換的其他 active Goal，須如實記錄，不得將其假標 complete。此次只要求 M1/T00，未獲主代理下一階段放行不得越級。

## 本輪 M1/T00 的所有權

2026-10-13 當前里程碑更新：M1 已由主代理獨立驗收 PASS，明確放行 M2/T01。M1 所有權段落保留為歷史範圍；當前依 TASKS 的 M2 allowlist 完成固定 production metadata、安全 headers／404、公開 reviewed source、Git blob 完全一致的固定 ZIP 與解壓重建。原功能對話仍為唯一產品 owner；主代理 M3 負責部署與首頁，M2 不讀 token／部署／動首頁。所有必要 M2 gates 通過後釋放 owner 並凍結 READY_FOR_INTEGRATION，外驗仍未完成。

- 工作目錄：`tool-projects/17-random-groups/`。核心 source 和測試不得引用孵化器 root 或兄弟工具的產品模組。
- 專用append-only證據：孵化器 .runs/random-groups/；M2放行後來源發布副本：.runs/github-publish/glossquote-labs-random-groups/，保留既有進度、不force。這些是開發交接路徑，不是runtime依賴。
- 只修改 `TASKS.md` 中 M1 允許路徑。其他路徑、首頁、M2 release、Cloudflare 和正式 deploy 都不在本輪授權內。
- 開發埠 `127.0.0.1:4197`；暫時驗收參考埠 `127.0.0.1:5197`。若占用，保留既有程序並改用 OS 分配埠記錄，不以 broad process name 或 port 批殺程序。
- runtime 零依賴；不安裝 package、不使用 CDN/remote fonts、不用第三方 API。測試資料必須為合成假姓名。
- 不讀取 credential、瀏覽器 profile、系統環境秘密或私人名單。禁止 root `git commit/reset/clean/stash`。保留既有改動、服務、分頁和測試進程。
- 來源公開與部署不是 M1 完成條件；不得在沒有主代理核准時開正式 GitHub repo 或部署。

## 不可破壞的產品決定

1. 名單原始長度以 UTF-16 code units 計，最多 60,000；每個 trim 後姓名 1–100 units，不接受 C0/C1 control。空白行會忽略並顯示數量；重名是不同人，ID 按非空輸入順序連號。
2. 組數原字串 ≤32 UTF-16 units，ASCII trim 後只接受 digits；2..min(50,N)，前導零可。輸入變更、重新分組開始及 random failure 都不保留過期結果。
3. 正式入口只用 browser crypto adapter。每個 n 用 `floor(2^32/n)*n` rejection limit，最多 128 次；沒有 `Math.random`、seed、history 或不加 rejection 的 `%`。
4. Fisher–Yates 後連續切組，前 `N mod K` 組多一人。樣本例與固定 PRNG vectors 是測試 oracle，不是 product output promise。
5. 不做抽獎名次、每組上限、指定/排除成員、歷史或儲存。MVP 不提供 Worker 或取消按鈕，不能製造假 loading。
6. copy 只在明確按鈕操作寫入；不讀 clipboard、不下載 TXT。copy Promise 有 revision + latest-call guard；clear/pagehide 清輸入/輸出。

## 必要交付與停止回報

完成 M1 時列出實際改檔、diff/commit、Node 版本、`npm test/check/build` 的真命令及 exit、真 Chrome/Edge 的操作紀錄、未驗/NOT_RUN、已知風險和 M2 阻塞。不把規格例、靜態掃描、Node harness 或工具自述說成真瀏覽器 PASS。遇到超出路徑、需要費用/新權限/服務，或 gate 相同失敗兩次而無新證據，停在受影響處並提供精確輸入、expected/actual、錯誤碼/檔案位置供主代理裁定。
