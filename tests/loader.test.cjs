const test = require('node:test');
const assert = require('node:assert/strict');
const { application } = require('./helpers.cjs');
const { attachDOM } = require('./dom-fixture.cjs');

test('initial shell has all cards and no eagerly evaluated game modules or engines', () => {
  const { context: c } = application('', { eager: false });
  assert.equal(c.App.games.length, 19);
  assert.equal(c.App.validateGames(), true);
  assert.ok(c.App.games.every(game => !game.start));
  assert.equal(c.ChessRules, undefined);
  assert.equal(c.CheckersRules, undefined);
});

test('lazy loader shares in-flight work, loads dependencies first and retries failed modules', async () => {
  const { context: c } = application();
  const calls = [];
  let fail = true;
  const loader = c.GameLoader.create({ loadScript: async file => {
    calls.push(file);
    if (file === 'game' && fail) throw new Error('transient');
  } });
  const game = { scripts: ['engine'], file: 'game' };
  const first = loader.load(game), second = loader.load(game);
  await assert.rejects(first, /transient/); await assert.rejects(second, /transient/);
  assert.deepEqual(calls, ['engine', 'game']);
  fail = false;
  await loader.load(game); await loader.load(game);
  assert.deepEqual(calls, ['engine', 'game', 'game']);
});

test('a pending game launch cannot replace the menu after the user leaves', async () => {
  const { context: c } = application('?test=1');
  const dom = attachDOM(c);
  c.Store.addProfile('Fixture', '🧪', 'junior');
  const stub = () => ({ textContent: '', setAttribute() {}, classList: { toggle() {} } });
  c.App.els = { title: stub(), homeBtn: stub(), musicBtn: stub(), soundBtn: stub(), langBtn: stub(), screen: dom.node(), overlay: dom.node() };
  let release, started = false;
  c.Store.prepareHistory = () => new Promise(resolve => { release = resolve; });
  c.App.gameById('math').start = () => { started = true; return () => {}; };
  const launch = c.App.startGame('math');
  c.App.goHome(); release();
  assert.equal(await launch, false);
  assert.equal(started, false);
  assert.equal(c.App.mode, 'home');
  assert.equal(c.App.session, null);
});
