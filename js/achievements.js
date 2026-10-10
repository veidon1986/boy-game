/* achievements.js — награды (ачивки) и статусы (ранги). */
(function (global) {
  'use strict';

  var t = global.t || function (k) { return k; };

  var RANKS = [
    { min: 0,  icon: '🌱', key: 'rank.rookie' },
    { min: 3,  icon: '🧭', key: 'rank.explorer' },
    { min: 8,  icon: '🧠', key: 'rank.smart' },
    { min: 15, icon: '🎓', key: 'rank.master' },
    { min: 21, icon: '👑', key: 'rank.genius' }
  ];

  var STAR_SLOTS = [
    { id: 'stars.3',  icon: '🌟', titleKey: 'ach.stars1.title', descKey: 'ach.stars1.desc' },
    { id: 'stars.8',  icon: '✨', titleKey: 'ach.stars2.title', descKey: 'ach.stars2.desc' },
    { id: 'stars.15', icon: '💫', titleKey: 'ach.stars3.title', descKey: 'ach.stars3.desc' }
  ];

  function scoringGameCount() {
    if (global.App && global.App.visibleGames) {
      return global.App.visibleGames().filter(function (g) { return !g.noStars; }).length;
    }
    return 0;
  }

  // Пороги звёздных наград зависят от возраста: считаем от максимума звёзд.
  // Для «старого» набора (5 игр × 3 = 15) получается прежний ряд 3 / 8 / 15.
  function starMilestones() {
    var max = Math.max(3, scoringGameCount() * 3);
    var a = Math.max(1, Math.round(max * 0.2));
    var b = Math.round(max * (8 / 15));
    if (b <= a) b = a + 1;
    if (b >= max) b = max - 1;
    return [
      { id: STAR_SLOTS[0].id, icon: STAR_SLOTS[0].icon, need: a, titleKey: STAR_SLOTS[0].titleKey, descKey: STAR_SLOTS[0].descKey },
      { id: STAR_SLOTS[1].id, icon: STAR_SLOTS[1].icon, need: b, titleKey: STAR_SLOTS[1].titleKey, descKey: STAR_SLOTS[1].descKey },
      { id: STAR_SLOTS[2].id, icon: STAR_SLOTS[2].icon, need: max, titleKey: STAR_SLOTS[2].titleKey, descKey: STAR_SLOTS[2].descKey }
    ];
  }

  // Доступные возрасту уровни сложности (для набора «идеально пройдено»).
  function gameLevels() {
    if (global.Ages && global.Ages.levels) {
      var age = (global.App && global.App.age) ? global.App.age() : undefined;
      return global.Ages.levels(age);
    }
    return ['easy', 'medium', 'hard'];
  }

  function gameList() {
    if (global.App && global.App.games && global.App.games.length) {
      var levels = gameLevels();
      var list = (global.App.visibleGames ? global.App.visibleGames() : global.App.games);
      return list
        .filter(function (g) { return !g.noStars; })
        .map(function (g) { return { id: g.id, titleKey: g.titleKey, levels: levels }; });
    }
    return [];
  }

  // Локализованный список всех наград.
  function defs() {
    var list = [];
    var games = gameList();

    games.forEach(function (g) {
      var gname = t(g.titleKey);
      list.push({
        id: 'first.' + g.id,
        icon: '🎉',
        title: t('ach.first.title', { game: gname }),
        desc: t('ach.first.desc', { game: gname }),
        ok: function (c) { return !!(c.stats[g.id] && c.stats[g.id].plays > 0); }
      });
      g.levels.forEach(function (lv) {
        var lname = t('common.' + lv);
        list.push({
          id: 'perfect.' + g.id + '.' + lv,
          icon: '⭐',
          title: t('ach.perfect.title', { game: gname, level: lname }),
          desc: t('ach.perfect.desc', { game: gname, level: lname }),
          ok: function (c) {
            var s = c.stats[g.id];
            return !!(s && s[lv] && s[lv].stars >= 3);
          }
        });
      });
    });

    starMilestones().forEach(function (m) {
      list.push({
        id: m.id,
        icon: m.icon,
        title: t(m.titleKey, { n: m.need }),
        desc: t(m.descKey, { n: m.need }),
        ok: function (c) { return c.totalStars >= m.need; }
      });
    });

    list.push({
      id: 'allgames',
      icon: '🏅',
      title: t('ach.allgames.title'),
      desc: t('ach.allgames.desc'),
      ok: function (c) {
        return games.length > 0 && games.every(function (g) {
          return c.stats[g.id] && c.stats[g.id].plays > 0;
        });
      }
    });

    return list;
  }

  function context() {
    return {
      stats: Store.allStats(),
      totalStars: Store.totalStars(),
      unlocked: Store.achievements()
    };
  }

  // Все награды с пометкой unlocked.
  function all() {
    var c = context();
    return defs().map(function (d) {
      return { id: d.id, icon: d.icon, title: d.title, desc: d.desc, unlocked: !!c.unlocked[d.id] };
    });
  }

  // Проверить и выдать новые награды. Возвращает список только что открытых.
  function checkNew() {
    var c = context();
    var out = [];
    defs().forEach(function (d) {
      if (!c.unlocked[d.id] && d.ok(c)) {
        Store.unlockAchievement(d.id);
        out.push({ id: d.id, icon: d.icon, title: d.title, desc: d.desc, unlocked: true });
      }
    });
    return out;
  }

  function count() {
    // Считаем только награды, актуальные для текущего возраста.
    var unlocked = Store.achievements();
    var n = 0;
    defs().forEach(function (d) { if (unlocked[d.id]) n++; });
    return n;
  }
  function total() { return defs().length; }

  function rankFor(n) {
    var r = RANKS[0];
    for (var i = 0; i < RANKS.length; i++) {
      if (n >= RANKS[i].min) r = RANKS[i];
    }
    return { icon: r.icon, name: t(r.key), key: r.key };
  }

  function rank() { return rankFor(count()); }

  // Достигнут ли уже указанный статус (например 'rank.smart').
  function hasRank(key) {
    var want = -1;
    for (var i = 0; i < RANKS.length; i++) { if (RANKS[i].key === key) want = i; }
    if (want < 0) return true;
    var n = count();
    var idx = 0;
    for (var j = 0; j < RANKS.length; j++) { if (n >= RANKS[j].min) idx = j; }
    return idx >= want;
  }

  // Порог числа наград для статуса (например 'rank.smart' -> 8).
  function rankNeed(key) {
    for (var i = 0; i < RANKS.length; i++) { if (RANKS[i].key === key) return RANKS[i].min; }
    return 0;
  }

  function defsForContext(ctx, age) {
    var list = [];
    var games = (global.App && global.App.visibleGames) ? global.App.visibleGames() : (global.App && global.App.games || []);
    var gl = games.filter(function (g) { return !g.noStars; }).map(function (g) { return { id: g.id, titleKey: g.titleKey }; });
    if (!ctx) ctx = context();
    gl.forEach(function (g) {
      var gname = t(g.titleKey);
      list.push({
        id: 'first.' + g.id, icon: '🎉',
        title: t('ach.first.title', { game: gname }),
        desc: t('ach.first.desc', { game: gname }),
        ok: function (c) { return !!(c.stats[g.id] && c.stats[g.id].plays > 0); }
      });
      ['easy','medium','hard'].forEach(function (lv) {
        var lname = t('common.' + lv);
        list.push({
          id: 'perfect.' + g.id + '.' + lv, icon: '⭐',
          title: t('ach.perfect.title', { game: gname, level: lname }),
          desc: t('ach.perfect.desc', { game: gname, level: lname }),
          ok: function (c) {
            var s = c.stats[g.id]; return !!(s && s[lv] && s[lv].stars >= 3);
          }
        });
      });
    });
    var milestones = (function () {
      var max = Math.max(3, scoringGameCount() * 3);
      var a = Math.max(1, Math.round(max * 0.2));
      var b = Math.round(max * (8 / 15));
      if (b <= a) b = a + 1;
      if (b >= max) b = max - 1;
      return [
        { id: STAR_SLOTS[0].id, icon: STAR_SLOTS[0].icon, need: a, titleKey: STAR_SLOTS[0].titleKey, descKey: STAR_SLOTS[0].descKey },
        { id: STAR_SLOTS[1].id, icon: STAR_SLOTS[1].icon, need: b, titleKey: STAR_SLOTS[1].titleKey, descKey: STAR_SLOTS[1].descKey },
        { id: STAR_SLOTS[2].id, icon: STAR_SLOTS[2].icon, need: max, titleKey: STAR_SLOTS[2].titleKey, descKey: STAR_SLOTS[2].descKey }
      ];
    })();
    milestones.forEach(function (m) {
      list.push({
        id: m.id, icon: m.icon,
        title: t(m.titleKey, { n: m.need }),
        desc: t(m.descKey, { n: m.need }),
        ok: function (c) { return c.totalStars >= m.need; }
      });
    });
    list.push({
      id: 'allgames', icon: '🏅', title: t('ach.allgames.title'), desc: t('ach.allgames.desc'),
      ok: function (c) {
        return gl.length > 0 && gl.every(function (g) { return c.stats[g.id] && c.stats[g.id].plays > 0; });
      }
    });
    return list;
  }

  global.Achievements = {
    defs: defs,
    defsForContext: defsForContext,
    all: all,
    checkNew: checkNew,
    count: count,
    total: total,
    rank: rank,
    rankFor: rankFor,
    hasRank: hasRank,
    rankNeed: rankNeed
  };
})(window);
