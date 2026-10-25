const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { root } = require('./helpers.cjs');
function rules(file, name) {
  const c = vm.createContext({}); c.window = c;
  vm.runInContext(fs.readFileSync(path.join(root, 'js/engines/' + file + '.js'), 'utf8'), c);
  return c[name];
}
test('pure chess engine preserves initial legal moves and detects checkmate', () => {
  const r = rules('chess', 'ChessRules');
  let state = r.newState();
  assert.equal(r.legalMoves(state, 'w').length, 20);
  let twoPlies = 0;
  for (const move of r.legalMoves(state, 'w')) twoPlies += r.legalMoves(r.simulateState(state, move), 'b').length;
  assert.equal(twoPlies, 400);
  for (const [from,to] of [['f2','f3'],['e7','e5'],['g2','g4'],['d8','h4']]) {
    const move = r.legalMoves(state, state.turn).find(move => r.squareName(move.from) === from && r.squareName(move.to) === to);
    assert.ok(move); state = r.simulateState(state, move);
  }
  assert.equal(r.inCheck(state.board, 'w'), true);
  assert.equal(r.legalMoves(state, 'w').length, 0);
});
test('pure checkers engine preserves mandatory captures backwards and flying kings', () => {
  const r = rules('checkers', 'CheckersRules');
  const board = Array.from({ length: 8 }, () => Array(8).fill(0));
  board[3][2] = 1; board[4][3] = -1;
  let moves = r.allMoves(board, 1, null);
  assert.equal(moves.length, 1);
  assert.equal(moves[0].to.r, 5); assert.equal(moves[0].to.c, 4);
  board[3][2] = 2;
  moves = r.allMoves(board, 1, null);
  assert.equal(moves.length, 3);
  assert.ok(moves.every(move => move.captured.length === 1));
});
