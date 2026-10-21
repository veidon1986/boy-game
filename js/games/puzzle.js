/* games/puzzle.js — собери простую картинку из крупных частей. */
(function (global) {
  'use strict';

  var el = UI.el;
  var SCENES = [
    ['☀️', '☁️', '🌷', '🦋'], ['🐠', '🫧', '🐚', '🌊'],
    ['🐱', '🧶', '🪟', '🌙'], ['🚗', '🌳', '🏠', '☁️'],
    ['🍓', '🍃', '🐞', '🌼'], ['🐸', '🪷', '🌿', '🐝'],
    ['🐻', '🍯', '🌲', '☀️'], ['🐰', '🥕', '🌱', '☁️'],
    ['🐦', '🪺', '🥚', '🌳'], ['🐢', '🌊', '🪨', '🌿'],
    ['🦉', '🌙', '⭐', '🌲'], ['🐝', '🌻', '🌼', '🍃'],
    ['🚂', '🛤️', '🌄', '☁️'], ['⛵', '🌊', '🐬', '☀️'],
    ['🦕', '🌿', '🌋', '☁️'], ['🐧', '❄️', '🧊', '🌊'],
    ['🍉', '🔪', '🍽️', '😋'], ['🧁', '🎂', '🎈', '🎁']
  ];

  function start(root, App) {
    var age = App.age();
    var level = 'easy';
    var rounds = 0;
    var firstTry = 0;
    var timer = null;
    var TOTAL = 5;
    var sceneGenerator = UI.uniqueGenerator(function () {
      var count = level === 'easy' ? 2 : (level === 'medium' ? 3 : 4);
      return UI.pick(SCENES).slice(0, count);
    }, function (scene) { return scene.slice().sort().join(','); }, 100, 'puzzle');
    var stage = el('div', { class: 'puzzle-stage' });
    var stats = el('div', { class: 'game-stats' });
    var difficulty = UI.segmented(Ages.levels(age).map(function (lv) {
      return { value: lv, label: t('common.' + lv) };
    }), level, function (v) { level = v; newSession(); });

    root.appendChild(el('p', { class: 'game-hint' }, t('game.puzzle.hint')));
    root.appendChild(difficulty);
    root.appendChild(stats);
    root.appendChild(stage);

    function newSession() {
      if (timer) { clearTimeout(timer); timer = null; }
      rounds = 0; firstTry = 0;
      renderRound();
    }

    function renderRound() {
      if (rounds >= TOTAL) {
        var stars = Math.max(1, Math.round(firstTry / TOTAL * 3));
        App.finishGame('puzzle', stars, newSession, null, level);
        return;
      }
      rounds++;
      stats.textContent = t('common.round') + ' ' + rounds + ' ' + t('common.of') + ' ' + TOTAL;
      UI.clear(stage);
      var count = level === 'easy' ? 2 : (level === 'medium' ? 3 : 4);
      var scene = sceneGenerator();
      if (!scene) { UI.showTaskPoolExhausted(root, App); return; }
      var image = UI.shuffle(scene);
      var selected = null;
      var placed = [];
      var roundMistakes = 0;
      var preview = el('div', { class: 'puzzle-preview', 'aria-label': t('game.puzzle.preview') });
      image.forEach(function (piece) { preview.appendChild(el('span', {}, piece)); });
      stage.appendChild(preview);
      stage.appendChild(el('p', { class: 'puzzle-label' }, t('game.puzzle.preview')));

      var board = el('div', { class: 'puzzle-board' + (count === 2 ? ' two' : '') });
      var pieces = UI.shuffle(image.map(function (piece, i) { return { icon: piece, home: i }; }));
      image.forEach(function (_, i) {
        var slot = el('button', {
          type: 'button', class: 'puzzle-slot',
          'aria-label': t('game.puzzle.slot', { n: i + 1 }),
          onclick: function () {
            if (!selected || slot._piece) return;
            var pieceButton = selected;
            var piece = pieceButton._piece;
            pieceButton.classList.remove('selected');
            if (piece.home !== i) {
              roundMistakes++;
              slot.classList.add('wrong');
              Sound.play('wrong');
              setTimeout(function () {
                slot.classList.remove('wrong');
                pieceButton.disabled = false;
              }, 450);
            } else {
              slot._piece = piece;
              slot.textContent = piece.icon;
              slot.classList.add('filled');
              pieceButton.disabled = true;
              placed.push(i);
              Sound.play('match');
            }
            selected = null;
            if (placed.length === count) {
              if (!roundMistakes) firstTry++;
              timer = setTimeout(renderRound, 650);
            }
          }
        }, '·');
        board.appendChild(slot);
      });
      stage.appendChild(board);

      var tray = el('div', { class: 'puzzle-pieces' });
      pieces.forEach(function (piece) {
        var button = el('button', {
          type: 'button', class: 'puzzle-piece',
          onclick: function () {
            if (selected) selected.classList.remove('selected');
            selected = button;
            button.classList.add('selected');
            Sound.play('tap');
          }
        }, piece.icon);
        button._piece = piece;
        tray.appendChild(button);
      });
      stage.appendChild(tray);
    }

    newSession();
    return function cleanup() { if (timer) clearTimeout(timer); };
  }

  App.register({
    id: 'puzzle', ages: ['toddler', 'preschool', 'junior'], emoji: '🧩',
    titleKey: 'game.puzzle', descKey: 'game.puzzle.desc', start: start
  });
})(window);
