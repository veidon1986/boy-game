/* games/math.js — «Счёт и примеры»: счёт, сложение, вычитание. */
(function (global) {
  'use strict';

  var el = UI.el;

  var OBJECTS = ['🍎', '⭐', '🐟', '🌸', '🎈', '🐞', '🍪', '🚗', '⚽', '🦋'];

  function optionCount(diff, age) {
    var a = Ages.normalize(age);
    if (a === 'preschool') return 3;
    if (a === 'school' && diff !== 'easy') return 4;
    return diff === 'hard' ? 4 : 3;
  }

  function makeOptions(answer, diff, age) {
    var n = optionCount(diff, age);
    var set = {};
    set[answer] = 1;
    var out = [answer];
    var guard = 0;
    while (out.length < n && guard < 200) {
      guard++;
      var delta = UI.pick([-3, -2, -1, 1, 2, 3]);
      var cand = answer + delta;
      if (cand >= 0 && !set[cand]) { set[cand] = 1; out.push(cand); }
    }
    return UI.shuffle(out);
  }

  // Типы заданий и числовые пределы зависят от возраста и уровня.
  function typesFor(age, diff) {
    var a = Ages.normalize(age);
    if (a === 'preschool') {
      return diff === 'easy' ? ['count', 'count', 'sum'] : ['count', 'sum', 'sum', 'rest'];
    }
    if (a === 'school') {
      if (diff === 'easy') return ['count', 'sum', 'sum'];
      if (diff === 'medium') return ['sum', 'rest', 'rest', 'missing'];
      return ['sum', 'rest', 'missing', 'missing'];
    }
    // junior (5–6) — как раньше
    if (diff === 'easy') return ['count', 'count', 'sum'];
    if (diff === 'medium') return ['count', 'sum', 'sum', 'rest'];
    return ['sum', 'rest', 'missing', 'missing', 'sum'];
  }

  function capsFor(age, diff) {
    var a = Ages.normalize(age);
    if (a === 'preschool') {
      return { count: diff === 'easy' ? 5 : 8, sum: diff === 'easy' ? 5 : 10, rest: 10, missing: 10 };
    }
    if (a === 'school') {
      return {
        count: diff === 'easy' ? 10 : 15,
        sum: diff === 'easy' ? 10 : (diff === 'medium' ? 20 : 30),
        rest: diff === 'medium' ? 20 : 30,
        missing: 12
      };
    }
    // junior (5–6) — как раньше
    return {
      count: diff === 'easy' ? 5 : 9,
      sum: diff === 'easy' ? 5 : (diff === 'medium' ? 10 : 20),
      rest: diff === 'medium' ? 10 : 20,
      missing: 10
    };
  }

  function makeQuestion(diff, age) {
    var cap = capsFor(age, diff);
    var emoji = UI.pick(OBJECTS);
    var type = UI.pick(typesFor(age, diff));

    if (type === 'count') {
      var n = UI.randInt(1, cap.count);
      return {
        promptKey: 'game.math.count',
        visual: { kind: 'count', n: n, emoji: emoji },
        answer: n,
        options: makeOptions(n, diff, age)
      };
    }

    if (type === 'sum') {
      var a = UI.randInt(1, cap.sum - 1);
      var b = UI.randInt(1, cap.sum - a);
      return {
        promptKey: 'game.math.sum',
        visual: { kind: 'sum', a: a, b: b, emoji: emoji },
        answer: a + b,
        options: makeOptions(a + b, diff, age)
      };
    }

    if (type === 'rest') {
      var total = UI.randInt(2, cap.rest);
      var take = UI.randInt(1, total - 1);
      return {
        promptKey: 'game.math.rest',
        visual: { kind: 'rest', a: total, b: take, emoji: emoji },
        answer: total - take,
        options: makeOptions(total - take, diff, age)
      };
    }

    // missing: a + ? = c
    var c2 = UI.randInt(4, cap.missing);
    var a2 = UI.randInt(1, c2 - 1);
    return {
      promptKey: 'game.math.missing',
      visual: { kind: 'missing', a: a2, b: c2 - a2, emoji: emoji },
      answer: c2 - a2,
      options: makeOptions(c2 - a2, diff, age)
    };
  }

  function keyOf(q) {
    var v = q.visual;
    return v.kind + '|' + (v.n || 0) + '|' + (v.a || 0) + '|' + (v.b || 0) + '|' + q.answer;
  }

  function dotGroup(n, emoji, dimFrom) {
    var g = el('div', { class: 'math-group' });
    for (var i = 0; i < n; i++) {
      g.appendChild(el('span', { class: 'math-dot' + (dimFrom !== undefined && i >= dimFrom ? ' dim' : '') }, emoji));
    }
    return g;
  }

  function renderVisual(v, stage) {
    if (v.kind === 'count') {
      var rowCount = el('div', { class: 'math-equation' });
      rowCount.appendChild(dotGroup(v.n, v.emoji));
      stage.appendChild(rowCount);
      return;
    }
    if (v.kind === 'sum') {
      var row = el('div', { class: 'math-equation' });
      row.appendChild(dotGroup(v.a, v.emoji));
      row.appendChild(el('span', { class: 'math-op' }, '+'));
      row.appendChild(dotGroup(v.b, v.emoji));
      row.appendChild(el('span', { class: 'math-op' }, '='));
      row.appendChild(el('span', { class: 'math-q' }, '?'));
      stage.appendChild(row);
      return;
    }
    if (v.kind === 'rest') {
      var row2 = el('div', { class: 'math-equation' });
      row2.appendChild(dotGroup(v.a, v.emoji, v.a - v.b));
      row2.appendChild(el('span', { class: 'math-op' }, '−'));
      row2.appendChild(dotGroup(v.b, '❌'));
      row2.appendChild(el('span', { class: 'math-op' }, '='));
      row2.appendChild(el('span', { class: 'math-q' }, '?'));
      stage.appendChild(row2);
      return;
    }
    // missing: a + ? = c
    var row3 = el('div', { class: 'math-equation' });
    row3.appendChild(dotGroup(v.a, v.emoji));
    row3.appendChild(el('span', { class: 'math-op' }, '+'));
    row3.appendChild(el('span', { class: 'math-q' }, '?'));
    row3.appendChild(el('span', { class: 'math-op' }, '='));
    row3.appendChild(dotGroup(v.a + v.b, v.emoji));
    stage.appendChild(row3);
  }

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
    var lastKind = null;

    var adaptive = new Adaptive({
      level: level,
      maxIndex: maxIndex,
      onChange: function (nl, why) {
        level = nl;
        if (difficulty) difficulty._setActive(nl);
        App.toast(t(why === 'up' ? 'level.up' : 'level.down', { name: t('common.' + nl) }), 1500);
      }
    });

    root.appendChild(el('p', { class: 'game-hint' }, t('game.math.hint')));

    var difficulty = UI.segmented(Ages.levels(age).map(function (lv) {
      return { value: lv, label: t('common.' + lv) };
    }), level, function (v) {
      level = v;
      adaptive.setLevel(v);
      TOTAL = v === 'easy' ? 5 : 6;
      newSession();
    });

    var progress = el('div', { class: 'game-stats' });
    var stage = el('div', { class: 'math-stage' });

    root.appendChild(difficulty);
    root.appendChild(progress);
    root.appendChild(stage);

    function newSession() {
      gen = UI.uniqueGenerator(function () { return makeQuestion(level, age); }, keyOf, 60);
      lastKind = null;
      round = 0; firstTry = 0;
      adaptive.reset();
      nextRound();
    }

    function nextQuestion() {
      var q = gen();
      var tries = 0;
      while (q.visual.kind === lastKind && tries < 6) { q = gen(); tries++; }
      lastKind = q.visual.kind;
      return q;
    }

    function nextRound() {
      if (timer) { clearTimeout(timer); timer = null; }
      if (round >= TOTAL) { finish(); return; }
      round++;
      progress.textContent = t('common.round') + ' ' + round + ' ' + t('common.of') + ' ' + TOTAL;
      render(nextQuestion());
    }

    function render(q) {
      current = { q: q, wrong: false };
      UI.clear(stage);

      stage.appendChild(el('p', { class: 'math-prompt' }, t(q.promptKey)));
      renderVisual(q.visual, stage);

      var options = el('div', { class: 'math-options' });
      q.options.forEach(function (opt) {
        var btn = el('button', {
          type: 'button', class: 'math-option',
          onclick: function () { choose(btn, opt); }
        }, String(opt));
        options.appendChild(btn);
      });
      stage.appendChild(options);
    }

    function choose(btn, opt) {
      if (current.done) return;
      if (opt === current.q.answer) {
        current.done = true;
        btn.classList.add('correct');
        Sound.play('match');
        if (!current.wrong) { firstTry++; adaptive.correct(); }
        timer = setTimeout(nextRound, 800);
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
      App.finishGame('math', stars, newSession, null, level);
    }

    newSession();

    return function cleanup() { if (timer) clearTimeout(timer); };
  }

  App.register({
    id: 'math',
    ages: ['preschool', 'junior', 'school'],
    emoji: '➕',
    titleKey: 'game.math',
    descKey: 'game.math.desc',
    start: start
  });
})(window);
