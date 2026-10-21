/* games/chess.js — локальные шахматы и интерактивные уроки. */
(function (global) {
  'use strict';

  var el = UI.el;
  var t = global.t || function (key) { return key; };
  var SIZE = 8;
  var PIECES = {
    wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
    bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟'
  };
  var PIECE_NAMES = { K: 'king', Q: 'queen', R: 'rook', B: 'bishop', N: 'knight', P: 'pawn' };
  var KNIGHT_STEPS = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
  var KING_STEPS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  var ROOK_DIRS = [[-1,0],[1,0],[0,-1],[0,1]];
  var BISHOP_DIRS = [[-1,-1],[-1,1],[1,-1],[1,1]];
  var PIECE_CARDS = ['pawn', 'rook', 'bishop', 'knight', 'queen', 'king'];
  var MOVE_ANIMATION_MS = 420;

  function inside(r, c) { return r >= 0 && r < SIZE && c >= 0 && c < SIZE; }
  function colorOf(piece) { return piece ? piece.charAt(0) : ''; }
  function typeOf(piece) { return piece ? piece.charAt(1) : ''; }
  function other(color) { return color === 'w' ? 'b' : 'w'; }
  function cloneBoard(board) { return board.map(function (row) { return row.slice(); }); }
  function squareName(square) { return String.fromCharCode(97 + square.c) + (8 - square.r); }

  function coordinateMarkers(row, col) {
    var markers = [];
    if (col === 0) markers.push(el('span', { class: 'chess-coordinate chess-coordinate-rank', 'aria-hidden': 'true' }, String(8 - row)));
    if (row === 7) markers.push(el('span', { class: 'chess-coordinate chess-coordinate-file', 'aria-hidden': 'true' }, String.fromCharCode(97 + col)));
    return markers;
  }

  function moveNotation(move, captured, promoteTo) {
    if (move.castle === 'k') return 'O-O';
    if (move.castle === 'q') return 'O-O-O';
    var separator = captured || move.enPassant ? '×' : '–';
    var notation = squareName(move.from) + separator + squareName(move.to);
    if (move.promotion) notation += '=' + (promoteTo || 'Q');
    return notation;
  }

  function initialBoard() {
    var back = ['R','N','B','Q','K','B','N','R'];
    var board = [];
    for (var r = 0; r < SIZE; r++) {
      var row = [];
      for (var c = 0; c < SIZE; c++) {
        if (r === 0) row.push('b' + back[c]);
        else if (r === 1) row.push('bP');
        else if (r === 6) row.push('wP');
        else if (r === 7) row.push('w' + back[c]);
        else row.push(null);
      }
      board.push(row);
    }
    return board;
  }

  function findKing(board, color) {
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) if (board[r][c] === color + 'K') return { r: r, c: c };
    }
    return null;
  }

  function squareAttacked(board, r, c, byColor) {
    var pawnRow = r + (byColor === 'w' ? 1 : -1);
    for (var dc = -1; dc <= 1; dc += 2) {
      var pawnCol = c + dc;
      if (inside(pawnRow, pawnCol) && board[pawnRow][pawnCol] === byColor + 'P') return true;
    }
    for (var n = 0; n < KNIGHT_STEPS.length; n++) {
      var nr = r + KNIGHT_STEPS[n][0];
      var nc = c + KNIGHT_STEPS[n][1];
      if (inside(nr, nc) && board[nr][nc] === byColor + 'N') return true;
    }
    for (var k = 0; k < KING_STEPS.length; k++) {
      nr = r + KING_STEPS[k][0];
      nc = c + KING_STEPS[k][1];
      if (inside(nr, nc) && board[nr][nc] === byColor + 'K') return true;
    }

    var dirs = ROOK_DIRS.concat(BISHOP_DIRS);
    for (var d = 0; d < dirs.length; d++) {
      var dr = dirs[d][0];
      var stepC = dirs[d][1];
      nr = r + dr;
      nc = c + stepC;
      var diagonal = d >= ROOK_DIRS.length;
      while (inside(nr, nc)) {
        var piece = board[nr][nc];
        if (piece) {
          if (colorOf(piece) === byColor) {
            var type = typeOf(piece);
            if (type === 'Q' || (!diagonal && type === 'R') || (diagonal && type === 'B')) return true;
          }
          break;
        }
        nr += dr;
        nc += stepC;
      }
    }
    return false;
  }

  function inCheck(board, color) {
    var king = findKing(board, color);
    return !!king && squareAttacked(board, king.r, king.c, other(color));
  }

  function pushMove(moves, r, c, nr, nc, extra) {
    var move = { from: { r: r, c: c }, to: { r: nr, c: nc } };
    if (extra) Object.keys(extra).forEach(function (key) { move[key] = extra[key]; });
    moves.push(move);
  }

  function pseudoMoves(state, r, c) {
    var board = state.board;
    var piece = board[r][c];
    if (!piece) return [];
    var color = colorOf(piece);
    var type = typeOf(piece);
    var moves = [];
    var dr, dc, nr, nc, target, dirs, i;

    if (type === 'P') {
      dr = color === 'w' ? -1 : 1;
      nr = r + dr;
      if (inside(nr, c) && !board[nr][c]) {
        pushMove(moves, r, c, nr, c, { promotion: nr === 0 || nr === 7 });
        var startRow = color === 'w' ? 6 : 1;
        if (r === startRow && !board[r + dr * 2][c]) pushMove(moves, r, c, r + dr * 2, c, { doublePawn: true });
      }
      for (dc = -1; dc <= 1; dc += 2) {
        nc = c + dc;
        nr = r + dr;
        if (!inside(nr, nc)) continue;
        target = board[nr][nc];
        if (target && colorOf(target) !== color && typeOf(target) !== 'K') pushMove(moves, r, c, nr, nc, { promotion: nr === 0 || nr === 7 });
        else if (state.enPassant && state.enPassant.r === nr && state.enPassant.c === nc) {
          pushMove(moves, r, c, nr, nc, { enPassant: true });
        }
      }
      return moves;
    }

    if (type === 'N' || type === 'K') {
      dirs = type === 'N' ? KNIGHT_STEPS : KING_STEPS;
      for (i = 0; i < dirs.length; i++) {
        nr = r + dirs[i][0];
        nc = c + dirs[i][1];
        if (inside(nr, nc) && (!board[nr][nc] || (colorOf(board[nr][nc]) !== color && typeOf(board[nr][nc]) !== 'K'))) pushMove(moves, r, c, nr, nc);
      }
      if (type === 'K' && r === (color === 'w' ? 7 : 0) && c === 4 && !inCheck(board, color)) {
        var home = color === 'w' ? 7 : 0;
        var enemy = other(color);
        var rights = state.castling[color];
        if (rights.k && board[home][5] === null && board[home][6] === null &&
            board[home][7] === color + 'R' &&
            !squareAttacked(board, home, 5, enemy) && !squareAttacked(board, home, 6, enemy)) {
          pushMove(moves, r, c, home, 6, { castle: 'k' });
        }
        if (rights.q && board[home][1] === null && board[home][2] === null && board[home][3] === null &&
            board[home][0] === color + 'R' &&
            !squareAttacked(board, home, 3, enemy) && !squareAttacked(board, home, 2, enemy)) {
          pushMove(moves, r, c, home, 2, { castle: 'q' });
        }
      }
      return moves;
    }

    dirs = [];
    if (type === 'R' || type === 'Q') dirs = dirs.concat(ROOK_DIRS);
    if (type === 'B' || type === 'Q') dirs = dirs.concat(BISHOP_DIRS);
    for (i = 0; i < dirs.length; i++) {
      dr = dirs[i][0];
      dc = dirs[i][1];
      nr = r + dr;
      nc = c + dc;
      while (inside(nr, nc)) {
        target = board[nr][nc];
        if (!target) pushMove(moves, r, c, nr, nc);
        else {
          if (colorOf(target) !== color && typeOf(target) !== 'K') pushMove(moves, r, c, nr, nc);
          break;
        }
        nr += dr;
        nc += dc;
      }
    }
    return moves;
  }

  function applyMove(board, move, promoteTo) {
    var next = cloneBoard(board);
    var piece = next[move.from.r][move.from.c];
    next[move.from.r][move.from.c] = null;
    if (move.enPassant) next[move.from.r][move.to.c] = null;
    if (move.castle) {
      var row = move.from.r;
      var rookFrom = move.castle === 'k' ? 7 : 0;
      var rookTo = move.castle === 'k' ? 5 : 3;
      next[row][rookTo] = next[row][rookFrom];
      next[row][rookFrom] = null;
    }
    if (move.promotion) piece = colorOf(piece) + (promoteTo || 'Q');
    next[move.to.r][move.to.c] = piece;
    return next;
  }

  function legalMoves(state, color) {
    var result = [];
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        if (colorOf(state.board[r][c]) !== color) continue;
        var candidates = pseudoMoves(state, r, c);
        candidates.forEach(function (move) {
          if (!inCheck(applyMove(state.board, move), color)) result.push(move);
        });
      }
    }
    return result;
  }

  function newState() {
    return {
      board: initialBoard(),
      turn: 'w',
      castling: { w: { k: true, q: true }, b: { k: true, q: true } },
      enPassant: null,
      lastMove: null
    };
  }

  function updateRights(rights, board, move) {
    var piece = board[move.from.r][move.from.c];
    var color = colorOf(piece);
    if (typeOf(piece) === 'K') { rights[color].k = false; rights[color].q = false; }
    if (piece === 'wR' && move.from.r === 7 && move.from.c === 0) rights.w.q = false;
    if (piece === 'wR' && move.from.r === 7 && move.from.c === 7) rights.w.k = false;
    if (piece === 'bR' && move.from.r === 0 && move.from.c === 0) rights.b.q = false;
    if (piece === 'bR' && move.from.r === 0 && move.from.c === 7) rights.b.k = false;
    var captured = board[move.to.r][move.to.c];
    if (captured === 'wR' && move.to.r === 7 && move.to.c === 0) rights.w.q = false;
    if (captured === 'wR' && move.to.r === 7 && move.to.c === 7) rights.w.k = false;
    if (captured === 'bR' && move.to.r === 0 && move.to.c === 0) rights.b.q = false;
    if (captured === 'bR' && move.to.r === 0 && move.to.c === 7) rights.b.k = false;
  }

  var PIECE_VALUE = { P: 100, N: 300, B: 320, R: 500, Q: 900, K: 20000 };

  function simulateState(state, move) {
    var rights = {
      w: { k: state.castling.w.k, q: state.castling.w.q },
      b: { k: state.castling.b.k, q: state.castling.b.q }
    };
    updateRights(rights, state.board, move);
    var piece = state.board[move.from.r][move.from.c];
    return {
      board: applyMove(state.board, move, move.promotion ? 'Q' : null),
      turn: other(state.turn),
      castling: rights,
      enPassant: typeOf(piece) === 'P' && Math.abs(move.to.r - move.from.r) === 2 ?
        { r: (move.from.r + move.to.r) / 2, c: move.from.c } : null,
      lastMove: move
    };
  }

  function evaluate(state, perspective) {
    var value = 0;
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var piece = state.board[r][c];
        if (!piece) continue;
        var score = PIECE_VALUE[typeOf(piece)] || 0;
        if (typeOf(piece) === 'P') score += colorOf(piece) === 'w' ? (6 - r) * 4 : (r - 1) * 4;
        value += colorOf(piece) === perspective ? score : -score;
      }
    }
    return value;
  }

  function search(state, depth, alpha, beta, perspective, ply) {
    var moves = legalMoves(state, state.turn);
    if (!moves.length) {
      if (!inCheck(state.board, state.turn)) return 0;
      return state.turn === perspective ? -100000 + ply : 100000 - ply;
    }
    if (depth <= 0) return evaluate(state, perspective);
    var maximizing = state.turn === perspective;
    var best = maximizing ? -Infinity : Infinity;
    for (var i = 0; i < moves.length; i++) {
      var score = search(simulateState(state, moves[i]), depth - 1, alpha, beta, perspective, ply + 1);
      if (maximizing) {
        best = Math.max(best, score);
        alpha = Math.max(alpha, best);
      } else {
        best = Math.min(best, score);
        beta = Math.min(beta, best);
      }
      if (beta <= alpha) break;
    }
    return best;
  }

  function chooseComputerMove(state, level) {
    var moves = legalMoves(state, state.turn);
    if (!moves.length) return null;
    if (level === 'easy' && Math.random() < 0.65) return moves[Math.floor(Math.random() * moves.length)];
    var depth = level === 'hard' ? 3 : (level === 'medium' ? 2 : 1);
    var bestScore = -Infinity;
    var best = [];
    moves.forEach(function (move) {
      var score = search(simulateState(state, move), depth - 1, -Infinity, Infinity, state.turn, 1);
      if (score > bestScore) { bestScore = score; best = [move]; }
      else if (score === bestScore) best.push(move);
    });
    return best[Math.floor(Math.random() * best.length)];
  }

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
    { piece: 'wK', from: [7,4], to: [[7,6]], extras: [{ piece: 'wR', at: [7,7] }], title: 'chess.lesson.castle.title',
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
      var unlocked = App.demoMode || Achievements.hasRank('rank.genius');
      return el('button', {
        type: 'button', class: 'btn wide', onclick: function () {
          Sound.play('tap');
          if (!unlocked) { App.showLocked({ requires: 'rank.genius' }); return; }
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
          el('span', { class: 'chess-piece white' }, PIECES['w' + pieceCode]),
          el('span', { class: 'chess-piece black' }, PIECES['b' + pieceCode])
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
          if (index === 7) {
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
                var pieceNode = el('span', { class: 'chess-piece ' + (colorOf(piece) === 'w' ? 'white' : 'black') }, PIECES[piece]);
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
                  pieceNode.style.setProperty('--move-x', ((from.c - col) * 100) + '%');
                  pieceNode.style.setProperty('--move-y', ((from.r - row) * 100) + '%');
                }
                contents.push(pieceNode);
              }
              contents = contents.concat(coordinateMarkers(row, col));
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
        if (ended || (computer && state.turn === 'b')) return;
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
        var captured = board[move.to.r][move.to.c] || move.enPassant;
        var notation = moveNotation(move, captured, promoteTo);
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
          endTimer = setTimeout(function () { showEnd(checked, false); }, MOVE_ANIMATION_MS);
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
      };
      paint();
    }

    renderMenu();
    return function cleanup() {
      stopped = true;
      if (aiTimer) clearTimeout(aiTimer);
      if (gameCleanup) gameCleanup();
      if (clockInterval) clearInterval(clockInterval);
      if (endTimer) clearTimeout(endTimer);
    };
  }

  App.register({
    id: 'chess', ages: ['junior', 'school'], emoji: '♟️',
    titleKey: 'game.chess', descKey: 'game.chess.desc',
    noStars: true, showRecord: false, start: start
  });
})(window);
