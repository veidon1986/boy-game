/* games/memory.js — «Найди пару»: тренировка памяти и внимания. */
(function (global) {
  'use strict';

  var el = UI.el;

  var EMOJI = ['🐶', '🐱', '🦊', '🐼', '🐸', '🦁', '🐵', '🐷',
               '🐔', '🐙', '🦄', '🐢', '🍎', '🍌', '🍓', '⭐',
               '🚗', '🚀', '⚽', '🌸'];

  var LEVELS = {
    easy:   { pairs: 3, cols: 3 },
    medium: { pairs: 6, cols: 4 },
    hard:   { pairs: 8, cols: 4 }
  };

  function starsForMoves(moves, pairs) {
    if (moves <= Math.ceil(pairs * 1.5)) return 3;
    if (moves <= Math.ceil(pairs * 2.2)) return 2;
    return 1;
  }

  function start(root, App) {
    var level = 'easy';
    var cards = [];
    var first = null;
    var locked = false;
    var matched = 0;
    var moves = 0;
    var timer = null;
    var lastSet = null;

    root.appendChild(el('p', { class: 'game-hint' }, t('game.memory.hint')));

    var difficulty = UI.segmented([
      { value: 'easy', label: t('common.easy') },
      { value: 'medium', label: t('common.medium') },
      { value: 'hard', label: t('common.hard') }
    ], level, function (v) { level = v; build(); });

    var stats = el('div', { class: 'game-stats' });
    var pairsLeft = el('span', { class: 'stat' });
    var movesStat = el('span', { class: 'stat' });
    stats.appendChild(pairsLeft);
    stats.appendChild(movesStat);

    var board = el('div', { class: 'memory-board' });

    root.appendChild(difficulty);
    root.appendChild(stats);
    root.appendChild(board);

    function updateStats() {
      pairsLeft.textContent = t('game.memory.pairs') + ': ' + (LEVELS[level].pairs - matched);
      movesStat.textContent = t('game.memory.moves') + ': ' + moves;
    }

    function build() {
      if (timer) { clearTimeout(timer); timer = null; }
      first = null; locked = false; matched = 0; moves = 0;
      var cfg = LEVELS[level];
      board.style.setProperty('--cols', cfg.cols);

      // Набор эмодзи не повторяет предыдущее поле.
      var chosen, key, tries = 0;
      do {
        chosen = UI.sample(EMOJI, cfg.pairs);
        key = chosen.slice().sort().join(',');
        tries++;
      } while (key === lastSet && tries < 20);
      lastSet = key;

      var deck = [];
      chosen.forEach(function (e, i) {
        deck.push({ key: i, emoji: e });
        deck.push({ key: i, emoji: e });
      });
      deck = UI.shuffle(deck);

      cards = deck.map(function (data) {
        var face = el('span', { class: 'memo-face' }, data.emoji);
        var back = el('span', { class: 'memo-back' }, '?');
        var inner = el('div', { class: 'memo-inner' }, [back, face]);
        var btn = el('button', { type: 'button', class: 'memo-card', onclick: onCard }, inner);
        var card = { data: data, el: btn, flipped: false, matched: false };
        btn._card = card;
        return card;
      });

      UI.clear(board);
      cards.forEach(function (c) { board.appendChild(c.el); });
      updateStats();
    }

    function onCard() {
      var card = this._card;
      if (locked || card.flipped || card.matched) return;
      flip(card);
      Sound.play('flip');
      if (!first) { first = card; return; }

      moves++;
      updateStats();

      if (first.data.key === card.data.key) {
        first.matched = true; card.matched = true;
        first.el.classList.add('matched');
        card.el.classList.add('matched');
        Sound.play('match');
        matched++;
        first = null;
        updateStats();
        if (matched === LEVELS[level].pairs) {
          setTimeout(finish, 650);
        }
      } else {
        var a = first, b = card;
        first = null;
        locked = true;
        timer = setTimeout(function () {
          unflip(a); unflip(b);
          locked = false; timer = null;
        }, 850);
      }
    }

    function flip(card) {
      card.flipped = true;
      card.el.classList.add('flipped');
    }
    function unflip(card) {
      card.flipped = false;
      card.el.classList.remove('flipped');
    }

    function finish() {
      var cfg = LEVELS[level];
      var playedLevel = level;
      var stars = starsForMoves(moves, cfg.pairs);
      var mistakes = moves - cfg.pairs; // лишние ходы = промахи

      // Адаптация: чисто прошёл — сложнее; много промахов — проще.
      var upAllowance = cfg.pairs >= 6 ? 1 : 0;
      var target = level;
      if (mistakes <= upAllowance) target = Adaptive.up(level);
      else if (mistakes >= cfg.pairs) target = Adaptive.down(level);

      var note = null;
      if (target !== level) {
        level = target;
        difficulty._setActive(level);
        note = t('level.next', { name: t('common.' + level) });
      }

      App.finishGame('memory', stars, build, note, playedLevel);
    }

    build();

    return function cleanup() { if (timer) clearTimeout(timer); };
  }

  App.register({
    id: 'memory',
    ages: ['preschool', 'junior', 'school'],
    emoji: '🧠',
    titleKey: 'game.memory',
    descKey: 'game.memory.desc',
    start: start
  });
})(window);
