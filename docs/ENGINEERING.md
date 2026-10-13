# 工程與 Windows 安全

正式產品是原生 HTML/CSS/瀏覽器 ESM 靜態網站；Node.js 24+ 僅供本機開發、離線測試及建置。MVP 不需 runtime 或 dev 套件，不新增 framework、CDN、遠端字型、圖示套件、Worker 或伺服器運算。

M1 package 使用 `private=true`、`type=module`、`engines.node >=24`。Scripts 是 `dev: node scripts/serve.mjs`、`test: node --test`、`check: node scripts/check.mjs`、`build: node scripts/build.mjs`。開發 server 只提供 `public/`，綁定 `127.0.0.1:4197`，只允許 GET/HEAD；拒絕 path traversal、hidden/outside、junction/symlink、非預期 method。正式 hosting 是 Cloudflare 靜態資產，應用程式本身無 API/form endpoint。

`check` 必須真的檢查 Node 版本、package contract、ESM 語法、兩語資產、相對引用、runtime 外部 API、copy 可見字串、資產 allowlist 與 preview noindex。掃描只是有限 evidence，不是安全證明。`build` 在任何 dist 寫入前驗證完整 source/目的地，再只複製已核准 public 資產；硬連結、junction、未知 stale 檔須安全拒絕並保留外部 sentinel。

任何破壞性檔案操作前核對絕對 target 在本工具範圍內；不使用 root destructive git 操作，不動其它工具。發布只用 reviewed independent source copy，禁止把孵化器根目錄推上去。保留使用者修改、頁籤、server 和進程；不批量殺程序。只有任務自己建立且確認 PID/command/開始時間的 disposable process 才可結束。

Windows User/Machine 環境變數、PATH、TEMP/TMP、registry、services、pagefile、BCD 都是受保護系統狀態。禁止 setx、registry Environment 寫入或 User/Machine environment setters。臨時 Node/CLI/test cache 只能 process-local，不可寫進持久 PATH。長 build/test/install 前後以受信任的環境 guard 保存 HKCU/HKLM PATH 型別、length、hash、ephemeral count 與完整 Environment fingerprint，並確認前後相同；若基線未知漂移，先停止回報，不猜測修復。

本工具不需 dotnet。不安裝額外工具或套件。必要測試對 source input 使用離線合成假名，固定預期不得從同一個被測演算法動態生成。長工作依上位 AGENTS 的 guard 規則執行；一般唯讀檢查不改環境。
