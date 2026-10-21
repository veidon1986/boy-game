/* games/brain.js — «Умные загадки»: логические уровни с хитрыми загадками.
   Главный фокус — загадки-ловушки (как в Brain Check): нестандартные вопросы
   и неочевидные ответы. Первые уровни — простой «разогрев» для малышей
   (найди лишнее, посчитай). Прогресс хранится в localStorage. */
(function (global) {
  'use strict';

  var el = UI.el;

  var TOTAL = 30;
  var WARMUP = 6; // первые уровни — простые, дальше — только хитрые загадки

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

  /* ---------- Разогрев: простые типы для первых уровней ---------- */
  var THEMES = {
    fruits:    ['🍎', '🍌', '🍓', '🍇', '🍊', '🍐', '🍑', '🍒', '🍉', '🍍'],
    animals:   ['🐶', '🐱', '🐰', '🐮', '🐸', '🐷', '🦊', '🐼', '🐔', '🐵'],
    transport: ['🚗', '🚌', '✈️', '🚲', '🚀', '⛵', '🚂', '🚁', '🛵', '🚓'],
    toys:      ['🧸', '🪀', '🪁', '🎈', '🛹', '⚽', '🎲', '🧩', '🪃', '🛼'],
    nature:    ['🌳', '🌸', '🌿', '🍄', '🌵', '🌻', '🌷', '🌲', '🍁', '🪴']
  };
  var THEME_KEYS = Object.keys(THEMES);
  var CIRCLES = ['🔴', '🔵', '🟢', '🟡', '🟣', '🟠', '🟤', '⚫', '⚪'];

  function genOdd(rng) {
    var count = rng() < 0.5 ? 3 : 4;
    var mainKey = rPick(rng, THEME_KEYS);
    var otherKeys = THEME_KEYS.filter(function (k) { return k !== mainKey; });
    var core = UI.unique(rSample(rng, THEMES[mainKey], count - 1));
    var odd = rPick(rng, THEMES[rPick(rng, otherKeys)]);
    while (core.length < count - 1) {
      var extra = rPick(rng, THEMES[rPick(rng, THEME_KEYS)]);
      if (extra !== odd && core.indexOf(extra) < 0) core.push(extra);
    }
    var opts = rShuffle(rng, core.concat([odd]));
    return { q: 'brain.q.odd', scene: null, options: opts, answer: opts.indexOf(odd) };
  }

  function genColorOdd(rng) {
    var count = 4; // 3 одинаковых + 1 другой — задача читается однозначно
    var base = rPick(rng, CIRCLES);
    var other = rPick(rng, CIRCLES.filter(function (c) { return c !== base; }));
    var opts = [];
    for (var i = 0; i < count - 1; i++) opts.push(base);
    opts.push(other);
    opts = rShuffle(rng, opts);
    return { q: 'brain.q.odd', scene: null, options: opts, answer: opts.indexOf(other) };
  }

  function genCount(rng) {
    var k = rInt(rng, 2, 5);
    var emoji = rPick(rng, THEMES[rPick(rng, THEME_KEYS)]);
    var scene = rep(emoji, k);
    var opts = [k];
    while (opts.length < 4) {
      var cand = k + rInt(rng, -2, 2);
      if (cand >= 1 && cand !== k && opts.indexOf(cand) < 0) opts.push(cand);
    }
    opts = rShuffle(rng, opts);
    return { q: 'brain.q.count', scene: scene, options: opts.map(String), answer: opts.indexOf(k) };
  }

  /* ---------- Хитрые загадки (главный фокус) ----------
     q — ключ вопроса (RU/EN в i18n), answer — правильный ответ-эмодзи,
     wrong — правдоподобные, но неверные варианты. */
  var RIDDLES = [
    { q: 'brain.r.1',  answer: '🪜', wrong: ['🛗', '🚠', '⛷️'] },          // идёт вверх-вниз, но не двигается
    { q: 'brain.r.2',  answer: '🎹', wrong: ['🔑', '🚪', '🪟'] },          // клавиши, но не открывает замок
    { q: 'brain.r.3',  answer: '⚖️', wrong: ['🍎', '🪶', '🍉'] },          // кг фруктов или кг перьев
    { q: 'brain.r.4',  answer: '❤️', wrong: ['🥚', '🪟', '🍶'] },          // разбить, не дотрагиваясь
    { q: 'brain.r.5',  answer: '🌊', wrong: ['🏃', '🐎', '🚗'] },          // бежит без ног
    { q: 'brain.r.6',  answer: '12️⃣', wrong: ['1️⃣', '2️⃣', '28️⃣'] },      // месяцы с 28 днями
    { q: 'brain.r.7',  answer: '1️⃣', wrong: ['7️⃣', '8️⃣', '0️⃣'] },        // семь братьев — одна сестра
    { q: 'brain.r.8',  answer: '🤧', wrong: ['⚽', '🎾', '🥏'] },          // поймать, но не бросить
    { q: 'brain.r.9',  answer: '🕳️', wrong: ['📦', '🎁', '🗃️'] },          // чем больше берёшь, тем больше
    { q: 'brain.r.10', answer: '🌽', wrong: ['🐰', '🎧', '🐘'] },          // уши, но не слышит
    { q: 'brain.r.11', answer: '🪡', wrong: ['👁️', '🧷', '🪢'] },          // глаз, но не видит
    { q: 'brain.r.12', answer: '🎵', wrong: ['📻', '🎧', '🔊'] },          // услышать, но не увидеть
    { q: 'brain.r.13', answer: '🥄', wrong: ['✋', '🫖', '🍵'] },          // чем мешать чай
    { q: 'brain.r.14', answer: '🧍', wrong: ['🦖', '🐢', '🦔'] },          // 4 ноги, 2, 3 — человек
    { q: 'brain.r.15', answer: '🧻', wrong: ['🧽', '☂️', '🚿'] },          // мокнет, пока вытирает
    { q: 'brain.r.16', answer: '🥛', wrong: ['🌊', '🚿', '🏺'] },          // где вода стоит столбом
    { q: 'brain.r.17', answer: '🕰️', wrong: ['🖼️', '🔔', '📆'] },          // висит и тикает
    { q: 'brain.r.18', answer: '🦇', wrong: ['🐻', '🦉', '🐱'] },          // спит вниз головой
    { q: 'brain.r.19', answer: '🍾', wrong: ['🧸', '📷', '🧦'] },          // шея без головы
    { q: 'brain.r.20', answer: '🌧️', wrong: ['🥚', '📱', '🍷'] },          // падает, но не разбивается
    { q: 'brain.r.21', answer: '🎈', wrong: ['✈️', '🦅', '🐛'] },          // летает без крыльев
    { q: 'brain.r.22', answer: '🪑', wrong: ['🐴', '🧍', '🛴'] },          // четыре ноги, не ходит
    { q: 'brain.r.23', answer: '6️⃣', wrong: ['3️⃣', '5️⃣', '4️⃣'] },        // концы трёх палок
    { q: 'brain.r.24', answer: '💤', wrong: ['🌙', '🕶️', '🎭'] }           // увидеть с закрытыми глазами
  ];

  /* ---------- Выбор уровня ---------- */

  function makeLevel(level) {
    if (level <= WARMUP) {
      var rng = mulberry32((level * 2654435761) >>> 0);
      var gens = [genOdd, genColorOdd, genCount];
      return gens[Math.floor(rng() * gens.length)](rng);
    }
    var r = RIDDLES[level - 1 - WARMUP];
    var rr = mulberry32((level * 2654435761) >>> 0);
    var opts = rShuffle(rr, [r.answer].concat(r.wrong));
    return { q: r.q, scene: null, options: opts, answer: opts.indexOf(r.answer) };
  }

  function tierFor(level) { return level <= WARMUP ? 0 : 1; }
  function levelNameFor(tier) { return tier <= 0 ? 'easy' : 'medium'; }

  /* ---------- Запуск ---------- */

  function start(root, App) {
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
      if (level > TOTAL) { victory(); return; }
      locked = false;
      mistakes = 0;
      var data = makeLevel(level);
      var taskKey = data.q + '|' + (data.scene || '') + '|' + data.options.slice().sort().join(',') + '|' + data.options[data.answer];
      if (!Store.rememberTask('brain', taskKey, TOTAL + WARMUP)) {
        level++;
        render();
        return;
      }
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
        Store.recordResult('brain', stars, levelNameFor(tierFor(level)));
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
