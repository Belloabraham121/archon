import assert from 'node:assert/strict';
import test from 'node:test';
import { JudgmentPriorityQueue } from './priority-queue';

test('reserves capacity for live judgment work', async () => {
  const queue = new JudgmentPriorityQueue(2);
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  const order: string[] = [];
  const background = queue.enqueue('background', async () => { order.push('background'); await held; });
  const secondBackground = queue.enqueue('background', async () => { order.push('background-2'); });
  const live = queue.enqueue('live', async () => { order.push('live'); });
  await live;
  assert.deepEqual(order, ['background', 'live']);
  release();
  await Promise.all([background, secondBackground]);
});
