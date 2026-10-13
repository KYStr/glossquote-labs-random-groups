# 使用流程與 SEO 規格：名單隨機分組

狀態：**SPEC_ONLY**。介面模式是 **Product App**：首屏直接完成貼名單與分組，不用 SaaS hero 或假資料取代空狀態。沿用 `docs/DESIGN-SYSTEM.md`；主要工作物是使用者貼入的名單及產生的完整分組。

## 工作層級

- **一直可見：**名單欄位、人數／忽略空行提示、組數欄、同名提示、本機處理提示、主按鈕。
- **貼近結果：**每組標題、人數、每位參與者和「複製分組」；複製失敗時就在結果旁提供可選取文字。
- **次要操作：**「載入範例」、「清除」、語言切換、返回 GlossQuote 首頁。不要把進階選項藏起來，因首版沒有進階選項。

## 線框

桌面首屏（空狀態）：

```text
┌────────────────────────────── 名單隨機分組 ─────────────────────────────┐
│ GlossQuote                                        繁中 / English       │
├────────────────────────────────────────────────────────────────────────┤
│ 把名單分成幾組                                      工具在瀏覽器本機處理 │
│ 每行一人；2–500 人；空白行忽略；同名視為不同人。                         │
│ ┌──────────────────────────────┐   ┌──────────┐                         │
│ │ 貼上或輸入名單               │   │ 組數     │                         │
│ │                              │   │ 2        │                         │
│ │                              │   └──────────┘                         │
│ └──────────────────────────────┘   共 0 人 · 忽略 0 行                 │
│ [產生分組]    [載入假名單]    [清除]                                    │
├──────────────────────────────── 結果 ──────────────────────────────────┤
│ 還沒有分組。貼上至少兩位參與者的名單，再選擇組數。                        │
└────────────────────────────────────────────────────────────────────────┘
```

成功後，結果區取代空狀態，完整列出組別、人數和名字序號；桌面可兩欄排組，但不能改變組別順序。最多 50 組時，所有組仍可順序閱讀。

手機直向：

```text
┌───────────────────────────┐
│ 名單隨機分組   繁中 / EN  │
├───────────────────────────┤
│ 貼上名單                   │
│ ┌───────────────────────┐ │
│ │ 一行一人               │ │
│ └───────────────────────┘ │
│ 共 N 人 · 忽略 M 行         │
│ 組數 [ 2 ]                  │
│ 同名會視為不同人            │
│ [ 產生分組 ]                │
│ 載入假名單       清除       │
├───────────────────────────┤
│ 第 1 組（3 人）             │
│ 姓名（#1）                  │
│ ...                        │
│ 第 2 組（2 人）             │
│ ...                        │
│ [ 複製分組 ]                │
└───────────────────────────┘
```

## 雙語可見文案

| 狀態／控制 | 繁體中文 | English |
|---|---|---|
| 瀏覽器標題 | 名單隨機分組｜GlossQuote | Random Group Generator \| GlossQuote |
| H1 | 名單隨機分組 | Random group generator |
| 說明 | 貼上每行一人的名單，選擇組數，讓每位參與者剛好分到一組。 | Paste one person per line, choose a number of groups, and assign each participant exactly once. |
| 名單標籤 | 參與者名單（一行一人） | Participant list (one person per line) |
| 組數標籤 | 組數 | Number of groups |
| 空行提示 | 空白行會忽略。 | Blank lines are ignored. |
| 重名提示 | 同名會視為不同的人，結果會附上序號。 | Duplicate names stay separate and include an ID. |
| 本機提示 | 名單只在此頁面記憶體處理；不會保存或送出。 | The list is processed in this page; it is not saved or sent. |
| 初始 CTA | 產生分組 | Generate groups |
| 成功後 CTA | 重新分組 | Regroup |
| 範例 | 載入假名單 | Load sample names |
| 清除 | 清除 | Clear |
| 結果空狀態 | 還沒有分組。貼上至少兩位參與者的名單，再選擇組數。 | No groups yet. Paste at least two participants and choose a group count. |
| ignored | 共 {N} 人 · 忽略 {M} 行 | {N} people · {M} blank lines ignored |
| copy | 複製分組 | Copy groups |
| copy fallback | 複製功能不可用。請選取下方文字後手動複製。 | Clipboard access is unavailable. Select the text below and copy it manually. |
| random failure | 無法取得隨機值，因此沒有產生或保留分組。請再試一次；若持續發生，請改用支援瀏覽器密碼學 API 的瀏覽器。 | Random values are unavailable, so no groups were produced or kept. Try again, or use a browser with the Web Crypto API. |
| 範例標示 | 下列姓名是示範用假資料，尚未分組。 | These names are sample data and have not been grouped. |

名稱驗證錯誤只包含固定解釋和行號，例如「第 4 行有控制字元，請移除後再試。」／“Line 4 contains a control character. Remove it and try again.” 不回顯該行姓名。

## SEO 文案

繁中頁：

- `title`：名單隨機分組｜GlossQuote
- `meta description`：貼上名單並指定組數，在瀏覽器本機隨機分組。忽略空白行、保留同名成員，讓各組人數最多差一人。
- 可見介紹：將活動或課程名單分成指定組數，檢查每組完整成員與人數；重新分組前保留原名單，任何輸入改動都會清除舊結果。

英文頁：

- `title`：Random Group Generator | GlossQuote
- `meta description`：Paste a roster and choose a group count to split it locally in your browser. Blank lines are ignored, duplicate names stay distinct, and group sizes differ by at most one.
- Visible introduction: Split an event or class roster into the group count you choose. Review every member and group size; editing the inputs clears the previous result.

以上 title、description 與可見文案必須互相一致。不得堆疊不自然關鍵字、聲稱熱門、保證公平或編造使用數據。

## FAQ（兩語都必須完整呈現）

1. **我可以貼上多少人？** 2 至 500 人；每人一行。最多 60,000 UTF-16 code units 的原始名單；姓名 trim 後最多 100 code units。
2. **同名的人會合併嗎？** 不會。每個非空輸入列都有獨立序號，例如「小明（#2）」和「小明（#5）」。請確認這些列確實代表不同參與者。
3. **每組人數會完全相同嗎？** 盡可能平均；不能整除時，前幾組各多一人，所以最多相差一人。
4. **結果是可以公證或稽核的抽籤嗎？** 不是。工具使用瀏覽器密碼學亂數 API 和無偏取樣程式，但不提供 seed、外部見證或可重現稽核證明，也不保證連續結果不同。
5. **名單會上傳或保存嗎？** 工具程式不傳送也不保存名單，關閉或離開頁面會清除目前工作。載入網站本身仍會連到託管主機，主機會收到一般頁面請求資訊；正式 Network/Storage 行為需在上線版本實測。
6. **複製按鈕不能用怎麼辦？** 結果仍可在頁面選取；瀏覽器拒絕剪貼簿寫入時，工具提供唯讀文字供你手動複製。

英文 FAQ 必須逐題翻譯並保留相同範圍，不能只有英文摘要。FAQ 不含未證明的公平、流量或支援承諾。

## 正式 SEO 與預覽

- M1 每個預覽頁 `robots=noindex,nofollow`，本機 HTTP 可另外回 `X-Robots-Tag: noindex, nofollow`。預覽不得混入索引 sitemap。
- M2 固定正式 URL：`https://groups.glossquote.com/index.html` 和 `https://groups.glossquote.com/en/index.html`。各自 self canonical；兩頁都提供互返 `zh-Hant`、`en` 與 `x-default`，x-default 指繁中正式頁。
- Production robots 允許正式頁並指向 `https://groups.glossquote.com/sitemap.xml`；sitemap 僅含兩個 canonical URL。
- 靜態 JSON-LD `WebApplication` 只用可見名稱、描述、正式 URL、語言及工具類別；不加入 aggregateRating、review、虛構評論或未驗證 claims。CSP 必須對靜態 JSON-LD 採精確內容 hash 或等效安全設定，不開 `unsafe-inline`/`unsafe-eval`。
- production canonical/robots/sitemap/structured data/headers 只有以正式來源真實部署後才可標 PASS。M3 的主代理需驗正式 HTTP、雙語頁和首頁往返連結；目前都 NOT_RUN。
