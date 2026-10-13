# 名單隨機分組開發入口

原生 HTML/CSS/ESM，Node 24+，零 runtime/development 依賴。先讀 AGENTS、PRODUCT、TECHNICAL、UX-SEO、ACCEPTANCE 與 TASKS。M1 已通過主代理驗收；M2 是正式靜態產物與 public source 候選，hosting 和外部複驗仍待整合。

執行 `npm test`、`npm run check`、`npm run build`、`npm run dev`。預覽僅127.0.0.1:4197，noindex；部署產物必須用 `npm run build:production`、`npm run check:production`。`npm run release:check` 檢查38項source allowlist。完整限制與未驗項见HANDOFF。
