/* engines/chess.js — правила и поиск хода без DOM. */
(function (global) {
  'use strict';
  var SIZE = 8;
  var KNIGHT_STEPS = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
  var KING_STEPS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  var ROOK_DIRS = [[-1,0],[1,0],[0,-1],[0,1]];
  var BISHOP_DIRS = [[-1,-1],[-1,1],[1,-1],[1,1]];
  function inside(r, c) { return r >= 0 && r < SIZE && c >= 0 && c < SIZE; }
  function colorOf(piece) { return piece ? piece.charAt(0) : ''; }
  function typeOf(piece) { return piece ? piece.charAt(1) : ''; }
  function other(color) { return color === 'w' ? 'b' : 'w'; }
  function cloneBoard(board) { return board.map(function (row) { return row.slice(); }); }
  function squareName(square) { return String.fromCharCode(97 + square.c) + (8 - square.r); }

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

  global.ChessRules = { inside: inside, colorOf: colorOf, typeOf: typeOf, other: other, cloneBoard: cloneBoard, squareName: squareName, moveNotation: moveNotation, initialBoard: initialBoard, findKing: findKing, squareAttacked: squareAttacked, inCheck: inCheck, pushMove: pushMove, pseudoMoves: pseudoMoves, applyMove: applyMove, legalMoves: legalMoves, newState: newState, updateRights: updateRights, simulateState: simulateState, evaluate: evaluate, search: search, chooseComputerMove: chooseComputerMove };
})(window);
