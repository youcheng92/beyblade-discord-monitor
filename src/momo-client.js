const EMPTY_RESULT_CODE = '40006';

export class MomoClient {
  constructor(config) {
    this.config = config;
    this.nextRequestAt = 0;
  }

  async fetchData() {
    if (Date.now() < this.nextRequestAt) {
      throw new Error(
        `momo API 暫停請求至 ${new Date(this.nextRequestAt).toLocaleString('zh-TW', {
          timeZone: 'Asia/Taipei',
          hour12: false,
        })}`,
      );
    }

    const products = [];
    for (let page = 1; page <= this.config.maxPages; page += 1) {
      const pageProducts = await this.#fetchPage(page);
      products.push(...pageProducts);

      if (pageProducts.length < this.config.pageSize) break;
      if (page === this.config.maxPages) {
        throw new Error(
          `momo 商品超過 ${this.config.maxPages} 頁，請提高 MOMO_MAX_PAGES`,
        );
      }
    }

    return { products };
  }

  async #fetchPage(page) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.requestTimeoutMs,
    );

    try {
      const response = await fetch(this.config.apiUrl, {
        method: 'POST',
        headers: {
          accept: 'application/json, text/plain, */*',
          'accept-language': 'zh-TW,zh;q=0.9,en;q=0.8',
          'content-type': 'application/json',
          origin: this.config.baseUrl,
          referer: this.config.pageUrl,
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-origin',
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
          version: this.config.apiVersion,
        },
        body: JSON.stringify(buildMomoRequest(this.config, page)),
        signal: controller.signal,
      });

      if (!response.ok) {
        this.#applyBackoff(response);
        throw new Error(`momo API 回傳 HTTP ${response.status}`);
      }

      const payload = await response.json();
      const resultCode = String(payload?.resultCode ?? '');
      const goods = payload?.rtnGoodsData?.goodsInfoList;

      if (payload?.success === false && resultCode === EMPTY_RESULT_CODE) {
        return [];
      }
      if (payload?.success !== true || !Array.isArray(goods)) {
        throw new Error(
          `momo API 回傳格式異常（resultCode=${resultCode || '未知'}）`,
        );
      }

      return normalizeMomoGoods(goods, this.config.baseUrl);
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error(
          `momo API 請求超過 ${this.config.requestTimeoutMs}ms`,
        );
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  #applyBackoff(response) {
    if (![403, 406, 429].includes(response.status)) return;

    const retryAfter = Number.parseInt(
      response.headers.get('retry-after') || '',
      10,
    );
    const delayMs = Number.isFinite(retryAfter)
      ? Math.max(retryAfter, 60) * 1_000
      : this.config.backoffMs;
    this.nextRequestAt = Date.now() + delayMs;
  }

  async close() {}
}

export function buildMomoRequest(config, page = 1) {
  return {
    host: 'web',
    data: {
      curPage: String(page),
      cateCode: config.categoryId,
      searchType: '3',
      isSpecialSortType: false,
      cateLevel: config.cateLevel,
      salesSort: '',
      custNo: '',
      imgType: 'webp',
      sortType: '3',
      priceS: '',
      priceE: '',
      commentRate: '',
      brandCode: [],
      brandName: [],
      indexInfoList: [],
      brandSeriesList: [],
      ecTagNos: [],
      first: '',
      freeze: '',
      prefere: '',
      NAM: '',
      cod: '',
      superstorePay: '',
      moCoinFeedback: '',
      superstoreFree: '',
      fast58: '',
      cp: '',
      video: '',
      stockYN: '',
      tvshop: '',
      cycle: '',
      cateType: '',
      has3P: '',
      discount: '',
      crossStoreDiscount: '',
      superstore: '',
      entpCode: '',
      specialSortType: '',
      specialGoodsType: '',
      tempSpecialSortType: '',
      dispCnt: String(config.pageSize),
      moProYN: '0',
    },
  };
}

export function normalizeMomoGoods(goods, baseUrl = 'https://www.momoshop.com.tw') {
  const products = new Map();

  for (const item of goods || []) {
    const id = String(item?.goodsCode ?? '').trim();
    const name = String(item?.goodsName ?? '').trim();
    if (!id || !name) continue;

    const stock = normalizeNumber(item.goodsStock);
    const statusText = [
      item.onSaleDescription,
      item.goodsPriceModel?.basePrice?.goodsStatus,
    ]
      .filter(Boolean)
      .join(' ');
    const unavailable = stock === 0 || /售完|缺貨|補貨中/.test(statusText);

    products.set(id, {
      __source: 'momo',
      __baseUrl: baseUrl,
      id,
      title: name,
      status: unavailable ? 'not_add_to_notice' : 'add_to_shopping_cart',
      stock,
      price: normalizeNumber(
        item.goodsPriceModel?.basePrice?.price ??
          item.goodsPrice ??
          item.SALE_PRICE,
      ),
      photo: String(item.imgUrl ?? item.imgUrlArray?.[0] ?? ''),
      url: `/goods/GoodsDetail.jsp?i_code=${encodeURIComponent(id)}`,
      description: String(item.goodsSubName ?? ''),
    });
  }

  return [...products.values()];
}

function normalizeNumber(value) {
  if (value == null || value === '') return null;
  const number = Number(String(value).replaceAll(',', ''));
  return Number.isFinite(number) ? number : null;
}
