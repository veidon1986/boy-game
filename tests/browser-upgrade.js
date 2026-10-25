/* Real Service Worker + IndexedDB; only memory-backed synthetic profiles. */
(function () {
  'use strict';
  var data = new Map(), lines = [], expected, first, second;
  var frame = document.getElementById('app');
  var output = document.getElementById('results');
  var storage = {
    getItem: function (key) { return data.has(key) ? data.get(key) : null; },
    setItem: function (key, value) { data.set(key, String(value)); },
    removeItem: function (key) { data.delete(key); },
    key: function (n) { return Array.from(data.keys())[n] || null; }
  };
  Object.defineProperty(storage, 'length', { get: function () { return data.size; } });
  function log(text) { lines.push(text); output.textContent = lines.join('\n'); }
  function assert(ok, message) { if (!ok) throw new Error(message); }
  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  function waitFor(read, label, timeout) {
    var start = performance.now();
    return new Promise(function (resolve, reject) {
      function poll() {
        try { var value = read(); if (value) { resolve(value); return; } }
        catch (e) { reject(e); return; }
        if (performance.now() - start > (timeout || 20000)) { reject(new Error('Timeout: ' + label)); return; }
        setTimeout(poll, 60);
      }
      poll();
    });
  }
  window.ReleaseFixture = {
    storage: storage, seeded: false, loads: 0,
    dbName: 'boygame-test-upgrade-' + Date.now() + '-' + Math.random().toString(36).slice(2),
    seed: function (win) {
      assert(!win.Store.schemaVersion, 'Baseline must predate the schema migration');
      first = win.Store.addProfile('Тест Алиса', '🦊', 'junior');
      win.Store.recordResult('math', 3, 'hard');
      win.Store.recordResult('memory', 2, 'medium');
      win.Store.setBest('runner', 123); win.Store.setBest('blocks', 42);
      win.Store.setChessRating(830); win.Store.setBrainLevel(4);
      win.Store.setLimitMinutes(45); win.Store.addUsage(37);
      win.Store.rememberTask('math', 'legacy-math');
      win.Store.rememberTask('chess-lessons-moves', 'legacy-lesson');
      win.Achievements.checkNew('math', 'hard');
      second = win.Store.addProfile('Тест Борис', '🐼', 'school');
      win.Store.recordResult('sequence', 1, 'easy');
      win.Store.rememberTask('math', 'other-profile-task');
      win.Store.setLimitMinutes(30); win.Store.setChessRating(640);
      win.Store.switchProfile(first.id);
      win.Store.set('permissionsPromptResolved', true);
      win.Store.set('permissionsPromptSeen', true);
      win.Store.set('analyticsEnabled', false);
      // These preferences are also present before audio.js is evaluated on subsequent loads.
      win.Store.set('music', false); win.Store.set('sound', false);
      expected = new Map(data);
      this.seeded = true;
    }
  };
  var fixture = window.ReleaseFixture;
  document.getElementById('run').onclick = async function () {
    this.disabled = true;
    try {
      assert(location.hostname === '127.0.0.1', 'Loopback server required');
      log('START: старый релиз, память вместо localStorage');
      frame.src = '/app/';
      var old = await waitFor(function () {
        var w = frame.contentWindow;
        return w.App && w.App.els.screen && fixture.seeded && w;
      }, 'old app');
      await old.navigator.serviceWorker.ready;
      await waitFor(function () { return frame.contentWindow.navigator.serviceWorker.controller; }, 'old SW control');
      await waitFor(function () { return frame.contentWindow.App && frame.contentWindow.App.els.screen; }, 'initial controller reload');
      old = frame.contentWindow;
      assert(old.localStorage === storage, 'Storage isolation failed');
      log('PASS: старый релиз создал два профиля, результаты, кубки, рейтинг и историю');

      await fetch('/fixture/candidate', { method: 'POST' });
      var registration = await old.navigator.serviceWorker.getRegistration();
      await registration.update();
      await waitFor(function () { return registration.waiting && old.App.updateAvailable; }, 'update prompt');
      assert(old.document.getElementById('overlay').textContent.includes(old.t('update.now')), 'Update prompt missing');
      log('PASS: приложение обнаружило обновление и предложило его установить');
      var before = fixture.loads;
      // The real user-facing action, including Store.flush and SKIP_WAITING.
      var update = Array.from(old.document.querySelectorAll('#overlay button')).find(function (b) { return b.textContent === old.t('update.now'); });
      assert(update, 'Update button missing'); update.click();
      var current = await waitFor(function () {
        var w = frame.contentWindow;
        return fixture.loads > before && w.AppBuild && w.App && w.App.els.screen && w;
      }, 'candidate reload');
      await current.Store.ready();
      assert(current.localStorage === storage, 'Storage isolation lost on upgrade');
      expected.forEach(function (value, key) { assert(data.get(key) === value, 'Changed existing key: ' + key); });
      assert(current.Store.profiles().length === 2 && current.Store.activeId() === first.id, 'Profiles lost');
      assert(current.Store.gameStats('math').hard.stars === 3, 'Stars lost');
      assert(current.Store.best('runner') === 123 && current.Store.best('blocks') === 42, 'Records lost');
      assert(current.Store.chessRating() === 830 && current.Store.brainLevel() === 4, 'Rating or brain level lost');
      assert(current.Store.usage().seconds === 37 && current.Store.limitMinutes() === 45, 'Daily limit lost');
      assert(current.Store.get('schemaVersion', 0) === 1, 'Schema not versioned');
      assert(same(current.Store.taskHistory('math'), ['legacy-math']), 'History not imported');
      assert(same(current.Store.taskHistory('chess-lessons-moves'), ['legacy-lesson']), 'Lesson history lost');
      current.Store.rememberTask('math', 'candidate-math'); await current.Store.flush();
      current.Store.switchProfile(second.id); await current.Store.prepareHistory();
      assert(same(current.Store.taskHistory('math'), ['other-profile-task']), 'Profiles mixed');
      assert(current.Store.chessRating() === 640 && current.Store.gameStats('sequence').plays === 1, 'Second profile changed');
      current.Store.switchProfile(first.id); await current.Store.prepareHistory();
      log('PASS: все прежние ключи сохранены побайтно; история перенесена и профили изолированы');

      await fetch('/fixture/offline', { method: 'POST' });
      before = fixture.loads; frame.contentWindow.location.reload();
      current = await waitFor(function () {
        var w = frame.contentWindow;
        return fixture.loads > before && w.AppBuild && w.App && w.App.els.screen && w;
      }, 'offline app');
      await current.Store.prepareHistory();
      assert(current.Store.taskHistory('math').includes('candidate-math'), 'New history lost after reload');
      assert(current.Store.gameStats('math').hard.stars === 3, 'Offline progress lost');
      assert(await current.App.startGame('chess'), 'Offline lazy chess failed');
      assert(current.ChessRules && typeof current.ChessRules.legalMoves === 'function', 'Offline engine absent');
      current.App.goHome();
      log('PASS: новый релиз открылся без сети; новая история сохранена; шахматы и движок загружены из кэша');
      log('DONE: обновление со старого релиза прошло. Пользовательское хранилище не открывалось.');
    } catch (error) { log('FAIL: ' + error.message); console.error(error); }
  };
})();
