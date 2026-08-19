const DEFAULT_HEADERS = {
  accept: 'application/json, text/plain, */*',
  'accept-language': 'zh-TW,zh;q=0.9,en;q=0.8',
  'cache-control': 'no-cache',
  pragma: 'no-cache',
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
};

export class HttpStatusError extends Error {
  constructor(status, url, bodySnippet = '') {
    super(`誠品 API 回傳 HTTP ${status}`);
    this.name = 'HttpStatusError';
    this.status = status;
    this.url = url;
    this.bodySnippet = bodySnippet;
  }
}

export class EsliteClient {
  constructor(config, logger = console) {
    this.config = config;
    this.logger = logger;
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  async fetchExhibit() {
    return this.config.fetchMode === 'http'
      ? this.#fetchWithHttp()
      : this.#fetchWithBrowser();
  }

  async fetchData() {
    return this.fetchExhibit();
  }

  async #fetchWithHttp() {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.requestTimeoutMs,
    );

    try {
      const response = await fetch(this.config.apiUrl, {
        headers: {
          ...DEFAULT_HEADERS,
          origin: 'https://www.eslite.com',
          referer: this.config.pageUrl,
          ...this.config.extraHeaders,
        },
        signal: controller.signal,
      });
      const text = await response.text();
      if (!response.ok) {
        throw new HttpStatusError(response.status, response.url, text.slice(0, 300));
      }
      return parseJson(text, this.config.apiUrl);
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error(`誠品 API 請求超過 ${this.config.requestTimeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async #openBrowser() {
    if (this.browser) return;

    let chromium;
    try {
      ({ chromium } = await import('playwright-core'));
    } catch (error) {
      throw new Error(`無法載入 playwright-core：${error.message}`);
    }

    const launchOptions = {
      headless: this.config.browserHeadless,
    };
    if (this.config.browserExecutablePath) {
      launchOptions.executablePath = this.config.browserExecutablePath;
    } else if (this.config.browserChannel) {
      launchOptions.channel = this.config.browserChannel;
    }

    try {
      this.browser = await chromium.launch(launchOptions);
    } catch (error) {
      throw new Error(
        `無法啟動瀏覽器（channel=${this.config.browserChannel}）。` +
          `請在 .env 改用 chrome，或設定 BROWSER_EXECUTABLE_PATH。原始錯誤：${error.message}`,
      );
    }

    this.context = await this.browser.newContext({
      locale: 'zh-TW',
      serviceWorkers: 'block',
      extraHTTPHeaders: this.config.extraHeaders,
    });

    await this.context.route('**/*', async (route) => {
      const request = route.request();
      const resourceType = request.resourceType();
      const hostname = new URL(request.url()).hostname;
      const isEslite =
        hostname === 'www.eslite.com' || hostname === 'athena.eslite.com';

      if (
        ['image', 'media', 'font'].includes(resourceType) ||
        (!isEslite && ['script', 'xhr', 'fetch'].includes(resourceType))
      ) {
        await route.abort();
        return;
      }
      await route.continue();
    });

    this.page = await this.context.newPage();
    this.page.setDefaultTimeout(this.config.requestTimeoutMs);
    this.page.setDefaultNavigationTimeout(this.config.requestTimeoutMs);
  }

  async #fetchWithBrowser() {
    await this.#openBrowser();

    const responsePromise = this.page.waitForResponse(
      (response) =>
        response.request().method() === 'GET' &&
        response.url().split('?')[0] === this.config.apiUrl.split('?')[0],
      { timeout: this.config.requestTimeoutMs },
    );

    const navigationPromise = this.page.url().startsWith(this.config.pageUrl)
      ? this.page.reload({ waitUntil: 'domcontentloaded' })
      : this.page.goto(this.config.pageUrl, { waitUntil: 'domcontentloaded' });

    let response;
    try {
      [response] = await Promise.all([responsePromise, navigationPromise]);
    } catch (error) {
      const hint = this.config.browserHeadless
        ? ' 誠品可能擋下無頭瀏覽器，請設定 BROWSER_HEADLESS=false。'
        : '';
      throw new Error(`瀏覽器未能取得誠品 API 回應：${error.message}${hint}`);
    }

    const text = await response.text();
    if (!response.ok()) {
      throw new HttpStatusError(response.status(), response.url(), text.slice(0, 300));
    }
    return parseJson(text, response.url());
  }

  async close() {
    await this.context?.close().catch(() => {});
    await this.browser?.close().catch(() => {});
    this.context = null;
    this.browser = null;
    this.page = null;
  }
}

function parseJson(text, url) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${url} 回傳的內容不是有效 JSON：${error.message}`);
  }
}
