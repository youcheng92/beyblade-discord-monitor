import 'dotenv/config';

import { EsliteClient } from '../src/eslite-client.js';
import { extractProducts, filterProducts } from '../src/products.js';

const exhibitId = process.env.ESLITE_EXHIBIT_ID || 'CU202310-00113';
const apiUrl =
  process.env.ESLITE_API_URL ||
  `https://athena.eslite.com/api/v1/book_exhibits/${exhibitId}`;
const pageUrl =
  process.env.ESLITE_PAGE_URL ||
  `https://www.eslite.com/exhibitions/${exhibitId}`;
const keywords = (process.env.KEYWORDS ?? 'BEYBLADE,戰鬥陀螺')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const client = new EsliteClient({
  exhibitId,
  apiUrl,
  pageUrl,
  fetchMode: process.env.ESLITE_FETCH_MODE || 'browser',
  extraHeaders: JSON.parse(process.env.ESLITE_EXTRA_HEADERS_JSON || '{}'),
  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS || 30_000),
  browserChannel: process.env.BROWSER_CHANNEL || 'msedge',
  browserExecutablePath: process.env.BROWSER_EXECUTABLE_PATH || null,
  browserHeadless: !['0', 'false', 'no'].includes(
    String(process.env.BROWSER_HEADLESS ?? 'false').toLowerCase(),
  ),
});

try {
  const payload = await client.fetchExhibit();
  const allProducts = extractProducts(payload);
  const matched = filterProducts(allProducts, keywords);

  console.log(`策展商品：${allProducts.length} 件`);
  console.log(`符合關鍵字：${matched.length} 件`);
  for (const product of matched) {
    console.log(`- [${product.status}] 庫存=${product.stock ?? '未提供'} ${product.name}`);
    console.log(`  ${product.url}`);
  }
} finally {
  await client.close();
}
