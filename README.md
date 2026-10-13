# 名單隨機分組

狀態：**來源候選已實作，正式部署待整合**。M1 已通過主代理獨立驗收；M2 建立正式靜態產物與來源發布候選。正式網站、首頁整合與外部複驗由後續里程碑驗證。

## 解決的問題

帶活動、課程、聚餐或出遊名單的人，常要把一串姓名分成指定數量的小組。手動分派容易重複漏人，也要再逐組計算人數。

**MVP：**貼上每行一人的名單，指定 2 至 50 組；工具在瀏覽器本機使用 `crypto.getRandomValues` 和 rejection-sampled Fisher–Yates 洗牌，再把全員平均分組。每個人恰好出現一次，組別人數最多差 1。空白行忽略；同名保留並以輸入序號辨認。

需求是具體且可操作的工具構想，尚未由訪談或流量資料驗證。替代方式包括手動點名、紙籤、試算表與其他抽籤工具。獨立工具的價值假設是：使用者可快速貼上既有名單，自己決定組數，並立即核對每組名單和人數。這不代表公證抽籤、可審計的公平程序或每次點擊都產生不同排列。

## 範圍與維護

- 2–500 位參與者；每人一行；清楚處理空行、重複姓名與長度上限。
- 2–min(50, 人數) 組；每次操作只做一個有界同步洗牌與分配。
- 繁體中文及英文靜態頁，結果可以選取或由使用者明確複製。
- 不保存名單、不讀取剪貼簿、不向外傳送姓名、不要求帳號或瀏覽器權限。
- 工程難度：低至中。重點是輸入邊界、無偏整數取樣、狀態失效、雙語介面與無障礙。
- 維護成本：低。核心不依賴外部名單或伺服器；正式網路／儲存檢查仍需在發布站人工驗證。

## 非目標

不做每組人數上限、指定成員／排除關係、抽獎名次、固定種子、歷史紀錄、登入、分享連結、儲存、匯入檔案、通知、雲端計算或可驗證抽籤證明。未來提案必須另立範圍，不得在 M1 靜默加入。

## 閱讀與開發

先讀 [PRODUCT.md](PRODUCT.md)、[TECHNICAL.md](TECHNICAL.md)、[UX-SEO.md](UX-SEO.md) 和 [ACCEPTANCE.md](ACCEPTANCE.md)，再按 [TASKS.md](TASKS.md) 開工；[TASK-ENTRY.md](TASK-ENTRY.md) 提供獨立對話的任務背景與邊界。

使用 Node.js 24+、Node 內建測試和零 runtime／development 依賴：

Git CLI 用於 source ZIP 的獨立 blob 比對與還原回歸；不需要 npm install。瀏覽器工具本身不依賴 Node 或 Git。

Wrangler 的 `.wrangler/` 是本機 CLI 暫存；公開 copy 只取來源白名單，排除這類暫存和建置產物。

- `npm test`
- `npm run check`
- `npm run build`
- `npm run dev`，只綁定 `127.0.0.1:4197`；被占用時使用未占用埠並記錄，不停止既有服務。
- `npm run build:production`，在 `dist/` 產生固定正式 metadata、安全 headers、robots、sitemap 與 404。
- `npm run check:production`，比對完整 production 產物、兩語 canonical/hreflang/JSON-LD、CSP hash 與 Worker 靜態設定。
- `npm run release:check`，檢查專案來源白名單；public copy 另外排除個人機器／聊天 metadata。

固定正式 canonical 為 `https://groups.glossquote.com/index.html` 與 `/en/index.html`。`/`、`/en`、`/en/` 以靜態 redirect 指向對應頁。正式發布前必須先執行 production build/check；預設 build 和原始 public 頁保持 noindex、阻擋 preview robots 並不產生 sitemap。

公開來源目標：[KYStr/glossquote-labs-random-groups](https://github.com/KYStr/glossquote-labs-random-groups)。來源公開、正式部署及首頁入口是分開的狀態；目前狀態見 HANDOFF。localhost 不是正式發布證據。

## 狀態

M1 核心與狀態測試已執行；M2 另有靜態 release／Git ZIP 還原回歸。瀏覽器原生剪貼簿、完整 Network/Storage、真機／讀屏與正式 HTTP 的未驗項仍需依 HANDOFF 分開記錄，不能把 Node、source scan 或本機預覽說成上線／外部驗收。
