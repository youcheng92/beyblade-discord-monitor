import 'dotenv/config';

import { MomoClient } from '../src/momo-client.js';
import { extractProducts } from '../src/products.js';

const categoryId = process.env.MOMO_CATEGORY_ID || '2186500036';
const baseUrl = process.env.MOMO_BASE_URL || 'https://www.momoshop.com.tw';
const client = new MomoClient({
  baseUrl,
  categoryId,
  pageUrl:
    process.env.MOMO_PAGE_URL || `${baseUrl}/categories/${categoryId}`,
  apiUrl:
    process.env.MOMO_API_URL ||
    `${baseUrl}/api/moecapp/getCategoryGoodsV3`,
  apiVersion: process.env.MOMO_API_VERSION || '2608.1.6',
  cateLevel: process.env.MOMO_CATE_LEVEL || '3',
  pageSize: Number(process.env.MOMO_PAGE_SIZE || 80),
  maxPages: Number(process.env.MOMO_MAX_PAGES || 10),
  requestTimeoutMs: Number(process.env.MOMO_REQUEST_TIMEOUT_MS || 30_000),
  backoffMs: Number(process.env.MOMO_BACKOFF_SECONDS || 600) * 1_000,
});

try {
  const payload = await client.fetchData();
  const products = extractProducts(payload);

  console.log(`momo 戰鬥陀螺分類：${products.length} 件`);
  for (const product of products) {
    console.log(
      `- [${product.status}] NT$${product.price ?? '未提供'} ${product.name}`,
    );
    console.log(`  ${product.url}`);
  }
} finally {
  await client.close();
}
