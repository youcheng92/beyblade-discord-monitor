import 'dotenv/config';

import { FunboxClient } from '../src/funbox-client.js';
import { extractProducts } from '../src/products.js';

const config = {
  baseUrl: process.env.FUNBOX_BASE_URL || 'https://shop.funbox.com.tw',
  categoryPath: process.env.FUNBOX_CATEGORY_PATH || 'XI/KB',
  pageSize: Number(process.env.FUNBOX_PAGE_SIZE || 100),
  maxPages: Number(process.env.FUNBOX_MAX_PAGES || 20),
  requestTimeoutMs: Number(process.env.FUNBOX_REQUEST_TIMEOUT_MS || 30_000),
};
const client = new FunboxClient(config);

try {
  const payload = await client.fetchData();
  const products = extractProducts(payload);
  console.log(`Funbox 戰鬥陀螺分類：${products.length} 件`);
  for (const product of products) {
    console.log(
      `- [${product.status}] 庫存=${product.stock ?? '未提供'} ${product.name}`,
    );
    console.log(`  ${product.url}`);
  }
} finally {
  await client.close();
}
