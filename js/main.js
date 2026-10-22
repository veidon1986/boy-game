/* main.js — запуск приложения и регистрация service worker. */
(function (global) {
  'use strict';

  // Обновлять при выпуске набора новых игр.
  var RELEASE_NOTICE_VERSION = '2026-10-18-1';

  function notifyReleaseIfNeeded() {
    if (App.demoMode || !('Notification' in window) || Notification.permission !== 'granted' ||
        Store.get('notificationsEnabled', false) !== true) return;
    if (Store.get('releaseNoticeVersion', '') === RELEASE_NOTICE_VERSION) return;
    Store.set('releaseNoticeVersion', RELEASE_NOTICE_VERSION);
    try {
      new Notification(I18N.getLang() === 'ru' ? 'Новые игры!' : 'New games!', {
        body: I18N.getLang() === 'ru' ? 'Загляни в приложение — появились новые игры.' : 'Open the app to discover new games.',
        icon: 'icons/icon-192.png'
      });
    } catch (e) { /* уведомления могут быть недоступны в этом режиме браузера */ }
  }

  function setupServiceWorker() {
    if (!('serviceWorker' in navigator) ||
        (location.protocol !== 'http:' && location.protocol !== 'https:')) return;

    navigator.serviceWorker.register('sw.js').then(function (registration) {
      var prompted = false;
      function offerUpdate() {
        if (prompted || !registration.waiting) return;
        prompted = true;
        App.updateAvailable = true;
        if (App.mode === 'home' && App.els.overlay.classList.contains('hidden')) App.showUpdatePrompt();
        else App._updatePromptDeferred = true;
      }
      if (registration.waiting && navigator.serviceWorker.controller) offerUpdate();
      registration.addEventListener('updatefound', function () {
        var worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', function () {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) offerUpdate();
        });
      });
      registration.update().catch(function () {});
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') registration.update().catch(function () {});
      });
    }).catch(function () { /* офлайн-режим недоступен */ });

    var reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (reloading) return;
      reloading = true;
      location.reload();
    });
  }

  function boot() {
    App.releaseNoticeVersion = RELEASE_NOTICE_VERSION;
    App.init();
    var splash = document.getElementById('startupSplash');
    if (splash) {
      splash.querySelector('[data-splash-title]').textContent = t('splash.title');
      splash.querySelector('[data-splash-subtitle]').textContent = t('splash.subtitle');
      document.getElementById('skipSplashBtn').textContent = t('splash.skip');
      var dismissed = false;
      var timer;
      function dismissSplash() {
        if (dismissed) return;
        dismissed = true;
        clearTimeout(timer);
        splash.classList.add('is-leaving');
        setTimeout(function () { splash.remove(); }, 500);
      }
      document.getElementById('skipSplashBtn').addEventListener('click', dismissSplash);
      timer = setTimeout(dismissSplash, 2200);
    }
    if (!App.demoMode) notifyReleaseIfNeeded();
    setupServiceWorker();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
