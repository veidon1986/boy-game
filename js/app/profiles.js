/* app/profiles.js — интерфейс и действия раздела. */
(function (global) {
  'use strict';
  var App = global.App;
  var el = UI.el;
  var AVATARS = ['🦁', '🐼', '🦊', '🐸', '🐵', '🐯', '🐨', '🐷',
                 '🐙', '🦄', '🐢', '🐝', '🚀', '⚽', '🌟', '🎈'];

  /* ---------- Профиль: форма (имя + аватар) ---------- */

  function profileForm(p) {
    var cur = p || Store.profile() || {};
    var name = cur.name || '';
    var avatar = cur.avatar || AVATARS[0];

    var preview = el('div', { class: 'avatar-preview' }, avatar);
    var nodes = [];

    function select(a) {
      Sound.play('tap');
      avatar = a;
      preview.textContent = a;
      nodes.forEach(function (n) { n.classList.toggle('active', n.textContent === a); });
    }

    var grid = el('div', { class: 'avatar-grid' });
    AVATARS.forEach(function (a) {
      var b = el('button', {
        type: 'button',
        class: 'avatar-opt' + (a === avatar ? ' active' : ''),
        onclick: function () { select(a); }
      }, a);
      nodes.push(b);
      grid.appendChild(b);
    });

    var nameInput = el('input', {
      class: 'name-input',
      type: 'text',
      maxlength: '20',
      autocomplete: 'off',
      placeholder: t('welcome.namePlaceholder'),
      value: name
    });

    var age = Ages.normalize(cur.age);
    var ageNodes = [];
    var ageRow = el('div', { class: 'age-row' });
    Ages.list.forEach(function (a) {
      var b = el('button', {
        type: 'button',
        class: 'age-opt' + (a.key === age ? ' active' : ''),
        onclick: function () {
          Sound.play('tap');
          age = a.key;
          ageNodes.forEach(function (n) { n.classList.toggle('active', n._k === a.key); });
        }
      }, [
        el('span', { class: 'age-emoji' }, a.emoji),
        el('span', { class: 'age-range' }, a.range + ' ' + t('age.years'))
      ]);
      b._k = a.key;
      ageNodes.push(b);
      ageRow.appendChild(b);
    });

    var formChildren = [
      el('div', { class: 'avatar-preview-wrap' }, preview),
      el('label', { class: 'field-label' }, t('welcome.nameLabel')),
      nameInput,
      el('label', { class: 'field-label' }, t('age.label')),
      ageRow
    ];
    if (cur.ageLocked) {
      formChildren.push(el('div', { class: 'age-hint' }, '🔒 ' + t('age.parentOnly')));
    }
    formChildren.push(el('label', { class: 'field-label' }, t('welcome.avatarLabel')));
    formChildren.push(grid);

    var form = el('div', { class: 'profile-form' }, formChildren);

    return {
      el: form,
      input: nameInput,
      getName: function () { return (nameInput.value || '').trim() || t('welcome.defaultName'); },
      getAvatar: function () { return avatar; },
      getAge: function () { return age; }
    };
  }

  App.showOnboarding = function () {
    var f = profileForm();
    var body = el('div', { class: 'onboarding' }, [
      el('div', { class: 'onboarding-emoji' }, '👋'),
      el('div', { class: 'onboarding-title' }, t('welcome.title')),
      f.el,
      el('button', {
        type: 'button', class: 'btn primary wide',
        onclick: function () {
          Store.setProfile({ name: f.getName(), avatar: f.getAvatar(), age: f.getAge(), createdAt: Date.now() });
          Sound.play('win');
          App.hideOverlay();
          App.renderHome();
          if (!App.requestInitialPermissions()) App.maybeShowInstallHint(700);
        }
      }, '🚀 ' + t('welcome.start'))
    ]);
    App.showOverlay(body);
  };

  App.editProfile = function (init) {
    var cur = Store.profile() || {};
    var initial = init || {
      name: cur.name,
      avatar: cur.avatar,
      age: Ages.normalize(cur.age),
      ageLocked: true
    };
    initial.ageLocked = true;
    var f = profileForm(initial);

    function doSave() {
      Store.setProfile({
        name: f.getName(),
        avatar: f.getAvatar(),
        age: f.getAge(),
        createdAt: (Store.profile() || {}).createdAt || Date.now()
      });
      Sound.play('win');
      App.hideOverlay();
      App.renderHome();
    }

    var body = el('div', { class: 'onboarding' }, [
      el('div', { class: 'onboarding-title' }, t('profile.title')),
      f.el,
      el('div', { class: 'result-actions' }, [
        el('button', {
          type: 'button', class: 'btn',
          onclick: function () { Sound.play('tap'); App.hideOverlay(); }
        }, t('profile.cancel')),
        el('button', {
          type: 'button', class: 'btn primary',
          onclick: function () {
            var pending = { name: f.getName(), avatar: f.getAvatar(), age: f.getAge() };
            var changedAge = pending.age !== Ages.normalize((Store.profile() || {}).age);
            if (changedAge) {
              // Смена возраста — только с подтверждением родителя.
              App.showParentsGate(doSave, function () { App.editProfile(pending); });
            } else {
              doSave();
            }
          }
        }, t('profile.save'))
      ])
    ]);
    App.showOverlay(body);
  };

  /* ---------- Профили детей (переключатель) ---------- */

  function childSummary(id) {
    var n = Object.keys(Store.achievementsFor(id)).length;
    return { rank: Achievements.rankFor(n), stars: Store.totalStarsFor(id) };
  }

  App.showProfiles = function () {
    var list = Store.profiles();
    var activeId = Store.activeId();

    var rows = list.map(function (p) {
      var isActive = p.id === activeId;
      var sum = childSummary(p.id);
      var name = p.name || t('welcome.defaultName');

      var pick = el('button', {
        type: 'button',
        class: 'kid-row' + (isActive ? ' active' : ''),
        onclick: function () {
          Sound.play('tap');
          if (!isActive) { Store.switchProfile(p.id); App.resetLimitState(); }
          App.hideOverlay();
          App.renderHome();
          if (!isActive) App.toast('👋 ' + t('profiles.switched', { name: name }), 1600);
        }
      }, [
        el('span', { class: 'kid-avatar' }, p.avatar || '🙂'),
        el('span', { class: 'kid-info' }, [
          el('span', { class: 'kid-name' }, name + (isActive ? ' · ' + t('profiles.active') : '')),
          el('span', { class: 'kid-sub' }, Ages.label(p.age) + ' · ' + sum.rank.icon + ' ' + sum.rank.name + ' · ⭐ ' + sum.stars)
        ])
      ]);

      if (!isActive && list.length > 1) {
        return el('div', { class: 'kid-line' }, [
          pick,
          el('button', {
            type: 'button', class: 'kid-del', title: t('profiles.delete'),
            onclick: function () {
              Sound.play('tap');
              App.showParentsGate(function () { App.confirmDeleteProfile(p); }, function () { App.showProfiles(); });
            }
          }, '🗑')
        ]);
      }
      return el('div', { class: 'kid-line' }, [pick]);
    });

    var body = el('div', { class: 'profiles-screen' }, [
      el('div', { class: 'onboarding-emoji' }, '👨‍👩‍👧‍👦'),
      el('div', { class: 'onboarding-title' }, t('profiles.selectTitle')),
      el('div', { class: 'kid-list' }, rows),
      el('button', {
        type: 'button', class: 'btn primary wide',
        onclick: function () {
          Sound.play('tap');
          App.showParentsGate(function () { App.showAddProfile(); }, function () { App.showProfiles(); });
        }
      }, '➕ ' + t('profiles.add')),
      el('button', {
        type: 'button', class: 'btn wide',
        onclick: function () { Sound.play('tap'); App.hideOverlay(); }
      }, t('limit.close'))
    ]);
    App.showOverlay(body);
  };

  App.showAddProfile = function () {
    var idx = Store.profiles().length % AVATARS.length;
    var f = profileForm({ name: '', avatar: AVATARS[idx] });
    var body = el('div', { class: 'onboarding' }, [
      el('div', { class: 'onboarding-emoji' }, '👶'),
      el('div', { class: 'onboarding-title' }, t('profiles.newTitle')),
      f.el,
      el('div', { class: 'result-actions' }, [
        el('button', {
          type: 'button', class: 'btn',
          onclick: function () { Sound.play('tap'); App.showProfiles(); }
        }, t('profile.cancel')),
        el('button', {
          type: 'button', class: 'btn primary',
          onclick: function () {
            var name = f.getName();
            Store.addProfile(name, f.getAvatar(), f.getAge());
            App.resetLimitState();
            Sound.play('win');
            App.hideOverlay();
            App.renderHome();
            App.toast('👋 ' + t('profiles.switched', { name: name }), 1600);
          }
        }, '✅ ' + t('profiles.addBtn'))
      ])
    ]);
    App.showOverlay(body);
  };

  App.confirmDeleteProfile = function (p) {
    var name = p.name || t('welcome.defaultName');
    var body = el('div', { class: 'onboarding' }, [
      el('div', { class: 'onboarding-emoji' }, '🗑'),
      el('div', { class: 'onboarding-title' }, t('profiles.deleteTitle')),
      el('p', { class: 'result-text' }, t('profiles.deleteConfirm', { name: name })),
      el('div', { class: 'result-actions' }, [
        el('button', {
          type: 'button', class: 'btn',
          onclick: function () { Sound.play('tap'); App.showProfiles(); }
        }, t('profile.cancel')),
        el('button', {
          type: 'button', class: 'btn primary',
          onclick: function () {
            if (Analytics.configured()) Analytics.deletePlayer(p).catch(function () {});
            Store.removeProfile(p.id);
            Sound.play('wrong');
            App.toast(t('profiles.removed'), 1500);
            if (!Store.profile()) { App.hideOverlay(); App.showOnboarding(); }
            else App.showProfiles();
          }
        }, '🗑 ' + t('profiles.delete'))
      ])
    ]);
    App.showOverlay(body);
  };

})(window);
