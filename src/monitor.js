import { diffProducts } from './diff.js';
import { extractProducts, filterProducts, toProductMap } from './products.js';

export class ProductMonitor {
  constructor({ client, notifier, stateStore, config, logger = console }) {
    this.client = client;
    this.notifier = notifier;
    this.stateStore = stateStore;
    this.config = config;
    this.logger = logger;
    this.timer = null;
    this.running = false;
    this.previous = undefined;
    this.failureCount = 0;
    this.failureAlertSent = false;
  }

  async start() {
    const savedProducts = await this.stateStore.load();
    this.previous = savedProducts
      ? Object.fromEntries(
          Object.entries(savedProducts).map(([id, product]) => [
            id,
            {
              ...product,
              source: product.source || this.config.sourceName,
            },
          ]),
        )
      : null;
    await this.runOnce();
    this.timer = setInterval(() => {
      void this.runOnce();
    }, this.config.pollIntervalMs);
  }

  async runOnce() {
    if (this.running) {
      this.logger.warn('[監聽] 上一次檢查尚未完成，本輪略過。');
      return;
    }

    this.running = true;
    try {
      const payload = await this.client.fetchData();
      const allProducts = extractProducts(payload);
      const matchedProducts = filterProducts(
        allProducts,
        this.config.keywords,
      ).map((product) => ({
        ...product,
        source: this.config.sourceName,
      }));
      const current = toProductMap(matchedProducts);
      const events = diffProducts(this.previous, current, {
        notifyOnFirstRun: this.config.notifyOnFirstRun,
      });

      if (events.length) await this.notifier.sendEvents(events);
      await this.stateStore.save(current);

      const now = new Date().toLocaleString('zh-TW', {
        timeZone: 'Asia/Taipei',
        hour12: false,
      });
      this.logger.log(
        `[監聽][${this.config.sourceName}] ${now}：取得 ${allProducts.length} 件，監聽 ${matchedProducts.length} 件，變化 ${events.length} 件。`,
      );

      if (this.failureAlertSent) {
        await this.notifier.sendRecovery(this.config.sourceName);
      }
      this.previous = current;
      this.failureCount = 0;
      this.failureAlertSent = false;
    } catch (error) {
      this.failureCount += 1;
      this.logger.error(
        `[監聽][${this.config.sourceName}] 第 ${this.failureCount} 次連續失敗：${error.stack || error}`,
      );

      if (
        !this.failureAlertSent &&
        this.failureCount >= this.config.maxConsecutiveFailures
      ) {
        try {
          await this.notifier.sendError(
            error,
            this.failureCount,
            this.config.sourceName,
          );
          this.failureAlertSent = true;
        } catch (notifyError) {
          this.logger.error(`[Discord] 錯誤通知傳送失敗：${notifyError.message}`);
        }
      }
    } finally {
      this.running = false;
    }
  }

  async stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await this.client.close();
  }
}
