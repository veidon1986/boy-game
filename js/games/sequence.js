/* games/sequence.js — «Что дальше?»: последовательности и причинно-следственные связи. */
(function (global) {
  'use strict';

  var el = UI.el;

  var EMOJI = ['🔵', '🔴', '🟢', '🟡', '⭐', '❤️', '🔺', '🟦', '🍎', '🐶', '🌸', '🚗'];

  // Готовые цепочки «что было раньше / что будет дальше».
  var CHAINS = {
    easy: [
      ['🌰', '🌱', '🌳'],
      ['🥚', '🐣', '🐥'],
      ['🐛', '🦋'],
      ['🌧️', '🌈'],
      ['🐶', '🐕', '🦴']
    ],
    medium: [
      ['🌱', '🌿', '🌳', '🌲'],
      ['🥚', '🐣', '🐥', '🐔'],
      ['🌧️', '💧', '🌊', '☀️'],
      ['🐛', '🛡️', '🦋'],
      ['🍎', '🍽️', '😋']
    ],
    hard: [
      ['🌰', '🌱', '🌿', '🌳', '🌲'],
      ['🥚', '🐣', '🐥', '🐔', '🍳'],
      ['💧', '🌧️', '🌈', '☀️', '🌵']
    ]
  };

  function makeRound(diff) {
    var type;
    if (diff === 'easy') type = UI.pick(['repeat2', 'repeat2', 'step1', 'chain']);
    else if (diff === 'medium') type = UI.pick(['repeat2', 'repeat3', 'step', 'step', 'chain']);
    else type = UI.pick(['repeat3', 'step', 'stepBack', 'chain', 'chain']);

    if (type === 'repeat2' || type === 'repeat3') {
      var unitLen = type === 'repeat2' ? 2 : 3;
      var unit = UI.sample(EMOJI, unitLen);
      var cycles = 3;
      var seq = [];
      for (var c = 0; c < cycles; c++) {
        for (var u = 0; u < unit.length; u++) seq.push(unit[u]);
      }
      var answer = seq.pop();
      seq.push(null); // пропуск в конце
      var opts = UI.shuffle(UI.unique([answer].concat(UI.sample(
        EMOJI.filter(function (e) { return unit.indexOf(e) === -1; }), 2))));
      return { tiles: seq, answer: answer, options: opts, kind: 'emoji', tag: 'rep' + unitLen };
    }

    if (type === 'step' || type === 'stepBack') {
      var start, step, count, nums = [];
      if (diff === 'easy') {
        step = type === 'stepBack' ? -1 : 1;
        start = type === 'stepBack' ? UI.randInt(4, 6) : UI.randInt(1, 3);
        count = 4;
      } else if (diff === 'medium') {
        step = type === 'stepBack' ? -1 : UI.pick([1, 1, 2]);
        start = step > 0 ? UI.randInt(1, 5) : UI.randInt(6, 10);
        count = 4;
      } else {
        step = UI.pick([2, 3, -1, -2]);
        start = step > 0 ? UI.randInt(1, 6) : UI.randInt(8, 14);
        count = 4;
      }
      for (var i = 0; i < count; i++) nums.push(start + i * step);
      var ans = nums[nums.length - 1];
      nums[nums.length - 1] = null;
      var set = {};
      set[ans] = 1;
      var distract = [];
      while (distract.length < 2) {
        var cand = ans + UI.pick([-2, -1, 1, 2, 3, -3]);
        if (!set[cand] && cand >= 0) { set[cand] = 1; distract.push(cand); }
      }
      return { tiles: nums, answer: ans, options: UI.shuffle([ans].concat(distract)), kind: 'number', tag: step > 0 ? 'step+' : 'step-' };
    }

    // chain: причинно-следственная цепочка
    var chain = UI.pick(CHAINS[diff] || CHAINS.easy);
    var tiles = chain.slice();
    var answerEmoji = tiles.pop();
    tiles.push(null);
    var pool = EMOJI.concat(['🌱', '🐔', '🌳', '🌈', '🥚']);
    var distract2 = UI.sample(pool.filter(function (e) { return chain.indexOf(e) === -1; }), 2);
    return { tiles: tiles, answer: answerEmoji, options: UI.shuffle(UI.unique([answerEmoji].concat(distract2))), kind: 'chain', tag: 'chain' };
  }

  function keyOf(r) {
    return r.kind + '|' + r.tiles.map(function (t) { return t === null ? '_' : t; }).join(',') + '|' + r.answer;
  }

  function start(root, App) {
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
      onChange: function (nl, why) {
        level = nl;
        if (difficulty) difficulty._setActive(nl);
        App.toast(t(why === 'up' ? 'level.up' : 'level.down', { name: t('common.' + nl) }), 1500);
      }
    });

    root.appendChild(el('p', { class: 'game-hint' }, t('game.sequence.hint')));

    var difficulty = UI.segmented([
      { value: 'easy', label: t('common.easy') },
      { value: 'medium', label: t('common.medium') },
      { value: 'hard', label: t('common.hard') }
    ], level, function (v) { level = v; adaptive.setLevel(v); newSession(); });

    var progress = el('div', { class: 'game-stats' });
    var stage = el('div', { class: 'seq-stage' });

    root.appendChild(difficulty);
    root.appendChild(progress);
    root.appendChild(stage);

    function newSession() {
      gen = UI.uniqueGenerator(function () { return makeRound(level); }, keyOf, 60);
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
      // по возможности не даём два одинаковых типа задания подряд
      var tries = 0;
      while (data.tag === lastTag && tries < 6) { data = gen(); tries++; }
      lastTag = data.tag;
      render(data);
    }

    function render(data) {
      current = { data: data, wrong: false };
      UI.clear(stage);

      var tiles = el('div', { class: 'seq-tiles' });
      data.tiles.forEach(function (val) {
        var cls = 'seq-tile' + (val === null ? ' blank' : '') + (data.kind === 'number' ? ' num' : '');
        var node = el('div', { class: cls }, val === null ? '❓' : String(val));
        if (val === null) current.blankEl = node;
        tiles.appendChild(node);
      });
      stage.appendChild(tiles);

      var options = el('div', { class: 'seq-options' + (data.kind === 'number' ? ' num' : '') });
      data.options.forEach(function (opt) {
        var btn = el('button', {
          type: 'button',
          class: 'seq-option' + (data.kind === 'number' ? ' num' : ''),
          onclick: function () { choose(btn, opt); }
        }, String(opt));
        options.appendChild(btn);
      });
      stage.appendChild(options);
    }

    function choose(btn, opt) {
      if (current.done) return;
      if (opt === current.data.answer) {
        current.done = true;
        btn.classList.add('correct');
        current.blankEl.textContent = String(current.data.answer);
        current.blankEl.classList.add('filled');
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
      App.finishGame('sequence', stars, newSession, null, level);
    }

    newSession();

    return function cleanup() { if (timer) clearTimeout(timer); };
  }

  App.register({
    id: 'sequence',
    ages: ['preschool', 'junior', 'school'],
    emoji: '🔢',
    titleKey: 'game.sequence',
    descKey: 'game.sequence.desc',
    start: start
  });
})(window);
