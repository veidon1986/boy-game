/* games/find.js — «Найди такого же»: зрительное сопоставление для малышей 2–5 лет.
   Показываем большую картинку-образец и несколько вариантов — нужно нажать
   точно такую же. Без чтения и текста. */
(function (global) {
  'use strict';

  var el = UI.el;

  var POOL = [
    '🐶', '🐱', '🐰', '🐮', '🐸', '🐷', '🦊', '🐼', '🐔', '🐵',
    '🐨', '🐹', '🐢', '🐙', '🦋', '🐝', '🌸', '🌳', '🍎', '🍌',
    '⭐', '🌙', '☀️', '🚗', '🚌', '⚽', '🎈', '🧸', '🍕', '🚀'
  ];

  function optionsCount(level) {
    if (level === 'hard') return 4;
    if (level === 'medium') return 3;
    return 2; // easy — малышам достаточно двух картинок
  }

  function makeRound(level) {
    var n = optionsCount(level);
    var target = UI.pick(POOL);
    var others = UI.sample(POOL.filter(function (e) { return e !== target; }), n - 1);
    return {
      target: target,
      items: UI.shuffle([target].concat(others))
    };
  }

  function keyOf(r) { return r.target + '|' + r.items.slice().sort().join(','); }

  function start(root, App) {
    var age = App.age ? App.age() : Ages.defaultKey;
    var level = (Ages.normalize(age) === 'toddler') ? 'easy' : 'medium';
    var maxIndex = Ages.levelIndex(age);
    var TOTAL = 6;
    var round = 0;
    var firstTry = 0;
    var current = null;
    var timer = null;
    var gen = null;

    var adaptive = new Adaptive({
      level: level,
      maxIndex: maxIndex,
      onChange: function (nl) { level = nl; }
    });

    var stage = el('div', { class: 'find-stage' });
    root.appendChild(stage);

    function newSession() {
      gen = UI.uniqueGenerator(function () { return makeRound(level); }, keyOf, 60);
      round = 0; firstTry = 0;
      adaptive.reset();
      nextRound();
    }

    function nextRound() {
      if (timer) { clearTimeout(timer); timer = null; }
      if (round >= TOTAL) { finish(); return; }
      round++;
      render(gen());
    }

    function render(data) {
      current = { answer: data.target, wrong: false, done: false };
      UI.clear(stage);

      stage.appendChild(el('div', { class: 'find-target' }, [
        el('span', { class: 'find-target-label' }, '👀'),
        el('span', { class: 'find-target-emoji' }, data.target)
      ]));

      stage.appendChild(el('div', { class: 'find-arrow' }, '👇'));

      var grid = el('div', { class: 'find-grid' });
      data.items.forEach(function (emoji) {
        var btn = el('button', {
          type: 'button', class: 'find-item',
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
        timer = setTimeout(nextRound, 700);
      } else {
        if (!current.wrong) { current.wrong = true; adaptive.wrong(); }
        btn.classList.add('wrong');
        Sound.play('wrong');
        setTimeout(function () { btn.classList.remove('wrong'); }, 450);
      }
    }

    function finish() {
      var stars = Math.round(firstTry / TOTAL * 3);
      if (firstTry > 0 && stars < 1) stars = 1;
      App.finishGame('find', stars, newSession, null, level);
    }

    newSession();

    return function cleanup() { if (timer) clearTimeout(timer); };
  }

  App.register({
    id: 'find',
    ages: ['toddler', 'preschool'],
    emoji: '👀',
    titleKey: 'game.find',
    descKey: 'game.find.desc',
    start: start
  });
})(window);
