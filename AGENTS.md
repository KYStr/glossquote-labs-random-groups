# 名單隨機分組實作契約

此工具是 Gloss Tools 家族的獨立雙語靜態工具。原功能對話是目前里程碑產品實作者；主對話負責產品決策、跨專案、source/deploy 整合和獨立驗收。請求 `gpt-6.1-sol` / `max` 與實際可證明的後端模型是兩回事，分開記錄。每個功能 chat 一次只推一個 milestone，不自行建立子代理或第二個 chat。

- 開始先讀 `START-HERE.md`、`HANDOFF.md`、當前 `TASKS.md` 段落及本文件引用的規格。只改目前 milestone allowlist；不改根 AGENTS、其他工具、首頁、GlossGate 或 040141.xyz。
- 必須完整遵守 `PRODUCT.md` 和 `TECHNICAL.md`；不得改輸入上限、random 算法、copy 政策或驗收預期換取綠燈。遇到真規格矛盾先交主代理，不猜測放寬。
- 使用原生 HTML/CSS/ESM、Node 24+ 和 `node:test`。MVP 零 runtime/development 依賴；測試離線、固定假資料和 literals。不能用實際使用者名單或其他私人文件當 fixture。
- production `generateGroups()` 必須使用真實 `crypto.getRandomValues` adapter；deterministic callback 只供明確 test seam。絕不能 `Math.random` fallback、固定 seed、未拒絕的取模或雲端隨機 API。不可稱具公開可審計／公證公平性。
- 所有姓名當不可信文字；不使用 innerHTML、eval、user string URL、storage、telemetry 或外部 network。剪貼簿只能由明確使用者按鈕寫入；不讀 clipboard、無 TXT download。
- 任何名單或組數更動立即清除分組結果及 copy fallback；重洗開始先失效舊結果。Pagehide 清輸入／結果引用。Copy Promise 需要內容 revision 和最新 request 序號保護 UI 狀態。
- 只做在 M1 已列的 paths。不要讀憑證，不讀其他 repository/profile/environment/credential store，不需 Cloudflare token。不要改持久 Windows environment、PATH、registry、service、pagefile 或 BCD。建置前後的長測試依工程文件跑 environment guard；不要永久設定 DOTNET 或 CLI PATH。
- 保留使用者修改、Git 狀態、服務、瀏覽器分頁及 background process。禁止 root destructive Git 操作。只可處理自己建立並精確識別的 disposable process。
- 關鍵驗收失敗先回到本里程碑；兩次相同失敗無新證據時停下提供根因，不盲目重試。不得刪減既有測試、弱化 `check` 或把 mock/Node 測試冒充瀏覽器。
- HANDOFF 必須記錄實際改檔、完整測試命令/exit、PASS/FAIL/NOT_RUN、瀏覽器版本及案例、風險、source/deploy/external-review 狀態和 owner 是否釋放。作者回報不能替代主代理獨立驗收。
