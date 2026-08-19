import assert from 'node:assert/strict';
import test from 'node:test';

import { diffProducts } from '../src/diff.js';
import {
  extractProducts,
  filterProducts,
  toProductMap,
} from '../src/products.js';

const fixture = {
  name: '對戰遊戲',
  contents: [
    {
      content_type: 'one_product_and_editor',
      product: {
        id: '10042014802683066235005',
        product_guid: 'bey-guid',
        name: 'BEYBLADE X戰鬥陀螺/ CX-06',
        status: 'can_not_buy',
        stock: 0,
        product_photo_url: 'https://example.com/bey.jpg',
      },
    },
    {
      content_type: 'list_of_four_product',
      book_list: [
        {
          products: [
            {
              id: '10042295282683082173008',
              product_guid: 'card-guid',
              name: 'PTCG 卡牌遊戲',
              status: 'add_to_shopping_cart',
              stock: 8,
            },
          ],
        },
      ],
    },
  ],
};

test('遞迴擷取策展內不同區塊的商品', () => {
  const products = extractProducts(fixture);
  assert.equal(products.length, 2);
  assert.equal(products[0].id, '10042014802683066235005');
  assert.equal(products[0].status, 'can_not_buy');
});

test('只保留戰鬥陀螺關鍵字商品', () => {
  const matched = filterProducts(extractProducts(fixture), [
    'BEYBLADE',
    '戰鬥陀螺',
  ]);
  assert.equal(matched.length, 1);
  assert.match(matched[0].name, /BEYBLADE/);
});

test('第一次執行預設只建立基準，不通知', () => {
  const current = toProductMap(filterProducts(extractProducts(fixture), ['BEYBLADE']));
  assert.deepEqual(diffProducts(null, current), []);
});

test('無法購買轉為可加入購物車時產生 available 事件', () => {
  const previousProduct = filterProducts(extractProducts(fixture), ['BEYBLADE'])[0];
  const currentProduct = {
    ...previousProduct,
    status: 'add_to_shopping_cart',
    stock: 3,
  };
  const events = diffProducts(
    { [previousProduct.id]: previousProduct },
    { [currentProduct.id]: currentProduct },
  );

  assert.equal(events.length, 1);
  assert.equal(events[0].kind, 'available');
  assert.match(events[0].changes.join(' '), /狀態/);
});

test('商品從 JSON 消失時產生 removed 事件', () => {
  const product = filterProducts(extractProducts(fixture), ['BEYBLADE'])[0];
  const events = diffProducts({ [product.id]: product }, {});
  assert.equal(events.length, 1);
  assert.equal(events[0].kind, 'removed');
});

test('解析 Funbox Cyberbiz 商品與規格庫存', () => {
  const payload = {
    products: [
      {
        __source: 'funbox',
        __baseUrl: 'https://shop.funbox.com.tw',
        id: 70137108,
        title: '戰鬥陀螺 BX-TEST 測試商品',
        url: '/products/bx-test',
        photo: '//cdn.example.com/bx-test.jpg',
        price: 590,
        variants: [
          { id: 1, inventory_quantity: 2 },
          { id: 2, inventory_quantity: 3 },
        ],
      },
    ],
  };

  const [product] = extractProducts(payload);
  assert.equal(product.id, '70137108');
  assert.equal(product.status, 'add_to_shopping_cart');
  assert.equal(product.stock, 5);
  assert.equal(product.price, 590);
  assert.equal(product.url, 'https://shop.funbox.com.tw/products/bx-test');
  assert.equal(product.image, 'https://cdn.example.com/bx-test.jpg');
});

test('Funbox 全規格缺貨時標記為貨到通知', () => {
  const [product] = extractProducts({
    products: [
      {
        __source: 'funbox',
        __baseUrl: 'https://shop.funbox.com.tw',
        id: 70137109,
        title: '戰鬥陀螺缺貨商品',
        url: '/products/out-of-stock',
        variants: [{ id: 1, inventory_quantity: 0 }],
      },
    ],
  });

  assert.equal(product.status, 'not_add_to_notice');
  assert.equal(product.stock, 0);
});
