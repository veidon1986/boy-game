/* app/parents.js — интерфейс и действия раздела. */
(function (global) {
  'use strict';
  var App = global.App;
  var el = UI.el;

  /* ---------- Лимит времени: справка и окна ---------- */

  App.canPlay = function () {
    return App.demoMode || Store.limitMinutes() <= 0 || Store.remainingSeconds() > 0;
  };

  // Сброс состояния предупреждений при смене ребёнка.
  App.resetLimitState = function () {
    App.warnDay = null;
    App.warned5 = false;
    App.warned1 = false;
    App.blockedDay = null;
  };

  App.fmtTime = function (sec) {
    if (sec === Infinity) return t('limit.unlimited');
    sec = Math.max(0, Math.round(sec));
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  };

  App.showLocked = function (g) {
    var need = g.requires ? Achievements.rankNeed(g.requires) : 0;
    var rankName = g.requires ? t(g.requires) : '';
    var body = el('div', { class: 'result' }, [
      el('div', { class: 'result-emoji' }, '🔒'),
      el('div', { class: 'result-title' }, t('runner.lockedTitle')),
      el('p', { class: 'result-text' }, t('game.unlockAtRank', { rank: rankName })),
      el('p', { class: 'result-note' }, t('game.needRank', { rank: rankName, got: Achievements.count(), need: need })),
      el('div', { class: 'result-actions' }, [
        el('button', {
          type: 'button', class: 'btn primary',
          onclick: function () { App.hideOverlay(); App.openAchievements(); }
        }, '🏆 ' + t('home.achievements')),
        el('button', {
          type: 'button', class: 'btn',
          onclick: function () { App.hideOverlay(); }
        }, t('limit.ok'))
      ])
    ]);
    App.showOverlay(body);
  };

  App.showBlocked = function () {
    var body = el('div', { class: 'result' }, [
      el('div', { class: 'result-emoji' }, '🌙'),
      el('div', { class: 'result-title' }, t('limit.upTitle')),
      el('p', { class: 'result-text' }, t('limit.up')),
      el('p', { class: 'result-note' }, t('limit.used') + ': ' + App.fmtTime(Store.usage().seconds) +
        ' / ' + (Store.limitMinutes() > 0 ? Store.limitMinutes() + ' ' + t('limit.min') : t('limit.unlimited'))),
      el('div', { class: 'result-actions' }, [
        el('button', {
          type: 'button', class: 'btn primary',
          onclick: function () { App.hideOverlay(); }
        }, '🙂 ' + t('limit.ok'))
      ])
    ]);
    App.showOverlay(body);
  };

  App.showParentsGate = function (onSuccess, onCancel) {
    var a = UI.randInt(6, 9), b = UI.randInt(6, 9);
    var input = el('input', { class: 'name-input', type: 'number', inputmode: 'numeric', placeholder: '?' });
    var err = el('p', { class: 'gate-error hidden' }, t('limit.gateWrong'));

    function submit() {
      if (Number(input.value) === a * b) {
        Sound.play('win');
        App.hideOverlay();
        if (onSuccess) onSuccess();
        else if (Store.get('permissionsPromptShown', false) &&
                 !Store.get('permissionsPromptResolved', false)) {
          App.showPermissionsConsent({ fromParent: true });
        } else App.showParentSettings();
      } else {
        err.classList.remove('hidden');
        input.value = '';
        Sound.play('wrong');
      }
    }

    var body = el('div', { class: 'onboarding' }, [
      el('div', { class: 'onboarding-emoji' }, '🔒'),
      el('div', { class: 'onboarding-title' }, t('limit.gateTitle')),
      el('p', { class: 'result-text' }, t('limit.gateHint')),
      el('div', { class: 'gate-q' }, t('limit.gateQ', { a: a, b: b })),
      input,
      err,
      el('div', { class: 'result-actions' }, [
        el('button', {
          type: 'button', class: 'btn',
          onclick: function () { App.hideOverlay(); if (onCancel) onCancel(); }
        }, t('limit.close')),
        el('button', {
          type: 'button', class: 'btn primary',
          onclick: submit
        }, t('limit.enter'))
      ])
    ]);
    App.showOverlay(body);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
    input.focus();
  };

  App.requestInitialPermissions = function () {
    if (App.demoMode) return false;
    if (Store.get('permissionsPromptShown', false)) return false;
    Store.set('permissionsPromptShown', true);
    App.showParentsGate(function () {
      App.showPermissionsConsent({ firstRun: true });
    }, function () {
      if (!Store.profile()) App.showOnboarding();
      else App.renderHome();
    });
    return true;
  };

  App.showParentSettings = function () {
    var OPTS = [10, 15, 20, 30, 45, 60, 0];
    var list = Store.profiles();
    var selId = Store.activeId();
    if (!selId && list.length) selId = list[0].id;
    var nodes = [];
    var chips = [];

    function labelFor(m) { return m === 0 ? t('limit.unlimited') : m + ' ' + t('limit.min'); }

    var usedLine = el('p', { class: 'result-text' }, '');
    function refreshUsed() {
      var m = Store.limitFor(selId);
      usedLine.textContent = t('limit.used') + ': ' + App.fmtTime(Store.usageFor(selId).seconds) +
        ' / ' + (m > 0 ? m + ' ' + t('limit.min') : t('limit.unlimited'));
    }

    function refreshActive() {
      var m = Store.limitFor(selId);
      nodes.forEach(function (n) { n.classList.toggle('active', n._m === m); });
      chips.forEach(function (c) { c.classList.toggle('active', c._id === selId); });
      refreshUsed();
    }

    var childRow = el('div', { class: 'limit-children' });
    list.forEach(function (p) {
      var chip = el('button', {
        type: 'button', class: 'child-chip',
        onclick: function () {
          selId = p.id;
          Sound.play('tap');
          refreshActive();
        }
      }, [
        el('span', { class: 'child-chip-avatar' }, p.avatar || '🙂'),
        el('span', {}, p.name || t('welcome.defaultName'))
      ]);
      chip._id = p.id;
      chips.push(chip);
      childRow.appendChild(chip);
    });

    var grid = el('div', { class: 'limit-options' });
    OPTS.forEach(function (m) {
      var b = el('button', {
        type: 'button', class: 'limit-opt',
        onclick: function () {
          Store.setLimitFor(selId, m);
          Sound.play('tap');
          refreshActive();
          App.toast(t('limit.saved'), 1200);
          if (App.mode === 'home') App.renderHome();
        }
      }, labelFor(m));
      b._m = m;
      nodes.push(b);
      grid.appendChild(b);
    });

    refreshActive();

    var head = [el('div', { class: 'onboarding-title' }, t('limit.parentsTitle'))];
    if (list.length > 1) {
      head.push(el('label', { class: 'field-label' }, t('limit.forChild')));
      head.push(childRow);
    }
    head.push(usedLine);
    head.push(el('label', { class: 'field-label' }, t('permissions.title')));
    head.push(el('p', { class: 'result-note' }, t('permissions.intro')));
    head.push(el('button', { type: 'button', class: 'btn', onclick: function () {
      Sound.play('tap');
      App.showPermissionsConsent();
    } }, t('permissions.open')));
    if (Analytics.hasPendingDeletion()) {
      head.push(el('p', { class: 'result-note' }, t('analytics.deletePending')));
      head.push(el('button', { type: 'button', class: 'btn', onclick: function () {
        Analytics.retryDeletion().then(function () {
          App.toast(t('analytics.deleted'), 2200);
          App.showParentSettings();
        }).catch(function () { App.toast(t('analytics.deleteFailed'), 2800); });
      } }, t('analytics.retryDelete')));
    }
    head.push(el('label', { class: 'field-label' }, t('limit.limitLabel')));
    head.push(grid);

    var body = el('div', { class: 'onboarding' }, head.concat([
      el('div', { class: 'result-actions' }, [
        el('button', {
          type: 'button', class: 'btn',
          onclick: function () {
            Store.resetUsageFor(selId);
            Sound.play('win');
            App.toast(t('limit.resetDone'), 1500);
            refreshUsed();
            App.renderHome();
          }
        }, '♻️ ' + t('limit.reset')),
        el('button', {
          type: 'button', class: 'btn primary',
          onclick: function () { App.hideOverlay(); App.renderHome(); }
        }, t('limit.close'))
      ])
    ]));
    App.showOverlay(body);
  };

})(window);
