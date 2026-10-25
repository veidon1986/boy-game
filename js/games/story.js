/* games/story.js — расставь события короткой истории по порядку. */
(function (global) {
  'use strict';

  var el = UI.el;
  var STORIES = [
    ['🌱', '💧', '🌿', '🌷'], ['🥚', '🐣', '🐥', '🐔'],
    ['🌧️', '☁️', '🌈', '☀️'], ['🧼', '👐', '🍽️', '😋'],
    ['🛏️', '🌞', '👕', '🍎'], ['🧺', '🧦', '🧼', '☀️'],
    ['🐛', '🍃', '🦋', '🌸'], ['☁️', '❄️', '⛄', '🌷'],
    ['🌰', '🌱', '🌿', '🌳', '🍎'], ['🐣', '🐥', '🐔', '🥚', '🪺'],
    ['🌧️', '💧', '🌱', '🌷', '☀️'], ['🧑', '🪥', '🧼', '👐', '😊'],
    ['🐶', '🦴', '🍽️', '😋', '🛏️'], ['🧺', '👕', '🧼', '☀️', '👚'],
    ['🐛', '🍃', '🛡️', '🦋', '🌸'], ['❄️', '⛄', '🌤️', '💧', '🌷'],
    ['🌱', '🌞', '💧', '🌿', '🌻'], ['🥕', '🐰', '🏠', '🥣', '😋'],
    ['☁️', '🌧️', '🌊', '🌤️', '🌈'], ['🐚', '🥚', '🐣', '🐥', '🪺'],
    ['🛏️', '⏰', '🧦', '👕', '🍎'], ['🍎', '🧺', '🚿', '🔪', '🥧']
  ];

  function start(root, App) {
    var age = App.age();
    var level = 'easy';
    var round = 0;
    var firstTry = 0;
    var timer = null;
    var TOTAL = 5;
    var storyGenerator = UI.uniqueGenerator(function () {
      var length = level === 'easy' ? 3 : (level === 'medium' ? 4 : 5);
      return UI.pick(STORIES).slice(0, length);
    }, function (story) { return story.join(','); }, 120, 'story', function () {
      var length = level === 'easy' ? 3 : (level === 'medium' ? 4 : 5);
      return STORIES.map(function (story) { return story.slice(0, length); });
    });
    var stats = el('div', { class: 'game-stats' });
    var stage = el('div', { class: 'story-stage' });
    var difficulty = UI.segmented(App.gameLevels('story').map(function (lv) {
      return { value: lv, label: t('common.' + lv) };
    }), level, function (v) { level = v; newSession(); });
    root.appendChild(el('p', { class: 'game-hint' }, t('game.story.hint')));
    root.appendChild(difficulty);
    root.appendChild(stats);
    root.appendChild(stage);

    function newSession() {
      if (timer) { clearTimeout(timer); timer = null; }
      round = 0; firstTry = 0; render();
    }
    function render() {
      if (round >= TOTAL) {
        App.finishGame('story', Math.max(1, Math.round(firstTry / TOTAL * 3)), newSession, null, level);
        return;
      }
      round++;
      stats.textContent = t('common.round') + ' ' + round + ' ' + t('common.of') + ' ' + TOTAL;
      UI.clear(stage);
      var story = storyGenerator();
      if (!story) { UI.showTaskPoolExhausted(root, App, storyGenerator); return; }
      var correctOrder = story.slice();
      var shuffled = UI.shuffle(story);
      var selected = [];
      var mistakes = 0;
      var tray = el('div', { class: 'story-tray' });
      var answer = el('div', { class: 'story-answer' });
      var slots = [];
      correctOrder.forEach(function (_, index) {
        var slot = el('span', {
          class: 'story-slot',
          'aria-label': t('game.story.position', { n: index + 1 })
        }, '·');
        slots.push(slot);
        answer.appendChild(slot);
      });
      stage.appendChild(tray);
      stage.appendChild(el('div', { class: 'story-arrow' }, '👇'));
      stage.appendChild(answer);
      shuffled.forEach(function (item, idx) {
        var button = el('button', {
          type: 'button', class: 'story-card',
          onclick: function () {
            if (button.disabled) return;
            button.disabled = true;
            selected.push(item);
            var slot = slots[selected.length - 1];
            slot.textContent = item;
            slot.classList.add('filled');
            if (item !== correctOrder[selected.length - 1]) {
              mistakes++;
              slot.classList.add('wrong');
            } else {
              slot.classList.add('correct');
            }
            Sound.play('tap');
            if (selected.length === correctOrder.length) {
              if (!mistakes) firstTry++;
              Sound.play(mistakes ? 'wrong' : 'win');
              timer = setTimeout(render, 750);
            }
          }
        }, item);
        button.dataset.order = String(idx);
        tray.appendChild(button);
      });
    }
    newSession();
    return function cleanup() { if (timer) clearTimeout(timer); };
  }

  App.register('story', start);
})(window);
