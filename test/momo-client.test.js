import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildMomoRequest,
  normalizeMomoGoods,
} from '../src/momo-client.js';
import { extractProducts } from '../src/products.js';

test('將 momo API 商品轉成監聽器使用的格式', () => {
  const [product] = normalizeMomoGoods(
    [
      {
        goodsCode: '15407443',
        goodsName: '【測試】戰鬥陀螺 BX-TEST',
        goodsPrice: '1,231',
        goodsStock: '3',
        imgUrl: 'https://example.com/product.webp',
        goodsSubName: '測試副標題',
      },
    ],
    'https://www.momoshop.com.tw',
  );

  assert.equal(product.id, '15407443');
  assert.equal(product.title, '【測試】戰鬥陀螺 BX-TEST');
  assert.equal(product.price, 1231);
  assert.equal(product.stock, 3);
  assert.equal(product.status, 'add_to_shopping_cart');
  assert.equal(
    product.url,
    '/goods/GoodsDetail.jsp?i_code=15407443',
  );

  const [normalized] = extractProducts({ products: [product] });
  assert.equal(normalized.id, '15407443');
  assert.equal(
    normalized.url,
    'https://www.momoshop.com.tw/goods/GoodsDetail.jsp?i_code=15407443',
  );
});

test('momo API 庫存為零時標記為貨到通知狀態', () => {
  const [product] = normalizeMomoGoods(
    [
      {
        goodsCode: '12345678',
        goodsName: '缺貨測試商品',
        goodsPrice: '999',
        goodsStock: '0',
      },
    ],
    'https://www.momoshop.com.tw',
  );

  assert.equal(product.stock, 0);
  assert.equal(product.status, 'not_add_to_notice');
});

test('建立 momo 分類 API 的分頁請求', () => {
  const request = buildMomoRequest(
    {
      categoryId: '2186500036',
      cateLevel: '3',
      pageSize: 80,
    },
    2,
  );

  assert.equal(request.host, 'web');
  assert.equal(request.data.curPage, '2');
  assert.equal(request.data.cateCode, '2186500036');
  assert.equal(request.data.cateLevel, '3');
  assert.equal(request.data.dispCnt, '80');
});
