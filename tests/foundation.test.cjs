const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const { application, root } = require('./helpers.cjs');
const { attachDOM } = require('./dom-fixture.cjs');
const { worker } = require('./sw-fixture.cjs');

test('every real game module opens and disposes its session without leftover timers', () => {
  for (const gameId of application().context.App.games.map(game => game.id)) {
    const { context: c } = application('?test=1');
    const dom = attachDOM(c);
    c.Store.addProfile('Fixture', '🧪', 'junior');
    const game = c.App.gameById(gameId);
    const session = c.GameSession.start(game, dom.node(), c.App);
    c.App.session = session;
    if (gameId === 'blocks') {
      assert.equal(c.App.pauseGame(), true);
      assert.equal(c.App.resumeGame(), true);
    }
    session.destroy(); session.destroy();
    assert.equal(dom.scheduled.size, 0, 'Leaked timers: ' + gameId);
    assert.equal(dom.listeners.size, 0, 'Leaked handlers: ' + gameId);
  }
});

test('all modules register exactly once and metadata exists in both languages', () => {
  const { context: c } = application();
  assert.equal(c.App.validateGames(true), true);
  assert.throws(() => c.App.register('memory', () => {}), /Duplicate/);
  assert.throws(() => c.App.register('unknown', () => {}), /Invalid/);
  const entries = JSON.parse(JSON.stringify(c.GameCatalog.list));
  assert.throws(() => c.GameCatalog.validate([...entries, entries[0]]), /duplicate/);
  entries[0].ages = ['unknown'];
  assert.throws(() => c.GameCatalog.validate(entries), /ages/);
});

test('launch checks age and rank before analytics or rendering; lessons are accessible', () => {
  const { context: c } = application();
  c.Store.addProfile('Fixture', '🧪', 'junior');
  let blocked = 0, launched = 0;
  c.App.showLocked = () => blocked++;
  c.App.toast = () => blocked++;
  c.Analytics.recordLaunch = () => launched++;
  c.App.startGame('runner');
  c.App.startGame('blocks');
  c.App.startGame('robot');
  assert.equal(blocked, 3);
  assert.equal(launched, 0);
  assert.equal(c.App.current, null);
  assert.equal(c.App.gameAccess('chess', 'lessons').allowed, true);
  assert.equal(c.App.gameAccess('checkers', 'lessons').allowed, true);
  assert.equal(c.App.gameAccess('chess', 'local').allowed, false);
  assert.equal(c.App.gameAccess('chess', 'computer').allowed, false);
  assert.equal(c.App.gameAccess('checkers', 'local').allowed, false);
  for (const game of c.App.ageGames().filter(game => !game.noStars)) c.Store.recordResult(game.id, 3, 'hard');
  assert.equal(c.App.gameAccess('blocks').allowed, true);
  assert.equal(c.App.gameAccess('chess', 'computer').allowed, true);
});

test('demo allows all known games and party modes but rejects unknown modes', () => {
  const { context: c } = application('?test=1');
  for (const game of c.App.games) assert.equal(c.App.gameAccess(game.id).allowed, true);
  assert.equal(c.App.gameAccess('chess', 'computer').allowed, true);
  assert.equal(c.App.gameAccess('chess', 'nonexistent').allowed, false);
});

test('session cleanup is once-only; pause and resume respect supported hooks', () => {
  const { context: c } = application();
  const calls = [];
  const session = c.GameSession.start({ id: 'fixture', start: () => ({
    destroy: () => calls.push('destroy'), pause: () => calls.push('pause'), resume: () => calls.push('resume')
  }) });
  assert.equal(session.pause(), true);
  assert.equal(session.isPaused(), true);
  assert.equal(session.pause(), false);
  assert.equal(session.resume(), true);
  session.destroy();
  session.destroy();
  assert.equal(session.pause(), false);
  assert.deepEqual(calls, ['pause', 'resume', 'destroy']);
  let cleanup = 0;
  const legacy = c.GameSession.start({ id: 'legacy', start: () => () => cleanup++ });
  assert.equal(legacy.pause(), false);
  legacy.destroy(); legacy.destroy();
  assert.equal(cleanup, 1);
  assert.throws(() => c.GameSession.start({ id: 'bad', start: () => null }), /cleanup/);
});

test('switching games cleans up previous session and ignores late results', async () => {
  const { context: c } = application();
  const dom = attachDOM(c);
  c.Store.addProfile('Fixture', '🧪', 'junior');
  const stub = () => ({ textContent: '', setAttribute() {}, classList: { toggle() {} } });
  c.App.els = { title: stub(), homeBtn: stub(), musicBtn: stub(), soundBtn: stub(), langBtn: stub(), screen: dom.node() };
  c.UI.clear = () => {};
  c.Sound.setMusicContext = () => {};
  let disposed = 0;
  c.App.gameById('memory').start = () => () => disposed++;
  c.App.gameById('math').start = () => () => disposed++;
  await c.App.startGame('memory');
  await c.App.startGame('math');
  assert.equal(disposed, 1);
  c.App.finishGame('memory', 3);
  assert.equal(c.Store.gameStats('memory').plays, 0);
  c.App.cleanup(); c.App.cleanup();
  assert.equal(disposed, 2);
});

test('generated game scripts and offline resources match real files', () => {
  execFileSync(process.execPath, ['tools/sync-assets.cjs', '--check'], { cwd: root });
});

test('service worker serves shell and every lazy module offline from a coherent build', async () => {
  const w = worker(); await w.install();
  const cache = [...w.stores.values()][0];
  for (const file of fs.readdirSync(path.join(root, 'js/games'))) assert.ok(cache.has('https://fixture.test/boy-game/js/games/' + file));
  assert.match(await w.request('./', 'navigate'), /game-catalog.js/);
  assert.equal(typeof await w.request('js/games/chess.js'), 'string');
  const mismatch = await w.request('js/games/chess.js?build=missing');
  assert.equal(mismatch.status, 409);
  assert.equal(w.request('https://api.example.test/stats'), undefined);
  assert.equal(w.request('/api/v1/stats'), undefined);
});

test('cache cleanup keeps previous build and never deletes another application cache', async () => {
  const w = worker();
  w.stores.set('other-application', new Map());
  w.stores.set('boygame-v73-old', new Map());
  w.stores.set('boygame-v74-previous', new Map([['https://fixture.test/boy-game/js/games/chess.js', 'previous code']]));
  await w.install(); await w.activate();
  assert.equal(w.stores.has('other-application'), true);
  assert.equal(w.stores.has('boygame-v73-old'), false);
  assert.equal(await w.request('js/games/chess.js?build=previous'), 'previous code');
});
