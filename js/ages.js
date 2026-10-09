/* ages.js — возрастные группы детей. У каждой игры есть список подходящих
   возрастов (поле ages), а у профиля ребёнка — его возрастная группа. */
(function (global) {
  'use strict';

  var LIST = [
    { key: 'toddler',   emoji: '🧸', range: '2–3' },
    { key: 'preschool', emoji: '🎨', range: '4–5' },
    { key: 'junior',    emoji: '🎒', range: '5–6' },
    { key: 'school',    emoji: '📚', range: '7–8' }
  ];

  var DEFAULT = 'junior';

  // Сколько уровней сложности доступно возрасту (индекс «сложно»).
  // Малыши — только «легко», 4–5 — без «сложно», 5–8 — все три.
  var MAX_LEVEL = { toddler: 0, preschool: 1, junior: 2, school: 2 };
  var ALL_LEVELS = ['easy', 'medium', 'hard'];

  function get(key) {
    for (var i = 0; i < LIST.length; i++) if (LIST[i].key === key) return LIST[i];
    return null;
  }

  function normalize(key) { return get(key) ? key : DEFAULT; }

  function keys() { return LIST.map(function (a) { return a.key; }); }

  // Метка вида «🎨 4–5 лет».
  function label(key) {
    var a = get(normalize(key));
    var years = global.t ? global.t('age.years') : 'лет';
    return a.emoji + ' ' + a.range + ' ' + years;
  }

  // Короткая метка вида «4–5 лет» (без эмодзи).
  function range(key) {
    var a = get(normalize(key));
    var years = global.t ? global.t('age.years') : 'лет';
    return a.range + ' ' + years;
  }

  // Индекс верхнего доступного уровня сложности для возраста.
  function levelIndex(key) {
    var n = MAX_LEVEL[normalize(key)];
    return n === undefined ? ALL_LEVELS.length - 1 : n;
  }

  // Список доступных уровней сложности для возраста.
  function levels(key) { return ALL_LEVELS.slice(0, levelIndex(key) + 1); }

  global.Ages = {
    list: LIST,
    defaultKey: DEFAULT,
    get: get,
    keys: keys,
    normalize: normalize,
    label: label,
    range: range,
    levelIndex: levelIndex,
    levels: levels
  };
})(window);
