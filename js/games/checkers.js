/* games/checkers.js — шашки для двух игроков на одном устройстве. */
(function (global) {
  'use strict';

  var el = UI.el;
  var t = global.t || function (k) { return k; };
  var SIZE = 8;
  var RED = 1;
  var BLUE = -1;

  var RULE_CARDS = [
    { title: 'checkers.school.rules.board.title', text: 'checkers.school.rules.board.text' },
    { title: 'checkers.school.rules.checker.title', text: 'checkers.school.rules.checker.text' },
    { title: 'checkers.school.rules.capture.title', text: 'checkers.school.rules.capture.text' },
    { title: 'checkers.school.rules.king.title', text: 'checkers.school.rules.king.text' },
    { title: 'checkers.school.rules.series.title', text: 'checkers.school.rules.series.text' }
  ];

  var MOVE_LESSONS = [
    { piece: RED, from: [5,0], extras: [], steps: [{ to: [4,1], captures: [] }], title: 'checkers.lesson.move.red.title', task: 'checkers.lesson.move.red.task', success: 'checkers.lesson.move.red.success' },
    { piece: BLUE, from: [2,1], extras: [], steps: [{ to: [3,0], captures: [] }], title: 'checkers.lesson.move.blue.title', task: 'checkers.lesson.move.blue.task', success: 'checkers.lesson.move.blue.success' },
    { piece: RED * 2, from: [5,0], extras: [], steps: [{ to: [2,3], captures: [] }], title: 'checkers.lesson.move.king.title', task: 'checkers.lesson.move.king.task', success: 'checkers.lesson.move.king.success' }
  ];

  var CAPTURE_LESSONS = [
    { piece: RED, from: [5,0], extras: [[4,1,BLUE]], steps: [{ to: [3,2], captures: [[4,1]] }], title: 'checkers.lesson.capture.forward.title', task: 'checkers.lesson.capture.forward.task', success: 'checkers.lesson.capture.forward.success' },
    { piece: RED, from: [3,2], extras: [[4,3,BLUE]], steps: [{ to: [5,4], captures: [[4,3]] }], title: 'checkers.lesson.capture.backward.title', task: 'checkers.lesson.capture.backward.task', success: 'checkers.lesson.capture.backward.success' },
    { piece: RED * 2, from: [5,0], extras: [[3,2,BLUE]], steps: [{ to: [1,4], captures: [[3,2]] }], title: 'checkers.lesson.capture.king.title', task: 'checkers.lesson.capture.king.task', success: 'checkers.lesson.capture.king.success' },
    { piece: RED, from: [5,0], extras: [[4,1,BLUE],[2,3,BLUE]], steps: [
      { to: [3,2], captures: [[4,1]] }, { to: [1,4], captures: [[2,3]] }
    ], title: 'checkers.lesson.capture.series.title', task: 'checkers.lesson.capture.series.task', success: 'checkers.lesson.capture.series.success' }
  ];

  function side(piece) { return piece > 0 ? RED : (piece < 0 ? BLUE : 0); }
  function inside(r, c) { return r >= 0 && r < SIZE && c >= 0 && c < SIZE; }
  function key(r, c) { return r + ',' + c; }

  function capturesFor(board, r, c, piece) {
    var found = [];
    var team = side(piece);
    var dirs = [-1, 1];
    if (Math.abs(piece) === 1) {
      dirs.forEach(function (dr) {
        dirs.forEach(function (dc) {
          var mr = r + dr;
          var mc = c + dc;
          var tr = r + dr * 2;
          var tc = c + dc * 2;
          if (inside(tr, tc) && side(board[mr][mc]) === -team && !board[tr][tc]) {
            found.push({ from: { r: r, c: c }, to: { r: tr, c: tc }, captured: [{ r: mr, c: mc }] });
          }
        });
      });
      return found;
    }

    dirs.forEach(function (dr) {
      dirs.forEach(function (dc) {
        var nr = r + dr;
        var nc = c + dc;
        while (inside(nr, nc) && !board[nr][nc]) { nr += dr; nc += dc; }
        if (!inside(nr, nc) || side(board[nr][nc]) !== -team) return;
        var captured = { r: nr, c: nc };
        nr += dr;
        nc += dc;
        while (inside(nr, nc) && !board[nr][nc]) {
          found.push({ from: { r: r, c: c }, to: { r: nr, c: nc }, captured: [captured] });
          nr += dr;
          nc += dc;
        }
      });
    });
    return found;
  }

  function allMoves(board, team, forcedFrom) {
    var captures = [];
    var moves = [];
    var r, c;
    if (forcedFrom) return capturesFor(board, forcedFrom.r, forcedFrom.c, board[forcedFrom.r][forcedFrom.c]);
    for (r = 0; r < SIZE; r++) {
      for (c = 0; c < SIZE; c++) {
        var piece = board[r][c];
        if (side(piece) !== team) continue;
        captures = captures.concat(capturesFor(board, r, c, piece));
      }
    }
    if (captures.length) return captures;

    for (r = 0; r < SIZE; r++) {
      for (c = 0; c < SIZE; c++) {
        piece = board[r][c];
        if (side(piece) !== team) continue;
        var dirs = [-1, 1];
        dirs.forEach(function (dr) {
          dirs.forEach(function (dc) {
            if (Math.abs(piece) === 1 && dr !== -team) return;
            var nr = r + dr;
            var nc = c + dc;
            while (inside(nr, nc) && !board[nr][nc]) {
              moves.push({ from: { r: r, c: c }, to: { r: nr, c: nc }, captured: [] });
              if (Math.abs(piece) === 1) break;
              nr += dr;
              nc += dc;
            }
          });
        });
      }
    }
    return moves;
  }

  function startParty(root, App) {
    var board = [];
    var turn = RED;
    var selected = null;
    var forcedFrom = null;
    var finished = false;
    var status = el('div', { class: 'game-stats checkers-status', 'aria-live': 'polite' });
    var boardEl = el('div', { class: 'checkers-board', role: 'grid', 'aria-label': t('game.checkers') });
    var stage = el('div', { class: 'checkers-stage' }, [status, boardEl]);
    var controls = el('div', { class: 'checkers-controls' });
    var squares = [];

    root.appendChild(el('p', { class: 'game-hint' }, t('checkers.hint')));
    root.appendChild(stage);
    root.appendChild(controls);

    function playerName(team) { return t(team === RED ? 'checkers.red' : 'checkers.blue'); }

    function startPosition() {
      board = [];
      for (var r = 0; r < SIZE; r++) {
        var row = [];
        for (var c = 0; c < SIZE; c++) {
          var piece = 0;
          if ((r + c) % 2 === 1 && r < 3) piece = BLUE;
          else if ((r + c) % 2 === 1 && r > 4) piece = RED;
          row.push(piece);
        }
        board.push(row);
      }
      turn = RED;
      selected = null;
      forcedFrom = null;
      finished = false;
      paint();
    }

    function legal() { return allMoves(board, turn, forcedFrom); }

    function updateStatus() {
      if (finished) return;
      var moves = legal();
      var canCapture = moves.some(function (move) { return move.captured.length > 0; });
      var text = t('checkers.turn', { player: playerName(turn) });
      if (forcedFrom) text += ' · ' + t('checkers.continueCapture');
      else if (canCapture) text += ' · ' + t('checkers.mustCapture');
      else if (selected) text += ' · ' + t('checkers.selectDestination');
      else text += ' · ' + t('checkers.selectPiece');
      status.textContent = text;
    }

    function paint() {
      UI.clear(boardEl);
      squares = [];
      var moves = legal();
      var targets = {};
      moves.forEach(function (move) {
        if (!selected || move.from.r !== selected.r || move.from.c !== selected.c) return;
        targets[key(move.to.r, move.to.c)] = true;
      });
      for (var r = 0; r < SIZE; r++) {
        for (var c = 0; c < SIZE; c++) {
          (function (row, col) {
            var piece = board[row][col];
            var classes = 'checkers-square ' + ((row + col) % 2 ? 'dark' : 'light');
            if (selected && selected.r === row && selected.c === col) classes += ' selected';
            if (targets[key(row, col)]) classes += ' target';
            var square = el('button', {
              type: 'button', class: classes, role: 'gridcell',
              'aria-label': t('checkers.square', { row: row + 1, col: col + 1 }),
              onclick: function () { choose(row, col); }
            });
            if (piece) {
              square.appendChild(el('span', {
                class: 'checkers-piece ' + (side(piece) === RED ? 'red' : 'blue') + (Math.abs(piece) === 2 ? ' king' : '')
              }, Math.abs(piece) === 2 ? '♛' : ''));
            }
            boardEl.appendChild(square);
            squares.push(square);
          })(r, c);
        }
      }
      updateStatus();
    }

    function choose(r, c) {
      if (finished) return;
      var moves = legal();
      var chosen = moves.filter(function (move) {
        return selected && move.from.r === selected.r && move.from.c === selected.c && move.to.r === r && move.to.c === c;
      })[0];
      if (chosen) {
        playMove(chosen);
        return;
      }
      if (forcedFrom) return;
      if (side(board[r][c]) === turn) {
        var options = moves.filter(function (move) { return move.from.r === r && move.from.c === c; });
        selected = options.length ? { r: r, c: c } : null;
        Sound.play('tap');
        paint();
      } else if (selected) {
        selected = null;
        paint();
      }
    }

    function playMove(move) {
      var piece = board[move.from.r][move.from.c];
      board[move.from.r][move.from.c] = 0;
      move.captured.forEach(function (at) { board[at.r][at.c] = 0; });
      board[move.to.r][move.to.c] = piece;
      if (piece === RED && move.to.r === 0) board[move.to.r][move.to.c] = RED * 2;
      if (piece === BLUE && move.to.r === SIZE - 1) board[move.to.r][move.to.c] = BLUE * 2;
      Sound.play('tap');

      if (move.captured.length) {
        var nextCaptures = capturesFor(board, move.to.r, move.to.c, board[move.to.r][move.to.c]);
        if (nextCaptures.length) {
          forcedFrom = { r: move.to.r, c: move.to.c };
          selected = forcedFrom;
          paint();
          return;
        }
      }

      forcedFrom = null;
      selected = null;
      turn = -turn;
      paint();
      var opponentPieces = 0;
      board.forEach(function (row) {
        row.forEach(function (value) { if (side(value) === turn) opponentPieces++; });
      });
      if (!opponentPieces || !legal().length) finish(-turn);
    }

    function finish(winner) {
      finished = true;
      status.textContent = t('checkers.wins', { player: playerName(winner) });
      Sound.play('win');
      App.showOverlay(el('div', { class: 'result' }, [
        el('div', { class: 'result-emoji' }, winner === RED ? '🔴' : '🔵'),
        el('div', { class: 'result-title' }, t('checkers.wins', { player: playerName(winner) })),
        el('div', { class: 'result-actions' }, [
          el('button', { type: 'button', class: 'btn primary', onclick: function () { App.hideOverlay(); startPosition(); } }, t('checkers.again')),
          el('button', { type: 'button', class: 'btn', onclick: function () { App.hideOverlay(); App.goHome(); } }, t('checkers.home'))
        ])
      ]));
    }

    controls.appendChild(el('button', {
      type: 'button', class: 'btn primary', onclick: startPosition
    }, t('checkers.newGame')));

    startPosition();
    return function cleanup() { finished = true; };
  }

  function start(root, App) {
    var partyCleanup = null;
    function menu() {
      UI.clear(root);
      root.appendChild(el('p', { class: 'game-hint' }, t('checkers.menuIntro')));
      root.appendChild(el('div', { class: 'chess-menu' }, [
        el('button', { type: 'button', class: 'btn primary wide', onclick: function () {
          Sound.play('tap');
          startSchool(root, App, menu);
        } }, '📖 ' + t('checkers.school.open')),
        el('button', { type: 'button', class: 'btn wide', onclick: function () {
          Sound.play('tap');
          if (!App.demoMode && !Achievements.hasRank('rank.genius')) {
            App.showLocked({ requires: 'rank.genius' });
            return;
          }
          partyCleanup = startParty(root, App);
        } }, (App.demoMode || Achievements.hasRank('rank.genius') ? '🔴 ' : '🔒 ') + t('checkers.play')),
        el('button', { type: 'button', class: 'btn wide', onclick: function () { App.goHome(); } }, '🏠 ' + t('checkers.home'))
      ]));
    }
    menu();
    return function cleanup() { if (partyCleanup) partyCleanup(); };
  }

  function startSchool(root, App, onBack) {
    var cardIndex = 0;

    function menu() {
      UI.clear(root);
      root.appendChild(el('p', { class: 'game-hint' }, t('checkers.school.intro')));
      root.appendChild(el('div', { class: 'chess-menu' }, [
        el('button', { type: 'button', class: 'btn primary wide', onclick: function () { cardIndex = 0; showRuleCard(); } }, '📖 ' + t('checkers.school.stage1')),
        el('button', { type: 'button', class: 'btn wide', onclick: function () { startStage(MOVE_LESSONS, 'moves'); } }, '↗️ ' + t('checkers.school.stage2')),
        el('button', { type: 'button', class: 'btn wide', onclick: function () { startStage(CAPTURE_LESSONS, 'captures'); } }, '🎯 ' + t('checkers.school.stage3')),
        el('button', { type: 'button', class: 'btn wide', onclick: function () { if (onBack) onBack(); else App.goHome(); } }, '← ' + t('checkers.school.backToGame'))
      ]));
    }

    function showRuleCard() {
      var card = RULE_CARDS[cardIndex];
      UI.clear(root);
      root.appendChild(el('div', { class: 'chess-lesson-head' }, [
        el('button', { type: 'button', class: 'btn', onclick: menu }, '← ' + t('checkers.school.back')),
        el('span', { class: 'chess-lesson-count' }, t('checkers.school.ruleProgress', { current: cardIndex + 1, total: RULE_CARDS.length }))
      ]));
      root.appendChild(el('div', { class: 'chess-piece-card checkers-rule-card' }, [
        el('div', { class: 'checkers-rule-icon', 'aria-hidden': 'true' }, cardIndex === 0 ? '⬛' : (cardIndex === 3 ? '👑' : '🔴')),
        el('h2', {}, t(card.title)),
        el('p', {}, t(card.text)),
        el('div', { class: 'chess-piece-nav' }, [
          el('button', { type: 'button', class: 'btn', disabled: cardIndex === 0, onclick: function () { cardIndex--; showRuleCard(); } }, '← ' + t('checkers.school.previous')),
          el('button', { type: 'button', class: 'btn primary', onclick: function () {
            if (cardIndex + 1 < RULE_CARDS.length) { cardIndex++; showRuleCard(); }
            else menu();
          } }, cardIndex + 1 < RULE_CARDS.length ? t('checkers.school.next') : t('checkers.school.toStages'))
        ])
      ]));
    }

    function startStage(list, stageName) {
      var historyKey = 'checkers-lessons-' + stageName;
      var seen = Store.taskHistory(historyKey);
      var remaining = list.filter(function (lesson) { return seen.indexOf(lesson.task) < 0; });
      if (!remaining.length) {
        UI.clear(root);
        root.appendChild(el('div', { class: 'chess-course-complete' }, [
          el('div', { class: 'chess-course-icon' }, '✅'),
          el('h2', {}, t('checkers.school.stageDone')),
          el('p', {}, t('checkers.school.stageExhausted')),
          el('button', { type: 'button', class: 'btn primary wide', onclick: menu }, t('checkers.school.back')),
          el('button', { type: 'button', class: 'btn wide', onclick: function () { App.goHome(); } }, '🏠 ' + t('checkers.home'))
        ]));
        return;
      }
      runExercise(remaining, 0, stageName);
    }

    function runExercise(list, index, stageName) {
      var lesson = list[index];
      var historyKey = 'checkers-lessons-' + stageName;
      Store.rememberTask(historyKey, lesson.task, list.length + index + 1);
      var board = [];
      for (var r = 0; r < SIZE; r++) board.push(new Array(SIZE).fill(0));
      board[lesson.from[0]][lesson.from[1]] = lesson.piece;
      lesson.extras.forEach(function (extra) { board[extra[0]][extra[1]] = extra[2]; });
      var current = { r: lesson.from[0], c: lesson.from[1] };
      var selected = false;
      var stepIndex = 0;
      var complete = false;
      var status = el('div', { class: 'game-stats checkers-status', 'aria-live': 'polite' }, t(lesson.task));
      var boardEl = el('div', { class: 'checkers-board', role: 'grid', 'aria-label': t('game.checkers') });
      var next = el('button', { type: 'button', class: 'btn primary wide hidden' }, '');

      function paint() {
        UI.clear(boardEl);
        var step = lesson.steps[stepIndex];
        var targets = {};
        if (selected && step) targets[key(step.to[0], step.to[1])] = true;
        for (var r = 0; r < SIZE; r++) {
          for (var c = 0; c < SIZE; c++) {
            (function (row, col) {
              var value = board[row][col];
              var classes = 'checkers-square ' + ((row + col) % 2 ? 'dark' : 'light');
              if (selected && current.r === row && current.c === col && !complete) classes += ' selected';
              if (targets[key(row, col)]) classes += ' target';
              var square = el('button', {
                type: 'button', class: classes, role: 'gridcell',
                'aria-label': t('checkers.square', { row: row + 1, col: col + 1 }),
                onclick: function () { choose(row, col); }
              });
              if (value) square.appendChild(el('span', {
                class: 'checkers-piece ' + (side(value) === RED ? 'red' : 'blue') + (Math.abs(value) === 2 ? ' king' : '')
              }, Math.abs(value) === 2 ? '♛' : ''));
              boardEl.appendChild(square);
            })(r, c);
          }
        }
      }

      function choose(r, c) {
        if (complete) return;
        if (!selected && r === current.r && c === current.c) {
          selected = true;
          status.textContent = t('checkers.school.chooseTarget');
          Sound.play('tap');
          paint();
          return;
        }
        if (!selected) {
          status.textContent = t('checkers.school.choosePiece');
          Sound.play('wrong');
          return;
        }
        var step = lesson.steps[stepIndex];
        if (r !== step.to[0] || c !== step.to[1]) {
          status.textContent = t('checkers.school.tryAgain');
          Sound.play('wrong');
          return;
        }
        var value = board[current.r][current.c];
        board[current.r][current.c] = 0;
        step.captures.forEach(function (at) { board[at[0]][at[1]] = 0; });
        if (value === RED && r === 0) value = RED * 2;
        if (value === BLUE && r === SIZE - 1) value = BLUE * 2;
        board[r][c] = value;
        current = { r: r, c: c };
        stepIndex++;
        Sound.play('match');
        if (stepIndex === lesson.steps.length) {
          complete = true;
          selected = false;
          status.textContent = t(lesson.success);
          next.textContent = index + 1 < list.length ? t('checkers.school.nextExercise') : t('checkers.school.stageDone');
          next.classList.remove('hidden');
        } else {
          status.textContent = t('checkers.school.continueSeries');
        }
        paint();
      }

      next.onclick = function () {
        Sound.play('tap');
        if (index + 1 < list.length) runExercise(list, index + 1, stageName);
        else if (stageName === 'captures') showStageComplete();
        else menu();
      };

      UI.clear(root);
      root.appendChild(el('div', { class: 'chess-lesson-head' }, [
        el('button', { type: 'button', class: 'btn', onclick: menu }, '← ' + t('checkers.school.back')),
        el('span', { class: 'chess-lesson-count' }, t('checkers.school.exerciseProgress', { current: index + 1, total: list.length }))
      ]));
      root.appendChild(el('h2', { class: 'chess-lesson-title' }, t(lesson.title)));
      root.appendChild(el('p', { class: 'game-hint' }, t(lesson.task)));
      root.appendChild(status);
      root.appendChild(boardEl);
      root.appendChild(next);
      paint();
    }

    function showStageComplete() {
      UI.clear(root);
      root.appendChild(el('div', { class: 'chess-course-complete' }, [
        el('div', { class: 'chess-course-icon' }, '🏆'),
        el('h2', {}, t('checkers.school.captureComplete')),
        el('p', {}, t('checkers.school.captureCompleteText')),
        el('button', { type: 'button', class: 'btn primary wide', onclick: menu }, t('checkers.school.back')),
        el('button', { type: 'button', class: 'btn wide', onclick: function () { if (onBack) onBack(); else App.goHome(); } }, '← ' + t('checkers.school.backToGame'))
      ]));
    }

    menu();
    return function cleanup() {};
  }

  App.register({
    id: 'checkers', ages: ['junior', 'school'], emoji: '🔴',
    titleKey: 'game.checkers', descKey: 'game.checkers.desc',
    noStars: true, showRecord: false, start: start
  });
})(window);
