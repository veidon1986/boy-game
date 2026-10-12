/* games/brain.js — «Умные загадки»: прогрессия логических уровней (аналог Brain Check).
   Микс визуальных и текстовых загадок. Уровни детерминированы (seed = номер уровня),
   поэтому уровень N одинаков у всех, а сложность ограничена возрастом ребёнка. */
(function (global) {
  'use strict';

  var el = UI.el;

  var TOTAL = 40;

  /* ---------- Детерминированный ГПСЧ (mulberry32) ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function rInt(rng, a, b) { return a + Math.floor(rng() * (b - a + 1)); }
  function rPick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
  function rShuffle(rng, arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }
  function rSample(rng, arr, n) { return rShuffle(rng, arr).slice(0, n); }
  function rep(sym, n) {
    var out = [];
    for (var i = 0; i < n; i++) out.push(sym);
    return out.join(' ');
  }

  /* ---------- Данные ---------- */
  var THEMES = {
    fruits:    ['🍎', '🍌', '🍓', '🍇', '🍊', '🍐', '🍑', '🍒', '🍉', '🍍'],
    animals:   ['🐶', '🐱', '🐰', '🐮', '🐸', '🐷', '🦊', '🐼', '🐔', '🐵'],
    transport: ['🚗', '🚌', '✈️', '🚲', '🚀', '⛵', '🚂', '🚁', '🛵', '🚓'],
    toys:      ['🧸', '🪀', '🪁', '🎈', '🛹', '⚽', '🎲', '🧩', '🪃', '🛼'],
    nature:    ['🌳', '🌸', '🌿', '🍄', '🌵', '🌻', '🌷', '🌲', '🍁', '🪴']
  };
  var THEME_KEYS = Object.keys(THEMES);

  // Похожие группы (для сложных «найди лишнее»).
  var FAMILIES = [
    { core: ['🍎', '🍌', '🍓', '🍇', '🍊', '🍐', '🍑', '🍒'], odd: ['🥕', '🥦', '🥔', '🌽', '🥒', '🫑'] },
    { core: ['🐶', '🐱', '🐮', '🐷', '🐑', '🐔', '🐴', '🐐'], odd: ['🦁', '🐯', '🐘', '🦒', '🐻', '🐺', '🦓'] },
    { core: ['🚗', '🚌', '🚚', '🚓', '🚕', '🚐'], odd: ['✈️', '🚁', '🚀', '⛵', '🛸'] },
    { core: ['👕', '👖', '👗', '🧦', '🧥', '👚', '🩳', '👔'], odd: ['👟', '👞', '🥾', '🩴', '👠'] },
    { core: ['🌳', '🌸', '🌿', '🌻', '🌷', '🌵'], odd: ['🍄', '🪨', '🌊'] }
  ];

  var CIRCLES = ['🔴', '🔵', '🟢', '🟡', '🟣', '🟠', '🟤', '⚫', '⚪'];
  var SYMS = ['🔴', '🔵', '🟢', '🟡', '🔺', '🔻', '⭐', '⬛', '⬜', '🟣', '🟠'];

  // Категории «кто/что умеет» и «что можно».
  var CATS = [
    { qYes: 'brain.q.fly.yes', qNo: 'brain.q.fly.no',
      yes: ['🐦', '🦅', '🦋', '🐝', '✈️', '🚁', '🛸', '🪁', '🐞', '🦇'],
      no:  ['🐟', '🐶', '🚗', '🪨', '🐢', '🐮', '🍎', '🚂', '🐍', '🐘', '🌳'] },
    { qYes: 'brain.q.swim.yes', qNo: 'brain.q.swim.no',
      yes: ['🐟', '🐬', '🐳', '🦆', '🐙', '🦈', '🦭', '🐠', '🚤'],
      no:  ['🐦', '🦅', '🚗', '🪨', '🐮', '🍎', '🦁', '🐘', '🐝', '🌳'] },
    { qYes: 'brain.q.edible.yes', qNo: 'brain.q.edible.no',
      yes: ['🍎', '🍌', '🍞', '🍕', '🥕', '🧀', '🍓', '🍇', '🍪', '🍉'],
      no:  ['🪨', '🚗', '🧦', '⚽', '📚', '🪑', '🌳', '🔨', '🎈', '🧸'] }
  ];

  // Животные по условному «росту» (для сравнения).
  var SIZE = [
    { e: '🐜', s: 1 }, { e: '🐭', s: 2 }, { e: '🐰', s: 3 },
    { e: '🐱', s: 4 }, { e: '🐶', s: 5 }, { e: '🐷', s: 6 },
    { e: '🐮', s: 7 }, { e: '🐻', s: 8 }, { e: '🐘', s: 9 }
  ];

  /* ---------- Генераторы уровней ----------
     Каждый возвращает { q, scene, options, answer }:
     q — ключ вопроса, scene — строка-сцена (или null), options — варианты,
     answer — индекс правильного. */

  function genOdd(rng, tier) {
    var count = tier <= 0 ? 3 : (tier === 1 ? 4 : (tier === 2 ? 5 : 6));
    var core, odd;
    if (tier >= 2 && rng() < 0.6) {
      var fam = rPick(rng, FAMILIES);
      core = rSample(rng, fam.core, count - 1);
      odd = rPick(rng, fam.odd);
    } else {
      var mainKey = rPick(rng, THEME_KEYS);
      var otherKeys = THEME_KEYS.filter(function (k) { return k !== mainKey; });
      core = rSample(rng, THEMES[mainKey], count - 1);
      odd = rPick(rng, THEMES[rPick(rng, otherKeys)]);
    }
    core = UI.unique(core.filter(function (e) { return e !== odd; }));
    while (core.length < count - 1) {
      var extra = rPick(rng, THEMES[rPick(rng, THEME_KEYS)]);
      if (extra !== odd && core.indexOf(extra) < 0) core.push(extra);
    }
    var opts = rShuffle(rng, core.concat([odd]));
    return { q: 'brain.q.odd', scene: null, options: opts, answer: opts.indexOf(odd) };
  }

  function genColorOdd(rng, tier) {
    var count = tier <= 0 ? 3 : (tier === 1 ? 4 : 5);
    var base = rPick(rng, CIRCLES);
    var other = rPick(rng, CIRCLES.filter(function (c) { return c !== base; }));
    var opts = [];
    for (var i = 0; i < count - 1; i++) opts.push(base);
    opts.push(other);
    opts = rShuffle(rng, opts);
    return { q: 'brain.q.odd', scene: null, options: opts, answer: opts.indexOf(other) };
  }

  function genCount(rng, tier) {
    var max = tier <= 0 ? 5 : (tier === 1 ? 8 : (tier === 2 ? 10 : 12));
    var k = rInt(rng, 2, max);
    var emoji = rPick(rng, THEMES[rPick(rng, THEME_KEYS)]);
    var scene = rep(emoji, k);
    var opts = [k];
    while (opts.length < 4) {
      var cand = k + rInt(rng, -3, 3);
      if (cand >= 1 && cand !== k && opts.indexOf(cand) < 0) opts.push(cand);
    }
    opts = rShuffle(rng, opts);
    return { q: 'brain.q.count', scene: scene, options: opts.map(String), answer: opts.indexOf(k) };
  }

  function genPattern(rng, tier) {
    var len = tier <= 0 ? 2 : (tier === 1 ? 2 : 3);
    var cycle = rSample(rng, SYMS, len);
    var totalShown = cycle.length * 2 + 1;
    var shown = [];
    for (var i = 0; i < totalShown; i++) shown.push(cycle[i % cycle.length]);
    var next = cycle[totalShown % cycle.length];
    var scene = shown.join(' ') + '  ?';
    var distract = rSample(rng, SYMS.filter(function (s) { return s !== next; }), 3);
    var opts = rShuffle(rng, [next].concat(distract));
    return { q: 'brain.q.next', scene: scene, options: opts, answer: opts.indexOf(next) };
  }

  function genMath(rng, tier) {
    var max = tier <= 0 ? 5 : (tier === 1 ? 10 : (tier === 2 ? 15 : 20));
    var add = tier <= 1 || rng() < 0.5;
    var emoji = rPick(rng, ['🍎', '⭐', '🎈', '🐟', '🍪', '🌸']);
    var a, b, res, scene;
    if (add) {
      a = rInt(rng, 1, Math.max(1, max - 1));
      b = rInt(rng, 1, Math.max(1, max - a));
      res = a + b;
      scene = rep(emoji, a) + '  +  ' + rep(emoji, b);
    } else {
      a = rInt(rng, 2, max);
      b = rInt(rng, 1, a - 1);
      res = a - b;
      scene = rep(emoji, a) + '  −  ' + rep(emoji, b);
    }
    var opts = [res];
    while (opts.length < 4) {
      var cand = res + rInt(rng, -3, 3);
      if (cand >= 0 && cand !== res && opts.indexOf(cand) < 0) opts.push(cand);
    }
    opts = rShuffle(rng, opts);
    return { q: add ? 'brain.q.sum' : 'brain.q.rest', scene: scene, options: opts.map(String), answer: opts.indexOf(res) };
  }

  function genNumber(rng, tier) {
    var max = tier <= 0 ? 10 : (tier === 1 ? 20 : (tier === 2 ? 100 : 1000));
    var big = rng() < 0.5;
    var n = tier <= 1 ? 2 : 3;
    var set = [];
    while (set.length < n) {
      var v = rInt(rng, 1, max);
      if (set.indexOf(v) < 0) set.push(v);
    }
    var target = big ? Math.max.apply(null, set) : Math.min.apply(null, set);
    var opts = rShuffle(rng, set);
    return { q: big ? 'brain.q.bigNum' : 'brain.q.smallNum', scene: null, options: opts.map(String), answer: opts.indexOf(target) };
  }

  function genSeq(rng, tier) {
    var step = tier <= 1 ? rInt(rng, 1, 2) : (tier === 2 ? rInt(rng, 2, 3) : rInt(rng, 2, 5));
    var start = tier <= 1 ? rInt(rng, 1, 3) : rInt(rng, 1, 6);
    var terms = [];
    for (var i = 0; i < 4; i++) terms.push(start + i * step);
    var answer = start + 4 * step;
    var scene = terms.join('  ·  ') + '  ·  ?';
    var opts = [answer];
    while (opts.length < 4) {
      var cand = answer + rInt(rng, -step - 1, step + 1);
      if (cand > 0 && cand !== answer && opts.indexOf(cand) < 0) opts.push(cand);
    }
    opts = rShuffle(rng, opts);
    return { q: 'brain.q.seq', scene: scene, options: opts.map(String), answer: opts.indexOf(answer) };
  }

  function genCategory(rng, tier) {
    var cat = rPick(rng, CATS);
    var need = tier <= 1 ? 3 : 4;
    var positive = rng() < 0.5;
    var target, opts, q;
    if (positive) {
      target = rPick(rng, cat.yes);
      opts = [target].concat(rSample(rng, cat.no, need - 1));
      q = cat.qYes;
    } else {
      target = rPick(rng, cat.no);
      opts = [target].concat(rSample(rng, cat.yes, need - 1));
      q = cat.qNo;
    }
    opts = rShuffle(rng, opts);
    return { q: q, scene: null, options: opts, answer: opts.indexOf(target) };
  }

  function genSize(rng, tier) {
    var n = tier <= 0 ? 2 : 3;
    var big = rng() < 0.5;
    var base = rPick(rng, SIZE);
    var pool = SIZE.filter(function (x) { return Math.abs(x.s - base.s) >= 2; });
    if (pool.length < n - 1) pool = SIZE.filter(function (x) { return x !== base; });
    var set = [base].concat(rSample(rng, pool, n - 1));
    var target = set[0];
    for (var i = 1; i < set.length; i++) {
      if (big ? set[i].s > target.s : set[i].s < target.s) target = set[i];
    }
    var opts = rShuffle(rng, set.map(function (x) { return x.e; }));
    return { q: big ? 'brain.q.bigSize' : 'brain.q.smallSize', scene: null, options: opts, answer: opts.indexOf(target.e) };
  }

  /* ---------- Выбор уровня ---------- */

  function tierFor(level, age) {
    var tier = level <= 10 ? 0 : (level <= 22 ? 1 : (level <= 32 ? 2 : 3));
    var cap = age === 'preschool' ? 1 : (age === 'junior' ? 2 : 3);
    return Math.min(tier, cap);
  }

  function levelNameFor(tier) {
    return tier <= 0 ? 'easy' : (tier === 1 ? 'medium' : 'hard');
  }

  function poolFor(tier) {
    if (tier <= 0) return [genOdd, genColorOdd, genCount, genPattern, genMath];
    if (tier === 1) return [genOdd, genColorOdd, genCount, genPattern, genMath, genNumber, genSize];
    if (tier === 2) return [genOdd, genPattern, genMath, genNumber, genSeq, genCategory, genSize];
    return [genOdd, genPattern, genMath, genNumber, genSeq, genCategory];
  }

  function makeLevel(level, age) {
    var tier = tierFor(level, age);
    var rng = mulberry32(((level * 2654435761) ^ (tier * 40503)) >>> 0);
    var pool = poolFor(tier);
    var gen = pool[Math.floor(rng() * pool.length)];
    return gen(rng, tier);
  }

  /* ---------- Запуск ---------- */

  function start(root, App) {
    var age = App.age();
    var level = Math.min(Math.max(1, Store.brainLevel()), TOTAL);
    var mistakes = 0;
    var locked = false;
    var advanceTimer = null;

    var progressEl = el('div', { class: 'game-stats' });
    var stage = el('div', { class: 'brain-stage' });

    root.appendChild(el('p', { class: 'game-hint' }, t('game.brain.hint')));
    root.appendChild(progressEl);
    root.appendChild(stage);

    function saveProgress() {
      if (level + 1 > Store.brainLevel()) Store.setBrainLevel(Math.min(level + 1, TOTAL));
    }

    function render() {
      locked = false;
      mistakes = 0;
      var data = makeLevel(level, age);
      UI.clear(stage);

      progressEl.textContent = t('brain.progress', { n: level, total: TOTAL });

      stage.appendChild(el('div', { class: 'brain-prompt' }, t(data.q)));
      if (data.scene) stage.appendChild(el('div', { class: 'brain-scene' }, data.scene));

      var grid = el('div', { class: 'brain-grid' + (data.options.length > 4 ? ' many' : '') });
      data.options.forEach(function (opt, idx) {
        grid.appendChild(el('button', {
          type: 'button', class: 'brain-opt',
          onclick: function (ev) { choose(ev.currentTarget, idx, data); }
        }, opt));
      });
      stage.appendChild(grid);
    }

    function choose(btn, idx, data) {
      if (locked) return;
      if (idx === data.answer) {
        locked = true;
        btn.classList.add('correct');
        Sound.play('win');
        var stars = mistakes === 0 ? 3 : (mistakes === 1 ? 2 : 1);
        Store.recordResult('brain', stars, levelNameFor(tierFor(level, age)));
        saveProgress();
        var newly = Achievements.checkNew();
        if (newly.length) App.showAchievements(newly, nextLevel);
        else advanceTimer = setTimeout(nextLevel, 800);
      } else {
        mistakes++;
        btn.classList.add('wrong');
        Sound.play('wrong');
        setTimeout(function () { btn.classList.remove('wrong'); }, 500);
      }
    }

    function nextLevel() {
      advanceTimer = null;
      if (level >= TOTAL) { victory(); return; }
      level++;
      render();
    }

    function victory() {
      var newly = Achievements.checkNew();

      function showVictory() {
        App.showOverlay(el('div', { class: 'result' }, [
          el('div', { class: 'result-emoji' }, '🧠'),
          el('div', { class: 'result-title' }, t('brain.victory')),
          el('p', { class: 'result-text' }, t('brain.progress', { n: TOTAL, total: TOTAL })),
          el('div', { class: 'result-actions' }, [
            el('button', {
              type: 'button', class: 'btn primary',
              onclick: function () {
                Sound.play('tap');
                App.hideOverlay();
                level = 1; Store.setBrainLevel(1); render();
              }
            }, '🔁 ' + t('brain.restart')),
            el('button', {
              type: 'button', class: 'btn',
              onclick: function () { Sound.play('tap'); App.hideOverlay(); App.goHome(); }
            }, '🏠 ' + t('home'))
          ])
        ]));
      }

      if (newly.length) App.showAchievements(newly, showVictory);
      else showVictory();
    }

    render();

    return function cleanup() {
      if (advanceTimer) { clearTimeout(advanceTimer); advanceTimer = null; }
      locked = true;
    };
  }

  App.register({
    id: 'brain',
    ages: ['preschool', 'junior', 'school'],
    emoji: '🧠',
    titleKey: 'game.brain',
    descKey: 'game.brain.desc',
    start: start
  });
})(window);
