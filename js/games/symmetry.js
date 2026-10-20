/* games/symmetry.js — дорисуй отражённую часть узора. */
(function (global) {
  'use strict';

  var el = UI.el;
  var COLORS = ['🔴', '🔵', '🟡', '🟢', '🟣', '🟠'];

  function start(root, App) {
    var age = App.age();
    var level = 'easy';
    var round = 0;
    var firstTry = 0;
    var timer = null;
    var TOTAL = 5;
    var stats = el('div', { class: 'game-stats' });
    var stage = el('div', { class: 'symmetry-stage' });
    var difficulty = UI.segmented(Ages.levels(age).map(function (lv) {
      return { value: lv, label: t('common.' + lv) };
    }), level, function (v) { level = v; newSession(); });
    root.appendChild(el('p', { class: 'game-hint' }, t('game.symmetry.hint')));
    root.appendChild(difficulty);
    root.appendChild(stats);
    root.appendChild(stage);

    function newSession() {
      if (timer) { clearTimeout(timer); timer = null; }
      round = 0; firstTry = 0; render();
    }
    function render() {
      if (round >= TOTAL) {
        App.finishGame('symmetry', Math.max(1, Math.round(firstTry / TOTAL * 3)), newSession, null, level);
        return;
      }
      round++;
      stats.textContent = t('common.round') + ' ' + round + ' ' + t('common.of') + ' ' + TOTAL;
      UI.clear(stage);
      var size = level === 'easy' ? 2 : (level === 'medium' ? 3 : 4);
      var matrix = [];
      for (var r = 0; r < size; r++) {
        matrix[r] = [];
        for (var c = 0; c < size; c++) {
          matrix[r][c] = matrix[r][Math.min(c, size - 1 - c)] || UI.pick(COLORS);
        }
      }
      var targetRow = UI.randInt(0, size - 1);
      var targetCol = UI.randInt(0, size - 1);
      var answer = matrix[targetRow][size - 1 - targetCol];
      var done = false;
      var board = el('div', { class: 'symmetry-board' });
      board.style.gridTemplateColumns = 'repeat(' + size + ', minmax(48px, 76px))';
      for (var rr = 0; rr < size; rr++) {
        for (var cc = 0; cc < size; cc++) {
          var hidden = rr === targetRow && cc === targetCol;
          board.appendChild(el('div', { class: 'symmetry-cell' + (hidden ? ' missing' : '') },
            hidden ? '?' : matrix[rr][cc]));
        }
      }
      stage.appendChild(board);
      var options = UI.shuffle([answer].concat(UI.sample(COLORS.filter(function (x) { return x !== answer; }), 3)));
      var choices = el('div', { class: 'symmetry-options' });
      options.forEach(function (item) {
        var button = el('button', {
          type: 'button', class: 'symmetry-option',
          onclick: function () {
            if (done) return;
            if (item === answer) {
              done = true;
              choices.querySelectorAll('button').forEach(function (choice) { choice.disabled = true; });
              button.classList.add('correct');
              firstTry++;
              Sound.play('win');
              timer = setTimeout(render, 650);
            } else {
              button.classList.add('wrong');
              Sound.play('wrong');
              setTimeout(function () { button.classList.remove('wrong'); }, 450);
            }
          }
        }, item);
        choices.appendChild(button);
      });
      stage.appendChild(choices);
    }
    newSession();
    return function cleanup() { if (timer) clearTimeout(timer); };
  }

  App.register({
    id: 'symmetry', ages: ['junior', 'school'], emoji: '🪞',
    titleKey: 'game.symmetry', descKey: 'game.symmetry.desc', start: start
  });
})(window);
