/* games/wordbuild.js — собери слово из перемешанных букв. */
(function (global) {
  'use strict';

  var el = UI.el;
  var WORDS = {
    ru: {
      3: [{ icon: '🐱', word: 'кот' }, { icon: '🏠', word: 'дом' }, { icon: '⚽', word: 'мяч' }],
      4: [{ icon: '🐟', word: 'рыба' }, { icon: '🐘', word: 'слон' }, { icon: '🌙', word: 'луна' }],
      5: [{ icon: '🍋', word: 'лимон' }, { icon: '🚂', word: 'поезд' }, { icon: '🌼', word: 'цветы' }]
    },
    en: {
      3: [{ icon: '🐱', word: 'cat' }, { icon: '🏠', word: 'hut' }, { icon: '☀️', word: 'sun' }],
      4: [{ icon: '🐟', word: 'fish' }, { icon: '🦁', word: 'lion' }, { icon: '🌙', word: 'moon' }],
      5: [{ icon: '🍋', word: 'lemon' }, { icon: '🚂', word: 'train' }, { icon: '🌱', word: 'plant' }]
    }
  };

  function start(root, App) {
    var age = App.age();
    var level = 'easy';
    var round = 0;
    var firstTry = 0;
    var timer = null;
    var TOTAL = 5;
    var stats = el('div', { class: 'game-stats' });
    var stage = el('div', { class: 'wordbuild-stage' });
    var difficulty = UI.segmented(Ages.levels(age).map(function (lv) {
      return { value: lv, label: t('common.' + lv) };
    }), level, function (v) { level = v; newSession(); });
    root.appendChild(el('p', { class: 'game-hint' }, t('game.wordbuild.hint')));
    root.appendChild(difficulty);
    root.appendChild(stats);
    root.appendChild(stage);

    function newSession() {
      if (timer) { clearTimeout(timer); timer = null; }
      round = 0; firstTry = 0; render();
    }
    function render() {
      if (round >= TOTAL) {
        App.finishGame('wordbuild', Math.max(1, Math.round(firstTry / TOTAL * 3)), newSession, null, level);
        return;
      }
      round++;
      stats.textContent = t('common.round') + ' ' + round + ' ' + t('common.of') + ' ' + TOTAL;
      UI.clear(stage);
      var lang = I18N.getLang() === 'en' ? 'en' : 'ru';
      var length = level === 'easy' ? 3 : (level === 'medium' ? 4 : 5);
      var word = UI.pick(WORDS[lang][length]);
      var letters = UI.shuffle(word.word.split('').map(function (letter, index) {
        return { letter: letter, id: index, used: false };
      }));
      var answer = [];
      var mistakes = 0;
      var locked = false;
      stage.appendChild(el('div', { class: 'wordbuild-picture' }, word.icon));
      var built = el('div', { class: 'wordbuild-answer' });
      var tray = el('div', { class: 'wordbuild-letters' });
      letters.forEach(function (item) {
        var button = el('button', {
          type: 'button', class: 'wordbuild-letter',
          onclick: function () {
            if (locked || item.used) return;
            item.used = true;
            answer.push(item);
            button.disabled = true;
            built.appendChild(el('button', {
              type: 'button', class: 'wordbuild-picked',
              'aria-label': t('game.wordbuild.removeLetter', { letter: item.letter }),
              onclick: function () {
                if (locked) return;
                var index = answer.indexOf(item);
                if (index >= 0) answer.splice(index, 1);
                item.used = false;
                button.disabled = false;
                this.remove();
              }
            }, item.letter));
            if (answer.length === word.word.length) check();
            Sound.play('tap');
          }
        }, item.letter);
        tray.appendChild(button);
      });
      stage.appendChild(built);
      stage.appendChild(tray);

      function check() {
        var guess = answer.map(function (x) { return x.letter; }).join('');
        if (guess === word.word) {
          locked = true;
          firstTry += mistakes ? 0 : 1;
          built.classList.add('correct');
          Sound.play('win');
          timer = setTimeout(render, 750);
        } else {
          mistakes++;
          locked = true;
          built.classList.add('wrong');
          Sound.play('wrong');
          timer = setTimeout(function () {
            answer.forEach(function (item) { item.used = false; });
            answer = [];
            UI.clear(built);
            built.classList.remove('wrong');
            tray.querySelectorAll('button').forEach(function (button) { button.disabled = false; });
            locked = false;
          }, 650);
        }
      }
    }
    newSession();
    return function cleanup() { if (timer) clearTimeout(timer); };
  }

  App.register({
    id: 'wordbuild', ages: ['school'], emoji: '🔠',
    titleKey: 'game.wordbuild', descKey: 'game.wordbuild.desc', start: start
  });
})(window);
