import 'dotenv/config';

import { createConfig } from './config.js';
import { DiscordNotifier } from './discord-notifier.js';
import { EsliteClient } from './eslite-client.js';
import { FunboxClient } from './funbox-client.js';
import { MomoClient } from './momo-client.js';
import { ProductMonitor } from './monitor.js';
import { StateStore } from './state-store.js';

let notifier;
const monitors = [];
let shuttingDown = false;

async function main() {
  const config = createConfig();
  notifier = new DiscordNotifier(config.discord);
  await notifier.connect();

  const esliteMonitor = new ProductMonitor({
    client: new EsliteClient(config.eslite),
    notifier,
    stateStore: new StateStore(config.monitor.stateFile),
    config: config.monitor,
  });
  monitors.push(esliteMonitor);

  if (config.funbox.enabled) {
    monitors.push(
      new ProductMonitor({
        client: new FunboxClient(config.funbox),
        notifier,
        stateStore: new StateStore(config.funbox.stateFile),
        config: {
          ...config.funbox,
          keywords: [],
        },
      }),
    );
  }

  if (config.momo.enabled) {
    monitors.push(
      new ProductMonitor({
        client: new MomoClient(config.momo),
        notifier,
        stateStore: new StateStore(config.momo.stateFile),
        config: {
          ...config.momo,
          keywords: [],
        },
      }),
    );
  }

  if (config.discord.notifyStartup) {
    const sources = [
      {
        name: '誠品線上',
        description: `策展 ${config.eslite.exhibitId}；關鍵字：${config.monitor.keywords.join('、') || '全部'}`,
      },
    ];
    if (config.funbox.enabled) {
      sources.push({
        name: 'Funbox Toys',
        description: `戰鬥陀螺分類 ${config.funbox.categoryPath}`,
      });
    }
    if (config.momo.enabled) {
      sources.push({
        name: config.momo.sourceName,
        description: `戰鬥陀螺分類 ${config.momo.categoryId}；每 ${Math.round(config.momo.pollIntervalMs / 1_000)} 秒`,
      });
    }
    await notifier.sendStartup({
      sources,
      pollIntervalMs: config.monitor.pollIntervalMs,
    });
  }

  await Promise.all(monitors.map((item) => item.start()));
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[系統] 收到 ${signal}，正在關閉…`);
  await Promise.all(
    monitors.map((item) => item.stop().catch((error) => console.error(error))),
  );
  await notifier?.close().catch((error) => console.error(error));
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

main().catch(async (error) => {
  console.error(`[啟動失敗] ${error.stack || error}`);
  await shutdown('啟動失敗');
  process.exitCode = 1;
});
