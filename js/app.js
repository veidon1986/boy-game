/* app.js — каркас приложения: профиль, главный экран, игры, награды, язык. */
(function (global) {
  'use strict';

  var el = UI.el;
  var games = GameCatalog.list.map(function (meta) {
    var game = {};
    Object.keys(meta).forEach(function (key) { game[key] = meta[key]; });
    return game;
  });
  var loader = GameLoader.create();
  var localTestHost = global.location && (
    global.location.hostname === 'localhost' ||
    global.location.hostname === '127.0.0.1' ||
    global.location.hostname === '::1' ||
    global.location.hostname === '[::1]'
  );
  var demoMode = !!(localTestHost && global.location.search && /(?:^|[?&])test=1(?:&|$)/.test(global.location.search));

  var App = {
    games: games,
    demoMode: demoMode,
    mode: 'home',      // 'home' | 'loading' | 'game' | 'achievements' | 'admin'
    current: null,     // id активной игры
    cleanup: null,     // функция очистки активной игры
    session: null,
    els: {}
  };
  if (demoMode && global.Store && global.Store.setReadOnly) global.Store.setReadOnly(true);

  App.register = function (id, start) {
    // Совместимость с прежней сигнатурой register({ id, start }).
    if (id && typeof id === 'object') { start = id.start; id = id.id; }
    var meta = GameCatalog.get(id);
    if (!meta || typeof start !== 'function') throw new Error('Invalid game registration: ' + id);
    var game = gameById(id);
    if (game.start) throw new Error('Duplicate game registration: ' + id);
    game.start = start;
  };

  App.validateGames = function (requireLoaded) {
    GameCatalog.validate(GameCatalog.list);
    GameCatalog.list.forEach(function (meta) {
      if (requireLoaded && typeof gameById(meta.id).start !== 'function') throw new Error('Game module not registered: ' + meta.id);
      Object.keys(I18N.strings).forEach(function (lang) {
        [meta.titleKey, meta.descKey].forEach(function (key) {
          if (typeof I18N.strings[lang][key] !== 'string') throw new Error('Missing translation: ' + lang + ':' + key);
        });
      });
    });
    return true;
  };

  function gameById(id) {
    for (var i = 0; i < games.length; i++) if (games[i].id === id) return games[i];
    return null;
  }
  App.gameById = gameById;

  // Возраст активного ребёнка.
  App.age = function () {
    var p = Store.profile();
    return Ages.normalize(p && p.age);
  };

  // Игры, подходящие возрасту активного ребёнка.
  App.ageGames = function () {
    var age = App.age();
    return games.filter(function (g) {
      return !g.ages || g.ages.indexOf(age) >= 0;
    });
  };
  App.visibleGames = function () {
    return App.demoMode ? games.slice() : App.ageGames();
  };

  App.gameAccess = function (id, mode) {
    return GameCatalog.access(id, App.age(), Achievements.hasRank, App.demoMode, mode);
  };

  App.gameLevels = function (id) {
    var game = GameCatalog.get(id);
    return game ? Ages.levels(App.age()).filter(function (level) { return game.levels.indexOf(level) >= 0; }) : [];
  };

  App.requireGameAccess = function (id, mode) {
    var access = App.gameAccess(id, mode);
    if (access.allowed) return true;
    if (access.reason === 'rank') App.showLocked({ requires: access.requires });
    else App.toast(t('game.unavailable'));
    return false;
  };

  App.pauseGame = function () { App.sampleTime(); return !!(App.session && App.session.pause()); };
  App.resumeGame = function () { App.sampleTime(); return !!(App.session && App.session.resume()); };

  // Число игр со звёздами для текущего возраста (аркады вроде «Дракончика» не в счёт).
  function scoringGames() {
    var list = App.ageGames();
    var n = 0;
    for (var i = 0; i < list.length; i++) if (!list[i].noStars) n++;
    return n;
  }

  /* ---------- Верхняя панель ---------- */

  function refreshTopbar() {
    if (App.mode === 'game' || App.mode === 'loading') {
      App.els.title.textContent = t(gameById(App.current).titleKey);
    } else if (App.mode === 'achievements') {
      App.els.title.textContent = t('ach.screen.title');
    } else if (App.mode === 'admin') {
      App.els.title.textContent = t('analytics.adminTitle');
    } else {
      App.els.title.textContent = t('app.title');
    }
    App.els.homeBtn.classList.toggle('hidden', App.mode === 'home');
    App.els.musicBtn.textContent = Sound.isMusicEnabled() ? '🎵' : '🎼';
    App.els.musicBtn.setAttribute('aria-pressed', Sound.isMusicEnabled() ? 'true' : 'false');
    App.els.musicBtn.setAttribute('aria-label', t(Sound.isMusicEnabled() ? 'music.on' : 'music.off'));
    App.els.soundBtn.textContent = Sound.isEnabled() ? '🔊' : '🔇';
    App.els.langBtn.textContent = I18N.getLang().toUpperCase();
    Sound.setMusicContext(App.mode === 'home' ? 'menu' : App.mode === 'game' ? App.current : 'pause');
  }

  function stopCurrent() {
    App.sampleTime();
    App.launchId = (App.launchId || 0) + 1;
    Store.flush();
    var cleanup = App.cleanup;
    App.cleanup = null;
    App.session = null;
    if (cleanup) { try { cleanup(); } catch (e) { console.error('Game cleanup failed', e); } }
  }

  /* ---------- Запуск игры ---------- */

  App.startGame = function (id) {
    var game = gameById(id);
    if (!game || !App.requireGameAccess(id)) return Promise.resolve(false);
    if (!App.canPlay()) { App.showBlocked(); return Promise.resolve(false); }
    stopCurrent();
    var launch = App.launchId;
    var profile = Store.activeId();
    App.mode = 'loading';
    App.current = id;
    refreshTopbar();
    var screen = App.els.screen;
    UI.clear(screen);
    screen.scrollTop = 0;
    screen.appendChild(el('p', { class: 'game-stats' }, t('game.loading')));
    return Store.prepareHistory().then(function () {
      if (launch !== App.launchId || profile !== Store.activeId()) return false;
      return game.start ? true : loader.load(game).then(function () { return true; });
    }).then(function (loaded) {
      if (!loaded) return false;
      if (launch !== App.launchId || profile !== Store.activeId()) return false;
      if (!App.gameAccess(id).allowed || !App.canPlay()) { App.renderHome(); return false; }
      UI.clear(screen);
      App.sampleTime();
      App.mode = 'game';
      if (typeof game.start !== 'function') throw new Error('Game module did not register: ' + id);
      App.session = GameSession.start(game, screen, App);
      App.cleanup = App.session.destroy;
      if (!App.demoMode) Analytics.recordLaunch(id);
      return true;
    }).catch(function (e) {
      if (launch !== App.launchId) return false;
      console.error('Game start failed: ' + id, e);
      App.renderHome();
      App.toast(t('game.startFailed'));
      return false;
    });
  };

  App.goHome = function () {
    Sound.play('tap');
    App.renderHome();
  };

  App.showUpdatePrompt = function () {
    if (!App.updateAvailable || App.mode !== 'home' || !App.els.overlay.classList.contains('hidden')) return;
    App._updatePromptDeferred = false;
    var body = el('div', { class: 'onboarding' }, [
      el('div', { class: 'onboarding-emoji' }, '✨'),
      el('div', { class: 'onboarding-title' }, t('update.title')),
      el('p', { class: 'result-text' }, t('update.body')),
      el('p', { class: 'result-note' }, t('update.cacheNote')),
      el('div', { class: 'result-actions' }, [
        el('button', { type: 'button', class: 'btn', onclick: function () { Sound.play('tap'); App.hideOverlay(); } }, t('update.later')),
        el('button', { type: 'button', class: 'btn primary', onclick: function () {
          Sound.play('tap');
          App.hideOverlay();
          App.checkpointTime();
          Store.flush().then(function () { return navigator.serviceWorker.getRegistration(); }).then(function (registration) {
            if (registration && registration.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          });
        } }, t('update.now'))
      ])
    ]);
    App.showOverlay(body);
  };

  /* ---------- Инициализация ---------- */

  App.init = function () {
    App.validateGames();
    App.els.title = document.getElementById('title');
    App.els.homeBtn = document.getElementById('homeBtn');
    App.els.musicBtn = document.getElementById('musicBtn');
    App.els.soundBtn = document.getElementById('soundBtn');
    App.els.langBtn = document.getElementById('langBtn');
    App.els.screen = document.getElementById('screen');
    App.els.overlay = document.getElementById('overlay');
    App.els.toast = document.getElementById('toast');

    I18N.setLang(Store.get('lang', 'ru'));

    App.els.homeBtn.addEventListener('click', function () { App.goHome(); });

    App.els.musicBtn.addEventListener('click', function () {
      var on = Sound.setMusicEnabled(!Sound.isMusicEnabled());
      refreshTopbar();
      Sound.play('tap');
      App.toast(t(on ? 'music.on' : 'music.off'), 1200);
    });

    App.els.langBtn.addEventListener('click', function () {
      var next = I18N.getLang() === 'ru' ? 'en' : 'ru';
      I18N.setLang(next);
      Store.set('lang', next);
      Sound.play('tap');
      if (App.mode === 'game') App.startGame(App.current);
      else if (App.mode === 'achievements') App.openAchievements();
      else if (App.mode === 'admin') App.openAdmin();
      else App.renderHome();
      refreshTopbar();
    });

    App.els.soundBtn.addEventListener('click', function () {
      var on = Sound.setEnabled(!Sound.isEnabled());
      refreshTopbar();
      if (on) Sound.play('tap');
      App.toast(on ? t('sound.on') : t('sound.off'), 1200);
    });



    var unlock = function () {
      Sound.unlock();
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
    };
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', unlock);

    // Админка по URL-хешу: #admin
    function checkAdminHash() {
      var h = location.hash;
      if (!h) return;
      if (h === '#admin') {
        try {
          history.replaceState(null, document.title, location.pathname + location.search);
        } catch (e) {}
        if (App.isAdmin()) {
          App.openAdmin();
        } else {
          App.showAdminAuth();
        }
      }
    }
    window.addEventListener('hashchange', checkAdminHash);

    App.startUsageClock();

    App.renderHome();
    if (location.hash === '#admin') {
      // Применяем маршрут после главного экрана, иначе renderHome
      // перезаписывает открытую админку при уже активной сессии.
      checkAdminHash();
    } else if (!Store.profile()) {
      App.showOnboarding();
    } else if (!App.requestInitialPermissions()) {
      App.maybeShowInstallHint(700);
    }
  };

  App.refreshTopbar = refreshTopbar;
  App.stopCurrent = stopCurrent;
  App.scoringGames = scoringGames;
  global.App = App;
})(window);
