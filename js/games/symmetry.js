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
    var taskGenerator = UI.uniqueGenerator(function () {
      var size = level === 'easy' ? 2 : (level === 'medium' ? 3 : 4);
      var matrix = [];
      for (var r = 0; r < size; r++) {
        matrix[r] = [];
        for (var c = 0; c < size; c++) matrix[r][c] = matrix[r][Math.min(c, size - 1 - c)] || UI.pick(COLORS);
      }
      var targetRow = UI.randInt(0, size - 1);
      var targetCol = UI.randInt(0, size - 1);
      var answer = matrix[targetRow][size - 1 - targetCol];
      var options = UI.shuffle([answer].concat(UI.sample(COLORS.filter(function (x) { return x !== answer; }), 3)));
      return { size: size, matrix: matrix, targetRow: targetRow, targetCol: targetCol, answer: answer, options: options };
    }, function (task) {
      return task.size + '|' + task.matrix.map(function (row) { return row.join(''); }).join('/') + '|' +
        task.targetRow + ',' + task.targetCol + '|' + task.answer;
    }, 150, 'symmetry');
    var stats = el('div', { class: 'game-stats' });
    var stage = el('div', { class: 'symmetry-stage' });
    var difficulty = UI.segmented(App.gameLevels('symmetry').map(function (lv) {
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
      var task = taskGenerator();
      if (!task) { UI.showTaskPoolExhausted(root, App, taskGenerator); return; }
      var size = task.size;
      var matrix = task.matrix;
      var targetRow = task.targetRow;
      var targetCol = task.targetCol;
      var answer = task.answer;
      var done = false;
      var mistakes = 0;
      var boardWrap = el('div', { class: 'symmetry-wrap' });
      var board = el('div', { class: 'symmetry-board' });
      board.style.gridTemplateColumns = 'repeat(' + size + ', minmax(48px, 76px))';
      for (var rr = 0; rr < size; rr++) {
        for (var cc = 0; cc < size; cc++) {
          var hidden = rr === targetRow && cc === targetCol;
          board.appendChild(el('div', { class: 'symmetry-cell' + (hidden ? ' missing' : '') },
            hidden ? '?' : matrix[rr][cc]));
        }
      }
      boardWrap.appendChild(board);
      stage.appendChild(boardWrap);
      var options = task.options;
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
              if (!mistakes) firstTry++;
              Sound.play('win');
              timer = setTimeout(render, 650);
            } else {
              mistakes++;
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

  App.register('symmetry', start);
})(window);
