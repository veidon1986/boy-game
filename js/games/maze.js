/* games/maze.js — проведи героя по лабиринту, нажимая соседние клетки. */
(function (global) {
  'use strict';

  var el = UI.el;
  var MOVES = [
    { dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }
  ];

  function start(root, App) {
    var age = App.age();
    var level = 'easy';
    var round = 0;
    var firstTry = 0;
    var timer = null;
    var TOTAL = 4;
    var stats = el('div', { class: 'game-stats' });
    var stage = el('div', { class: 'maze-stage' });
    var difficulty = UI.segmented(Ages.levels(age).map(function (lv) {
      return { value: lv, label: t('common.' + lv) };
    }), level, function (v) { level = v; newSession(); });
    root.appendChild(el('p', { class: 'game-hint' }, t('game.maze.hint')));
    root.appendChild(difficulty);
    root.appendChild(stats);
    root.appendChild(stage);

    function newSession() {
      if (timer) { clearTimeout(timer); timer = null; }
      round = 0; firstTry = 0; render();
    }
    function render() {
      if (round >= TOTAL) {
        App.finishGame('maze', Math.max(1, Math.round(firstTry / TOTAL * 3)), newSession, null, level);
        return;
      }
      round++;
      stats.textContent = t('common.round') + ' ' + round + ' ' + t('common.of') + ' ' + TOTAL;
      UI.clear(stage);
      var size = level === 'easy' ? 4 : (level === 'medium' ? 5 : 6);
      var player = { r: 0, c: 0 };
      var mistakes = 0;
      var done = false;
      var path = {};
      for (var c = 0; c < size; c++) path['0,' + c] = true;
      for (var r = 1; r < size; r++) path[r + ',' + (size - 1)] = true;
      for (var back = size - 2; back >= 1; back--) path[(size - 2) + ',' + back] = true;
      path[(size - 1) + ',1'] = true;
      for (var across = 1; across < size; across++) path[(size - 1) + ',' + across] = true;

      var grid = el('div', { class: 'maze-grid' });
      grid.style.gridTemplateColumns = 'repeat(' + size + ', minmax(38px, 60px))';
      var cells = {};
      function paint() {
        Object.keys(cells).forEach(function (key) {
          var cell = cells[key];
          cell.textContent = (cell._r === player.r && cell._c === player.c) ? '🐻' :
            (cell._r === size - 1 && cell._c === size - 1 ? '🏠' : (path[key] ? '' : ''));
          cell.classList.toggle('maze-wall', !path[key]);
          cell.classList.toggle('maze-player', cell._r === player.r && cell._c === player.c);
          cell.classList.toggle('maze-goal', cell._r === size - 1 && cell._c === size - 1);
        });
      }
      for (var row = 0; row < size; row++) {
        for (var col = 0; col < size; col++) {
          (function (rr, cc) {
            var key = rr + ',' + cc;
            var cell = el('button', {
              type: 'button', class: 'maze-cell',
              'aria-label': t('game.maze.cell', { row: rr + 1, col: cc + 1 }),
              onclick: function () {
                if (done) return;
                var adjacent = Math.abs(rr - player.r) + Math.abs(cc - player.c) === 1;
                if (!adjacent || !path[key]) {
                  mistakes++;
                  cell.classList.add('wrong');
                  Sound.play('wrong');
                  setTimeout(function () { cell.classList.remove('wrong'); }, 400);
                  return;
                }
                player = { r: rr, c: cc };
                Sound.play('tap');
                paint();
                if (rr === size - 1 && cc === size - 1) {
                  done = true;
                  if (!mistakes) firstTry++;
                  Sound.play('win');
                  timer = setTimeout(render, 650);
                }
              }
            }, '');
            cell._r = rr; cell._c = cc; cells[key] = cell; grid.appendChild(cell);
          })(row, col);
        }
      }
      stage.appendChild(grid);
      paint();
    }
    newSession();
    return function cleanup() { if (timer) clearTimeout(timer); };
  }

  App.register({
    id: 'maze', ages: ['junior', 'school'], emoji: '🧭',
    titleKey: 'game.maze', descKey: 'game.maze.desc', start: start
  });
})(window);
