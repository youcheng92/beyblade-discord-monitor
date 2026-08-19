# 誠品、Funbox 與 momo 戰鬥陀螺 Discord 監聽機器人

定期讀取誠品線上策展 `CU202310-00113` 的 JSON，篩選 `BEYBLADE`／`戰鬥陀螺` 商品，並在下列情況傳送 Discord Embed：

同時讀取 Funbox Toys 與 momo購物網 Funbox Toys 館的「戰鬥陀螺」分類 JSON。Funbox 與 momo 都直接呼叫網頁前端使用的 JSON API；只有誠品需要本機瀏覽器。

- 策展新增商品
- 商品轉為「可加入購物車」
- 庫存由 0 變成正數
- 狀態、庫存、價格或名稱改變
- 商品從策展 JSON 消失

實際策展 API：

```text
https://athena.eslite.com/api/v1/book_exhibits/CU202310-00113
```

## 1. 建立 Discord Bot

1. 在 Discord Developer Portal 建立 Application 與 Bot，複製 Bot Token。
2. 在 OAuth2 URL Generator 勾選 `bot`，Bot 權限勾選 `View Channels`、`Send Messages`、`Embed Links`，用產生的網址邀請 Bot 進伺服器。
3. Discord 開啟「開發者模式」，在接收通知的頻道按右鍵複製頻道 ID。
4. 本專案不讀取一般聊天訊息，因此不需要開啟 Message Content Intent。

## 2. 安裝與設定

需要 Node.js 20 以上，以及 Microsoft Edge 或 Google Chrome。

```powershell
npm.cmd install
Copy-Item .env.example .env
```

編輯 `.env`，至少填入：

```dotenv
DISCORD_TOKEN=你的BotToken
DISCORD_CHANNEL_ID=戰鬥陀螺上架通知頻道ID
DISCORD_OTHER_CHANNEL_ID=1538802130196889700
```

`new_available`、`available`、`restocked` 會送到 `DISCORD_CHANNEL_ID`；`new`、`changed`、`removed` 以及啟動、錯誤、恢復通知會送到 `DISCORD_OTHER_CHANNEL_ID`。若未設定第二個頻道，為了向下相容，所有通知會送到 `DISCORD_CHANNEL_ID`。

若希望可購買或補貨時標註身分組，再填：

```dotenv
DISCORD_ROLE_MENTION_ID=身分組ID
```

## 3. 執行

```powershell
npm.cmd test
npm.cmd run check:eslite
npm.cmd run check:funbox
npm.cmd run check:momo
npm.cmd start
```

`check:eslite` 不需要 Discord Token，會實際抓取策展 API 並列出符合關鍵字的商品，可用來先確認誠品端是否正常。

`check:funbox` 也不需要 Discord Token，會列出 Funbox 戰鬥陀螺分類目前的商品、狀態與庫存。分類當下沒有商品時，顯示 `0 件` 是正常結果；之後分類新增商品便會通知。

`check:momo` 不需要 Discord Token，會直接呼叫 momo 網頁前端使用的分類 JSON API，不會開啟瀏覽器。該分類當下沒有商品時，顯示 `0 件` 是正常結果；之後新增商品便會通知。

第一次成功讀取時，預設只建立 `.data/state.json` 基準，不會把既有商品全部誤報成新上架。若要測試商品通知，可暫時設定：

```dotenv
NOTIFY_ON_FIRST_RUN=true
```

測試後刪除 `.data/state.json` 再啟動，便會把目前符合關鍵字的商品送到 Discord。

## 誠品瀏覽器模式

誠品來源預設使用 `ESLITE_FETCH_MODE=browser`。程式啟動後會直接開啟本機 Edge，載入策展頁並取得該頁發出的 API JSON，不會先對 API 發出一般 HTTP 請求。

Windows 預設：

```dotenv
BROWSER_CHANNEL=msedge
BROWSER_HEADLESS=false
```

若使用 Chrome：

```dotenv
BROWSER_CHANNEL=chrome
```

若找不到瀏覽器，可用 `BROWSER_EXECUTABLE_PATH` 指定執行檔。目前實測誠品會阻擋無頭 Edge，因此預設使用 `BROWSER_HEADLESS=false`；執行期間會保留一個瀏覽器視窗，可將它最小化，但不要關閉。若未來網站允許無頭模式，再改成 `true`。

## 其他設定

| 變數 | 預設值 | 說明 |
|---|---:|---|
| `KEYWORDS` | `BEYBLADE,戰鬥陀螺` | 逗號分隔；留空監控全部商品 |
| `POLL_INTERVAL_SECONDS` | `60` | 輪詢秒數，最低 15 秒 |
| `MAX_CONSECUTIVE_FAILURES` | `3` | 達到後傳送一次錯誤通知 |
| `STATE_FILE` | `.data/state.json` | 上一次商品快照 |
| `ESLITE_FETCH_MODE` | `browser` | `browser` 直接使用本機瀏覽器；`http` 僅供手動診斷 |
| `NOTIFY_STARTUP` | `true` | 啟動時傳送 Discord 訊息 |

### Funbox 設定

| 變數 | 預設值 | 說明 |
|---|---:|---|
| `FUNBOX_ENABLED` | `true` | 是否啟用 Funbox 監聽 |
| `FUNBOX_CATEGORY_PATH` | `XI/KB` | Funbox 戰鬥陀螺分類路徑 |
| `FUNBOX_PAGE_SIZE` | `100` | 每頁讀取商品數量 |
| `FUNBOX_MAX_PAGES` | `20` | 最多讀取頁數，避免異常無限翻頁 |
| `FUNBOX_STATE_FILE` | `.data/funbox-state.json` | Funbox 上一次商品快照 |

### momo 設定

| 變數 | 預設值 | 說明 |
|---|---:|---|
| `MOMO_ENABLED` | `true` | 是否啟用 momo 監聽 |
| `MOMO_CATEGORY_ID` | `2186500036` | momo Funbox Toys 館戰鬥陀螺分類 ID |
| `MOMO_API_URL` | `/api/moecapp/getCategoryGoodsV3` | momo 網頁前端分類 JSON 端點 |
| `MOMO_API_VERSION` | `2608.1.6` | 前端 API 的 `version` 標頭；網站改版時可能需要更新 |
| `MOMO_CATE_LEVEL` | `3` | 目標分類層級 |
| `MOMO_PAGE_SIZE` | `80` | 每頁讀取商品數量 |
| `MOMO_MAX_PAGES` | `10` | 最多讀取頁數，避免異常無限翻頁 |
| `MOMO_POLL_INTERVAL_SECONDS` | `60` | momo 輪詢秒數，最低 60 秒 |
| `MOMO_BACKOFF_SECONDS` | `600` | 收到 403／406／429 時停止請求的秒數 |
| `MOMO_STATE_FILE` | `.data/momo-state.json` | momo 上一次商品快照 |

請避免過短的輪詢間隔。momo 端點是網站內部前端 API，不是對外保證相容性的正式 API；若日後 `version` 標頭或回傳欄位改變，需要同步更新設定或解析方式。
