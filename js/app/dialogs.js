/* app/dialogs.js — интерфейс и действия раздела. */
(function (global) {
  'use strict';
  var App = global.App;
  var el = UI.el;

  /* ---------- Оверлей и тост ---------- */

  App.showOverlay = function (content) {
    App.sampleTime();
    var ov = App.els.overlay;
    UI.clear(ov);
    ov.appendChild(el('div', { class: 'overlay-card' }, content));
    ov.classList.remove('hidden');
  };

  App.hideOverlay = function () {
    App.sampleTime();
    App.els.overlay.classList.add('hidden');
    if (App._updatePromptDeferred && App.mode === 'home') setTimeout(App.showUpdatePrompt, 0);
  };

  function isStandalone() {
    try {
      return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
             (window.navigator.standalone === true) ||
             (document.referrer && document.referrer.indexOf('android-app://') === 0);
    } catch (e) { return false; }
  }

  function getPlatform() {
    var ua = navigator.userAgent || '';
    var isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    var isAndroid = /Android/i.test(ua);
    if (isIOS) return 'ios';
    if (isAndroid) return 'android';
    return 'desktop';
  }

  // Всплывающее окно с подсказкой установки PWA (умный текст по платформе).
  App.showInstallHint = function (force) {
    try {
      if (!force) {
        if (isStandalone()) return;
        if (Store.get('installNever', '0') === '1') return;
      }
    } catch (e) { return; }

    var p = getPlatform();
    var installText = '';
    if (p === 'android') installText = t('install.android');
    else if (p === 'ios') installText = t('install.ios');
    else installText = t('install.desktop');

    var body = el('div', { class: 'onboarding install-modal' }, [
      el('div', { class: 'onboarding-emoji' }, '📲'),
      el('div', { class: 'onboarding-title' }, t('install.title')),
      el('div', { class: 'install-modal-text' }, installText),
      el('div', { class: 'result-actions' }, [
        el('button', {
          type: 'button', class: 'btn',
          onclick: function () { Sound.play('tap'); Store.set('installNever', '1'); App.hideOverlay(); }
        }, t('install.never')),
        el('button', {
          type: 'button', class: 'btn primary',
          onclick: function () { Sound.play('tap'); App.hideOverlay(); }
        }, t('install.dismiss'))
      ])
    ]);
    App.showOverlay(body);
  };

  // Показать окно установки один раз за сеанс, когда есть профиль и нет других окон.
  App._installHintShown = false;
  App.maybeShowInstallHint = function (delay) {
    if (App.demoMode) return;
    if (App._installHintShown) return;
    if (!Store.profile()) return;
    if (!App.els.overlay.classList.contains('hidden')) return;
    App._installHintShown = true;
    setTimeout(function () { App.showInstallHint(); }, delay || 0);
  };

  var toastTimer = null;
  App.toast = function (msg, ms) {
    var node = App.els.toast;
    node.textContent = msg;
    node.classList.remove('hidden');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { node.classList.add('hidden'); }, ms || 1800);
  };

})(window);
