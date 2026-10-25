/* app/admin.js — интерфейс и действия раздела. */
(function (global) {
  'use strict';
  var App = global.App;
  var el = UI.el;
  var refreshTopbar = App.refreshTopbar;

  /* ---------- Админ-панель (только администратор) ---------- */

  var ADMIN_PASS = 'boygame-admin';
  var ADMIN_KEY = 'boygame.adminUntil';

  function isAdmin() {
    var v = Store.get(ADMIN_KEY, 0);
    return !!v && Date.now() < Number(v);
  }

  function adminLogin(pass) {
    if (pass === ADMIN_PASS) {
      Store.set(ADMIN_KEY, Date.now() + 60 * 60 * 1000);
      return true;
    }
    return false;
  }

  function adminLogout() {
    Store.remove(ADMIN_KEY);
  }

  App.isAdmin = isAdmin;

  App.showAdminAuth = function () {
    var passInput = UI.el('input', {
      class: 'name-input',
      type: 'password',
      autocomplete: 'current-password',
      placeholder: 'Пароль администратора'
    });
    var body = UI.el('div', { class: 'onboarding' }, [
      UI.el('div', { class: 'onboarding-emoji' }, '🔐'),
      UI.el('div', { class: 'onboarding-title' }, 'Админ-панель'),
      UI.el('label', { class: 'field-label' }, 'Введите пароль'),
      passInput,
      UI.el('div', { class: 'result-actions' }, [
        UI.el('button', { type: 'button', class: 'btn', onclick: function () { Sound.play('tap'); App.hideOverlay(); } }, t('profile.cancel')),
        UI.el('button', { type: 'button', class: 'btn primary', onclick: function () {
          Sound.play('tap');
          if (adminLogin(passInput.value)) {
            App.hideOverlay();
            App.openAdmin();
          } else {
            passInput.value = '';
            App.toast('Неверный пароль', 1600);
          }
        } }, 'Войти')
      ])
    ]);
    App.showOverlay(body);
    setTimeout(function () { try { passInput.focus(); } catch (e) {} }, 50);
  };

  App.openAdmin = function () {
    if (!isAdmin()) { App.showAdminAuth(); return; }
    App.stopCurrent();
    App.mode = 'admin';
    App.current = null;
    if (typeof refreshTopbar === 'function') refreshTopbar();
    var screen = App.els.screen;
    UI.clear(screen);
    screen.scrollTop = 0;
    var wrap = UI.el('div', { class: 'ach-screen' });
    wrap.appendChild(el('div', { class: 'onboarding-title' }, t('analytics.adminTitle')));
    if (!Analytics.configured()) {
      wrap.appendChild(el('p', { class: 'result-text' }, t('analytics.adminNotConfigured')));
      screen.appendChild(wrap);
      return;
    }

    var tokenInput = el('input', { class: 'name-input', type: 'password', autocomplete: 'current-password', placeholder: t('analytics.adminToken') });
    var status = el('p', { class: 'result-note' }, t('analytics.adminHint'));
    var stats = el('div', { class: 'analytics-results' });

    function loadStats() {
      status.textContent = t('analytics.loading');
      Analytics.getStats(tokenInput.value).then(function (data) {
        UI.clear(stats);
        status.textContent = t('analytics.statsUpdated', { day: data.day, tz: data.timezone });
        var cards = el('div', { class: 'analytics-metric-grid' }, [
          el('div', { class: 'analytics-metric' }, [el('span', { class: 'analytics-metric-value' }, data.newPlayersToday), el('span', { class: 'analytics-metric-label' }, t('analytics.newToday'))]),
          el('div', { class: 'analytics-metric' }, [el('span', { class: 'analytics-metric-value' }, data.activePlayersToday), el('span', { class: 'analytics-metric-label' }, t('analytics.activeToday'))]),
          el('div', { class: 'analytics-metric' }, [el('span', { class: 'analytics-metric-value' }, data.totalPlayers), el('span', { class: 'analytics-metric-label' }, t('analytics.totalPlayers'))])
        ]);
        stats.appendChild(cards);
        stats.appendChild(el('div', { class: 'analytics-section-title' }, t('analytics.popularGames', { days: data.gameLaunchesDays })));
        if (!data.popularGames.length) {
          stats.appendChild(el('p', { class: 'result-note' }, t('analytics.noGames')));
        } else {
          var table = el('div', { class: 'analytics-game-list' });
          data.popularGames.forEach(function (item, index) {
            var game = App.gameById(item.gameId);
            var label = game ? t(game.titleKey) : item.gameId;
            table.appendChild(el('div', { class: 'analytics-game-row' }, [
              el('span', { class: 'analytics-game-rank' }, index + 1),
              el('span', { class: 'analytics-game-name' }, label),
              el('span', { class: 'analytics-game-count' }, item.launches)
            ]));
          });
          stats.appendChild(table);
        }
      }).catch(function (error) {
        status.textContent = t(error.message === 'unauthorized' ? 'analytics.adminUnauthorized' : 'analytics.adminUnavailable');
        UI.clear(stats);
      });
    }

    wrap.appendChild(el('p', { class: 'result-note' }, t('analytics.adminPrivacy')));
    wrap.appendChild(el('label', { class: 'field-label' }, t('analytics.adminToken')));
    wrap.appendChild(tokenInput);
    wrap.appendChild(el('button', { type: 'button', class: 'btn primary analytics-load-button', onclick: loadStats }, t('analytics.loadStats')));
    wrap.appendChild(status);
    wrap.appendChild(stats);
    screen.appendChild(wrap);
  };


})(window);
