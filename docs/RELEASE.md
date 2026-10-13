# 名單隨機分組發布契約

M1 只建立可操作的本機預覽，不部署。主代理 M1 驗收通過後，M2 建立可重現的正式建置、雙語 SEO、安全 headers 和 public source。正式 origin 固定為 `https://groups.glossquote.com`；訪客 Host、query 或輸入不得決定 metadata。既有 GitHub public source 和免費 Cloudflare 授權仍須遵守主專案 contract。公開來源不是自動授予軟體 license；本工具不可未經主代理批准添加 license 文件。

## Routes 與索引

- 繁中 `/index.html` 的 canonical 是 `https://groups.glossquote.com/index.html`。
- 英文 `/en/index.html` 的 canonical 是 `https://groups.glossquote.com/en/index.html`。
- 兩頁互相列出 `hreflang="zh-Hant"`、`hreflang="en"` 和 `hreflang="x-default"`；x-default 指繁中 canonical。每個 hreflang 目標都在真實正式站可達。
- Production `robots.txt` 允許以上正式頁並指向 `https://groups.glossquote.com/sitemap.xml`。Sitemap 只列 canonical 雙語 URL；不收錄 preview、query、404 或草稿。
- Preview 保持 meta robots `noindex,nofollow`、HTTP `X-Robots-Tag: noindex, nofollow` 並以 `Disallow: /` 的預覽 robots 阻止爬取；preview 不提供索引 sitemap。Production build 不得包含 noindex/preview robots。
- 兩語 title、description、H1、Open Graph 語言、可見 FAQ 和 JSON-LD 必須互相一致。WebApplication JSON-LD 不含 rating/review 或未驗證隨機公平聲明；靜態 JSON-LD CSP 用精確 hash。

## 靜態安全交付

M2 的 production build 只部署審核過的 dist allowlist。真正 404 回 404，不做 SPA fallback；HTML/CSS/JS/XML/TXT 回正確 MIME。建議安全 headers 見 `PRIVACY-SECURITY.md`。頁面本身沒有 runtime endpoint，不在 server 計算或保存名單。正式服務不得靠寬鬆 CSP 解決腳本問題。

## Source repository

預定公開 repository：`https://github.com/KYStr/glossquote-labs-random-groups`。只有 M1 主代理驗收與 M2 release checks 完成才發布。用 reviewed project-only copy 和 allowlist；不 force push、不操作 root checkout、不發布 `.runs`、node_modules、dist、私人輸入、憑證或兄弟工具。記錄 remote public visibility、固定 HEAD commit、每個 source blob bytes/hash 和可還原 ZIP 的驗證結果。不要印 credential/token。

## 主代理 M3 整合

主代理使用已授權免費 Cloudflare 流程部署至 `groups.glossquote.com`，核對部署版本與 source commit、HTTP status/headers、正式 robots/sitemap、metadata/structured data、雙語導航、實際分組/clipboard、完整 Network/Storage，特別檢查同源 `/cdn-cgi/rum`。確認 live release 後，主代理才將 `random-groups` 加入 `tool-projects/00-home/catalog.json` published，重建/驗證雙語首頁，發布首頁來源並核對正式頁。工具對話不得改共用首頁或直接讀 Cloudflare token。

候選 source push、正式部署與首頁上線是三件事，分別記錄。外部驗收交付狀態為「已上線，待外部複驗」；收到報告後回原對話返工並重新固定 source/deploy commit。未經使用者或驗收者確認，不標該版本完成。

## M2 已實作的離線產物契約

預設 `npm run build` 產生 preview：原始兩語頁保留 noindex/nofollow、preview robots、preview `_headers`，不含 canonical、JSON-LD、sitemap 或正式 redirects。`npm run build:production` 在相同 gitignored `dist/` 產生 11 個固定 allowlist 檔；`npm run check:production` 逐內容比對固定 origin、canonical/hreflang/x-default、OG、僅可見資料的 WebApplication JSON-LD、兩個 canonical sitemap URL 和精確 CSP hash。已知 mode 產物可安全切換；未知 stale 檔、hardlink/junction 仍拒絕，build 不遞迴刪 dist。

`wrangler.jsonc` 是 assets-only Worker，無 main／bindings／server-side 計算；日期固定 2026-10-13，html_handling=none、not_found_handling=404-page，根與英文短路徑用 `_redirects` 301 導向完整 index.html。404 的 stylesheet 和工具入口使用根相對路徑，深層未知 URL 也可回到工具。workers.dev／preview URLs 關閉；observability logs/traces 關閉，依較嚴格的產品隱私契約。`_headers` 使用嚴格 CSP、nosniff、no-referrer、DENY 和未用功能的 Permissions-Policy。這些是靜態產物／配置驗證，真正 Cloudflare status/MIME/headers 仍需 M3。

官方依據：[靜態 headers](https://developers.cloudflare.com/workers/static-assets/headers/)、[HTML handling](https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/)、[404 routing](https://developers.cloudflare.com/workers/static-assets/routing/static-site-generation/)、[dry-run](https://developers.cloudflare.com/workers/wrangler/commands/workers/)。Wrangler 檢查使用已存在、主代理核准的 4.147.0 CLI 與本地 schema，不把 CLI 加到本工具 dependencies、不在公開 source 寫機器絕對路徑、不讀 token。只有 task-owned process-local profile/temp/log/outdir，禁止實際 deploy。

公開 copy 由 `scripts/release.mjs` 的 38 項 source allowlist 審查，不複製 .runs、dist、node_modules、.git 或未知檔；private chat／本機狀態文件換成公開摘要，runtime/test/tooling bytes 保持一致。此 source check 是有限篩查，不能證明任意混淆 JS 無網路，也不取代真 Network/Storage。

Git ZIP 用固定 HEAD 和 `git -c core.autocrlf=false -c core.eol=lf archive --format=zip`，只暫時關閉 Git 的 working-tree 換行轉換。不得改全域 Git 設定。`verifySourceZip` 檢查 commit comment、path/size/CRC/普通 DOS 或 Unix file mode、source allowlist，再逐 entry 對固定 Git blob bytes/hash；解壓只到全新的已核准 owned 子目錄，既有目的地拒絕，之後重新 test/check/build/production check。正常 Git ZIP 的非執行檔可有 DOS attr=0、目錄 attr=16，不能誤當 symlink；任何 symlink mode 仍拒絕。
