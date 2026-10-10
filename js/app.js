/* app.js — каркас приложения: профиль, главный экран, игры, награды, язык. */
(function (global) {
  'use strict';

  var el = UI.el;
  var games = [];

  var AVATARS = ['🦁', '🐼', '🦊', '🐸', '🐵', '🐯', '🐨', '🐷',
                 '🐙', '🦄', '🐢', '🐝', '🚀', '⚽', '🌟', '🎈'];

  var App = {
    games: games,
    mode: 'home',      // 'home' | 'game' | 'achievements'
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
    } else {
      App.els.title.textContent = t('app.title');
    }
    App.els.homeBtn.classList.toggle('hidden', App.mode === 'home');
    App.els.soundBtn.textContent = Sound.isEnabled() ? '🔊' : '🔇';
    App.els.langBtn.textContent = I18N.getLang().toUpperCase();
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
        else App.showParentSettings();
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

  App.hideOverlay = function () { App.els.overlay.classList.add('hidden'); };

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
    App.els.soundBtn = document.getElementById('soundBtn');
    App.els.langBtn = document.getElementById('langBtn');
    App.els.adminBtn = document.getElementById('adminBtn');
    App.els.screen = document.getElementById('screen');
    App.els.overlay = document.getElementById('overlay');
    App.els.toast = document.getElementById('toast');

    I18N.setLang(Store.get('lang', 'ru'));

    App.els.homeBtn.addEventListener('click', function () { App.goHome(); });

    App.els.langBtn.addEventListener('click', function () {
      var next = I18N.getLang() === 'ru' ? 'en' : 'ru';
      I18N.setLang(next);
      Store.set('lang', next);
      Sound.play('tap');
      if (App.mode === 'game') App.startGame(App.current);
      else if (App.mode === 'achievements') App.openAchievements();
      else App.renderHome();
      refreshTopbar();
    });

    App.els.soundBtn.addEventListener('click', function () {
      var on = Sound.setEnabled(!Sound.isEnabled());
      refreshTopbar();
      if (on) Sound.play('tap');
      App.toast(on ? t('sound.on') : t('sound.off'), 1200);
    });

    if (App.els.adminBtn) {
      App.els.adminBtn.addEventListener('click', function () {
        Sound.play('tap');
        App.showAdminAuth();
      });
    }

    var unlock = function () {
      Sound.unlock();
      document.removeEventListener('pointerdown', unlock);
    };
    document.addEventListener('pointerdown', unlock);

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
    if (!Store.profile()) App.showOnboarding();
  };

  global.App = App;
})(window);
