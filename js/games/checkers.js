/* games/checkers.js — шашки для двух игроков на одном устройстве. */
(function (global) {
  'use strict';

  var el = UI.el;
  var t = global.t || function (k) { return k; };
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

  function start(root, App) {
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

  App.register({
    id: 'checkers', ages: ['junior', 'school'], emoji: '🔴',
    titleKey: 'game.checkers', descKey: 'game.checkers.desc',
    requires: 'rank.genius', noStars: true, showRecord: false, start: start
  });
})(window);
