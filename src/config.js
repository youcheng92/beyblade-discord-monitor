import path from 'node:path';

function parseBoolean(value, fallback) {
  if (value == null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function parseInteger(value, fallback, minimum = Number.MIN_SAFE_INTEGER) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? Math.max(parsed, minimum) : fallback;
}

function parseJsonObject(value, name) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
      throw new TypeError('必須是 JSON 物件');
    }
    return parsed;
  } catch (error) {
    throw new Error(`${name} 格式錯誤：${error.message}`);
  }
}

export function createConfig(env = process.env) {
  const exhibitId = env.ESLITE_EXHIBIT_ID || 'CU202310-00113';
  const token = env.DISCORD_TOKEN?.trim();
  const channelId = env.DISCORD_CHANNEL_ID?.trim();
  const otherChannelId =
    env.DISCORD_OTHER_CHANNEL_ID?.trim() || channelId;
  const momoBaseUrl =
    env.MOMO_BASE_URL?.trim() || 'https://www.momoshop.com.tw';
  const momoCategoryId = env.MOMO_CATEGORY_ID?.trim() || '2186500036';

  if (!token) throw new Error('缺少 DISCORD_TOKEN，請先設定 .env');
  if (!channelId) throw new Error('缺少 DISCORD_CHANNEL_ID，請先設定 .env');

  const fetchMode = (env.ESLITE_FETCH_MODE || 'browser').toLowerCase();
  if (!['http', 'browser'].includes(fetchMode)) {
    throw new Error('ESLITE_FETCH_MODE 只能是 http 或 browser');
  }

  return {
    discord: {
      token,
      channelId,
      otherChannelId,
      roleMentionId: env.DISCORD_ROLE_MENTION_ID?.trim() || null,
      notifyStartup: parseBoolean(env.NOTIFY_STARTUP, true),
    },
    eslite: {
      exhibitId,
      apiUrl:
        env.ESLITE_API_URL?.trim() ||
        `https://athena.eslite.com/api/v1/book_exhibits/${exhibitId}`,
      pageUrl:
        env.ESLITE_PAGE_URL?.trim() ||
        `https://www.eslite.com/exhibitions/${exhibitId}`,
      fetchMode,
      extraHeaders: parseJsonObject(
        env.ESLITE_EXTRA_HEADERS_JSON,
        'ESLITE_EXTRA_HEADERS_JSON',
      ),
      requestTimeoutMs: parseInteger(env.REQUEST_TIMEOUT_MS, 30_000, 5_000),
      browserChannel: env.BROWSER_CHANNEL?.trim() || 'msedge',
      browserExecutablePath: env.BROWSER_EXECUTABLE_PATH?.trim() || null,
      browserHeadless: parseBoolean(env.BROWSER_HEADLESS, false),
    },
    monitor: {
      sourceName: '誠品線上',
      keywords: (env.KEYWORDS ?? 'BEYBLADE,戰鬥陀螺')
        .split(',')
        .map((keyword) => keyword.trim())
        .filter(Boolean),
      pollIntervalMs:
        parseInteger(env.POLL_INTERVAL_SECONDS, 60, 15) * 1_000,
      maxConsecutiveFailures: parseInteger(
        env.MAX_CONSECUTIVE_FAILURES,
        3,
        1,
      ),
      notifyOnFirstRun: parseBoolean(env.NOTIFY_ON_FIRST_RUN, false),
      stateFile: path.resolve(env.STATE_FILE?.trim() || '.data/state.json'),
    },
    funbox: {
      enabled: parseBoolean(env.FUNBOX_ENABLED, true),
      sourceName: 'Funbox Toys',
      baseUrl: env.FUNBOX_BASE_URL?.trim() || 'https://shop.funbox.com.tw',
      categoryPath: env.FUNBOX_CATEGORY_PATH?.trim() || 'XI/KB',
      pageSize: parseInteger(env.FUNBOX_PAGE_SIZE, 100, 1),
      maxPages: parseInteger(env.FUNBOX_MAX_PAGES, 20, 1),
      requestTimeoutMs: parseInteger(
        env.FUNBOX_REQUEST_TIMEOUT_MS,
        30_000,
        5_000,
      ),
      pollIntervalMs:
        parseInteger(env.POLL_INTERVAL_SECONDS, 60, 15) * 1_000,
      maxConsecutiveFailures: parseInteger(
        env.MAX_CONSECUTIVE_FAILURES,
        3,
        1,
      ),
      notifyOnFirstRun: parseBoolean(env.NOTIFY_ON_FIRST_RUN, false),
      stateFile: path.resolve(
        env.FUNBOX_STATE_FILE?.trim() || '.data/funbox-state.json',
      ),
    },
    momo: {
      enabled: parseBoolean(env.MOMO_ENABLED, true),
      sourceName: 'momo購物網 Funbox Toys 館',
      baseUrl: momoBaseUrl,
      categoryId: momoCategoryId,
      pageUrl:
        env.MOMO_PAGE_URL?.trim() ||
        `${momoBaseUrl}/categories/${momoCategoryId}`,
      apiUrl:
        env.MOMO_API_URL?.trim() ||
        `${momoBaseUrl}/api/moecapp/getCategoryGoodsV3`,
      apiVersion: env.MOMO_API_VERSION?.trim() || '2608.1.6',
      cateLevel: env.MOMO_CATE_LEVEL?.trim() || '3',
      pageSize: parseInteger(env.MOMO_PAGE_SIZE, 80, 1),
      maxPages: parseInteger(env.MOMO_MAX_PAGES, 10, 1),
      requestTimeoutMs: parseInteger(
        env.MOMO_REQUEST_TIMEOUT_MS,
        30_000,
        5_000,
      ),
      backoffMs:
        parseInteger(env.MOMO_BACKOFF_SECONDS, 600, 60) * 1_000,
      pollIntervalMs:
        parseInteger(env.MOMO_POLL_INTERVAL_SECONDS, 60, 60) * 1_000,
      maxConsecutiveFailures: parseInteger(
        env.MAX_CONSECUTIVE_FAILURES,
        3,
        1,
      ),
      notifyOnFirstRun: parseBoolean(env.NOTIFY_ON_FIRST_RUN, false),
      stateFile: path.resolve(
        env.MOMO_STATE_FILE?.trim() || '.data/momo-state.json',
      ),
    },
  };
}
