/* games/blocks.js — медленная бонусная игра с падающими фигурами. */
(function (global) {
  'use strict';

  var el = UI.el;
  var t = global.t || function (k) { return k; };
  var WIDTH = 10;
  var HEIGHT = 16;
  var SHAPES = [
    [[1, 1, 1, 1]],
    [[1, 0, 0], [1, 1, 1]],
    [[0, 0, 1], [1, 1, 1]],
    [[1, 1], [1, 1]],
    [[0, 1, 1], [1, 1, 0]],
    [[0, 1, 0], [1, 1, 1]],
    [[1, 1, 0], [0, 1, 1]]
  ];

  function rotate(shape) {
    var rows = shape.length;
    var cols = shape[0].length;
    var turned = [];
    for (var c = 0; c < cols; c++) {
      var row = [];
      for (var r = rows - 1; r >= 0; r--) row.push(shape[r][c]);
      turned.push(row);
    }
    return turned;
  }

  function start(root, App) {
    var age = App.age();
    var baseSpeed = age === 'junior' ? 1050 : 850;
    var minSpeed = age === 'junior' ? 650 : 520;
    var timer = null;
    var active = false;
    var paused = false;
    var board = [];
    var piece = null;
    var nextPiece = null;
    var score = 0;
    var lines = 0;
    var best = Store.best('blocks');
    var cells = [];
    var previewCells = [];
    var status = el('div', { class: 'game-stats blocks-stats' });
    var topbar = el('div', { class: 'blocks-topbar' }, [status]);
    var boardEl = el('div', { class: 'blocks-board', role: 'grid', 'aria-label': t('game.blocks') });
    var previewEl = el('div', { class: 'blocks-next-board', role: 'grid', 'aria-label': t('blocks.next') });
    var previewPanel = el('div', { class: 'blocks-next' }, [
      el('div', { class: 'blocks-next-title' }, t('blocks.next')),
      previewEl
    ]);
    var stage = el('div', { class: 'blocks-stage' }, [previewPanel, boardEl]);
    var controls = el('div', { class: 'blocks-controls' });
    var pad = el('div', { class: 'blocks-pad', role: 'group', 'aria-label': t('blocks.directionControls') });
    var actions = el('div', { class: 'blocks-actions' });
    var holdDelay = null;
    var holdRepeat = null;

    function speedNow() {
      return Math.max(minSpeed, baseSpeed - Math.floor(lines / 5) * 60);
    }

    function updateStatus() {
      status.textContent = t('blocks.score') + ': ' + score + '   ·   ' +
        t('blocks.lines') + ': ' + lines + '   ·   ' + t('runner.best') + ': ' + best +
        '   ·   ' + t('blocks.speed') + ': ' + (speedNow() / 1000).toFixed(1) + ' ' + t('blocks.secondsPerStep');
    }

    function makeBoard() {
      board = [];
      cells = [];
      UI.clear(boardEl);
      for (var r = 0; r < HEIGHT; r++) {
        var row = [];
        for (var c = 0; c < WIDTH; c++) {
          row.push(0);
          var cell = el('div', { class: 'blocks-cell' });
          cells.push(cell);
          boardEl.appendChild(cell);
        }
        board.push(row);
      }
    }

    function randomPiece() {
      var type = UI.randInt(0, SHAPES.length - 1);
      var shape = SHAPES[type].map(function (row) { return row.slice(); });
      return { type: type + 1, shape: shape, x: Math.floor((WIDTH - shape[0].length) / 2), y: 0 };
    }

    function makePreview() {
      previewCells = [];
      UI.clear(previewEl);
      for (var i = 0; i < 16; i++) {
        var cell = el('div', { class: 'blocks-preview-cell' });
        previewCells.push(cell);
        previewEl.appendChild(cell);
      }
    }

    function paintPreview() {
      for (var i = 0; i < previewCells.length; i++) previewCells[i].className = 'blocks-preview-cell';
      if (!nextPiece) return;
      var offsetX = Math.floor((4 - nextPiece.shape[0].length) / 2);
      var offsetY = Math.floor((4 - nextPiece.shape.length) / 2);
      for (var r = 0; r < nextPiece.shape.length; r++) {
        for (var c = 0; c < nextPiece.shape[r].length; c++) {
          if (nextPiece.shape[r][c]) {
            var index = (offsetY + r) * 4 + offsetX + c;
            previewCells[index].className = 'blocks-preview-cell block-' + nextPiece.type;
          }
        }
      }
    }

    function fits(shape, x, y) {
      for (var r = 0; r < shape.length; r++) {
        for (var c = 0; c < shape[r].length; c++) {
          if (!shape[r][c]) continue;
          var bx = x + c;
          var by = y + r;
          if (bx < 0 || bx >= WIDTH || by >= HEIGHT) return false;
          if (by >= 0 && board[by][bx]) return false;
        }
      }
      return true;
    }

    function paint() {
      var shown = board.map(function (row) { return row.slice(); });
      if (piece) {
        for (var r = 0; r < piece.shape.length; r++) {
          for (var c = 0; c < piece.shape[r].length; c++) {
            if (piece.shape[r][c] && piece.y + r >= 0) shown[piece.y + r][piece.x + c] = piece.type;
          }
        }
      }
      for (var i = 0; i < cells.length; i++) {
        var value = shown[Math.floor(i / WIDTH)][i % WIDTH];
        cells[i].className = 'blocks-cell' + (value ? ' block-' + value : '');
      }
      updateStatus();
    }

    function clearLines() {
      var cleared = 0;
      for (var r = HEIGHT - 1; r >= 0; r--) {
        if (board[r].every(function (value) { return value > 0; })) {
          board.splice(r, 1);
          board.unshift(new Array(WIDTH).fill(0));
          cleared++;
          r++;
        }
      }
      if (cleared) {
        lines += cleared;
        score += [0, 10, 30, 60, 100][cleared] || cleared * 40;
        Sound.play('win');
        startTimer();
      }
    }

    function spawn() {
      piece = nextPiece || randomPiece();
      nextPiece = randomPiece();
      paintPreview();
      if (!fits(piece.shape, piece.x, piece.y)) gameOver();
    }

    function lockPiece() {
      for (var r = 0; r < piece.shape.length; r++) {
        for (var c = 0; c < piece.shape[r].length; c++) {
          if (piece.shape[r][c] && piece.y + r >= 0) board[piece.y + r][piece.x + c] = piece.type;
        }
      }
      clearLines();
      spawn();
      paint();
    }

    function drop() {
      if (!piece || !active || paused) return;
      if (fits(piece.shape, piece.x, piece.y + 1)) piece.y++;
      else lockPiece();
      paint();
    }

    function startTimer() {
      if (timer) { clearInterval(timer); timer = null; }
      if (active && !paused) timer = setInterval(drop, speedNow());
    }

    function move(dx, dy) {
      if (!active || paused || !piece) return;
      if (fits(piece.shape, piece.x + dx, piece.y + dy)) {
        piece.x += dx;
        piece.y += dy;
        if (dy > 0) score++;
        paint();
      } else if (dy > 0) {
        lockPiece();
      }
    }

    function turn() {
      if (!active || paused || !piece) return;
      var next = rotate(piece.shape);
      var kicks = [0, -1, 1, -2, 2];
      for (var i = 0; i < kicks.length; i++) {
        if (fits(next, piece.x + kicks[i], piece.y)) {
          piece.shape = next;
          piece.x += kicks[i];
          Sound.play('tap');
          paint();
          return;
        }
      }
    }

    function togglePause() {
      if (!piece || !active) return;
      paused = !paused;
      pauseButton.textContent = '';
      pauseButton.setAttribute('aria-label', t(paused ? 'blocks.resume' : 'blocks.pause'));
      pauseButton.setAttribute('title', t(paused ? 'blocks.resume' : 'blocks.pause'));
      if (paused) { if (timer) clearInterval(timer); timer = null; }
      else startTimer();
    }

    function gameOver() {
      active = false;
      if (timer) { clearInterval(timer); timer = null; }
      if (score > best) { best = score; Store.setBest('blocks', best); }
      paint();
      Sound.play('wrong');
      App.showOverlay(el('div', { class: 'result' }, [
        el('div', { class: 'result-emoji' }, '🧱'),
        el('div', { class: 'result-title' }, t('blocks.gameover')),
        el('p', { class: 'result-text' }, t('blocks.score') + ': ' + score),
        el('p', { class: 'result-note' }, t('blocks.lines') + ': ' + lines),
        el('div', { class: 'result-actions' }, [
          el('button', { type: 'button', class: 'btn primary', onclick: function () { App.hideOverlay(); reset(); } }, t('blocks.again')),
          el('button', { type: 'button', class: 'btn', onclick: function () { App.hideOverlay(); App.goHome(); } }, t('home'))
        ])
      ]));
    }

    function reset() {
      if (timer) { clearInterval(timer); timer = null; }
      score = 0;
      lines = 0;
      active = true;
      paused = false;
      pauseButton.textContent = '';
      pauseButton.setAttribute('aria-label', t('blocks.pause'));
      pauseButton.setAttribute('title', t('blocks.pause'));
      makeBoard();
      makePreview();
      nextPiece = randomPiece();
      spawn();
      paint();
      startTimer();
    }

    function button(key, className, action, label) {
      return el('button', { type: 'button', class: className, 'aria-label': label, onclick: action }, key);
    }

    function stopHold() {
      if (holdDelay) { clearTimeout(holdDelay); holdDelay = null; }
      if (holdRepeat) { clearInterval(holdRepeat); holdRepeat = null; }
    }

    function repeatButton(icon, className, action, label) {
      var pointerStarted = false;
      var btn = el('button', { type: 'button', class: className, 'aria-label': label }, icon);
      btn.addEventListener('pointerdown', function (event) {
        event.preventDefault();
        pointerStarted = true;
        stopHold();
        action();
        if (btn.setPointerCapture) btn.setPointerCapture(event.pointerId);
        holdDelay = setTimeout(function () {
          holdDelay = null;
          holdRepeat = setInterval(action, 85);
        }, 230);
      });
      btn.addEventListener('pointerup', function () {
        stopHold();
        setTimeout(function () { pointerStarted = false; }, 0);
      });
      btn.addEventListener('pointercancel', function () { stopHold(); pointerStarted = false; });
      btn.addEventListener('lostpointercapture', stopHold);
      btn.addEventListener('click', function (event) {
        if (pointerStarted) {
          pointerStarted = false;
          event.preventDefault();
        } else action();
      });
      return btn;
    }

    var pauseButton = button('', 'btn blocks-pause', togglePause, t('blocks.pause'));
    pauseButton.setAttribute('title', t('blocks.pause'));
    topbar.appendChild(pauseButton);
    var rotateButton = el('button', {
      type: 'button', class: 'blocks-rotate', 'aria-label': t('blocks.rotate'), onclick: turn
    });
    pad.appendChild(el('span', { class: 'blocks-pad-empty', 'aria-hidden': 'true' }));
    pad.appendChild(button('', 'blocks-control blocks-up', turn, t('blocks.rotate')));
    pad.appendChild(el('span', { class: 'blocks-pad-empty', 'aria-hidden': 'true' }));
    pad.appendChild(repeatButton('', 'blocks-control blocks-left', function () { move(-1, 0); }, t('blocks.left')));
    pad.appendChild(el('span', { class: 'blocks-pad-center', 'aria-hidden': 'true' }));
    pad.appendChild(repeatButton('', 'blocks-control blocks-right', function () { move(1, 0); }, t('blocks.right')));
    pad.appendChild(el('span', { class: 'blocks-pad-empty', 'aria-hidden': 'true' }));
    pad.appendChild(repeatButton('', 'blocks-control blocks-down', function () { move(0, 1); }, t('blocks.down')));
    pad.appendChild(el('span', { class: 'blocks-pad-empty', 'aria-hidden': 'true' }));
    actions.appendChild(rotateButton);
    controls.appendChild(pad);
    controls.appendChild(actions);

    root.appendChild(el('p', { class: 'game-hint' }, t('blocks.hint')));
    root.appendChild(topbar);
    root.appendChild(stage);
    root.appendChild(controls);

    function onKey(event) {
      var handled = true;
      if (event.code === 'ArrowLeft') move(-1, 0);
      else if (event.code === 'ArrowRight') move(1, 0);
      else if (event.code === 'ArrowDown') move(0, 1);
      else if (event.code === 'ArrowUp' || event.code === 'Space') turn();
      else if (event.code === 'Escape') togglePause();
      else handled = false;
      if (handled) event.preventDefault();
    }

    document.addEventListener('keydown', onKey);
    reset();
    return function cleanup() {
      active = false;
      stopHold();
      if (timer) { clearInterval(timer); timer = null; }
      document.removeEventListener('keydown', onKey);
    };
  }

  App.register({
    id: 'blocks', ages: ['junior', 'school'], emoji: '🧱',
    titleKey: 'game.blocks', descKey: 'game.blocks.desc',
    requires: 'rank.master', noStars: true, start: start
  });
})(window);
