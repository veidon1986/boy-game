/* app/privacy.js — интерфейс и действия раздела. */
(function (global) {
  'use strict';
  var App = global.App;
  var el = UI.el;

  App.showAnalyticsConsent = function () {
    var children = [
      el('div', { class: 'onboarding-emoji' }, '📊'),
      el('div', { class: 'onboarding-title' }, t('analytics.consentTitle')),
      el('p', { class: 'result-text' }, t('analytics.consentDetails')),
      el('p', { class: 'result-note' }, t('analytics.consentOptional'))
    ];
    if (Analytics.privacyUrl) {
      children.push(el('a', { class: 'analytics-privacy-link', href: Analytics.privacyUrl, target: '_blank', rel: 'noopener noreferrer' }, t('analytics.privacyLink')));
    }
    children.push(el('div', { class: 'result-actions' }, [
      el('button', { type: 'button', class: 'btn', onclick: function () { App.hideOverlay(); } }, t('analytics.notNow')),
      el('button', { type: 'button', class: 'btn primary', onclick: function () {
        Store.set('analyticsEnabled', true);
        Store.set('analyticsConsentVersion', 'analytics-v1');
        Store.set('analyticsConsentAt', new Date().toISOString());
        Store.set('analyticsDeletePending', false);
        App.hideOverlay();
        App.toast(t('analytics.enabled'), 2200);
        App.showParentSettings();
      } }, t('analytics.accept'))
    ]));
    App.showOverlay(el('div', { class: 'onboarding' }, children));
  };

  App.showAnalyticsRevoke = function () {
    var body = el('div', { class: 'onboarding' }, [
      el('div', { class: 'onboarding-title' }, t('analytics.revokeTitle')),
      el('p', { class: 'result-text' }, t('analytics.revokeDetails')),
      el('div', { class: 'result-actions' }, [
        el('button', { type: 'button', class: 'btn', onclick: function () { App.hideOverlay(); } }, t('analytics.cancel')),
        el('button', { type: 'button', class: 'btn primary', onclick: function () {
          Analytics.revoke().then(function () {
            App.hideOverlay();
            App.toast(t('analytics.deleted'), 2200);
            App.showParentSettings();
          }).catch(function () {
            App.hideOverlay();
            App.toast(t('analytics.deleteFailed'), 3000);
            App.showParentSettings();
          });
        } }, t('analytics.revokeButton'))
      ])
    ]);
    App.showOverlay(body);
  };

  App.showPermissionsConsent = function (flow) {
    flow = flow || {};
    var analyticsAvailable = Analytics.configured();
    var notificationsAvailable = 'Notification' in window;
    var analyticsBox = el('input', { type: 'checkbox', disabled: !analyticsAvailable });
    var notificationsBox = el('input', {
      type: 'checkbox',
      disabled: !notificationsAvailable || (notificationsAvailable && Notification.permission === 'denied')
    });
    analyticsBox.checked = Analytics.consented();
    notificationsBox.checked = Store.get('notificationsEnabled', false) === true &&
      (!notificationsAvailable || Notification.permission !== 'denied');

    var content = [
      el('div', { class: 'onboarding-emoji' }, '🔐'),
      el('div', { class: 'onboarding-title' }, t('permissions.title')),
      el('p', { class: 'result-text' }, t('permissions.intro'))
    ];

    if (analyticsAvailable) {
      content.push(el('label', { class: 'permission-option' }, [
        analyticsBox,
        el('span', { class: 'permission-option-text' }, [
          el('strong', {}, t('analytics.title')),
          el('span', {}, t('analytics.consentDetails'))
        ])
      ]));
    } else {
      content.push(el('p', { class: 'result-note' }, t('permissions.analyticsUnavailable')));
    }

    if (Analytics.configured() && Analytics.privacyUrl) {
      content.push(el('a', {
        class: 'analytics-privacy-link',
        href: Analytics.privacyUrl,
        target: '_blank',
        rel: 'noopener noreferrer'
      }, t('analytics.privacyLink')));
    }

    content.push(el('label', { class: 'permission-option' }, [
      notificationsBox,
      el('span', { class: 'permission-option-text' }, [
        el('strong', {}, t('notifications.title')),
        el('span', {}, t('notifications.description'))
      ])
    ]));
    if (!notificationsAvailable) {
      content.push(el('p', { class: 'result-note' }, t('notifications.unsupported')));
    } else if (Notification.permission === 'denied') {
      content.push(el('p', { class: 'result-note' }, t('notifications.blocked')));
    }

    content.push(el('div', { class: 'result-actions' }, [
      el('button', {
        type: 'button', class: 'btn',
        onclick: function () {
          App.hideOverlay();
          if (flow.firstRun && !Store.profile()) App.showOnboarding();
          else if (flow.firstRun) App.renderHome();
          else App.showParentSettings();
        }
      }, t('analytics.notNow')),
      el('button', {
        type: 'button', class: 'btn primary',
        onclick: function () {
          Sound.play('tap');

          // Browser permission must be requested directly from this click.
          var notificationRequest = null;
          if (notificationsAvailable && notificationsBox.checked && Notification.permission === 'default') {
            try { notificationRequest = Notification.requestPermission(); }
            catch (e) { notificationRequest = Promise.resolve('denied'); }
          }

          var wasConsented = Analytics.consented();
          var deletion = Promise.resolve();
          if (analyticsAvailable && analyticsBox.checked && !wasConsented) {
            Store.set('analyticsEnabled', true);
            Store.set('analyticsConsentVersion', 'analytics-v1');
            Store.set('analyticsConsentAt', new Date().toISOString());
            Store.set('analyticsDeletePending', false);
          } else if (analyticsAvailable && !analyticsBox.checked && wasConsented) {
            deletion = Analytics.revoke();
          }

          Store.set('permissionsPromptResolved', true);

          if (!notificationsAvailable || !notificationsBox.checked) {
            Store.set('notificationsEnabled', false);
          } else if (Notification.permission === 'granted') {
            Store.set('notificationsEnabled', true);
            Store.set('releaseNoticeVersion', App.releaseNoticeVersion);
          }

          Promise.resolve(notificationRequest).catch(function () { return 'denied'; }).then(function (permission) {
            if (notificationRequest) {
              var granted = permission === 'granted';
              Store.set('notificationsEnabled', granted);
              if (granted) Store.set('releaseNoticeVersion', App.releaseNoticeVersion);
            }
            return deletion;
          }).then(function () {
            App.hideOverlay();
            App.toast(t('permissions.saved'), 2200);
            if (!Store.profile()) App.showOnboarding();
            else App.showParentSettings();
          }).catch(function () {
            App.hideOverlay();
            App.toast(t('analytics.deleteFailed'), 2800);
            App.showParentSettings();
          });
        }
      }, t('permissions.save'))
    ]));

    App.showOverlay(el('div', { class: 'onboarding permissions-modal' }, content));
  };


})(window);
