/* app/rewards.js — интерфейс и действия раздела. */
(function (global) {
  'use strict';
  var App = global.App;
  var el = UI.el;
  var refreshTopbar = App.refreshTopbar;
  var stopCurrent = App.stopCurrent;

  /* ---------- Экран наград ---------- */

  App.openAchievements = function () {
    stopCurrent();
    App.mode = 'achievements';
    App.current = null;
    refreshTopbar();

    var screen = App.els.screen;
    UI.clear(screen);
    screen.scrollTop = 0;

    var r = Achievements.rank();
    var list = Achievements.all();

    var wrap = el('div', { class: 'ach-screen' });
    wrap.appendChild(el('div', { class: 'ach-rank' }, [
      el('span', { class: 'ach-rank-icon' }, r.icon),
      el('span', { class: 'ach-rank-name' }, t('home.rankLabel') + ': ' + r.name)
    ]));
    wrap.appendChild(el('div', { class: 'ach-progress' },
      t('ach.progress', { got: Achievements.count(), total: Achievements.total() })));

    var grid = el('div', { class: 'ach-grid' });
    list.forEach(function (a) {
      grid.appendChild(el('div', { class: 'ach-card' + (a.unlocked ? ' unlocked' : ' locked') }, [
        el('div', { class: 'ach-icon' }, a.unlocked ? a.icon : '🔒'),
        el('div', { class: 'ach-body' }, [
          el('div', { class: 'ach-card-title' }, a.title),
          el('div', { class: 'ach-card-desc' }, a.unlocked ? a.desc : t('ach.locked'))
        ])
      ]));
    });
    wrap.appendChild(grid);
    screen.appendChild(wrap);
  };

  /* ---------- Награды после игры ---------- */

  App.showAchievements = function (list, onDone) {
    var title = list.length > 1 ? t('ach.newMultiple') : t('ach.new');
    var rows = list.map(function (a) {
      return el('div', { class: 'ach-reward-item' }, [
        el('span', { class: 'ach-reward-item-icon' }, a.icon),
        el('span', { class: 'ach-reward-item-title' }, a.title)
      ]);
    });
    var body = el('div', { class: 'ach-reward' }, [
      el('div', { class: 'ach-reward-icon' }, list[0].icon),
      el('div', { class: 'ach-reward-title' }, title),
      el('div', { class: 'ach-reward-list' }, rows),
      el('button', {
        type: 'button', class: 'btn primary wide',
        onclick: function () { Sound.play('tap'); App.hideOverlay(); if (onDone) onDone(); }
      }, '🎉 ' + t('ach.ok'))
    ]);
    Sound.play('win');
    App.showOverlay(body);
  };

  /* ---------- Завершение игры ---------- */

  // stars: 1..3, replay: перезапуск, note: подпись, level: сложность для статистики
  App.finishGame = function (id, stars, replay, note, level, nextLevel) {
    if (App.mode !== 'game' || App.current !== id) return;
    stars = Math.max(1, Math.min(3, stars));
    Store.recordResult(id, stars, level);
    Sound.play('win');

    var emoji = stars >= 3 ? '🏆' : (stars === 2 ? '🎉' : '👍');
    var praise = stars >= 3 ? t('common.great') : (stars === 2 ? t('common.wellDone') : t('common.keepGoing'));

    function showResult() {
      var actions = [
        el('button', {
          type: 'button', class: 'btn primary',
          onclick: function () {
            App.hideOverlay();
            if (!App.canPlay()) { App.showBlocked(); return; }
            if (replay) replay();
          }
        }, '🔁 ' + t('common.again'))
      ];
      if (nextLevel && nextLevel.level && typeof nextLevel.start === 'function') {
        actions.push(el('button', {
          type: 'button', class: 'btn primary next-level-btn',
          onclick: function () {
            App.hideOverlay();
            if (!App.canPlay()) { App.showBlocked(); return; }
            nextLevel.start();
          }
        }, '➡️ ' + t('level.try', { name: t('common.' + nextLevel.level) })));
      }
      actions.push(el('button', {
        type: 'button', class: 'btn',
        onclick: function () { App.hideOverlay(); App.goHome(); }
      }, '🏠 ' + t('home')));

      var body = el('div', { class: 'result' }, [
        el('div', { class: 'result-emoji' }, emoji),
        el('div', { class: 'result-title' }, praise),
        UI.starsRow(stars, 3),
        el('p', { class: 'result-text' }, t('common.result.stars', { n: stars })),
        note ? el('p', { class: 'result-note' }, note) : null,
        el('div', { class: 'result-actions' + (nextLevel ? ' has-next-level' : '') }, actions)
      ]);
      App.showOverlay(body);
    }

    var newly = Achievements.checkNew(id, level);
    if (newly.length) App.showAchievements(newly, showResult);
    else showResult();
  };

})(window);
