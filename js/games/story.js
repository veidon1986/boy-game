/* games/story.js — расставь события короткой истории по порядку. */
(function (global) {
  'use strict';

  var el = UI.el;
  var STORIES = [
    ['🌱', '💧', '🌿', '🌷'], ['🥚', '🐣', '🐥', '🐔'],
    ['🌧️', '☁️', '🌈', '☀️'], ['🧼', '👐', '🍽️', '😋'],
    ['🛏️', '🌞', '👕', '🍎'], ['🧺', '🧦', '🧼', '☀️'],
    ['🐛', '🍃', '🦋', '🌸'], ['☁️', '❄️', '⛄', '🌷']
  ];

  function start(root, App) {
    var age = App.age();
    var level = 'easy';
    var round = 0;
    var firstTry = 0;
    var timer = null;
    var TOTAL = 5;
    var stats = el('div', { class: 'game-stats' });
    var stage = el('div', { class: 'story-stage' });
    var difficulty = UI.segmented(Ages.levels(age).map(function (lv) {
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
      var length = level === 'easy' ? 3 : (level === 'medium' ? 4 : 5);
      var story = STORIES[(round - 1) % STORIES.length].slice(0, length);
      var correctOrder = story.slice();
      var shuffled = UI.shuffle(story);
      var selected = [];
      var mistakes = 0;
      var tray = el('div', { class: 'story-tray' });
      var answer = el('div', { class: 'story-answer' });
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
            answer.appendChild(el('span', { class: 'story-picked' }, item));
            if (item !== correctOrder[selected.length - 1]) mistakes++;
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

  App.register({
    id: 'story', ages: ['preschool'], emoji: '📖',
    titleKey: 'game.story', descKey: 'game.story.desc', start: start
  });
})(window);
