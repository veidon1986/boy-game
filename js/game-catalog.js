/* game-catalog.js — единственный источник метаданных, файлов и правил доступа игр. */
(function (global) {
  'use strict';

  var LEVELS = ['easy', 'medium', 'hard'];
  var AGES = ['toddler', 'preschool', 'junior', 'school'];
  var RANKS = ['rank.rookie', 'rank.explorer', 'rank.smart', 'rank.master', 'rank.genius'];

  function entry(id, emoji, ages, options) {
    var game = {
      id: id, file: 'js/games/' + id + '.js', emoji: emoji, ages: ages,
      titleKey: 'game.' + id, descKey: 'game.' + id + '.desc',
      levels: LEVELS.slice(), assets: [], scripts: []
    };
    Object.keys(options || {}).forEach(function (key) { game[key] = options[key]; });
    if (game.noStars) game.levels = [];
    return game;
  }

  var LIST = [
    entry('memory', '🧠', ['preschool', 'junior', 'school']),
    entry('sequence', '🔢', ['preschool', 'junior', 'school']),
    entry('sorting', '🧩', ['preschool', 'junior', 'school']),
    entry('math', '➕', ['preschool', 'junior', 'school']),
    entry('odd', '🔍', ['preschool', 'junior', 'school']),
    entry('find', '👀', ['toddler', 'preschool']),
    entry('puzzle', '🧩', ['toddler', 'preschool', 'junior']),
    entry('shadow', '🌘', ['preschool']),
    entry('story', '📖', ['preschool']),
    entry('maze', '🧭', ['junior', 'school']),
    entry('symmetry', '🪞', ['junior', 'school']),
    entry('robot', '🤖', ['school']),
    entry('wordbuild', '🔠', ['school']),
    // Сохранён прежний набор наград; этапы brain управляют сложностью внутри игры.
    entry('brain', '🧠', ['preschool', 'junior', 'school'], { difficulty: 'stages' }),
    entry('words', '🔤', ['school']),
    entry('runner', '🐉', ['junior', 'school'], { requires: 'rank.smart', noStars: true }),
    entry('blocks', '🧱', ['junior', 'school'], { requires: 'rank.master', noStars: true }),
    entry('checkers', '🔴', ['junior', 'school'], {
      noStars: true, showRecord: false, scripts: ['js/engines/checkers.js'], modes: { lessons: null, local: 'rank.genius' }
    }),
    entry('chess', '♟️', ['junior', 'school'], {
      noStars: true, showRecord: false,
      scripts: ['js/engines/chess.js'],
      modes: { lessons: null, local: 'rank.genius', computer: 'rank.genius' }
    })
  ];

  function validate(list) {
    var ids = {}, files = {};
    list.forEach(function (game) {
      if (!/^[a-z][a-z0-9-]*$/.test(game.id) || ids[game.id]) throw new Error('Invalid or duplicate game id: ' + game.id);
      ids[game.id] = true;
      if (!/^js\/games\/[a-z][a-z0-9-]*\.js$/.test(game.file) || files[game.file]) throw new Error('Invalid or duplicate game file: ' + game.file);
      files[game.file] = true;
      if (!Array.isArray(game.scripts) || game.scripts.some(function (file) { return !/^js\/engines\/[a-z][a-z0-9-]*\.js$/.test(file); })) throw new Error('Invalid game scripts: ' + game.id);
      if (!Array.isArray(game.assets) || game.assets.some(function (file) { return typeof file !== 'string' || !/^[a-zA-Z0-9_./-]+$/.test(file) || file.charAt(0) === '/' || file.split('/').indexOf('..') >= 0; })) throw new Error('Invalid game assets: ' + game.id);
      if (!game.emoji || !game.titleKey || !game.descKey) throw new Error('Missing game labels: ' + game.id);
      if (!Array.isArray(game.ages) || !game.ages.length || game.ages.some(function (age) { return AGES.indexOf(age) < 0; })) throw new Error('Invalid game ages: ' + game.id);
      if (!Array.isArray(game.levels) || game.levels.some(function (level) { return LEVELS.indexOf(level) < 0; })) throw new Error('Invalid game levels: ' + game.id);
      var ranks = [game.requires].concat(Object.keys(game.modes || {}).map(function (mode) { return game.modes[mode]; }));
      if (ranks.some(function (rank) { return rank != null && RANKS.indexOf(rank) < 0; })) throw new Error('Invalid game rank: ' + game.id);
    });
    return true;
  }

  function get(id) {
    for (var i = 0; i < LIST.length; i++) if (LIST[i].id === id) return LIST[i];
    return null;
  }

  function access(id, age, hasRank, demo, mode) {
    var game = get(id);
    if (!game) return { allowed: false, reason: 'unknown' };
    if (mode && (!game.modes || !Object.prototype.hasOwnProperty.call(game.modes, mode))) return { allowed: false, reason: 'mode' };
    if (demo) return { allowed: true };
    if (game.ages.indexOf(age) < 0) return { allowed: false, reason: 'age' };
    if (game.requires && !hasRank(game.requires)) return { allowed: false, reason: 'rank', requires: game.requires };
    var required = mode && game.modes[mode];
    if (required && !hasRank(required)) return { allowed: false, reason: 'rank', requires: required };
    return { allowed: true };
  }

  validate(LIST);
  global.GameCatalog = { list: LIST, get: get, access: access, validate: validate };
})(typeof window === 'undefined' ? self : window);
