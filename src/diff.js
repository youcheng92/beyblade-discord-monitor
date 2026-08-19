import { AVAILABLE_STATUS } from './products.js';

export function diffProducts(previous, current, options = {}) {
  const { notifyOnFirstRun = false } = options;
  const events = [];
  const isFirstRun = previous == null;
  const previousProducts = previous || {};

  for (const [id, product] of Object.entries(current)) {
    const before = previousProducts[id];

    if (!before) {
      if (!isFirstRun || notifyOnFirstRun) {
        events.push({
          kind:
            product.status === AVAILABLE_STATUS ? 'new_available' : 'new',
          product,
          before: null,
          changes: ['監聽來源新增此商品'],
        });
      }
      continue;
    }

    const changes = collectChanges(before, product);
    if (!changes.length) continue;

    let kind = 'changed';
    if (
      product.status === AVAILABLE_STATUS &&
      before.status !== AVAILABLE_STATUS
    ) {
      kind = 'available';
    } else if (
      product.stock != null &&
      product.stock > 0 &&
      (before.stock == null || before.stock <= 0)
    ) {
      kind = 'restocked';
    }

    events.push({ kind, product, before, changes });
  }

  if (!isFirstRun) {
    for (const [id, product] of Object.entries(previousProducts)) {
      if (!current[id]) {
        events.push({
          kind: 'removed',
          product,
          before: product,
          changes: ['商品已從監聽來源中消失'],
        });
      }
    }
  }

  return events;
}

function collectChanges(before, after) {
  const changes = [];
  if (before.status !== after.status) {
    changes.push(`狀態：${before.status || '未知'} → ${after.status || '未知'}`);
  }
  if (before.stock !== after.stock) {
    changes.push(`庫存：${formatValue(before.stock)} → ${formatValue(after.stock)}`);
  }
  if (before.price !== after.price) {
    changes.push(`價格：${formatValue(before.price)} → ${formatValue(after.price)}`);
  }
  if (before.name !== after.name) {
    changes.push(`名稱：${before.name} → ${after.name}`);
  }
  return changes;
}

function formatValue(value) {
  return value == null ? '未提供' : String(value);
}
