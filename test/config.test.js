import assert from 'node:assert/strict';
import test from 'node:test';

import { createConfig } from '../src/config.js';

const requiredEnv = {
  DISCORD_TOKEN: 'test-token',
  DISCORD_CHANNEL_ID: '123456789',
};

test('Discord 可將一般通知設定到另一個文字頻道', () => {
  const config = createConfig({
    ...requiredEnv,
    DISCORD_OTHER_CHANNEL_ID: '1538802130196889700',
  });

  assert.equal(config.discord.channelId, '123456789');
  assert.equal(config.discord.otherChannelId, '1538802130196889700');
});

test('未設定一般通知頻道時沿用上架通知頻道', () => {
  const config = createConfig(requiredEnv);
  assert.equal(config.discord.otherChannelId, '123456789');
});

test('誠品預設從一開始就使用本機瀏覽器', () => {
  const config = createConfig(requiredEnv);
  assert.equal(config.eslite.fetchMode, 'browser');
});

test('誠品不再接受先 HTTP 後瀏覽器的 auto 模式', () => {
  assert.throws(
    () => createConfig({ ...requiredEnv, ESLITE_FETCH_MODE: 'auto' }),
    /只能是 http 或 browser/,
  );
});

test('momo 預設啟用指定的戰鬥陀螺分類', () => {
  const config = createConfig(requiredEnv);
  assert.equal(config.momo.enabled, true);
  assert.equal(config.momo.categoryId, '2186500036');
  assert.equal(
    config.momo.pageUrl,
    'https://www.momoshop.com.tw/categories/2186500036',
  );
  assert.equal(
    config.momo.apiUrl,
    'https://www.momoshop.com.tw/api/moecapp/getCategoryGoodsV3',
  );
  assert.equal(config.momo.apiVersion, '2608.1.6');
  assert.equal(config.momo.pageSize, 80);
  assert.equal(config.momo.pollIntervalMs, 60_000);
  assert.match(config.momo.stateFile, /momo-state\.json$/);
});
