# 名單隨機分組來源交接

狀態：M1_PRIMARY_PASS / M2_SOURCE_CANDIDATE / NOT_DEPLOYED。公開來源供審查；Cloudflare hosting、雙語首頁與外部複驗仍由整合里程碑驗證。

Node24.14.0：57/57自動測試、check、preview build、production build/check及38項source check PASS。production為11項靜態allowlist，固定groups.glossquote.com雙語canonical/hreflang/x-default/OG/JSON-LD、robots/sitemap、精確CSP hash與真404設定。預覽保持noindex且無sitemap。已有Wrangler4.147.0本地schema與隔離dry-run exit0；未上傳／部署，不將CLI或任何credential納入source。

M1主代理獨立固定副本53/53及代表性真Edge操作PASS，作者另真Chrome/Edge兩語B02–B06、500人邊界、320px密集列表及鍵盤核心路徑。瀏覽器完整engine版本、原生clipboard編輯器貼上、真browserAPI缺失／拒絕／競態注入、完整Network/Storage、實際BFCache命中、額外純鍵盤錯誤恢復、原生200%zoom、停用JS、reduce-motion切換、真機／讀屏及正式HTTP/首頁都未完整驗證，保持逐項PARTIAL/NOT_RUN；Node harness／source scan／UI提示不能代替。

來源只用本工具38項allowlist，無dist、node_modules、.runs、credential、私人名單或兄弟工具。固定Git HEAD ZIP需逐entry比對Git blob bytes/hash，安全解壓到全新owned目錄後重test/check/build/production check；Gitarchive命令暫用core.autocrlf=false和core.eol=lf，不改global設定。Windows持久環境已監測，無系統設定變更。

主代理在來源固定後才整合免費Cloudflare與首頁。未經使用者／外部驗收者確認，不標產品版本complete；後續修正回原功能對話。完整工作紀錄保留在原開發workspace的追加證據，公開copy不含私有聊天或機器metadata。
