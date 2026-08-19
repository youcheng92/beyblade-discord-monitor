export const AVAILABLE_STATUS = 'add_to_shopping_cart';

export const STATUS_LABELS = {
  add_to_shopping_cart: '可加入購物車',
  out_of_print: '已絕版',
  can_not_buy: '無法購買',
  has_not_started: '尚未開賣',
  has_ended: '銷售結束',
  not_add_to_notice: '缺貨／可設貨到通知',
  not_notify: '貨到通知已設定',
  restock_notify: '缺貨／貨到通知',
  coming_soon_book: '即將上市',
  coming_soon_not_book: '即將開賣',
  region_unavailable: '所在地區無法購買',
};

export function statusLabel(status) {
  return STATUS_LABELS[status] || status || '未知';
}

export function extractProducts(payload) {
  const products = new Map();
  const seen = new Set();

  function visit(value) {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);

    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    if (isProductRecord(value)) {
      const product = normalizeProduct(value);
      if (product) products.set(product.id, product);
    }

    Object.values(value).forEach(visit);
  }

  visit(payload);
  return [...products.values()];
}

export function filterProducts(products, keywords) {
  if (!keywords?.length) return products;
  const normalizedKeywords = keywords.map((keyword) => keyword.toLocaleLowerCase('zh-TW'));

  return products.filter((product) => {
    const haystack = [
      product.name,
      product.brand,
      product.highlight,
      product.description,
    ]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('zh-TW');
    return normalizedKeywords.some((keyword) => haystack.includes(keyword));
  });
}

export function toProductMap(products) {
  return Object.fromEntries(products.map((product) => [product.id, product]));
}

function isProductRecord(value) {
  if (value.product_guid && (value.name || value.status)) return true;

  if (
    value.__source === 'funbox' &&
    (value.id || value.product_id) &&
    value.title &&
    Array.isArray(value.variants)
  ) {
    return true;
  }

  if (
    value.__source === 'momo' &&
    (value.id || value.product_id) &&
    (value.title || value.name)
  ) {
    return true;
  }

  const id = String(value.id ?? '');
  return (
    /^\d{10,}$/.test(id) &&
    Boolean(
      value.name ||
        value.status ||
        value.product_photo_url ||
        value.stock != null,
    )
  );
}

function normalizeProduct(raw) {
  const id = String(raw.id ?? raw.product_id ?? raw.product_guid ?? '').trim();
  if (!id) return null;

  const variantInventory = getVariantInventory(raw.variants);
  const status =
    raw.status ??
    (variantInventory.available
      ? 'add_to_shopping_cart'
      : 'not_add_to_notice');
  const baseUrl = raw.__baseUrl || 'https://www.eslite.com';

  return {
    id,
    guid: String(raw.product_guid ?? raw.guid ?? id),
    name: String(raw.name ?? raw.title ?? '未命名商品').trim(),
    status: String(status ?? 'unknown'),
    stock:
      raw.stock != null ? normalizeNumber(raw.stock) : variantInventory.stock,
    price: normalizeNumber(
      raw.final_price ?? raw.sale_price ?? raw.price ?? raw.pre_price,
    ),
    image: normalizeUrl(raw.product_photo_url ?? raw.image ?? raw.photo ?? ''),
    url: normalizeProductUrl(raw.url, baseUrl, id),
    brand: String(raw.brand_name ?? raw.brandName ?? raw.brand ?? ''),
    highlight: String(raw.text ?? raw.golden_text ?? raw.slogan ?? ''),
    description: String(raw.description ?? raw.brief ?? ''),
  };
}

function getVariantInventory(variants) {
  if (!Array.isArray(variants) || !variants.length) {
    return { available: false, stock: null };
  }

  let hasUnlimitedInventory = false;
  let stock = 0;
  for (const variant of variants) {
    if (variant.inventory_quantity == null) {
      hasUnlimitedInventory = true;
    } else {
      stock += Math.max(0, Number(variant.inventory_quantity) || 0);
    }
  }

  return {
    available: hasUnlimitedInventory || stock > 0,
    stock: hasUnlimitedInventory ? null : stock,
  };
}

function normalizeNumber(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeUrl(value) {
  if (!value) return '';
  if (String(value).startsWith('//')) return `https:${value}`;
  return String(value);
}

function normalizeProductUrl(value, baseUrl, id) {
  if (!value) {
    return `https://www.eslite.com/product/${encodeURIComponent(id)}`;
  }
  try {
    return new URL(String(value), baseUrl).toString();
  } catch {
    return String(value);
  }
}
