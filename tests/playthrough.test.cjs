const test = require('node:test');
const assert = require('node:assert/strict');
const { application } = require('./helpers.cjs');
const { attachDOM } = require('./dom-fixture.cjs');

// Executes actual game click handlers and scheduled transitions. DOM/canvas are
// simulated; this is not a visual or physical-device acceptance test.
function play(id, age = 'school', language = 'ru') {
  const { context: c } = application();
  const dom = attachDOM(c), root = dom.node();
  c.I18N.setLang(language);
  let clock = 0, serial = 0, overlay = null;
  const jobs = new Map(), epoch = Date.now(), tasks = new Map();
  c.Date = class extends Date { constructor(...args) { super(...(args.length ? args : [epoch + clock])); } static now() { return epoch + clock; } };
  const schedule = (type, fn, delay = 0) => { jobs.set(++serial, { type, fn, delay, at: clock + Math.max(1, delay) }); return serial; };
  c.setTimeout = (fn, delay) => schedule('timeout', fn, delay);
  c.setInterval = (fn, delay) => schedule('interval', fn, delay);
  c.requestAnimationFrame = fn => schedule('frame', fn, 16);
  c.clearTimeout = c.clearInterval = c.cancelAnimationFrame = key => jobs.delete(key);
  function tick(ms, max = 10000) {
    const until = clock + ms;
    let count = 0;
    while (true) {
      const entry = [...jobs].filter(([, job]) => job.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
      if (!entry) break;
      assert.ok(++count <= max, 'Timer loop: ' + id);
      const [key, job] = entry;
      clock = job.at;
      if (job.type === 'interval') job.at += Math.max(1, job.delay);
      else jobs.delete(key);
      job.fn(clock);
    }
    clock = until;
  }
  function flush() {
    for (let n = 0; n < 500 && [...jobs.values()].some(job => job.type === 'timeout'); n++) {
      const next = Math.min(...[...jobs.values()].filter(job => job.type === 'timeout').map(job => job.at));
      tick(next - clock);
    }
    assert.ok(![...jobs.values()].some(job => job.type === 'timeout'), 'Timeout chain did not settle');
  }
  const generate = c.UI.uniqueGenerator;
  c.UI.uniqueGenerator = function (...args) {
    const gen = generate(...args);
    const next = (...preferences) => { const result = gen(...preferences); tasks.set(args[3], result); return result; };
    Object.defineProperty(next, 'exhausted', { get: () => gen.exhausted });
    return next;
  };
  const remember = c.Store.rememberTask;
  c.Store.rememberTask = (game, signature, ...args) => { tasks.set(game + ':signature', signature); return remember(game, signature, ...args); };
  c.Store.addProfile('Synthetic playthrough', '🧪', age);
  // Unlock party/arcade gates through ordinary results, only in this Map storage.
  for (const game of c.App.ageGames().filter(game => !game.noStars)) c.Store.recordResult(game.id, 3, 'hard');
  const recorded = [], recordResult = c.Store.recordResult;
  c.Store.recordResult = (...args) => { recorded.push(args); return recordResult(...args); };
  c.App.els = { screen: root, overlay: dom.node(), toast: dom.node() };
  c.App.els.overlay.classList.add('hidden');
  c.App.showOverlay = body => { overlay = body; c.App.els.overlay.classList.remove('hidden'); };
  c.App.hideOverlay = () => { overlay = null; c.App.els.overlay.classList.add('hidden'); };
  c.App.showAchievements = (_list, done) => { if (done) done(); };
  c.App.mode = 'game'; c.App.current = id;
  const session = c.GameSession.start(c.App.gameById(id), root, c.App);
  c.App.session = session;
  const all = selector => root.querySelectorAll(selector);
  const button = text => all('button').find(node => node.textContent === text);
  return { c, root, jobs, tasks, session, all, button, tick, flush, recorded,
    overlay: () => overlay,
    close: () => { session.destroy(); assert.equal(jobs.size, 0, 'Leaked jobs after play: ' + id); assert.equal(dom.listeners.size, 0); },
    key: code => dom.listeners.get('keydown')({ code, preventDefault() {} }) };
}

function choice(p, selector, text) {
  const node = p.all(selector).find(b => !b.disabled && b.textContent === String(text));
  assert.ok(node, 'Missing answer ' + text + ' in ' + selector); node.click();
}
function route(p) {
  const cells = p.all('.robot-cell');
  const start = cells.find(c => c.classList.contains('robot-current'));
  const goal = cells.find(c => c.classList.contains('robot-goal'));
  assert.ok(start && goal);
  const queue = [{ cell: start, steps: [] }], visited = new Set();
  const directions = [[-1,0,'⬆️'], [0,1,'➡️'], [1,0,'⬇️'], [0,-1,'⬅️']];
  while (queue.length) {
    const { cell, steps } = queue.shift(), key = cell._r + ',' + cell._c;
    if (visited.has(key)) continue; visited.add(key);
    if (cell === goal) return steps;
    for (const [dr, dc, icon] of directions) {
      const next = cells.find(c => c._r === cell._r + dr && c._c === cell._c + dc && !c.classList.contains('robot-wall'));
      if (next) queue.push({ cell: next, steps: steps.concat(icon) });
    }
  }
  assert.fail('No route to goal');
}

const solvers = {
  memory(p) {
    const groups = new Map();
    for (const card of p.all('.memo-card')) {
      const key = card._card.data.key;
      if (!groups.has(key)) groups.set(key, []); groups.get(key).push(card);
    }
    for (const pair of groups.values()) pair.forEach(card => card.click());
  },
  sorting(p) {
    for (const item of [...p.all('.sort-item')].filter(b => !b.disabled)) {
      item.click(); p.all('.bin').find(b => b.dataset.cat === item._cat).click();
    }
  },
  puzzle(p) {
    for (const piece of p.all('.puzzle-piece')) { piece.click(); p.all('.puzzle-slot')[piece._piece.home].click(); }
  },
  story(p) { for (const icon of p.tasks.get('story')) choice(p, '.story-card', icon); },
  wordbuild(p) { for (const letter of p.tasks.get('wordbuild').item.word) choice(p, '.wordbuild-letter', letter); },
  sequence(p) { choice(p, '.seq-option', p.tasks.get('sequence').answer); },
  math(p) { choice(p, '.math-option', p.tasks.get('math').answer); },
  odd(p) { choice(p, '.odd-item', p.tasks.get('odd').answer); },
  find(p) { choice(p, '.find-item', p.tasks.get('find').target); },
  words(p) { choice(p, '.words-option', p.tasks.get('words').target[p.c.I18N.getLang()]); },
  symmetry(p) { choice(p, '.symmetry-option', p.tasks.get('symmetry').answer); },
  shadow(p) {
    const task = p.tasks.get('shadow');
    p.all('.shadow-option')[task.options.findIndex(shape => shape.name === task.target.name)].click();
  },
  maze(p) { for (const icon of route(p)) choice(p, '.robot-arrow', icon); p.button(p.c.t('game.robot.run')).click(); },
  robot(p) { solvers.maze(p); }
};

for (const id of Object.keys(solvers)) test(id + ': complete, save stars, replay with new tasks, close', () => {
  const age = application().context.GameCatalog.get(id).ages.slice(-1)[0];
  const p = play(id, age);
  const before = p.c.Store.gameStats(id).plays;
  for (let round = 0; !p.overlay() && round < 10; round++) {
    solvers[id](p); p.flush();
    const active = p.all('.seg-btn.active')[0];
    if (active) assert.equal(active.textContent, p.c.t('common.easy'), 'Difficulty changed during play');
  }
  assert.ok(p.overlay(), 'No result for ' + id);
  assert.equal(p.c.Store.gameStats(id).plays, before + 1);
  const result = p.c.Store.gameStats(id), played = id === 'find' ? 'medium' : 'easy';
  assert.equal(result[played].stars, 3);
  assert.equal(p.recorded[0][1], 3, 'Perfect session did not award three stars');
  const previous = [...p.c.Store.taskHistory(id)];
  const again = p.overlay().querySelectorAll('button').find(b => b.textContent.includes(p.c.t('common.again')));
  assert.ok(again); again.click();
  assert.equal(p.overlay(), null);
  assert.ok(p.c.Store.taskHistory(id).length > previous.length, 'Replay reused tasks');
  p.close();
});

// Cover every real age/level combination and both dictionaries. No direct calls
// to finishGame: only generated tasks, UI handlers and their virtual timers.
for (const id of Object.keys(solvers)) {
  const catalog = application().context;
  for (const age of catalog.GameCatalog.get(id).ages) {
    const levels = id === 'find' ? [age === 'toddler' ? 'easy' : 'medium'] : catalog.Ages.levels(age);
    for (const level of levels) for (const language of ['ru', 'en']) {
      test(`${id}: ${age}/${level}/${language} completes without difficulty escalation`, () => {
        const p = play(id, age, language);
        if (id !== 'find') p.button(p.c.t('common.' + level)).click();
        for (let round = 0; !p.overlay() && round < 10; round++) {
          solvers[id](p); p.flush();
          const active = p.all('.seg-btn.active')[0];
          if (active) assert.equal(active.textContent, p.c.t('common.' + level));
        }
        assert.ok(p.overlay());
        assert.equal(p.recorded.length, 1);
        assert.deepEqual(Array.from(p.recorded[0]), [id, 3, level]);
        p.close();
      });
    }
  }
}

test('memory: leaving after last pair cancels pending reward before a new session', () => {
  const p = play('memory'); solvers.memory(p);
  p.session.destroy();
  assert.equal(p.jobs.size, 0, 'Pending finish could reward a later memory session');
});

test('variety selection records only displayed math, sequence and odd tasks', () => {
  for (const [id, rounds] of [['math',5], ['sequence',5], ['odd',5]]) {
    const p = play(id, 'junior');
    for (let round = 0; !p.overlay() && round < 10; round++) { solvers[id](p); p.flush(); }
    assert.ok(p.overlay()); assert.equal(p.c.Store.taskHistory(id).length, rounds, 'Unshown tasks remembered: ' + id);
    p.close();
  }
});

for (const [id, selector] of [['math','.math-option'], ['sequence','.seq-option'], ['odd','.odd-item'],
  ['find','.find-item'], ['words','.words-option'], ['symmetry','.symmetry-option']]) {
  test(id + ': mistakes reduce the session award without switching difficulty', () => {
    const age = application().context.GameCatalog.get(id).ages.slice(-1)[0];
    const p = play(id, age);
    for (let round = 0; !p.overlay() && round < 10; round++) {
      const task = p.tasks.get(id);
      const answer = id === 'find' ? task.target : id === 'words' ? task.target.ru : task.answer;
      const wrong = p.all(selector).find(button => button.textContent !== String(answer));
      assert.ok(wrong); wrong.click(); solvers[id](p); p.flush();
    }
    assert.ok(p.overlay()); assert.equal(p.recorded[0][1], 1); p.close();
  });
}

test('brain: all 30 levels persist, then report completion', () => {
  const p = play('brain');
  const before = p.c.Store.gameStats('brain').plays;
  for (let level = 0; !p.overlay() && level < 31; level++) {
    const answer = p.tasks.get('brain:signature').split('|').pop();
    choice(p, '.brain-opt', answer); p.flush();
  }
  assert.ok(p.overlay().textContent.includes(p.c.t('brain.victory')));
  assert.equal(p.c.Store.brainLevel(), 30);
  assert.equal(p.c.Store.gameStats('brain').plays, before + 30);
  assert.equal(p.c.Store.taskHistory('brain').length, 30); p.close();
});

test('runner: animated frames, jump, landing, collision, record and retry', () => {
  const p = play('runner'); p.tick(100); p.key('Space'); p.tick(800);
  assert.equal(p.overlay(), null);
  p.tick(6000); assert.ok(p.overlay());
  assert.ok(p.c.Store.best('runner') > 0);
  p.overlay().querySelectorAll('button')[0].click();
  assert.equal(p.overlay(), null); p.tick(100); p.close();
});

test('blocks: pause freezes board, repeat does not double tap, game over and retry', () => {
  const p = play('blocks');
  const state = () => p.all('.blocks-cell').map(b => b.className).join('|');
  const right = p.all('.blocks-right')[0], before = state();
  right.listeners.pointerdown({ button: 0, isPrimary: true, pointerId: 1, preventDefault() {} });
  const once = state(); assert.notEqual(once, before);
  right.listeners.pointerup(); right.listeners.click({ detail: 1, preventDefault() {} });
  assert.equal(state(), once, 'Synthetic click made a second move');
  p.all('.blocks-pause')[0].click(); const paused = state(); p.tick(3000); assert.equal(state(), paused);
  p.all('.blocks-pause')[0].click(); p.tick(1200); assert.notEqual(state(), paused);
  for (let i = 0; !p.overlay() && i < 500; i++) p.key('ArrowDown');
  assert.ok(p.overlay()); assert.ok(p.c.Store.best('blocks') > 0);
  p.overlay().querySelectorAll('button')[0].click(); assert.equal(p.overlay(), null); p.close();
});

function menuButton(p, key) {
  const button = p.all('button').find(b => b.textContent.includes(p.c.t(key)));
  assert.ok(button, 'Missing menu: ' + key); button.click();
}
function finishLessons(p, game, expected) {
  const squareClass = '.' + game + '-square';
  let count = 0;
  while (p.all(squareClass).length && count < 20) {
    let next = p.all('.btn.primary.wide').find(b => !b.classList.contains('hidden'));
    for (let step = 0; !next && step < 4; step++) {
      if (!p.all(squareClass + '.target').length) {
        const candidates = p.all(squareClass).map((s, index) => s.querySelector('.' + game + '-piece') ? index : -1).filter(i => i >= 0);
        for (const index of candidates) {
          p.all(squareClass)[index].click();
          if (p.all(squareClass + '.target').length) break;
        }
      }
      const target = p.all(squareClass + '.target')[0]; assert.ok(target, 'Lesson target missing'); target.click();
      next = p.all('.btn.primary.wide').find(b => !b.classList.contains('hidden'));
    }
    assert.ok(next, 'Lesson completion missing'); count++; next.click();
  }
  assert.equal(count, expected);
}

test('chess: all move and capture lessons finish and exhausted stages stay explicit', () => {
  const p = play('chess'); menuButton(p, 'chess.openLessons'); menuButton(p, 'chess.school.stage2');
  finishLessons(p, 'chess', 9);
  assert.equal(p.c.Store.taskHistory('chess-lessons-moves').length, 9);
  menuButton(p, 'chess.school.stage2');
  assert.ok(p.root.textContent.includes(p.c.t('chess.lesson.stageExhausted')));
  menuButton(p, 'chess.school.back'); menuButton(p, 'chess.school.stage3');
  finishLessons(p, 'chess', 5);
  assert.equal(p.c.Store.taskHistory('chess-lessons-captures').length, 5); p.close();
});

test('chess: local checkmate, four logged plies, coordinates and new game', () => {
  const p = play('chess'); const rating = p.c.Store.chessRating();
  menuButton(p, 'chess.twoPlayers'); menuButton(p, 'chess.clock.noTimer');
  assert.equal(p.all('.chess-coordinate-rank').length, 8);
  assert.equal(p.all('.chess-coordinate-file').length, 8);
  const square = name => p.all('.chess-square').find(s => s.getAttribute('aria-label') === p.c.t('chess.square', { square: name }));
  for (const [from, to] of [['f2','f3'], ['e7','e5'], ['g2','g4'], ['d8','h4']]) {
    square(from).click(); square(to).click(); p.tick(1000);
  }
  assert.ok(p.overlay().textContent.includes(p.c.t('chess.checkmate', { winner: p.c.t('chess.black') })));
  assert.equal(p.all('.chess-move-row').length, 2);
  assert.equal(p.c.Store.chessRating(), rating, 'Local match affected computer rating');
  p.overlay().querySelectorAll('button')[0].click(); assert.equal(p.overlay(), null); p.close();
});

test('chess: resumed course still moves the rook during castling', () => {
  const p = play('chess');
  for (const name of ['pawn', 'double', 'rook', 'bishop', 'queen', 'knight', 'king']) {
    p.c.Store.rememberTask('chess-lessons-moves', 'chess.lesson.' + name + '.task');
  }
  menuButton(p, 'chess.openLessons'); menuButton(p, 'chess.school.stage2');
  const square = name => p.all('.chess-square').find(s => s.getAttribute('aria-label') === p.c.t('chess.square', { square: name }));
  square('e1').click(); square('g1').click();
  assert.ok(square('f1').querySelector('.chess-piece'), 'Castling rook stayed at h1 after resume');
  assert.equal(square('h1').querySelector('.chess-piece'), null); p.close();
});

test('chess: computer responds and timeout updates rating exactly once', () => {
  const p = play('chess'); const before = p.c.Store.chessRating();
  menuButton(p, 'chess.vsComputer'); p.button(p.c.t('chess.clock.minutes', { minutes: 5 })).click();
  menuButton(p, 'chess.computer.easy');
  const square = name => p.all('.chess-square').find(s => s.getAttribute('aria-label') === p.c.t('chess.square', { square: name }));
  square('e2').click(); square('e4').click(); p.tick(2000);
  assert.ok(p.all('.chess-move-black')[0].textContent, 'Computer did not reply');
  p.tick(301000);
  assert.ok(p.overlay()); assert.ok(p.c.Store.chessRating() < before);
  const after = p.c.Store.chessRating(); p.tick(10000); assert.equal(p.c.Store.chessRating(), after); p.close();
});

test('checkers: all move and capture lessons finish and stage exhaustion is explicit', () => {
  const p = play('checkers'); menuButton(p, 'checkers.school.open'); menuButton(p, 'checkers.school.stage2');
  finishLessons(p, 'checkers', 3);
  assert.equal(p.c.Store.taskHistory('checkers-lessons-moves').length, 3);
  menuButton(p, 'checkers.school.stage2'); assert.ok(p.root.textContent.includes(p.c.t('checkers.school.stageExhausted')));
  menuButton(p, 'checkers.school.back'); menuButton(p, 'checkers.school.stage3'); finishLessons(p, 'checkers', 4);
  assert.equal(p.c.Store.taskHistory('checkers-lessons-captures').length, 4); p.close();
});

test('checkers: full legal party reaches result, clears menu and restarts', () => {
  const p = play('checkers'); menuButton(p, 'checkers.play');
  assert.equal(p.all('.chess-menu').length, 0, 'Party retained game menu');
  let turn = 1, forced = null, random = 12345;
  for (let ply = 0; !p.overlay() && ply < 1000; ply++) {
    const squares = p.all('.checkers-square');
    const board = Array.from({ length: 8 }, (_, r) => Array.from({ length: 8 }, (_, col) => {
      const piece = squares[r * 8 + col].querySelector('.checkers-piece');
      return piece ? (piece.classList.contains('red') ? 1 : -1) * (piece.classList.contains('king') ? 2 : 1) : 0;
    }));
    const moves = p.c.CheckersRules.allMoves(board, turn, forced); assert.ok(moves.length);
    random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
    const move = moves[random % moves.length], piece = board[move.from.r][move.from.c];
    squares[move.from.r * 8 + move.from.c].click();
    p.all('.checkers-square')[move.to.r * 8 + move.to.c].click(); p.tick(1000);
    board[move.from.r][move.from.c] = 0;
    move.captured.forEach(at => { board[at.r][at.c] = 0; });
    const promoted = piece === 1 && move.to.r === 0 ? 2 : piece === -1 && move.to.r === 7 ? -2 : piece;
    board[move.to.r][move.to.c] = promoted;
    if (move.captured.length && p.c.CheckersRules.capturesFor(board, move.to.r, move.to.c, promoted).length) forced = move.to;
    else { forced = null; turn = -turn; }
  }
  assert.ok(p.overlay(), 'Party did not end within 1000 plies');
  p.overlay().querySelectorAll('button')[0].click(); assert.equal(p.overlay(), null); p.close();
});
