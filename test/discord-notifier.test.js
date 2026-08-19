import assert from 'node:assert/strict';
import test from 'node:test';

import { partitionEvents } from '../src/discord-notifier.js';

test('只將上架、可購買及補貨事件分到上架通知頻道', () => {
  const events = [
    { kind: 'new_available' },
    { kind: 'available' },
    { kind: 'restocked' },
    { kind: 'new' },
    { kind: 'changed' },
    { kind: 'removed' },
  ];

  const { availabilityEvents, otherEvents } = partitionEvents(events);

  assert.deepEqual(
    availabilityEvents.map((event) => event.kind),
    ['new_available', 'available', 'restocked'],
  );
  assert.deepEqual(
    otherEvents.map((event) => event.kind),
    ['new', 'changed', 'removed'],
  );
});
