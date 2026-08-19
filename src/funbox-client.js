const DEFAULT_HEADERS = {
  accept: 'application/json, text/plain, */*',
  'accept-language': 'zh-TW,zh;q=0.9,en;q=0.8',
  'cache-control': 'no-cache',
  pragma: 'no-cache',
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
};

export class FunboxClient {
  constructor(config) {
    this.config = config;
  }

  async fetchData() {
    const products = [];

    for (let page = 1; page <= this.config.maxPages; page += 1) {
      const pageProducts = await this.#fetchPage(page);
      products.push(
        ...pageProducts.map((product) => ({
          ...product,
          __source: 'funbox',
          __baseUrl: this.config.baseUrl,
        })),
      );

      if (pageProducts.length < this.config.pageSize) break;
      if (page === this.config.maxPages) {
        throw new Error(
          `Funbox 商品超過 ${this.config.maxPages} 頁，請提高 FUNBOX_MAX_PAGES`,
        );
      }
    }

    return { products };
  }

  async #fetchPage(page) {
    const categoryPath = this.config.categoryPath
      .split('/')
      .filter(Boolean)
      .map(encodeURIComponent)
      .join('/');
    const url = new URL(
      `/category_products/${categoryPath}.json`,
      this.config.baseUrl,
    );
    url.searchParams.set('limit', String(this.config.pageSize));
    url.searchParams.set('page', String(page));
    url.searchParams.set('sort_by', 'sell_from-desc');

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.requestTimeoutMs,
    );

    try {
      const response = await fetch(url, {
        headers: {
          ...DEFAULT_HEADERS,
          referer: new URL(
            `/categories/${categoryPath}`,
            this.config.baseUrl,
          ).toString(),
        },
        signal: controller.signal,
      });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(`Funbox 商品 API 回傳 HTTP ${response.status}`);
      }

      let payload;
      try {
        payload = JSON.parse(text);
      } catch (error) {
        throw new Error(`Funbox API 回傳的內容不是有效 JSON：${error.message}`);
      }
      if (!Array.isArray(payload)) {
        throw new Error('Funbox 商品 API 格式異常：預期收到商品陣列');
      }
      return payload;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error(`Funbox API 請求超過 ${this.config.requestTimeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async close() {}
}
