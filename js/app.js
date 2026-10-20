/* app.js — каркас приложения: профиль, главный экран, игры, награды, язык. */
(function (global) {
  'use strict';

  var el = UI.el;
  var games = [];

  var AVATARS = ['🦁', '🐼', '🦊', '🐸', '🐵', '🐯', '🐨', '🐷',
                 '🐙', '🦄', '🐢', '🐝', '🚀', '⚽', '🌟', '🎈'];

  var App = {
    games: games,
    mode: 'home',      // 'home' | 'game' | 'achievements' | 'admin'
    current: null,     // id активной игры
    cleanup: null,     // функция очистки активной игры
    els: {}
  };

  App.register = function (game) { games.push(game); };

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
  App.visibleGames = function () {
    var age = App.age();
    return games.filter(function (g) {
      return !g.ages || g.ages.indexOf(age) >= 0;
    });
  };

  // Число игр со звёздами для текущего возраста (аркады вроде «Дракончика» не в счёт).
  function scoringGames() {
    var list = App.visibleGames();
    var n = 0;
    for (var i = 0; i < list.length; i++) if (!list[i].noStars) n++;
    return n;
  }

  /* ---------- Верхняя панель ---------- */

  function refreshTopbar() {
    if (App.mode === 'game') {
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
    if (App.cleanup) { try { App.cleanup(); } catch (e) {} App.cleanup = null; }
  }

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

  /* ---------- Главный экран ---------- */

  function profileCard() {
    var prof = Store.profile() || {};
    var r = Achievements.rank();

    var main = el('button', {
      type: 'button', class: 'profile-main',
      onclick: function () { Sound.play('tap'); App.editProfile(); }
    }, [
      el('span', { class: 'profile-avatar' }, prof.avatar || '🙂'),
      el('span', { class: 'profile-info' }, [
        el('span', { class: 'profile-name' }, t('home.greeting', { name: prof.name || t('welcome.defaultName') })),
        el('span', { class: 'profile-tags' }, [
          el('span', { class: 'profile-rank' }, r.icon + ' ' + t('home.rankLabel') + ': ' + r.name),
          el('span', { class: 'profile-age' }, Ages.label(prof.age))
        ])
      ]),
      el('span', { class: 'profile-edit' }, '✏️')
    ]);

    var list = Achievements.all();
    var badges = el('button', {
      type: 'button', class: 'profile-badges',
      onclick: function () { Sound.play('tap'); App.openAchievements(); }
    }, list.map(function (a) {
      return el('span', {
        class: 'badge' + (a.unlocked ? ' got' : ' locked'),
        title: a.title
      }, a.icon);
    }));

    var kidsBtn = el('button', {
      type: 'button', class: 'profile-kids',
      onclick: function () { Sound.play('tap'); App.showProfiles(); }
    }, '👥 ' + t('profiles.switch') + ' · ' + Store.profiles().length);

    return el('div', { class: 'profile-card' }, [
      main,
      el('div', { class: 'profile-badges-label' },
        t('home.achievements') + ' · ' + Achievements.count() + ' / ' + Achievements.total()),
      badges,
      kidsBtn
    ]);
  }

  App.renderHome = function () {
    App.mode = 'home';
    App.current = null;
    stopCurrent();
    refreshTopbar();

    var screen = App.els.screen;
    UI.clear(screen);
    screen.scrollTop = 0;

    var timeUp = !App.canPlay();

    var wrap = el('div', { class: 'home' });

    if (timeUp) {
      wrap.appendChild(el('div', { class: 'limit-banner' }, '🌙 ' + t('limit.up')));
    }

    wrap.appendChild(profileCard());

    var badgeItems = [
      el('div', { class: 'home-badge' }, [el('span', { class: 'home-badge-icon' }, '⭐'), ' ' + Store.totalStars() + ' / ' + (scoringGames() * 3)]),
      el('div', { class: 'home-badge' }, [el('span', { class: 'home-badge-icon' }, '🏆'), ' ' + Achievements.count() + ' / ' + Achievements.total()])
    ];
    App.els.timeChip = null;
    App.els.timeChipText = null;
    if (Store.limitMinutes() > 0) {
      var chipText = el('span', {}, App.fmtTime(Store.remainingSeconds()));
      App.els.timeChipText = chipText;
      App.els.timeChip = el('div', { class: 'home-badge' + (timeUp ? ' home-badge-alert' : '') }, [
        el('span', { class: 'home-badge-icon' }, '⏳'), chipText
      ]);
      badgeItems.push(App.els.timeChip);
    }
    wrap.appendChild(el('div', { class: 'home-badges' }, badgeItems));

    wrap.appendChild(el('p', { class: 'home-subtitle' }, t('home.subtitle')));

    var grid = el('div', { class: 'game-grid' });
    App.visibleGames().forEach(function (g) {
      var locked = g.requires && !Achievements.hasRank(g.requires);
      var st = Store.gameStats(g.id);
      var card = el('button', {
        type: 'button',
        class: 'game-card' + (locked ? ' card-locked' : ''),
        onclick: function () {
          Sound.play('tap');
          if (locked) App.showLocked(g);
          else App.startGame(g.id);
        }
      }, [
        el('div', { class: 'game-card-emoji' }, locked ? '🔒' : g.emoji),
        el('div', { class: 'game-card-title' }, t(g.titleKey)),
        el('div', { class: 'game-card-desc' }, locked ? t('runner.locked') : t(g.descKey)),
        locked ? null : (g.noStars
          ? el('div', { class: 'game-card-record' }, '🏆 ' + t('runner.best') + ': ' + Store.best(g.id))
          : UI.starsRow(st.stars, 3))
      ]);
      if (!locked && st.stars >= 3) card.classList.add('mastered');
      grid.appendChild(card);
    });
    wrap.appendChild(grid);

    wrap.appendChild(el('button', {
      type: 'button', class: 'ach-open-btn',
      onclick: function () { Sound.play('tap'); App.openAchievements(); }
    }, '🏆 ' + t('home.achievements')));

    wrap.appendChild(el('button', {
      type: 'button', class: 'parents-btn',
      onclick: function () { Sound.play('tap'); App.showParentsGate(); }
    }, '🔒 ' + t('limit.parents')));

    screen.appendChild(wrap);
    if (App.updateAvailable && App._updatePromptDeferred) setTimeout(function () {
      if (App.els.overlay.classList.contains('hidden')) App.showUpdatePrompt();
    }, 0);
  };

  /* ---------- Лимит времени: справка и окна ---------- */

  App.canPlay = function () {
    return Store.limitMinutes() <= 0 || Store.remainingSeconds() > 0;
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
    var body = el('div', { class: 'result' }, [
      el('div', { class: 'result-emoji' }, '🔒'),
      el('div', { class: 'result-title' }, t('runner.lockedTitle')),
      el('p', { class: 'result-text' }, t('runner.locked')),
      el('p', { class: 'result-note' }, t('runner.needRank', { got: Achievements.count(), need: need })),
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

  /* ---------- Запуск игры ---------- */

  App.startGame = function (id) {
    if (!App.canPlay()) { App.showBlocked(); return; }
    var game = gameById(id);
    if (!game) return;
    Analytics.recordLaunch(id);
    stopCurrent();

    App.mode = 'game';
    App.current = id;
    refreshTopbar();

    var screen = App.els.screen;
    UI.clear(screen);
    screen.scrollTop = 0;
    App.cleanup = game.start(screen, App) || null;
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
          navigator.serviceWorker.getRegistration().then(function (registration) {
            if (registration && registration.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          });
        } }, t('update.now'))
      ])
    ]);
    App.showOverlay(body);
  };

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
      el('p', { class: 'result-text' }, t('permissions.intro')),
      el('label', { class: 'permission-option' }, [
        analyticsBox,
        el('span', { class: 'permission-option-text' }, [
          el('strong', {}, t('analytics.title')),
          el('span', {}, t('analytics.consentDetails'))
        ])
      ])
    ];

    if (Analytics.configured() && Analytics.privacyUrl) {
      content.push(el('a', {
        class: 'analytics-privacy-link',
        href: Analytics.privacyUrl,
        target: '_blank',
        rel: 'noopener noreferrer'
      }, t('analytics.privacyLink')));
    } else if (!analyticsAvailable) {
      content.push(el('p', { class: 'result-note' }, t('permissions.analyticsUnavailable')));
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
    if (App.cleanup) { try { App.cleanup(); } catch (e) {} App.cleanup = null; }
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
  App.finishGame = function (id, stars, replay, note, level) {
    stars = Math.max(1, Math.min(3, stars));
    Store.recordResult(id, stars, level);
    Sound.play('win');

    var emoji = stars >= 3 ? '🏆' : (stars === 2 ? '🎉' : '👍');
    var praise = stars >= 3 ? t('common.great') : (stars === 2 ? t('common.wellDone') : t('common.keepGoing'));

    function showResult() {
      var body = el('div', { class: 'result' }, [
        el('div', { class: 'result-emoji' }, emoji),
        el('div', { class: 'result-title' }, praise),
        UI.starsRow(stars, 3),
        el('p', { class: 'result-text' }, t('common.result.stars', { n: stars })),
        note ? el('p', { class: 'result-note' }, note) : null,
        el('div', { class: 'result-actions' }, [
          el('button', {
            type: 'button', class: 'btn primary',
            onclick: function () {
              App.hideOverlay();
              if (!App.canPlay()) { App.showBlocked(); return; }
              if (replay) replay();
            }
          }, '🔁 ' + t('common.again')),
          el('button', {
            type: 'button', class: 'btn',
            onclick: function () { App.hideOverlay(); App.goHome(); }
          }, '🏠 ' + t('home'))
        ])
      ]);
      App.showOverlay(body);
    }

    var newly = Achievements.checkNew();
    if (newly.length) App.showAchievements(newly, showResult);
    else showResult();
  };

  /* ---------- Оверлей и тост ---------- */

  App.showOverlay = function (content) {
    var ov = App.els.overlay;
    UI.clear(ov);
    ov.appendChild(el('div', { class: 'overlay-card' }, content));
    ov.classList.remove('hidden');
  };

  App.hideOverlay = function () {
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

  /* ---------- Инициализация ---------- */

  App.init = function () {
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
        if (isAdmin()) {
          App.openAdmin();
        } else {
          App.showAdminAuth();
        }
      }
    }
    window.addEventListener('hashchange', checkAdminHash);

    // Дневной лимит: считаем только время активной игры (без окон).
    App.warnDay = null;
    App.warned5 = false;
    App.warned1 = false;
    App.blockedDay = null;
    App.lastTick = Date.now();
    setInterval(function () {
      var now = Date.now();
      var dt = Math.round((now - App.lastTick) / 1000);
      App.lastTick = now;
      if (dt <= 0) return;
      if (Store.limitMinutes() <= 0) return;

      var overlayHidden = App.els.overlay.classList.contains('hidden');
      if (App.mode === 'game' && overlayHidden) Store.addUsage(dt);

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

  global.App = App;
})(window);
