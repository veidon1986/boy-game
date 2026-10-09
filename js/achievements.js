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

  var STAR_MILESTONES = [
    { id: 'stars.3',  icon: '🌟', need: 3,  titleKey: 'ach.stars3.title',  descKey: 'ach.stars3.desc' },
    { id: 'stars.8',  icon: '✨', need: 8,  titleKey: 'ach.stars8.title',  descKey: 'ach.stars8.desc' },
    { id: 'stars.15', icon: '💫', need: 15, titleKey: 'ach.stars15.title', descKey: 'ach.stars15.desc' }
  ];

  function gameList() {
    if (global.App && global.App.games && global.App.games.length) {
      return global.App.games
        .filter(function (g) { return !g.noStars; })
        .map(function (g) { return { id: g.id, titleKey: g.titleKey }; });
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
      ['easy', 'medium', 'hard'].forEach(function (lv) {
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

    STAR_MILESTONES.forEach(function (m) {
      list.push({
        id: m.id,
        icon: m.icon,
        title: t(m.titleKey),
        desc: t(m.descKey),
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

  function count() { return Store.achievementCount(); }
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

  global.Achievements = {
    defs: defs,
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
