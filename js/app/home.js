/* app/home.js — интерфейс и действия раздела. */
(function (global) {
  'use strict';
  var App = global.App;
  var el = UI.el;
  var refreshTopbar = App.refreshTopbar;
  var stopCurrent = App.stopCurrent;
  var scoringGames = App.scoringGames;

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

    var rewards = Achievements.all();
    var rewardCount = Achievements.count();
    var rewardTotal = Achievements.total();
    var nextReward = rewards.filter(function (reward) { return !reward.unlocked; })[0];
    var rewardPercent = rewardTotal ? Math.round(rewardCount / rewardTotal * 100) : 100;
    var rewardSummary = el('button', {
      type: 'button', class: 'profile-reward-summary',
      'aria-label': t('home.achievements') + ': ' + rewardCount + ' / ' + rewardTotal,
      onclick: function () { Sound.play('tap'); App.openAchievements(); }
    }, [
      el('span', { class: 'profile-reward-icon' }, nextReward ? nextReward.icon : '🏅'),
      el('span', { class: 'profile-reward-copy' }, [
        el('span', { class: 'profile-reward-title' }, t('home.achievements')),
        el('span', { class: 'profile-reward-count' }, rewardCount + ' / ' + rewardTotal),
        el('span', { class: 'profile-reward-next' }, nextReward
          ? t('home.nextReward', { title: nextReward.title })
          : t('home.allRewards'))
      ]),
      el('span', { class: 'profile-reward-track', 'aria-hidden': 'true' },
        el('span', { style: { width: rewardPercent + '%' } }))
    ]);

    var kidsBtn = el('button', {
      type: 'button', class: 'profile-kids',
      onclick: function () { Sound.play('tap'); App.showProfiles(); }
    }, '👥 ' + t('profiles.switch') + ' · ' + Store.profiles().length);

    return el('div', { class: 'profile-card' }, [
      main,
      rewardSummary,
      kidsBtn
    ]);
  }

  App.renderHome = function () {
    stopCurrent();
    App.mode = 'home';
    App.current = null;
    refreshTopbar();

    var screen = App.els.screen;
    UI.clear(screen);
    screen.scrollTop = 0;

    var timeUp = !App.canPlay();

    var wrap = el('div', { class: 'home' });

    if (App.demoMode) wrap.appendChild(el('div', { class: 'demo-banner' }, t('demo.banner')));

    if (timeUp) {
      wrap.appendChild(el('div', { class: 'limit-banner' }, '🌙 ' + t('limit.up')));
    }

    wrap.appendChild(profileCard());

    var badgeItems = [
      el('div', { class: 'home-badge' }, [el('span', { class: 'home-badge-icon' }, '⭐'), ' ' + Store.totalStars() + ' / ' + (scoringGames() * 3)])
    ];
    App.els.timeChip = null;
    App.els.timeChipText = null;
    if (Store.limitMinutes() > 0 && !App.demoMode) {
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
      var locked = !App.gameAccess(g.id).allowed;
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
        el('div', { class: 'game-card-desc' }, locked ? t('game.unlockAtRank', { rank: t(g.requires) }) : t(g.descKey)),
        locked ? null : (g.noStars
          ? (g.showRecord === false ? null : el('div', { class: 'game-card-record' }, '🏆 ' + t('runner.best') + ': ' + Store.best(g.id)))
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

})(window);
