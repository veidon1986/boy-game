/* Native IndexedDB regression checks. Never opens boygame-history or localStorage. */
(async function () {
  'use strict';
  var output = document.getElementById('results');
  var lines = [];
  var names = [];
  var histories = [];
  function assert(ok, message) { if (!ok) throw new Error(message); }
  function factory() {
    var name = 'boygame-test-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    names.push(name);
    function create() { var h = TaskHistory.create({ name: name }); histories.push(h); return h; }
    return { name: name, create: create };
  }
  async function check(name, callback) { await callback(); lines.push('PASS ' + name); output.textContent = lines.join('\n'); }
  try {
    await check('import, deduplication, persistence and profile isolation', async function () {
      var fixture = factory(), h = fixture.create();
      var legacy = { memory: ['old', 'old'], 'chess-lessons-moves': ['lesson'] };
      assert(await h.prepare('one', legacy), 'import failed');
      assert(h.list('one', 'memory').length === 1, 'duplicate import');
      assert(!h.remember('one', 'memory', 'old'), 'old question repeated');
      assert(h.remember('one', 'memory', 'new'), 'new task rejected');
      await h.flush(); await h.close();
      h = fixture.create();
      assert(await h.prepare('one', legacy), 'reopen failed');
      assert(h.list('one', 'memory').length === 2, 'new record lost');
      assert(await h.prepare('two', {}), 'second profile failed');
      assert(h.list('two', 'memory').length === 0, 'profiles mixed');
      assert(legacy.memory.length === 2, 'legacy source changed');
    });
    await check('fallback local history is merged after IndexedDB recovers', async function () {
      var fixture = factory(), h = fixture.create();
      await h.prepare('one', { memory: ['a'] }); await h.close();
      h = fixture.create(); await h.prepare('one', { memory: ['a', 'fallback-record'] });
      assert(h.list('one', 'memory').length === 2, 'fallback history lost');
    });
    await check('explicit reset racing with initial import cannot resurrect history', async function () {
      var fixture = factory(), h = fixture.create();
      var importJob = h.prepare('one', { math: ['old'] });
      var resetJob = h.forget('one');
      await Promise.all([importJob, resetJob]);
      assert(h.list('one', 'math').length === 0, 'memory resurrected');
      await h.close(); h = fixture.create(); await h.prepare('one', {});
      assert(h.list('one', 'math').length === 0, 'database resurrected');
    });
    await check('future schema aborts transaction without changing records', async function () {
      var fixture = factory(), h = fixture.create();
      await h.prepare('one', { memory: ['preserved'] }); await h.close();
      var db = await new Promise(function (resolve, reject) {
        var request = indexedDB.open(fixture.name, 1); request.onsuccess = function () { resolve(request.result); }; request.onerror = reject;
      });
      await new Promise(function (resolve, reject) {
        var tx = db.transaction('migrations', 'readwrite'); tx.objectStore('migrations').put({ profile: 'one', version: 99 });
        tx.oncomplete = resolve; tx.onabort = reject;
      }); db.close();
      h = fixture.create(); assert(!await h.prepare('one', { memory: ['should-not-import'] }), 'future schema accepted');
      assert(h.error().message === 'history-schema-too-new', 'wrong error');
      await h.close();
      db = await new Promise(function (resolve, reject) {
        var request = indexedDB.open(fixture.name, 1); request.onsuccess = function () { resolve(request.result); }; request.onerror = reject;
      });
      var records = await new Promise(function (resolve, reject) {
        var tx = db.transaction(['tasks', 'migrations'], 'readonly');
        var result = {};
        var tasks = tx.objectStore('tasks').getAll(); tasks.onsuccess = function () { result.tasks = tasks.result; };
        var marker = tx.objectStore('migrations').get('one'); marker.onsuccess = function () { result.version = marker.result.version; };
        tx.oncomplete = function () { resolve(result); }; tx.onabort = reject;
      }); db.close();
      assert(records.version === 99 && records.tasks.length === 1 && records.tasks[0].signature === 'preserved', 'aborted migration changed stored data');
    });
    await check('newer IndexedDB version is rejected safely', async function () {
      var fixture = factory();
      var db = await new Promise(function (resolve, reject) {
        var request = indexedDB.open(fixture.name, 2); request.onsuccess = function () { resolve(request.result); }; request.onerror = reject;
      }); db.close();
      var h = fixture.create();
      assert(!await h.prepare('one', {}), 'new database version accepted');
      assert(h.error().message === 'history-schema-too-new', 'version error not recognized');
    });
    lines.push('DONE: 5 checks passed. User storage was not accessed.');
  } catch (error) { lines.push('FAIL ' + error.message); }
  finally {
    await Promise.all(histories.map(function (h) { return h.close(); }));
    // Only unique disposable databases created by this test page are removed.
    await Promise.all(names.map(function (name) {
      return new Promise(function (resolve) { var req = indexedDB.deleteDatabase(name); req.onsuccess = req.onerror = req.onblocked = resolve; });
    }));
    output.textContent = lines.join('\n');
  }
})();
