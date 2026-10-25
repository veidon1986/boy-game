/* engines/checkers.js — правила ходов и взятий без DOM. */
(function (global) {
  'use strict';
  var SIZE = 8;
  var RED = 1;
  var BLUE = -1;
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

  global.CheckersRules = { side: side, inside: inside, key: key, capturesFor: capturesFor, allMoves: allMoves };
})(window);
