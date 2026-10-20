/* games/robot.js — составь команды для робота и запусти программу. */
(function (global) {
  'use strict';

  var el = UI.el;
  var DIRS = [
    { id: 'up', dr: -1, dc: 0, icon: '⬆️' },
    { id: 'down', dr: 1, dc: 0, icon: '⬇️' },
    { id: 'left', dr: 0, dc: -1, icon: '⬅️' },
    { id: 'right', dr: 0, dc: 1, icon: '➡️' }
  ];
  var ROUTES = {
    easy: [
      ['right', 'right', 'down', 'down'],
      ['down', 'down', 'right', 'right'],
      ['right', 'down', 'right', 'down'],
      ['down', 'right', 'down', 'right'],
      ['right', 'down', 'down', 'right']
    ],
    medium: [
      ['down', 'down', 'right', 'right', 'right'],
      ['down', 'right', 'down', 'right', 'right'],
      ['down', 'right', 'right', 'down', 'right'],
      ['right', 'down', 'down', 'right', 'right'],
      ['right', 'down', 'right', 'down', 'right']
    ],
    hard: [
      ['down', 'down', 'right', 'right', 'up', 'right', 'down'],
      ['right', 'right', 'right', 'down', 'down', 'left', 'up'],
      ['down', 'right', 'down', 'right', 'right', 'up', 'right'],
      ['right', 'down', 'right', 'down', 'right', 'up', 'right'],
      ['down', 'down', 'right', 'up', 'right', 'down', 'right'],
      ['right', 'down', 'down', 'right', 'right', 'up', 'left']
    ]
  };

  function start(root, App) {
    var age = App.age();
    var level = 'easy';
    var round = 0;
    var firstTry = 0;
    var timer = null;
    var routeQueue = [];
    var TOTAL = 5;
    var stats = el('div', { class: 'game-stats' });
    var stage = el('div', { class: 'robot-stage' });
    var difficulty = UI.segmented(Ages.levels(age).map(function (lv) {
      return { value: lv, label: t('common.' + lv) };
    }), level, function (v) { level = v; newSession(); });
    root.appendChild(el('p', { class: 'game-hint' }, t('game.robot.hint')));
    root.appendChild(difficulty);
    root.appendChild(stats);
    root.appendChild(stage);

    function newSession() {
      if (timer) { clearTimeout(timer); timer = null; }
      routeQueue = UI.shuffle(ROUTES[level]);
      round = 0; firstTry = 0; render();
    }
    function render() {
      if (round >= TOTAL) {
        App.finishGame('robot', Math.max(1, Math.round(firstTry / TOTAL * 3)), newSession, null, level);
        return;
      }
      round++;
      stats.textContent = t('common.round') + ' ' + round + ' ' + t('common.of') + ' ' + TOTAL;
      UI.clear(stage);
      var route = routeQueue[round - 1];
      var position = { r: 2, c: 0 };
      var routeCells = { '2,0': true };
      route.forEach(function (id) {
        var dir = DIRS.filter(function (d) { return d.id === id; })[0];
        position = { r: position.r + dir.dr, c: position.c + dir.dc };
        routeCells[position.r + ',' + position.c] = true;
      });
      var goal = position;
      var commands = [];
      var mistakes = 0;
      var locked = false;
      var size = 5;
      var grid = el('div', { class: 'robot-grid' });
      grid.style.gridTemplateColumns = 'repeat(' + size + ', minmax(34px, 52px))';
      var cells = {};
      function paint(at, bump) {
        Object.keys(cells).forEach(function (key) {
          var cell = cells[key];
          cell.textContent = cell._r === at.r && cell._c === at.c ? '🤖' :
            (cell._r === 2 && cell._c === 0 ? '▶️' :
              (cell._r === goal.r && cell._c === goal.c ? '⭐' : ''));
          cell.classList.toggle('robot-wall', !routeCells[key]);
          cell.classList.toggle('robot-bump', !!bump && cell._r === bump.r && cell._c === bump.c);
        });
      }
      for (var r = 0; r < size; r++) {
        for (var c = 0; c < size; c++) {
          (function (rr, cc) {
            var key = rr + ',' + cc;
            var cell = el('div', { class: 'robot-cell' });
            cell._r = rr; cell._c = cc; cells[key] = cell; grid.appendChild(cell);
          })(r, c);
        }
      }
      stage.appendChild(grid);
      paint({ r: 2, c: 0 });

      var program = el('div', { class: 'robot-program' });
      var commandButtons = [];
      var palette = el('div', { class: 'robot-palette' });
      var feedback = el('div', { class: 'robot-feedback', 'aria-live': 'polite' });
      function paintProgram() {
        UI.clear(program);
        commandButtons = [];
        commands.forEach(function (id, index) {
          var icon = DIRS.filter(function (d) { return d.id === id; })[0].icon;
          var cmd = el('button', {
            type: 'button', class: 'robot-command',
            'aria-label': t('game.robot.removeCommand', { n: index + 1 }),
            onclick: function () { if (!locked) { commands.splice(index, 1); paintProgram(); } }
          }, icon);
          commandButtons.push(cmd);
          program.appendChild(cmd);
        });
        if (!commands.length) program.appendChild(el('span', { class: 'robot-empty' }, '…'));
      }
      DIRS.forEach(function (dir) {
        palette.appendChild(el('button', {
          type: 'button', class: 'robot-arrow',
          'aria-label': t('game.robot.' + dir.id),
          onclick: function () {
            if (!locked) { commands.push(dir.id); paintProgram(); Sound.play('tap'); }
          }
        }, dir.icon));
      });
      var actions = el('div', { class: 'robot-actions' }, [
        el('button', { type: 'button', class: 'btn', onclick: function () { if (!locked) { commands = []; paintProgram(); } } }, t('game.robot.clear')),
        el('button', { type: 'button', class: 'btn primary', onclick: run }, t('game.robot.run'))
      ]);
      function run() {
        if (locked) return;
        locked = true;
        var at = { r: 2, c: 0 };
        var index = 0;
        feedback.textContent = '';

        function fail(bump) {
          mistakes++;
          if (bump) paint(at, bump);
          feedback.textContent = t('game.robot.tryAgain');
          Sound.play('wrong');
          timer = setTimeout(function () {
            paint({ r: 2, c: 0 });
            commandButtons.forEach(function (button) { button.classList.remove('active'); });
            feedback.textContent = '';
            locked = false;
          }, 700);
        }

        function step() {
          commandButtons.forEach(function (button, i) {
            button.classList.toggle('active', i === index);
          });
          if (index >= commands.length) {
            if (at.r === goal.r && at.c === goal.c) {
              if (!mistakes) firstTry++;
              feedback.textContent = t('common.correct');
              Sound.play('win');
              timer = setTimeout(render, 750);
            } else {
              fail();
            }
            return;
          }
          var d = DIRS.filter(function (x) { return x.id === commands[index]; })[0];
          var next = { r: at.r + d.dr, c: at.c + d.dc };
          timer = setTimeout(function () {
            if (!routeCells[next.r + ',' + next.c]) {
              fail(next.r >= 0 && next.r < size && next.c >= 0 && next.c < size ? next : null);
              return;
            }
            at = next;
            paint(at);
            Sound.play('tap');
            index++;
            step();
          }, 420);
        }

        if (!commands.length) {
          fail();
          return;
        }
        step();
      }
      paintProgram();
      stage.appendChild(program);
      stage.appendChild(palette);
      stage.appendChild(actions);
      stage.appendChild(feedback);
    }
    newSession();
    return function cleanup() { if (timer) clearTimeout(timer); };
  }

  App.register({
    id: 'robot', ages: ['school'], emoji: '🤖',
    titleKey: 'game.robot', descKey: 'game.robot.desc', start: start
  });
})(window);
