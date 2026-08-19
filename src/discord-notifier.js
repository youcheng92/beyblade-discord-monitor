import {
  Client,
  EmbedBuilder,
  GatewayIntentBits,
} from 'discord.js';
import { statusLabel } from './products.js';

const EVENT_STYLE = {
  new_available: ['新商品可購買', 0x2ecc71],
  new: ['策展新增商品', 0x3498db],
  available: ['商品已可購買', 0x2ecc71],
  restocked: ['商品補貨', 0x2ecc71],
  changed: ['商品資料有變化', 0xf1c40f],
  removed: ['商品已移出策展', 0x95a5a6],
};

const AVAILABILITY_EVENT_KINDS = new Set([
  'new_available',
  'available',
  'restocked',
]);

export class DiscordNotifier {
  constructor(config, logger = console) {
    this.config = config;
    this.logger = logger;
    this.client = new Client({ intents: [GatewayIntentBits.Guilds] });
    this.availabilityChannel = null;
    this.otherChannel = null;
  }

  async connect() {
    await this.client.login(this.config.token);
    await new Promise((resolve) => {
      if (this.client.isReady()) resolve();
      else this.client.once('ready', resolve);
    });

    this.availabilityChannel = await this.#fetchTextChannel(
      this.config.channelId,
    );
    this.otherChannel =
      this.config.otherChannelId === this.config.channelId
        ? this.availabilityChannel
        : await this.#fetchTextChannel(this.config.otherChannelId);
    this.logger.log(`[Discord] 已登入 ${this.client.user.tag}`);
  }

  async sendStartup({ sources, pollIntervalMs }) {
    const sourceFields = sources.map((source) => ({
      name: source.name,
      value: source.description,
      inline: false,
    }));
    await this.#send(this.otherChannel, {
      embeds: [
        new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle('戰鬥陀螺多網站監聽已啟動')
          .addFields(
            {
              name: '檢查頻率',
              value: `${Math.round(pollIntervalMs / 1_000)} 秒`,
              inline: true,
            },
            ...sourceFields,
          )
          .setTimestamp(),
      ],
    });
  }

  async sendEvents(events) {
    const { availabilityEvents, otherEvents } = partitionEvents(events);
    await this.#sendEventBatches(
      this.availabilityChannel,
      availabilityEvents,
      true,
    );
    await this.#sendEventBatches(this.otherChannel, otherEvents, false);
  }

  async sendError(error, failureCount, sourceName = '網站') {
    await this.#send(this.otherChannel, {
      embeds: [
        new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle(`${sourceName}監聽連續失敗`)
          .setDescription(truncate(error.message || String(error), 3_800))
          .addFields({
            name: '連續失敗次數',
            value: String(failureCount),
            inline: true,
          })
          .setTimestamp(),
      ],
    });
  }

  async sendRecovery(sourceName = '網站') {
    await this.#send(this.otherChannel, {
      embeds: [
        new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle(`${sourceName}監聽已恢復`)
          .setDescription('商品資料已可正常讀取，將繼續比對變化。')
          .setTimestamp(),
      ],
    });
  }

  async #fetchTextChannel(channelId) {
    const channel = await this.client.channels.fetch(channelId);
    if (!channel?.isTextBased() || typeof channel.send !== 'function') {
      throw new Error(`Discord 頻道 ${channelId} 不是可傳訊息的文字頻道`);
    }
    return channel;
  }

  async #sendEventBatches(channel, events, allowRoleMention) {
    for (let index = 0; index < events.length; index += 10) {
      const batch = events.slice(index, index + 10);
      const roleId = allowRoleMention ? this.config.roleMentionId : null;
      await this.#send(channel, {
        content: roleId ? `<@&${roleId}>` : undefined,
        allowedMentions: roleId ? { roles: [roleId] } : { parse: [] },
        embeds: batch.map(buildEventEmbed),
      });
    }
  }

  async #send(channel, message) {
    if (!channel) throw new Error('Discord 尚未連線');
    await channel.send(message);
  }

  async close() {
    this.client.destroy();
  }
}

export function partitionEvents(events) {
  const availabilityEvents = [];
  const otherEvents = [];

  for (const event of events) {
    if (AVAILABILITY_EVENT_KINDS.has(event.kind)) {
      availabilityEvents.push(event);
    } else {
      otherEvents.push(event);
    }
  }

  return { availabilityEvents, otherEvents };
}

function buildEventEmbed(event) {
  const [title, color] = EVENT_STYLE[event.kind] || EVENT_STYLE.changed;
  const product = event.product;
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(`[${truncate(product.name, 240)}](${product.url})`)
    .addFields(
      { name: '目前狀態', value: statusLabel(product.status), inline: true },
      {
        name: '庫存',
        value: product.stock == null ? 'API 未提供' : String(product.stock),
        inline: true,
      },
      { name: '商品 ID', value: product.id, inline: true },
      { name: '來源', value: product.source || '未知', inline: true },
      {
        name: 'JSON 變化',
        value: truncate(event.changes.join('\n'), 1_024),
      },
    )
    .setURL(product.url)
    .setTimestamp();

  if (product.price != null) {
    embed.addFields({
      name: '價格',
      value: `NT$ ${Number(product.price).toLocaleString('zh-TW')}`,
      inline: true,
    });
  }
  if (/^https?:\/\//.test(product.image)) embed.setThumbnail(product.image);
  return embed;
}

function truncate(value, maxLength) {
  const text = String(value ?? '');
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`;
}
