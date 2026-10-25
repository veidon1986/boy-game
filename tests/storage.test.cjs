const test = require('node:test');
const assert = require('node:assert/strict');
const { application } = require('./helpers.cjs');

test('task preferences do not consume rejected candidates and keep a valid fallback', () => {
  const { context: c } = application();
  let index = 0;
  const gen = c.UI.uniqueGenerator(() => [1,2,3][index++ % 3], String, 6, 'preferred-fixture');
  assert.equal(gen(value => value === 3), 3);
  assert.deepEqual(Array.from(c.Store.taskHistory('preferred-fixture')), ['3']);
  assert.equal(gen(value => value === 3), 1);
  assert.deepEqual(Array.from(c.Store.taskHistory('preferred-fixture')), ['3','1']);
  assert.equal(gen(value => value === 3), 2);
  const finite = c.UI.uniqueGenerator(() => 0, String, 3, 'preferred-pool', () => [1,2]);
  assert.equal(finite(value => value === 2), 2);
  assert.equal(finite(value => value === 2), 1);
});

test('finite task pools prove exhaustion; random retries never claim the pool is empty', () => {
  const { context: c } = application();
  const random = c.UI.uniqueGenerator(() => 'same', x => x, 2, 'random-fixture');
  assert.equal(random(), 'same'); assert.equal(random(), null); assert.equal(random.exhausted, false);
  const finite = c.UI.uniqueGenerator(() => 'unused', x => x, 2, 'finite-fixture', () => ['a','b']);
  const results = [finite(), finite()];
  assert.equal(new Set(results).size, 2);
  assert.equal(finite(), null); assert.equal(finite.exhausted, true);
});

test('schema initialization is additive; old payloads remain unchanged without IndexedDB', async () => {
  const { context: c, data } = application();
  const child = c.Store.addProfile('Existing', '🧪', 'school');
  c.Store.recordResult('memory', 3, 'hard');
  c.Store.rememberTask('memory', 'old');
  const before = new Map(data);
  await c.Store.ready();
  assert.equal(c.Store.get('schemaVersion'), 1);
  for (const [key, value] of before) assert.equal(data.get(key), value, key);
  assert.equal(c.Store.activeId(), child.id);
  c.Store.rememberTask('memory', 'new');
  assert.equal(c.Store.taskHistory('memory').length, 2);
});

test('newer schema is rejected without changing saved data', async () => {
  const { context: c, data } = application();
  c.Store.set('schemaVersion', 99);
  const before = [...data];
  await assert.rejects(c.Store.ready(), /schema-too-new/);
  assert.deepEqual([...data], before);
});

test('demo initialization does not open IndexedDB or write schema metadata', async () => {
  const { context: c, data } = application('?test=1');
  c.indexedDB = { open() { throw new Error('demo accessed database'); } };
  await c.Store.ready();
  assert.equal(data.size, 0);
});

test('usage batches writes, merges persisted totals, isolates profiles and survives restart', async () => {
  const { context: c, data } = application();
  const first = c.Store.addProfile('One', '🧪', 'junior');
  const key = 'boygame.d.' + first.id + '.usage';
  c.Store.addUsage(3); c.Store.addUsage(4);
  assert.equal(data.has(key), false);
  assert.equal(c.Store.usage().seconds, 7);
  // Simulate an additive write by another tab before this tab flushes.
  data.set(key, JSON.stringify({ day: c.Store.usage().day, seconds: 5 }));
  await c.Store.flush();
  assert.equal(JSON.parse(data.get(key)).seconds, 12);
  assert.equal(c.Store.remainingSecondsFor(first.id), 1200 - 12);
  c.Store.addUsage(2);
  const second = c.Store.addProfile('Two', '🧪', 'school');
  assert.equal(JSON.parse(data.get(key)).seconds, 14);
  assert.equal(c.Store.usage().seconds, 0);
  c.Store.addUsage(9); c.Store.resetUsage(); await c.Store.flush();
  assert.equal(c.Store.usage().seconds, 0);
  c.Store.switchProfile(first.id);
  assert.equal(c.Store.usage().seconds, 14);
  assert.notEqual(first.id, second.id);
  const restored = application(); for (const [k,v] of data) restored.data.set(k,v);
  assert.equal(restored.context.Store.usage().seconds, 14);
});

test('failed usage writes stay pending and can be retried', () => {
  const { context: c } = application();
  let saved = null, failed = true;
  const store = c.UsageStore.create({ read: () => saved, write: (_id, v) => { if (failed) return false; saved = v; return true; }, readOnly: () => false });
  store.add('one', 10); store.flush();
  assert.equal(store.read('one').seconds, 10);
  failed = false; store.flush(); store.flush();
  assert.equal(saved.seconds, 10);
});

test('daily rollover does not carry pending time into the next day', () => {
  const { context: c } = application();
  let instant = new Date(2026, 9, 25, 23, 59, 59).getTime();
  c.Date = class extends Date { constructor(...args) { super(...(args.length ? args : [instant])); } };
  let saved = null;
  const store = c.UsageStore.create({ read: () => saved, write: (_id, value) => { saved = value; return true; }, readOnly: () => false });
  store.add('one', 30);
  instant += 2000;
  assert.equal(store.read('one').seconds, 0);
  store.flush(); store.add('one', 2); store.flush();
  assert.equal(saved.seconds, 2);
});

test('explicit history reset is retryable and cannot restore stale local history', async () => {
  const { context: c } = application();
  const child = c.Store.addProfile('Fixture', '🧪', 'junior');
  c.Store.rememberTask('math', 'old'); c.Store.reset();
  assert.equal(c.Store.get('historyResets')[child.id], true);
  assert.equal(c.Store.taskHistory('math').length, 0);
  c.Store.rememberTask('math', 'new'); await c.Store.ready();
  assert.equal(c.Store.taskHistory('math').join(','), 'new');
});

test('storage write failure remains visible and does not replace existing records', () => {
  const { context: c, data } = application();
  c.Store.addProfile('Fixture', '🧪', 'junior');
  const before = [...data];
  c.localStorage.setItem = () => { throw new Error('quota'); };
  c.Store.recordResult('math', 3, 'hard');
  assert.equal(c.Store.storageError().message, 'quota');
  assert.deepEqual([...data], before);
});

test('play time excludes pauses and background; checkpoints preserve final fractions', () => {
  const { context: c } = application();
  let now = 0, visible = true, active = true, seconds = 0, flushed = 0;
  const clock = c.PlayTime.create({ now: () => now, visible: () => visible, active: () => active, add: n => seconds += n, flush: () => flushed++ });
  now = 1200; clock.sample();
  now = 1500; clock.sample(); active = false;
  now = 9000; clock.sample(); active = true;
  now = 10000; visible = false; clock.visibility();
  now = 70000; visible = true; clock.visibility();
  now = 70500; clock.checkpoint();
  assert.equal(seconds, 3);
  assert.ok(flushed >= 3);
});
