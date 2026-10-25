const test = require('node:test');
const assert = require('node:assert/strict');
const { application } = require('./helpers.cjs');
const plain = value => JSON.parse(JSON.stringify(value));
const ages = {
  toddler: 'find puzzle',
  preschool: 'memory sequence sorting math odd find puzzle shadow story brain',
  junior: 'memory sequence sorting math odd puzzle maze symmetry brain runner blocks checkers chess',
  school: 'memory sequence sorting math odd maze symmetry robot wordbuild brain words runner blocks checkers chess'
};

test('catalog order, age groups and difficulty availability stay compatible', () => {
  const { context: c } = application();
  assert.equal(c.App.games.length, 19);
  c.Store.setProfile({ name: 'Fixture', avatar: '🧪', age: 'junior' });
  for (const [age, expected] of Object.entries(ages)) {
    c.Store.setAge(age);
    assert.equal(c.App.ageGames().map(game => game.id).join(' '), expected);
  }
  assert.deepEqual(plain(c.Ages.levels('toddler')), ['easy']);
  assert.deepEqual(plain(c.Ages.levels('preschool')), ['easy', 'medium']);
  assert.deepEqual(plain(c.Ages.levels('school')), ['easy', 'medium', 'hard']);
  c.Store.setAge('preschool');
  assert.deepEqual(plain(c.App.gameLevels('math')), ['easy', 'medium']);
  assert.equal(c.App.gameById('runner').requires, 'rank.smart');
  assert.equal(c.App.gameById('blocks').requires, 'rank.master');
  assert.equal(c.App.gameById('chess').requires, undefined);
});

test('hard completion grants lower cups without playing the same game three times', () => {
  const { context: c } = application();
  c.Store.setProfile({ name: 'Fixture', avatar: '🧪', age: 'junior' });
  c.Store.recordResult('memory', 3, 'hard');
  c.Achievements.checkNew('memory', 'hard');
  const cups = c.Achievements.all().filter(a => a.id.startsWith('cup.memory.') && a.unlocked);
  assert.equal(cups.length, 3);
  assert.equal(c.Store.gameStats('memory').easy.plays, 0);
});

test('profiles isolate results and task history; restarting a generator keeps history', () => {
  const { context: c } = application();
  const first = c.Store.addProfile('One', '🧪', 'junior');
  c.Store.recordResult('memory', 2, 'easy');
  const make = () => 42;
  const signature = value => String(value);
  assert.equal(c.UI.uniqueGenerator(make, signature, 3, 'fixture')(), 42);
  assert.equal(c.UI.uniqueGenerator(make, signature, 3, 'fixture')(), null);
  c.Store.addProfile('Two', '🧪', 'school');
  assert.equal(c.Store.gameStats('memory').plays, 0);
  assert.equal(c.UI.uniqueGenerator(make, signature, 3, 'fixture')(), 42);
  c.Store.switchProfile(first.id);
  assert.equal(c.Store.gameStats('memory').stars, 2);
  assert.equal(c.UI.uniqueGenerator(make, signature, 3, 'fixture')(), null);
});

test('existing profile data survives a fresh application instance', () => {
  const { context: c, data } = application();
  const child = c.Store.addProfile('Existing', '🦁', 'school');
  c.Store.recordResult('math', 3, 'hard');
  c.Store.rememberTask('math', 'existing-task');
  c.Store.setChessRating(730);
  const second = application();
  for (const [key, value] of data) second.data.set(key, value);
  assert.equal(second.context.Store.activeId(), child.id);
  assert.equal(second.context.Store.gameStats('math').hard.stars, 3);
  assert.equal(second.context.Store.chessRating(), 730);
  assert.deepEqual(plain(second.context.Store.taskHistory('math')), ['existing-task']);
});

test('local demo never persists progress or task history', () => {
  const { context: c, data } = application('?test=1');
  c.Store.recordResult('memory', 3, 'hard');
  c.Store.rememberTask('memory', 'fixture');
  assert.equal(data.size, 0);
});
