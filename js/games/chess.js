/* games/chess.js — локальные шахматы и интерактивные уроки. */
(function (global) {
  'use strict';

  var el = UI.el;
  var t = global.t || function (key) { return key; };
  var SIZE = 8;
  var PIECES = {
    wK: '🤴', wQ: '👸', wR: '🏰', wB: '🐘', wN: '🐴', wP: '🛡️',
    bK: '🤴', bQ: '👸', bR: '🏰', bB: '🐘', bN: '🐴', bP: '🛡️'
  };
  var PIECE_NAMES = { K: 'king', Q: 'queen', R: 'rook', B: 'bishop', N: 'knight', P: 'pawn' };
  var PIECE_CARDS = ['pawn', 'rook', 'bishop', 'knight', 'queen', 'king'];
  var MOVE_ANIMATION_MS = 420;
  var CAPTURE_ANIMATION_MS = 720;

  function coordinateMarkers(row, col) {
    var markers = [];
    if (col === 0) markers.push(el('span', { class: 'chess-coordinate chess-coordinate-rank', 'aria-hidden': 'true' }, String(8 - row)));
    if (row === 7) markers.push(el('span', { class: 'chess-coordinate chess-coordinate-file', 'aria-hidden': 'true' }, String.fromCharCode(97 + col)));
    return markers;
  }

  var inside = ChessRules.inside;
  var colorOf = ChessRules.colorOf;
  var typeOf = ChessRules.typeOf;
  var other = ChessRules.other;
  var cloneBoard = ChessRules.cloneBoard;
  var squareName = ChessRules.squareName;
  var moveNotation = ChessRules.moveNotation;
  var initialBoard = ChessRules.initialBoard;
  var findKing = ChessRules.findKing;
  var squareAttacked = ChessRules.squareAttacked;
  var inCheck = ChessRules.inCheck;
  var pushMove = ChessRules.pushMove;
  var pseudoMoves = ChessRules.pseudoMoves;
  var applyMove = ChessRules.applyMove;
  var legalMoves = ChessRules.legalMoves;
  var newState = ChessRules.newState;
  var updateRights = ChessRules.updateRights;
  var simulateState = ChessRules.simulateState;
  var evaluate = ChessRules.evaluate;
  var search = ChessRules.search;
  var chooseComputerMove = ChessRules.chooseComputerMove;

  var LESSONS = [
    { piece: 'wP', from: [6,3], to: [[5,3]], extras: [], title: 'chess.lesson.pawn.title',
      text: 'chess.lesson.pawn.text', task: 'chess.lesson.pawn.task' },
    { piece: 'wP', from: [6,4], to: [[4,4]], extras: [], title: 'chess.lesson.double.title',
      text: 'chess.lesson.double.text', task: 'chess.lesson.double.task' },
    { piece: 'wR', from: [4,1], to: [[4,5]], extras: [{ piece: 'wP', at: [4,6] }], title: 'chess.lesson.rook.title',
      text: 'chess.lesson.rook.text', task: 'chess.lesson.rook.task' },
    { piece: 'wB', from: [5,1], to: [[2,4]], extras: [], title: 'chess.lesson.bishop.title',
      text: 'chess.lesson.bishop.text', task: 'chess.lesson.bishop.task' },
    { piece: 'wQ', from: [4,3], to: [[1,3]], extras: [], title: 'chess.lesson.queen.title',
      text: 'chess.lesson.queen.text', task: 'chess.lesson.queen.task' },
    { piece: 'wN', from: [4,3], to: [[2,4]], extras: [{ piece: 'wP', at: [3,3] }], title: 'chess.lesson.knight.title',
      text: 'chess.lesson.knight.text', task: 'chess.lesson.knight.task' },
    { piece: 'wK', from: [4,4], to: [[3,4]], extras: [], title: 'chess.lesson.king.title',
      text: 'chess.lesson.king.text', task: 'chess.lesson.king.task' },
    { piece: 'wK', from: [7,4], to: [[7,6]], castle: true, extras: [{ piece: 'wR', at: [7,7] }], title: 'chess.lesson.castle.title',
      text: 'chess.lesson.castle.text', task: 'chess.lesson.castle.task' },
    { piece: 'wR', from: [7,0], to: [[1,0]], extras: [{ piece: 'bK', at: [0,0] }, { piece: 'wK', at: [7,7] }], title: 'chess.lesson.check.title',
      text: 'chess.lesson.check.text', task: 'chess.lesson.check.task' }
  ];

  var CAPTURE_LESSONS = [
    { piece: 'wP', from: [4,2], to: [[3,3]], extras: [{ piece: 'bP', at: [3,3] }], title: 'chess.capture.pawn.title', text: 'chess.capture.pawn.text', task: 'chess.capture.pawn.task' },
    { piece: 'wR', from: [4,1], to: [[4,5]], extras: [{ piece: 'bN', at: [4,5] }], title: 'chess.capture.rook.title', text: 'chess.capture.rook.text', task: 'chess.capture.rook.task' },
    { piece: 'wB', from: [5,1], to: [[2,4]], extras: [{ piece: 'bP', at: [2,4] }], title: 'chess.capture.bishop.title', text: 'chess.capture.bishop.text', task: 'chess.capture.bishop.task' },
    { piece: 'wN', from: [4,3], to: [[2,4]], extras: [{ piece: 'bR', at: [2,4] }, { piece: 'wP', at: [3,3] }], title: 'chess.capture.knight.title', text: 'chess.capture.knight.text', task: 'chess.capture.knight.task' },
    { piece: 'wQ', from: [4,3], to: [[1,3]], extras: [{ piece: 'bB', at: [1,3] }], title: 'chess.capture.queen.title', text: 'chess.capture.queen.text', task: 'chess.capture.queen.task' }
  ];

  function lessonBoard(lesson) {
    var board = [];
    for (var r = 0; r < SIZE; r++) board.push(new Array(SIZE).fill(null));
    board[lesson.from[0]][lesson.from[1]] = lesson.piece;
    lesson.extras.forEach(function (extra) { board[extra.at[0]][extra.at[1]] = extra.piece; });
    return board;
  }

  function start(root, App, lessonsOnly) {
    var stopped = false;
    var aiTimer = null;
    var gameCleanup = null;

    function renderMenu() {
      if (stopped) return;
      if (gameCleanup) { gameCleanup(); gameCleanup = null; }
      if (aiTimer) { clearTimeout(aiTimer); aiTimer = null; }
      UI.clear(root);
      if (lessonsOnly) {
        root.appendChild(el('p', { class: 'game-hint' }, t('chess.school.intro')));
        root.appendChild(el('div', { class: 'chess-menu' }, [
          el('button', { type: 'button', class: 'btn primary wide', onclick: function () { Sound.play('tap'); renderPieceLesson(0); } }, '📖 ' + t('chess.school.stage1')),
          el('button', { type: 'button', class: 'btn wide', onclick: function () { Sound.play('tap'); startLessonStage(LESSONS, 'moves'); } }, '♟️ ' + t('chess.school.stage2')),
          el('button', { type: 'button', class: 'btn wide', onclick: function () { Sound.play('tap'); startLessonStage(CAPTURE_LESSONS, 'captures'); } }, '🎯 ' + t('chess.school.stage3')),
          el('button', { type: 'button', class: 'btn wide', onclick: function () { lessonsOnly = false; renderMenu(); } }, '← ' + t('chess.backToGame'))
        ]));
        return;
      }
      root.appendChild(el('p', { class: 'game-hint' }, t('chess.intro')));
      root.appendChild(el('div', { class: 'chess-rating-card' }, [
        el('span', {}, '🏅 ' + t('chess.rating')),
        el('strong', {}, String(Store.chessRating()))
      ]));
      root.appendChild(el('div', { class: 'chess-menu' }, [
        el('button', { type: 'button', class: 'btn primary wide', onclick: function () { Sound.play('tap'); lessonsOnly = true; renderMenu(); } }, '📖 ' + t('chess.openLessons')),
        partyButton('computer', '🤖 ' + t('chess.vsComputer')),
        partyButton('local', '♟️ ' + t('chess.twoPlayers')),
        el('button', { type: 'button', class: 'btn wide', onclick: function () { App.goHome(); } }, '🏠 ' + t('chess.home'))
      ]));
    }

    function partyButton(mode, label) {
      var unlocked = App.gameAccess('chess', mode).allowed;
      return el('button', {
        type: 'button', class: 'btn wide', onclick: function () {
          Sound.play('tap');
          if (!App.requireGameAccess('chess', mode)) return;
          renderTimeOptions(mode);
        }
      }, (unlocked ? '' : '🔒 ') + label);
    }

    function renderTimeOptions(mode) {
      UI.clear(root);
      root.appendChild(el('p', { class: 'game-hint' }, t('chess.chooseTime')));
      root.appendChild(el('div', { class: 'chess-menu chess-time-options' }, [
        timeButton(0, t('chess.clock.noTimer')),
        timeButton(5, t('chess.clock.minutes', { minutes: 5 })),
        timeButton(10, t('chess.clock.minutes', { minutes: 10 })),
        timeButton(15, t('chess.clock.minutes', { minutes: 15 })),
        el('button', { type: 'button', class: 'btn wide', onclick: renderMenu }, '← ' + t('chess.home'))
      ]));

      function timeButton(minutes, label) {
        return el('button', { type: 'button', class: 'btn wide', onclick: function () {
          Sound.play('tap');
          var timeSeconds = minutes * 60;
          if (mode === 'computer') renderComputerLevels(timeSeconds);
          else startLocalGame({ timeSeconds: timeSeconds });
        } }, label);
      }
    }

    function renderComputerLevels(timeSeconds) {
      UI.clear(root);
      root.appendChild(el('p', { class: 'game-hint' }, t('chess.chooseComputer')));
      root.appendChild(el('div', { class: 'chess-menu' }, [
        computerLevelButton('easy', '♟️ ' + t('chess.computer.easy'), timeSeconds),
        computerLevelButton('medium', '♞ ' + t('chess.computer.medium'), timeSeconds),
        computerLevelButton('hard', '♛ ' + t('chess.computer.hard'), timeSeconds),
        el('button', { type: 'button', class: 'btn wide', onclick: function () { renderTimeOptions('computer'); } }, '← ' + t('chess.chooseTime'))
      ]));
    }

    function computerLevelButton(level, label, timeSeconds) {
      return el('button', { type: 'button', class: 'btn wide', onclick: function () { Sound.play('tap'); startLocalGame({ level: level, timeSeconds: timeSeconds }); } }, label);
    }

    function renderPieceLesson(index) {
      var pieceName = PIECE_CARDS[index];
      var pieceCode = pieceName === 'knight' ? 'N' : pieceName.charAt(0).toUpperCase();
      UI.clear(root);
      root.appendChild(el('div', { class: 'chess-lesson-head' }, [
        el('button', { type: 'button', class: 'btn', onclick: renderMenu }, '← ' + t('chess.school.back')),
        el('span', { class: 'chess-lesson-count' }, t('chess.school.pieceProgress', { current: index + 1, total: PIECE_CARDS.length }))
      ]));
      root.appendChild(el('div', { class: 'chess-piece-card' }, [
        el('div', { class: 'chess-piece-pair' }, [
          el('span', { class: 'chess-piece white chess-kind-' + pieceCode }, PIECES['w' + pieceCode]),
          el('span', { class: 'chess-piece black chess-kind-' + pieceCode }, PIECES['b' + pieceCode])
        ]),
        el('h2', {}, t('chess.piece.' + pieceName)),
        el('section', {}, [
          el('h3', {}, t('chess.school.moveTitle')),
          el('p', {}, t('chess.school.' + pieceName + '.move'))
        ]),
        el('section', {}, [
          el('h3', {}, t('chess.school.captureTitle')),
          el('p', {}, t('chess.school.' + pieceName + '.capture'))
        ]),
        el('div', { class: 'chess-piece-nav' }, [
          el('button', { type: 'button', class: 'btn', disabled: index === 0, onclick: function () { renderPieceLesson(index - 1); } }, '← ' + t('chess.school.previous')),
          el('button', { type: 'button', class: 'btn primary', onclick: function () {
            if (index + 1 < PIECE_CARDS.length) renderPieceLesson(index + 1);
            else renderMenu();
          } }, index + 1 < PIECE_CARDS.length ? t('chess.school.nextPiece') : t('chess.school.doneReading'))
        ])
      ]));
    }

    function startLessonStage(lessonList, stage) {
      var historyKey = 'chess-lessons-' + stage;
      var seen = Store.taskHistory(historyKey);
      var remaining = lessonList.filter(function (lesson) { return seen.indexOf(lesson.task) < 0; });
      if (remaining.length) {
        renderLesson(0, remaining, stage);
        return;
      }
      UI.clear(root);
      root.appendChild(el('div', { class: 'chess-course-complete' }, [
        el('div', { class: 'chess-course-icon' }, '✅'),
        el('h2', {}, t('chess.lesson.stageExhausted')),
        el('p', {}, t('chess.lesson.stageExhaustedText')),
        el('button', { type: 'button', class: 'btn primary wide', onclick: renderMenu }, '📖 ' + t('chess.school.back')),
          el('button', { type: 'button', class: 'btn wide', onclick: function () { lessonsOnly = false; renderMenu(); } }, '← ' + t('chess.backToGame'))
      ]));
    }

    function renderLesson(index, lessonList, stage) {
      if (stopped) return;
      lessonList = lessonList || LESSONS;
      stage = stage || 'moves';
      var lesson = lessonList[index];
      Store.rememberTask('chess-lessons-' + stage, lesson.task, lessonList.length + index + 1);
      var board = lessonBoard(lesson);
      var selected = false;
      var complete = false;
      var status = el('div', { class: 'game-stats chess-status', 'aria-live': 'polite' }, t(lesson.task));
      var boardEl = el('div', { class: 'chess-board', role: 'grid', 'aria-label': t('game.chess') });
      var targets = lesson.to.map(function (p) { return { r: p[0], c: p[1] }; });

      function paint() {
        UI.clear(boardEl);
        for (var r = 0; r < SIZE; r++) {
          for (var c = 0; c < SIZE; c++) {
            (function (row, col) {
              var piece = board[row][col];
              var classes = 'chess-square ' + ((row + col) % 2 ? 'dark' : 'light');
              if (piece && row === lesson.from[0] && col === lesson.from[1] && !complete && selected) classes += ' selected';
              if (selected && !complete && targets.some(function (at) { return at.r === row && at.c === col; })) classes += ' target';
              var contents = piece ? [el('span', { class: 'chess-piece ' + (colorOf(piece) === 'w' ? 'white' : 'black') }, PIECES[piece])] : [];
              contents = contents.concat(coordinateMarkers(row, col));
              boardEl.appendChild(el('button', {
                type: 'button', class: classes, role: 'gridcell',
                'aria-label': t('chess.square', { square: String.fromCharCode(97 + col) + (8 - row) }),
                onclick: function () { choose(row, col); }
              }, contents));
            })(r, c);
          }
        }
      }

      function choose(r, c) {
        if (complete) return;
        if (r === lesson.from[0] && c === lesson.from[1]) {
          selected = true;
          status.textContent = t('chess.lesson.chooseTarget');
          Sound.play('tap');
          paint();
          return;
        }
        if (!selected) {
          status.textContent = t('chess.lesson.choosePiece');
          Sound.play('wrong');
          return;
        }
        if (targets.some(function (at) { return at.r === r && at.c === c; })) {
          board[r][c] = lesson.piece;
          board[lesson.from[0]][lesson.from[1]] = null;
          if (lesson.castle) {
            board[7][5] = board[7][7];
            board[7][7] = null;
          }
          complete = true;
          status.textContent = t(lesson.text);
          Sound.play('win');
          paint();
          nextButton.classList.remove('hidden');
        } else {
          status.textContent = t('chess.lesson.tryAgain');
          Sound.play('wrong');
        }
      }

      UI.clear(root);
      var nextButton = el('button', {
        type: 'button', class: 'btn primary wide hidden',
        onclick: function () {
          Sound.play('tap');
          if (index + 1 < lessonList.length) renderLesson(index + 1, lessonList, stage);
          else if (stage === 'captures') renderCourseComplete();
          else renderMenu();
        }
      }, index + 1 < lessonList.length ? '➡️ ' + t('chess.lesson.next') : '🎉 ' + t(stage === 'captures' ? 'chess.lesson.finish' : 'chess.lesson.stageDone'));
      root.appendChild(el('div', { class: 'chess-lesson-head' }, [
        el('button', { type: 'button', class: 'btn', onclick: renderMenu }, '← ' + t('chess.lessons')),
        el('span', { class: 'chess-lesson-count' }, t('chess.lesson.progress', { current: index + 1, total: lessonList.length }))
      ]));
      root.appendChild(el('h2', { class: 'chess-lesson-title' }, t(lesson.title)));
      root.appendChild(el('p', { class: 'game-hint' }, t(lesson.task)));
      root.appendChild(status);
      root.appendChild(boardEl);
      root.appendChild(nextButton);
      paint();
    }

    function renderCourseComplete() {
      UI.clear(root);
      root.appendChild(el('div', { class: 'chess-course-complete' }, [
        el('div', { class: 'chess-course-icon' }, '🏆'),
        el('h2', {}, t('chess.lesson.captureStageComplete')),
        el('p', {}, t('chess.lesson.captureStageCompleteText')),
        el('button', { type: 'button', class: 'btn primary wide', onclick: renderMenu }, '📖 ' + t('chess.school.back')),
        el('button', { type: 'button', class: 'btn wide', onclick: function () { lessonsOnly = false; renderMenu(); } }, '← ' + t('chess.backToGame'))
      ]));
    }

    function startLocalGame(opponent) {
      if (gameCleanup) { gameCleanup(); gameCleanup = null; }
      if (aiTimer) { clearTimeout(aiTimer); aiTimer = null; }
      var gameOptions = opponent || {};
      var computer = gameOptions.level ? gameOptions : null;
      var timeLimit = Math.max(0, Number(gameOptions.timeSeconds) || 0);
      var timed = timeLimit > 0;
      var state = newState();
      var selected = null;
      var animateLastMove = false;
      var animatedPiece = null;
      var captureEffect = null;
      var captureTimer = null;
      var interactionLockedUntil = 0;
      var ended = false;
      var clockInterval = null;
      var clockDeadline = 0;
      var endTimer = null;
      var remaining = { w: timeLimit, b: timeLimit };
      var status = el('div', { class: 'game-stats chess-status', 'aria-live': 'polite' });
      var boardEl = el('div', { class: 'chess-board', role: 'grid', 'aria-label': t('game.chess') });
      var moveLogEl = el('div', { class: 'chess-move-log', 'aria-live': 'polite' });
      var whiteClock = el('strong', { class: 'chess-clock-value' });
      var blackClock = el('strong', { class: 'chess-clock-value' });
      var clockPanel = el('div', { class: 'chess-clocks' }, [
        el('div', { class: 'chess-clock', 'data-color': 'w' }, [el('span', {}, t('chess.clock.white')), whiteClock]),
        el('div', { class: 'chess-clock', 'data-color': 'b' }, [el('span', {}, t('chess.clock.black')), blackClock])
      ]);
      var controls = el('div', { class: 'chess-controls' });
      var selectionMoves = [];

      function formatClock(seconds) {
        var total = Math.max(0, Math.ceil(seconds));
        return Math.floor(total / 60) + ':' + String(total % 60).padStart(2, '0');
      }

      function updateClockDisplay() {
        whiteClock.textContent = formatClock(remaining.w);
        blackClock.textContent = formatClock(remaining.b);
        clockPanel.querySelector('[data-color="w"]').classList.toggle('active', state.turn === 'w');
        clockPanel.querySelector('[data-color="b"]').classList.toggle('active', state.turn === 'b');
      }

      function stopClock() {
        if (clockInterval) { clearInterval(clockInterval); clockInterval = null; }
      }

      function expireClock() {
        if (ended || stopped) return;
        ended = true;
        stopClock();
        showEnd(false, true);
      }

      function updateClock() {
        if (!timed || ended) return;
        remaining[state.turn] = Math.max(0, (clockDeadline - Date.now()) / 1000);
        updateClockDisplay();
        if (remaining[state.turn] <= 0) expireClock();
      }

      function logMove(text) {
        var ply = moveLogEl._ply || 0;
        var num = Math.floor(ply / 2) + 1;
        if (ply % 2 === 0) {
          if (ply === 0) UI.clear(moveLogEl);
          moveLogEl.appendChild(el('div', { class: 'chess-move-row' }, [
            el('span', { class: 'chess-move-number' }, num + '.'),
            el('span', { class: 'chess-move-white' }, text),
            el('span', { class: 'chess-move-black' }, '')
          ]));
        } else {
          var rows = moveLogEl.querySelectorAll('.chess-move-row');
          rows[rows.length - 1].lastChild.textContent = text;
        }
        moveLogEl._ply = ply + 1;
        moveLogEl.scrollTop = moveLogEl.scrollHeight;
      }

      function paint() {
        UI.clear(boardEl);
        var checkKing = findKing(state.board, state.turn);
        var isChecked = checkKing && inCheck(state.board, state.turn);
        var destinations = {};
        selectionMoves.forEach(function (move) { destinations[move.to.r + ',' + move.to.c] = true; });
        for (var r = 0; r < SIZE; r++) {
          for (var c = 0; c < SIZE; c++) {
            (function (row, col) {
              var piece = state.board[row][col];
              var classes = 'chess-square ' + ((row + col) % 2 ? 'dark' : 'light');
              if (selected && selected.r === row && selected.c === col) classes += ' selected';
              if (destinations[row + ',' + col]) classes += ' target' + (piece ? ' capture' : '');
              if (isChecked && piece === state.turn + 'K') classes += ' in-check';
              if (state.lastMove && ((state.lastMove.from.r === row && state.lastMove.from.c === col) ||
                  (state.lastMove.to.r === row && state.lastMove.to.c === col))) classes += ' last-move';
              var contents = [];
              if (piece) {
                var pieceNode = el('span', {
                  class: 'chess-piece ' + (colorOf(piece) === 'w' ? 'white' : 'black') + ' chess-kind-' + typeOf(piece)
                }, PIECES[piece]);
                var move = state.lastMove;
                var from = null;
                if (animateLastMove && move && row === move.to.r && col === move.to.c && piece === animatedPiece) from = move.from;
                if (animateLastMove && move && move.castle && piece === colorOf(animatedPiece) + 'R' && row === move.from.r) {
                  var rookFromCol = move.castle === 'k' ? 7 : 0;
                  var rookToCol = move.castle === 'k' ? 5 : 3;
                  if (col === rookToCol) from = { r: row, c: rookFromCol };
                }
                if (from) {
                  classes += ' moving-piece';
                  pieceNode.classList.add('chess-piece-moving');
                  pieceNode.style.setProperty('--move-x', ((from.c - col) * 119.05) + '%');
                  pieceNode.style.setProperty('--move-y', ((from.r - row) * 119.05) + '%');
                }
                contents.push(pieceNode);
              }
              contents = contents.concat(coordinateMarkers(row, col));
              if (captureEffect && captureEffect.r === row && captureEffect.c === col) {
                contents.push(el('span', {
                  class: 'magic-capture-ghost chess-capture-ghost ' +
                    (colorOf(captureEffect.piece) === 'w' ? 'white' : 'black') + ' chess-kind-' + typeOf(captureEffect.piece),
                  'aria-hidden': 'true'
                }, PIECES[captureEffect.piece]));
                contents.push(el('span', {
                  class: 'magic-capture-burst chess-capture-burst chess-capture-' + typeOf(captureEffect.piece),
                  'aria-hidden': 'true'
                }, '✨'));
              }
              boardEl.appendChild(el('button', {
                type: 'button', class: classes, role: 'gridcell',
                'aria-label': t('chess.square', { square: squareName({ r: row, c: col }) }),
                onclick: function () { choose(row, col); }
              }, contents));
            })(r, c);
          }
        }
        animateLastMove = false;
        var colorName = t(state.turn === 'w' ? 'chess.white' : 'chess.black');
        var moves = legalMoves(state, state.turn);
        if (!moves.length) status.textContent = isChecked ? t('chess.checkmate', { winner: t(other(state.turn) === 'w' ? 'chess.white' : 'chess.black') }) : t('chess.stalemate');
        else status.textContent = t('chess.turn', { color: colorName }) + (isChecked ? ' · ' + t('chess.check') : '');
      }

      function choose(r, c) {
        if (ended || Date.now() < interactionLockedUntil || (computer && state.turn === 'b')) return;
        var chosen = selectionMoves.filter(function (move) { return move.to.r === r && move.to.c === c; })[0];
        if (chosen) {
          if (chosen.promotion) showPromotion(chosen);
          else play(chosen, null);
          return;
        }
        if (colorOf(state.board[r][c]) === state.turn) {
          selected = { r: r, c: c };
          selectionMoves = legalMoves(state, state.turn).filter(function (move) { return move.from.r === r && move.from.c === c; });
          Sound.play('tap');
        } else {
          selected = null;
          selectionMoves = [];
          Sound.play('tap');
        }
        paint();
      }

      function play(move, promoteTo) {
        if (stopped || ended) return;
        if (timed) {
          remaining[state.turn] = Math.max(0, (clockDeadline - Date.now()) / 1000);
          if (remaining[state.turn] <= 0) { expireClock(); return; }
        }
        var board = state.board;
        var piece = board[move.from.r][move.from.c];
        var captureSquare = move.enPassant ? { r: move.from.r, c: move.to.c } : move.to;
        var capturedPiece = board[captureSquare.r][captureSquare.c];
        var captured = !!capturedPiece || move.enPassant;
        var notation = moveNotation(move, captured, promoteTo);
        if (capturedPiece) {
          captureEffect = { r: captureSquare.r, c: captureSquare.c, piece: capturedPiece };
          interactionLockedUntil = Date.now() + CAPTURE_ANIMATION_MS;
          if (captureTimer) clearTimeout(captureTimer);
          captureTimer = setTimeout(function () {
            captureEffect = null;
            captureTimer = null;
            if (!stopped) paint();
          }, CAPTURE_ANIMATION_MS);
        }
        updateRights(state.castling, board, move);
        state.board = applyMove(board, move, promoteTo);
        state.enPassant = typeOf(piece) === 'P' && Math.abs(move.to.r - move.from.r) === 2 ?
          { r: (move.from.r + move.to.r) / 2, c: move.from.c } : null;
        state.turn = other(state.turn);
        state.lastMove = move;
        animatedPiece = state.board[move.to.r][move.to.c];
        animateLastMove = true;
        if (timed) {
          clockDeadline = Date.now() + remaining[state.turn] * 1000;
          updateClockDisplay();
        }
        selected = null;
        selectionMoves = [];
        Sound.play('tap');
        paint();
        var moves = legalMoves(state, state.turn);
        if (!moves.length) {
          Sound.play('win');
          var checked = inCheck(state.board, state.turn);
          notation += checked ? '#' : '=';
          logMove(notation);
          ended = true;
          stopClock();
          controls.querySelectorAll('button').forEach(function (button) { button.disabled = true; });
          endTimer = setTimeout(function () { showEnd(checked, false); }, captured ? CAPTURE_ANIMATION_MS + 120 : MOVE_ANIMATION_MS);
        } else if (inCheck(state.board, state.turn)) {
          notation += '+';
          logMove(notation);
          if (computer && state.turn === 'b') {
            aiTimer = setTimeout(function () {
              aiTimer = null;
              var reply = chooseComputerMove(state, computer.level);
              if (reply) play(reply, null);
            }, 760);
          }
        } else if (computer && state.turn === 'b') {
          logMove(notation);
          aiTimer = setTimeout(function () {
            aiTimer = null;
            var reply = chooseComputerMove(state, computer.level);
            if (reply) play(reply, null);
          }, 760);
        } else {
          logMove(notation);
        }
      }

      function showPromotion(move) {
        var color = state.turn;
        var choices = ['Q','R','B','N'];
        var options = el('div', { class: 'chess-promotion' }, [
          el('h2', {}, t('chess.promoteTitle')),
          el('div', { class: 'chess-promotion-options' }, choices.map(function (type) {
            return el('button', {
              type: 'button', class: 'chess-promotion-option',
              'aria-label': t('chess.piece.' + PIECE_NAMES[type]),
              onclick: function () { App.hideOverlay(); play(move, type); }
            }, PIECES[color + type]);
          }))
        ]);
        App.showOverlay(options);
      }

      function showEnd(check, timedOut) {
        var winner = t(state.turn === 'w' ? 'chess.black' : 'chess.white');
        var ratingText = '';
        if (computer) {
          var before = Store.chessRating();
          var result = !check && !timedOut ? 0.5 : (state.turn === 'b' ? 1 : 0);
          var opponentRating = computer.level === 'easy' ? 450 : (computer.level === 'medium' ? 650 : 850);
          var expected = 1 / (1 + Math.pow(10, (opponentRating - before) / 400));
          var after = Store.setChessRating(before + 32 * (result - expected));
          var delta = after - before;
          ratingText = t('chess.ratingChange', { before: before, after: after, delta: delta > 0 ? '+' + delta : delta });
        }
        App.showOverlay(el('div', { class: 'result' }, [
          el('div', { class: 'result-emoji' }, check || timedOut ? '🏆' : '🤝'),
          el('div', { class: 'result-title' }, timedOut ? t('chess.timeout', { winner: winner }) : (check ? t('chess.checkmate', { winner: winner }) : t('chess.stalemate'))),
          el('p', { class: 'result-text' }, timedOut ? t('chess.timeoutHelp') : (check ? t('chess.checkmateHelp') : t('chess.stalemateHelp'))),
          ratingText ? el('p', { class: 'chess-rating-result' }, ratingText) : null,
          el('div', { class: 'result-actions' }, [
            el('button', { type: 'button', class: 'btn primary', onclick: function () { App.hideOverlay(); startLocalGame(gameOptions); } }, t('chess.newGame')),
            el('button', { type: 'button', class: 'btn', onclick: function () { App.hideOverlay(); App.goHome(); } }, t('chess.home'))
          ])
        ]));
      }

      UI.clear(root);
      status.textContent = t('chess.turn', { color: t('chess.white') });
      root.appendChild(el('p', { class: 'game-hint' }, computer ? t('chess.computerHint') : t('chess.twoPlayerHint')));
      root.appendChild(status);
      if (timed) {
        updateClockDisplay();
        root.appendChild(clockPanel);
        clockDeadline = Date.now() + remaining.w * 1000;
        clockInterval = setInterval(updateClock, 200);
      }
      root.appendChild(boardEl);
      var moveLog = el('div', { class: 'chess-move-log-panel' }, [
        el('h3', {}, t('chess.movesLog')),
        el('div', { class: 'chess-move-log', 'aria-live': 'polite' }, t('chess.movesLogEmpty'))
      ]);
      moveLogEl = moveLog.lastChild;
      root.appendChild(moveLog);
      controls.appendChild(el('button', { type: 'button', class: 'btn', onclick: renderMenu }, '↩️ ' + t('chess.changeMode')));
      controls.appendChild(el('button', { type: 'button', class: 'btn primary', onclick: function () { startLocalGame(gameOptions); } }, t('chess.newGame')));
      controls.appendChild(el('button', { type: 'button', class: 'btn', onclick: function () { App.goHome(); } }, '🏠 ' + t('chess.home')));
      root.appendChild(controls);
      gameCleanup = function () {
        ended = true;
        stopClock();
        if (endTimer) { clearTimeout(endTimer); endTimer = null; }
        if (captureTimer) { clearTimeout(captureTimer); captureTimer = null; }
      };
      paint();
    }

    renderMenu();
    return function cleanup() {
      stopped = true;
      if (aiTimer) clearTimeout(aiTimer);
      if (gameCleanup) gameCleanup();
    };
  }

  App.register('chess', start);
})(window);
