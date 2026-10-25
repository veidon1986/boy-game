/* app/play-time.js — лимиты и сохранение времени при переходах и уходе в фон. */
(function (global) {
  'use strict';
  var App = global.App;
  App.sampleTime = function () { if (App.timeCounter) App.timeCounter.sample(); };
  App.checkpointTime = function () { if (App.timeCounter) App.timeCounter.checkpoint(); else Store.flush(); };
  App.startUsageClock = function () {
    if (App.timeCounter) return;
    App.timeCounter = PlayTime.create({
      now: function () { return Date.now(); },
      visible: function () { return document.visibilityState !== 'hidden'; },
      active: function () {
        return App.mode === 'game' && Store.limitMinutes() > 0 &&
          App.els.overlay.classList.contains('hidden') && !(App.session && App.session.isPaused());
      },
      add: Store.addUsage,
      flush: Store.flush
    });
    document.addEventListener('visibilitychange', function () { App.timeCounter.visibility(); });
    global.addEventListener('pagehide', function () { App.timeCounter.suspend(); });
    global.addEventListener('pageshow', function () { App.timeCounter.visibility(); });
    // Дневной лимит: считаем только время активной игры (без окон).
    App.warnDay = null;
    App.warned5 = false;
    App.warned1 = false;
    App.blockedDay = null;
    setInterval(function () {
      App.timeCounter.sample();
      if (Store.limitMinutes() <= 0) return;

      var rem = Store.remainingSeconds();

      // Обновляем чип остатка на главной.
      if (App.mode === 'home' && App.els.timeChipText) {
        App.els.timeChipText.textContent = App.fmtTime(rem);
        if (App.els.timeChip) App.els.timeChip.classList.toggle('home-badge-alert', rem <= 0);
      }

      // Предупреждения во время игры.
      if (App.mode === 'game') {
        var u = Store.usage();
        if (App.warnDay !== u.day) { App.warnDay = u.day; App.warned5 = false; App.warned1 = false; }
        if (!App.warned5 && rem <= 300 && rem > 60) { App.warned5 = true; App.toast('⏳ ' + t('limit.warn5'), 2500); }
        if (!App.warned1 && rem <= 60 && rem > 0) { App.warned1 = true; App.toast('⏳ ' + t('limit.warn1'), 2500); }
      }

      // Время вышло на главной — показать баннер один раз.
      if (App.mode === 'home' && rem <= 0 && App.blockedDay !== Store.usage().day) {
        App.blockedDay = Store.usage().day;
        App.renderHome();
      }
    }, 1000);

  };
})(window);
