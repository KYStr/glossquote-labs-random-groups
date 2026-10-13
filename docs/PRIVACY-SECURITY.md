# 本機名單資料與安全契約

姓名可能是個人資料。本工具在頁面執行時只將名單原稿、解析結果、隨機分組和 copy 狀態放在該頁面的 JavaScript 記憶體／DOM；不使用 `localStorage`、`sessionStorage`、IndexedDB、Cache API、cookies、Service Worker、URL/history、伺服器資料庫或雲端同步。Clear 和 `pagehide` 清除所有輸入、結果、copy fallback 與 JS 引用。清除不保證覆寫作業系統所有記憶體、OS clipboard 或瀏覽器內部記憶體。

程式運算完全在使用者瀏覽器本機。除載入網站所需的同源 HTML/CSS/ES modules 外，不呼叫 fetch/XHR/WebSocket/EventSource/beacon/API、analytics 或外部字型。網站載入本身仍會連到託管服務，主機可看見一般 HTTP 請求資訊；不得宣稱整個網站「完全沒有網路」。正式檢查需觀察完整 Network 與 Storage，包含同源 `/cdn-cgi/rum`，並檢查页面載入後、輸入、產生、複製、hidden 狀態。

名單是不可信輸入。以 `value`/text node 渲染，禁止 innerHTML/eval/new Function/把姓名放到 URL、console、HTTP headers 或 logs。Core 錯誤使用固定 code，最多回傳整數行號，不顯示 raw exception、原始行或 stack。測試只用明確假名字。

建議正式安全 headers：`default-src 'none'; script-src 'self' 'sha256-<exact static JSON-LD hash>'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`，並加 `X-Content-Type-Options: nosniff`、`Referrer-Policy: no-referrer` 和只關閉產品不使用的權限之 Permissions-Policy。JSON-LD 是唯一預期 inline structured data，build 必須對固定 bytes 計算精確 CSP hash；不要改成 `unsafe-inline` 或 `unsafe-eval`。M1 local server 是 preview，不能冒充 production header 測量。

Clipboard 寫入僅由使用者直接按「複製分組」觸發，內容是目前完整純文字結果。工具從不讀取系統 clipboard；拒絕時提供可選取唯讀文字。Page JS 無法取消已提交給 OS 的 clipboard promise，因此只用 revision guard 防止舊完成狀態污染目前畫面，不能宣稱撤回已送出的 clipboard write。

功能對話不得讀憑證或其他帳號狀態。公開 source 不含 `.runs`、dist、node_modules、環境檔、憑證、瀏覽器資料、私有驗收名單或根 repo/兄弟工具。
