(function () {
  'use strict';
  var frame = document.getElementById('app'), output = document.getElementById('results');
  var data = new Map([['boygame.music', 'false'], ['boygame.sound', 'false']]);
  var results = { baseline: [], candidate: [] };
  window.ReleaseFixture = {
    dbName: 'boygame-test-perf-unused-' + Date.now(), loads: 0,
    storage: {
      getItem: function (key) { return data.has(key) ? data.get(key) : null; },
      setItem: function () { throw new Error('Read-only benchmark'); },
      removeItem: function () { throw new Error('Read-only benchmark'); }
    },
    beforeBoot: function (w) {
      w.Store.setProfile({ name: 'Замер', avatar: '🧪', age: 'school' });
      var init = w.App.init;
      w.App.init = function () { init.apply(this, arguments); w.fixtureMenuReady = w.performance.now(); };
    }
  };
  function waitFor(read) {
    var started = performance.now();
    return new Promise(function (resolve, reject) {
      function poll() {
        var value;
        try { value = read(); } catch (e) { reject(e); return; }
        if (value) resolve(value);
        else if (performance.now() - started > 15000) reject(new Error('App timeout'));
        else setTimeout(poll, 5);
      }
      poll();
    });
  }
  async function launch(kind, index) {
    frame.src = '/' + kind + '/?test=1&run=' + index;
    var w = await waitFor(function () {
      var child = frame.contentWindow;
      return child.location.pathname === '/' + kind + '/' && child.location.search === '?test=1&run=' + index &&
        child.fixtureMenuReady && child.document.readyState === 'complete' && child;
    });
    var resources = w.performance.getEntriesByType('resource');
    var scripts = resources.filter(function (r) { return r.initiatorType === 'script' && !r.name.includes('/fixture/'); });
    var menu = w.fixtureMenuReady;
    var count = w.document.querySelectorAll('script[src*="/games/"]').length;
    var began = w.performance.now();
    await w.App.startGame('memory');
    await new Promise(function (resolve) { w.requestAnimationFrame(resolve); });
    var first = w.performance.now() - began;
    if (!w.document.querySelector('.memory-board .memo-card')) throw new Error('Memory did not open');
    w.App.goHome(); began = w.performance.now();
    await w.App.startGame('memory');
    await new Promise(function (resolve) { w.requestAnimationFrame(resolve); });
    var warm = w.performance.now() - began;
    w.App.goHome();
    return { menu: menu, first: first, warm: warm,
      jsBytes: scripts.reduce(function (sum, r) { return sum + r.decodedBodySize; }, 0),
      jsCount: scripts.length, eagerGames: count };
  }
  function median(rows, field) {
    var values = rows.map(function (r) { return r[field]; }).sort(function (a, b) { return a - b; });
    return values[Math.floor(values.length / 2)];
  }
  document.getElementById('run').onclick = async function () {
    this.disabled = true;
    try {
      for (var i = 0; i < 9; i++) {
        // Alternate order to reduce systematic first-run and thermal bias.
        for (var kind of (i % 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate'])) {
          results[kind].push(await launch(kind, i));
          output.textContent = 'Выполнено запусков: ' + (results.baseline.length + results.candidate.length) + ' / 18';
        }
      }
      var lines = ['DONE: медиана 9 запусков. Старый → новый релиз:'];
      [['Меню, мс', 'menu'], ['Первая игра, мс', 'first'], ['Повторная игра, мс', 'warm'],
       ['JavaScript меню, байт', 'jsBytes'], ['JS-запросов меню', 'jsCount'], ['Игр загружено в меню', 'eagerGames']].forEach(function (row) {
        lines.push(row[0] + ': ' + median(results.baseline, row[1]).toFixed(1) + ' → ' + median(results.candidate, row[1]).toFixed(1));
      });
      lines.push('Время включает создание интерфейса; запуск игры — до ближайшего кадра. Это не замер на телефоне и не замер сети интернет.');
      output.textContent = lines.join('\n');
    } catch (error) { output.textContent = 'FAIL: ' + error.message; console.error(error); }
  };
})();
