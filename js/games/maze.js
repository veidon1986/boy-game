/* games/maze.js — составь программу и проведи героя домой. */
(function (global) {
  'use strict';

  var el = UI.el;
  var DIRS = [
    { id: 'up', dr: -1, dc: 0, icon: '⬆️' },
    { id: 'down', dr: 1, dc: 0, icon: '⬇️' },
    { id: 'left', dr: 0, dc: -1, icon: '⬅️' },
    { id: 'right', dr: 0, dc: 1, icon: '➡️' }
  ];
  var CORNERS = [
    { r: 0, c: 0 }, { r: 0, c: 1 }, { r: 1, c: 0 }, { r: 1, c: 1 }
  ];

  function direction(id) {
    return DIRS.filter(function (dir) { return dir.id === id; })[0];
  }

  function start(root, App) {
    var age = App.age();
    var level = 'easy';
    var round = 0;
    var firstTry = 0;
    var timer = null;
    var TOTAL = 5;
    var seenRoutes = {};
    var historyRoutes = {};
    Store.taskHistory('maze').forEach(function (key) { historyRoutes[key] = true; });
    var previousCorner = -1;
    var stats = el('div', { class: 'game-stats' });
    var stage = el('div', { class: 'maze-stage' });
    var difficulty = UI.segmented(App.gameLevels('maze').map(function (lv) {
      return { value: lv, label: t('common.' + lv) };
    }), level, function (v) { level = v; newSession(); });
    root.appendChild(el('p', { class: 'game-hint' }, t('game.maze.hint')));
    root.appendChild(difficulty);
    root.appendChild(stats);
    root.appendChild(stage);

    function newSession() {
      if (timer) { clearTimeout(timer); timer = null; }
      seenRoutes = {};
      previousCorner = -1;
      round = 0;
      firstTry = 0;
      render();
    }

    function makeRoute(size) {
      var cornerIndex = UI.randInt(0, CORNERS.length - 1);
      if (cornerIndex === previousCorner) cornerIndex = (cornerIndex + 1 + UI.randInt(0, 2)) % CORNERS.length;
      var corner = CORNERS[cornerIndex];
      previousCorner = cornerIndex;
      var startAt = { r: corner.r ? size - 1 : 0, c: corner.c ? size - 1 : 0 };
      var goal = { r: size - 1 - startAt.r, c: size - 1 - startAt.c };
      var down = goal.r > startAt.r ? 'down' : 'up';
      var across = goal.c > startAt.c ? 'right' : 'left';
      var steps = [];
      for (var i = 1; i < size; i++) steps.push(down, across);
      steps = UI.shuffle(steps);
      var key = cornerIndex + '|' + steps.join(',');
      var attempts = 0;
      while ((seenRoutes[key] || historyRoutes[key]) && attempts < 100) {
        steps = UI.shuffle(steps);
        key = cornerIndex + '|' + steps.join(',');
        attempts++;
      }
      if (seenRoutes[key] || historyRoutes[key]) return null;
      seenRoutes[key] = true;
      historyRoutes[key] = true;
      Store.rememberTask('maze', key, 1000);
      var cells = {};
      var at = { r: startAt.r, c: startAt.c };
      cells[at.r + ',' + at.c] = true;
      steps.forEach(function (id) {
        var dir = direction(id);
        at = { r: at.r + dir.dr, c: at.c + dir.dc };
        cells[at.r + ',' + at.c] = true;
      });
      return { start: startAt, goal: goal, steps: steps, cells: cells, key: key };
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
      var route = makeRoute(size);
      if (!route) { UI.showTaskPoolExhausted(root, App, { exhausted: false }); return; }
      var commands = [];
      var mistakes = 0;
      var locked = false;
      var position = { r: route.start.r, c: route.start.c };
      var grid = el('div', { class: 'robot-grid maze-grid' });
      grid.style.gridTemplateColumns = 'repeat(' + size + ', minmax(38px, 60px))';
      var cells = {};

      function paint(at, bump) {
        Object.keys(cells).forEach(function (key) {
          var cell = cells[key];
          cell.textContent = cell._r === at.r && cell._c === at.c ? '🐻' :
            (cell._r === route.goal.r && cell._c === route.goal.c ? '🏠' : '');
          cell.classList.toggle('robot-wall', !route.cells[key]);
          cell.classList.toggle('robot-current', cell._r === at.r && cell._c === at.c);
          cell.classList.toggle('robot-goal', cell._r === route.goal.r && cell._c === route.goal.c);
          cell.classList.toggle('robot-path', !!route.cells[key]);
          cell.classList.toggle('maze-cell', true);
          cell.classList.toggle('robot-bump', !!bump && cell._r === bump.r && cell._c === bump.c);
        });
      }

      for (var r = 0; r < size; r++) {
        for (var c = 0; c < size; c++) {
          var cell = el('div', { class: 'robot-cell maze-cell' });
          cell._r = r;
          cell._c = c;
          cells[r + ',' + c] = cell;
          grid.appendChild(cell);
        }
      }
      stage.appendChild(grid);
      paint(position);

      var program = el('div', { class: 'robot-program' });
      var commandButtons = [];
      var palette = el('div', { class: 'robot-palette' });
      var feedback = el('div', { class: 'robot-feedback', 'aria-live': 'polite' });

      function paintProgram() {
        UI.clear(program);
        commandButtons = [];
        commands.forEach(function (id, index) {
          var icon = direction(id).icon;
          var command = el('button', {
            type: 'button', class: 'robot-command',
            'aria-label': t('game.robot.removeCommand', { n: index + 1 }),
            onclick: function () {
              if (!locked) {
                commands.splice(index, 1);
                paintProgram();
              }
            }
          }, icon);
          commandButtons.push(command);
          program.appendChild(command);
        });
        if (!commands.length) program.appendChild(el('span', { class: 'robot-empty' }, '…'));
      }

      DIRS.forEach(function (dir) {
        palette.appendChild(el('button', {
          type: 'button', class: 'robot-arrow',
          'aria-label': t('game.robot.' + dir.id),
          onclick: function () {
            if (!locked) {
              commands.push(dir.id);
              paintProgram();
              Sound.play('tap');
            }
          }
        }, dir.icon));
      });

      function fail(bump) {
        mistakes++;
        if (bump) paint(position, bump);
        feedback.textContent = t('game.maze.tryAgain');
        Sound.play('wrong');
        timer = setTimeout(function () {
          position = { r: route.start.r, c: route.start.c };
          paint(position);
          commandButtons.forEach(function (button) { button.classList.remove('active'); });
          feedback.textContent = '';
          locked = false;
        }, 700);
      }

      function run() {
        if (locked) return;
        locked = true;
        position = { r: route.start.r, c: route.start.c };
        var index = 0;
        feedback.textContent = '';
        if (!commands.length) {
          fail();
          return;
        }

        function step() {
          commandButtons.forEach(function (button, i) {
            button.classList.toggle('active', i === index);
          });
          if (index >= commands.length) {
            if (position.r === route.goal.r && position.c === route.goal.c) {
              if (!mistakes) firstTry++;
              feedback.textContent = t('common.correct');
              Sound.play('win');
              timer = setTimeout(render, 750);
            } else {
              fail();
            }
            return;
          }

          var dir = direction(commands[index]);
          var next = { r: position.r + dir.dr, c: position.c + dir.dc };
          timer = setTimeout(function () {
            if (!route.cells[next.r + ',' + next.c]) {
              var inBounds = next.r >= 0 && next.r < size && next.c >= 0 && next.c < size;
              fail(inBounds ? next : null);
              return;
            }
            position = next;
            paint(position);
            Sound.play('tap');
            index++;
            step();
          }, 420);
        }
        step();
      }

      var actions = el('div', { class: 'robot-actions' }, [
        el('button', {
          type: 'button', class: 'btn',
          onclick: function () {
            if (!locked) { commands = []; paintProgram(); }
          }
        }, t('game.robot.clear')),
        el('button', { type: 'button', class: 'btn primary', onclick: run }, t('game.robot.run'))
      ]);

      paintProgram();
      stage.appendChild(program);
      stage.appendChild(palette);
      stage.appendChild(actions);
      stage.appendChild(feedback);
    }

    newSession();
    return function cleanup() { if (timer) clearTimeout(timer); };
  }

  App.register('maze', start);
})(window);
