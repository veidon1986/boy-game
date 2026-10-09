/* games/words.js — «Найди слово»: чтение для младших школьников 7–8 лет.
   Показываем картинку и варианты слов — нужно выбрать подходящее слово.
   Слова даны на двух языках, выбираются по текущему языку интерфейса. */
(function (global) {
  'use strict';

  var el = UI.el;

  var WORDS = [
    { e: '🍎', ru: 'яблоко', en: 'apple' },
    { e: '🍌', ru: 'банан', en: 'banana' },
    { e: '🍇', ru: 'виноград', en: 'grapes' },
    { e: '🍓', ru: 'клубника', en: 'strawberry' },
    { e: '🍕', ru: 'пицца', en: 'pizza' },
    { e: '🥛', ru: 'молоко', en: 'milk' },
    { e: '🍞', ru: 'хлеб', en: 'bread' },
    { e: '🧀', ru: 'сыр', en: 'cheese' },
    { e: '🥕', ru: 'морковь', en: 'carrot' },
    { e: '🐶', ru: 'собака', en: 'dog' },
    { e: '🐱', ru: 'кошка', en: 'cat' },
    { e: '🐰', ru: 'заяц', en: 'rabbit' },
    { e: '🐘', ru: 'слон', en: 'elephant' },
    { e: '🐟', ru: 'рыба', en: 'fish' },
    { e: '🐸', ru: 'лягушка', en: 'frog' },
    { e: '🐝', ru: 'пчела', en: 'bee' },
    { e: '🐢', ru: 'черепаха', en: 'turtle' },
    { e: '🦊', ru: 'лиса', en: 'fox' },
    { e: '⭐', ru: 'звезда', en: 'star' },
    { e: '🌙', ru: 'луна', en: 'moon' },
    { e: '☀️', ru: 'солнце', en: 'sun' },
    { e: '🏠', ru: 'дом', en: 'house' },
    { e: '🌳', ru: 'дерево', en: 'tree' },
    { e: '🌸', ru: 'цветок', en: 'flower' },
    { e: '🚗', ru: 'машина', en: 'car' },
    { e: '🚌', ru: 'автобус', en: 'bus' },
    { e: '✈️', ru: 'самолёт', en: 'plane' },
    { e: '🚀', ru: 'ракета', en: 'rocket' },
    { e: '⚽', ru: 'мяч', en: 'ball' },
    { e: '📚', ru: 'книга', en: 'book' },
    { e: '🎈', ru: 'шар', en: 'balloon' },
    { e: '🧸', ru: 'мишка', en: 'teddy' }
  ];

  function wordOf(item) {
    return global.I18N.getLang() === 'en' ? item.en : item.ru;
  }

  function optionsCount(level) {
    if (level === 'hard') return 5;
    if (level === 'medium') return 4;
    return 3;
  }

  function makeRound(level) {
    var n = optionsCount(level);
    var target = UI.pick(WORDS);
    var others = UI.shuffle(WORDS.filter(function (w) { return w.e !== target.e; })).slice(0, n - 1);
    return {
      target: target,
      items: UI.shuffle([target].concat(others))
    };
  }

  function keyOf(r) {
    return r.target.e + '|' + r.items.map(function (w) { return w.e; }).sort().join(',');
  }

  function start(root, App) {
    var level = 'easy';
    var TOTAL = 6;
    var round = 0;
    var firstTry = 0;
    var current = null;
    var timer = null;
    var gen = null;

    var adaptive = new Adaptive({
      level: level,
      onChange: function (nl, why) {
        level = nl;
        if (difficulty) difficulty._setActive(nl);
        App.toast(t(why === 'up' ? 'level.up' : 'level.down', { name: t('common.' + nl) }), 1500);
      }
    });

    root.appendChild(el('p', { class: 'game-hint' }, t('game.words.hint')));

    var difficulty = UI.segmented([
      { value: 'easy', label: t('common.easy') },
      { value: 'medium', label: t('common.medium') },
      { value: 'hard', label: t('common.hard') }
    ], level, function (v) {
      level = v;
      adaptive.setLevel(v);
      newSession();
    });

    var progress = el('div', { class: 'game-stats' });
    var stage = el('div', { class: 'words-stage' });

    root.appendChild(difficulty);
    root.appendChild(progress);
    root.appendChild(stage);

    function newSession() {
      gen = UI.uniqueGenerator(function () { return makeRound(level); }, keyOf, 60);
      round = 0; firstTry = 0;
      adaptive.reset();
      nextRound();
    }

    function nextRound() {
      if (timer) { clearTimeout(timer); timer = null; }
      if (round >= TOTAL) { finish(); return; }
      round++;
      progress.textContent = t('common.round') + ' ' + round + ' ' + t('common.of') + ' ' + TOTAL;
      render(gen());
    }

    function render(data) {
      current = { answer: wordOf(data.target), wrong: false, done: false };
      UI.clear(stage);

      stage.appendChild(el('div', { class: 'words-picture' }, data.target.e));

      var list = el('div', { class: 'words-options' });
      data.items.forEach(function (item) {
        var word = wordOf(item);
        var btn = el('button', {
          type: 'button', class: 'words-option',
          onclick: function () { choose(btn, word); }
        }, word);
        list.appendChild(btn);
      });
      stage.appendChild(list);
    }

    function choose(btn, word) {
      if (current.done) return;
      if (word === current.answer) {
        current.done = true;
        btn.classList.add('correct');
        Sound.play('match');
        if (!current.wrong) { firstTry++; adaptive.correct(); }
        timer = setTimeout(nextRound, 850);
      } else {
        if (!current.wrong) { current.wrong = true; adaptive.wrong(); }
        btn.classList.add('wrong');
        Sound.play('wrong');
        setTimeout(function () { btn.classList.remove('wrong'); }, 500);
      }
    }

    function finish() {
      var stars = Math.round(firstTry / TOTAL * 3);
      if (firstTry > 0 && stars < 1) stars = 1;
      App.finishGame('words', stars, newSession, null, level);
    }

    newSession();

    return function cleanup() { if (timer) clearTimeout(timer); };
  }

  App.register({
    id: 'words',
    ages: ['school'],
    emoji: '🔤',
    titleKey: 'game.words',
    descKey: 'game.words.desc',
    start: start
  });
})(window);
