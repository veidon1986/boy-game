/* games/odd.js — «Что лишнее?»: логика, обобщение, умение находить общий признак. */
(function (global) {
  'use strict';

  var el = UI.el;

  // Явно разные темы — для лёгкого и среднего уровня.
  var THEMES = {
    animals:   ['🐶', '🐱', '🐰', '🐮', '🐸', '🐷', '🦊', '🐼', '🐔', '🐵', '🐨', '🐹'],
    food:      ['🍎', '🍌', '🍞', '🧀', '🍓', '🍕', '🥕', '🍇', '🍪', '🍩', '🍉', '🥐'],
    transport: ['🚗', '🚌', '✈️', '🚲', '🚀', '⛵', '🚂', '🚁', '🛵', '🚓', '🚚', '🛶'],
    clothes:   ['👕', '👖', '👗', '🧦', '👟', '🧢', '🧥', '👒', '🧤', '👘'],
    toys:      ['🧸', '🪀', '🪁', '🎈', '🛹', '⚽', '🎲', '🧩', '🪃', '🛼'],
    nature:    ['🌳', '🌸', '🌿', '🍄', '🌵', '🌻', '🌷', '🌲', '🍁', '🪴']
  };
  var THEME_KEYS = Object.keys(THEMES);

  // Похожие группы с «тонким» лишним — для сложного уровня.
  var FAMILIES = [
    { core: ['🍎', '🍌', '🍓', '🍇', '🍊', '🍐', '🍑', '🍒'], odd: ['🥕', '🥦', '🥔', '🌽', '🥒', '🫑'] },
    { core: ['🐶', '🐱', '🐮', '🐷', '🐑', '🐔', '🐴', '🐐'], odd: ['🦁', '🐯', '🐘', '🦒', '🐻', '🐺', '🦓'] },
    { core: ['🚗', '🚌', '🚚', '🚓', '🚕', '🚐'], odd: ['✈️', '🚁', '🚀', '⛵', '🛸'] },
    { core: ['🐝', '🐜', '🦋', '🐞', '🐛', '🦗'], odd: ['🕷️', '🦂', '🐌'] },
    { core: ['👕', '👖', '👗', '🧦', '🧥', '👚', '🩳', '👔', '🧣'], odd: ['👟', '👞', '🥾', '🩴', '👠'] },
    { core: ['🌳', '🌸', '🌿', '🌻', '🌷', '🌵'], odd: ['🍄', '🪨', '🌊'] }
  ];

  function countRange(age, diff) {
    var a = Ages.normalize(age);
    if (a === 'preschool') {
      return diff === 'easy' ? [3, 3] : [3, 4];
    }
    if (a === 'school') {
      return diff === 'easy' ? [4, 5] : (diff === 'medium' ? [5, 6] : [6, 7]);
    }
    // junior (5–6) — как раньше
    return diff === 'easy' ? [3, 4] : (diff === 'medium' ? [4, 5] : [5, 6]);
  }

  function makeRound(diff, age) {
    var r = countRange(age, diff);
    var count = UI.randInt(r[0], r[1]);

    var core, odd, tag;
    if (diff === 'hard' && Ages.normalize(age) !== 'preschool') {
      var fi = UI.randInt(0, FAMILIES.length - 1);
      var fam = FAMILIES[fi];
      core = UI.sample(fam.core, count - 1);
      odd = UI.pick(fam.odd);
      tag = 'fam' + fi;
    } else {
      var mainKey = UI.pick(THEME_KEYS);
      var other = THEME_KEYS.filter(function (k) { return k !== mainKey; });
      core = UI.sample(THEMES[mainKey], count - 1);
      odd = UI.pick(THEMES[UI.pick(other)]);
      tag = mainKey;
    }

    // Лишний не должен случайно совпасть с остальными.
    core = core.filter(function (e) { return e !== odd; });
    while (core.length < count - 1) {
      core.push(UI.pick(THEMES[UI.pick(THEME_KEYS)]));
      core = UI.unique(core).filter(function (e) { return e !== odd; });
    }

    return { items: UI.shuffle(core.concat([odd])), answer: odd, tag: tag };
  }

  function keyOf(r) { return r.tag + '|' + r.items.slice().sort().join(',') + '|' + r.answer; }

  function start(root, App) {
    var age = App.age();
    var maxIndex = Ages.levelIndex(age);
    var level = 'easy';
    var TOTAL = 5;
    var round = 0;
    var firstTry = 0;
    var current = null;
    var timer = null;
    var gen = null;
    var lastTag = null;

    var adaptive = new Adaptive({
      level: level,
      maxIndex: maxIndex,
      onChange: function (nl, why) {
        level = nl;
        if (difficulty) difficulty._setActive(nl);
        App.toast(t(why === 'up' ? 'level.up' : 'level.down', { name: t('common.' + nl) }), 1500);
      }
    });

    root.appendChild(el('p', { class: 'game-hint' }, t('game.odd.hint')));

    var difficulty = UI.segmented(Ages.levels(age).map(function (lv) {
      return { value: lv, label: t('common.' + lv) };
    }), level, function (v) {
      level = v;
      adaptive.setLevel(v);
      TOTAL = v === 'hard' ? 6 : 5;
      newSession();
    });

    var progress = el('div', { class: 'game-stats' });
    var stage = el('div', { class: 'odd-stage' });

    root.appendChild(difficulty);
    root.appendChild(progress);
    root.appendChild(stage);

    function newSession() {
      gen = UI.uniqueGenerator(function () { return makeRound(level, age); }, keyOf, 60);
      lastTag = null;
      round = 0; firstTry = 0;
      adaptive.reset();
      nextRound();
    }

    function nextRound() {
      if (timer) { clearTimeout(timer); timer = null; }
      if (round >= TOTAL) { finish(); return; }
      round++;
      progress.textContent = t('common.round') + ' ' + round + ' ' + t('common.of') + ' ' + TOTAL;
      var data = gen();
      var tries = 0;
      while (data.tag === lastTag && tries < 6) { data = gen(); tries++; }
      lastTag = data.tag;
      render(data);
    }

    function render(data) {
      current = { answer: data.answer, wrong: false, done: false };
      UI.clear(stage);

      stage.appendChild(el('p', { class: 'math-prompt' }, t('game.odd.hint')));

      var grid = el('div', { class: 'odd-grid' });
      data.items.forEach(function (emoji) {
        var btn = el('button', {
          type: 'button', class: 'odd-item',
          onclick: function () { choose(btn, emoji); }
        }, emoji);
        grid.appendChild(btn);
      });
      stage.appendChild(grid);
    }

    function choose(btn, emoji) {
      if (current.done) return;
      if (emoji === current.answer) {
        current.done = true;
        btn.classList.add('correct');
        Sound.play('match');
        if (!current.wrong) { firstTry++; adaptive.correct(); }
        timer = setTimeout(nextRound, 850);
      } else {
        if (!current.wrong) { current.wrong = true; adaptive.wrong(); }
        btn.classList.add('wrong');
        Sound.play('wrong');
        setTimeout(function () { btn.classList.remove('wrong'); }, 500);
      }
    }

    function finish() {
      var stars = Math.round(firstTry / TOTAL * 3);
      if (firstTry > 0 && stars < 1) stars = 1;
      App.finishGame('odd', stars, newSession, null, level);
    }

    newSession();

    return function cleanup() { if (timer) clearTimeout(timer); };
  }

  App.register({
    id: 'odd',
    ages: ['preschool', 'junior', 'school'],
    emoji: '🔍',
    titleKey: 'game.odd',
    descKey: 'game.odd.desc',
    start: start
  });
})(window);
