/* store.js — сохранение настроек, профилей, прогресса и наград в localStorage.

   Данные делятся на два уровня:
   - общие для устройства (язык, звук) — ключи 'lang', 'sound';
   - данные конкретного ребёнка — ключи 'd.<profileId>.<...>'.
   Профили (дети) лежат в ключе 'profiles'. */
(function (global) {
  'use strict';

  var PREFIX = 'boygame.';
  var LEVELS = ['easy', 'medium', 'hard'];

  function raw(key) {
    try { return global.localStorage.getItem(PREFIX + key); }
    catch (e) { return null; }
  }

  function get(key, fallback) {
    var v = raw(key);
    if (v === null || v === undefined) return fallback;
    try { return JSON.parse(v); }
    catch (e) { return fallback; }
  }

  function set(key, value) {
    try { global.localStorage.setItem(PREFIX + key, JSON.stringify(value)); }
    catch (e) { /* приватный режим — просто не сохраняем */ }
    return value;
  }

  function remove(key) {
    try { global.localStorage.removeItem(PREFIX + key); } catch (e) {}
  }

  /* ---------- Профили (дети) ---------- */

  var _reg = null;   // кэш реестра профилей
  var _ready = false;

  function newId() {
    return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  // Одноразовый перенос старого одиночного профиля в реестр.
  function migrate() {
    var r = get('profiles', null);
    if (r && Array.isArray(r.list) && r.list.length) { _reg = r; return; }
    if (!r || !Array.isArray(r.list)) r = { list: [], activeId: null };

    var legacy = get('profile', null);
    if (legacy) {
      var id = newId();
      r.list.push({
        id: id,
        name: legacy.name || '',
        avatar: legacy.avatar || '🙂',
        createdAt: legacy.createdAt || Date.now()
      });
      r.activeId = id;
      ['stats', 'achievements', 'best', 'usage', 'limitMinutes'].forEach(function (k) {
        var v = raw(k);
        if (v !== null) { try { global.localStorage.setItem(PREFIX + 'd.' + id + '.' + k, v); } catch (e) {} }
      });
      ['profile', 'stats', 'achievements', 'best', 'usage', 'limitMinutes'].forEach(remove);
    }
    _reg = r;
    set('profiles', r);
  }

  function ensure() {
    if (_ready) return;
    _ready = true;
    migrate();
  }

  function registry() {
    ensure();
    if (_reg) return _reg;
    var r = get('profiles', null);
    if (!r || !Array.isArray(r.list)) r = { list: [], activeId: null };
    _reg = r;
    return r;
  }

  function saveRegistry(r) { _reg = r; return set('profiles', r); }

  function findById(r, id) {
    for (var i = 0; i < r.list.length; i++) if (r.list[i].id === id) return r.list[i];
    return null;
  }

  function profiles() { return registry().list; }
  function activeId() { return registry().activeId; }

  function profile() {
    var r = registry();
    return r.activeId ? findById(r, r.activeId) : null;
  }

  // Создать профиль (если активного нет) или обновить текущий.
  function setProfile(p) {
    var r = registry();
    var cur = r.activeId ? findById(r, r.activeId) : null;
    if (cur) {
      cur.name = p.name;
      cur.avatar = p.avatar;
      if (p.createdAt) cur.createdAt = p.createdAt;
    } else {
      var id = newId();
      r.list.push({ id: id, name: p.name, avatar: p.avatar, createdAt: p.createdAt || Date.now() });
      r.activeId = id;
    }
    saveRegistry(r);
    return profile();
  }

  function addProfile(name, avatar) {
    var r = registry();
    var id = newId();
    r.list.push({ id: id, name: name, avatar: avatar, createdAt: Date.now() });
    r.activeId = id;
    saveRegistry(r);
    return findById(r, id);
  }

  function switchProfile(id) {
    var r = registry();
    if (findById(r, id)) { r.activeId = id; saveRegistry(r); }
    return profile();
  }

  function removeProfile(id) {
    var r = registry();
    r.list = r.list.filter(function (p) { return p.id !== id; });
    ['stats', 'achievements', 'best', 'usage', 'limitMinutes'].forEach(function (k) {
      remove('d.' + id + '.' + k);
    });
    if (r.activeId === id) r.activeId = r.list.length ? r.list[0].id : null;
    saveRegistry(r);
    return profile();
  }

  /* ---------- Данные конкретного профиля ---------- */

  function dataKey(id, key) { return 'd.' + id + '.' + key; }

  // Ключ данных активного профиля (для игровых функций ниже).
  function dKey(key) {
    var id = registry().activeId;
    return id ? dataKey(id, key) : key;
  }

  function emptyGame() {
    return {
      plays: 0, stars: 0,
      easy: { plays: 0, stars: 0 },
      medium: { plays: 0, stars: 0 },
      hard: { plays: 0, stars: 0 }
    };
  }

  function gameStats(id) {
    var all = get(dKey('stats'), {});
    return all[id] || emptyGame();
  }

  function recordResult(id, stars, level) {
    var all = get(dKey('stats'), {});
    var st = all[id] || emptyGame();
    st.plays += 1;
    st.stars = Math.max(st.stars || 0, stars);
    if (level && LEVELS.indexOf(level) >= 0) {
      var lv = st[level] || { plays: 0, stars: 0 };
      lv.plays += 1;
      lv.stars = Math.max(lv.stars || 0, stars);
      st[level] = lv;
    }
    all[id] = st;
    set(dKey('stats'), all);
    return st;
  }

  function allStats() { return get(dKey('stats'), {}); }

  function totalStars() {
    var all = get(dKey('stats'), {});
    var sum = 0;
    for (var k in all) {
      if (Object.prototype.hasOwnProperty.call(all, k)) sum += (all[k].stars || 0);
    }
    return sum;
  }

  /* ---------- Награды ---------- */

  function achievements() { return get(dKey('achievements'), {}); }

  function unlockAchievement(id) {
    var a = achievements();
    if (a[id]) return false;
    a[id] = Date.now();
    set(dKey('achievements'), a);
    return true;
  }

  function achievementCount() { return Object.keys(achievements()).length; }

  /* ---------- Личные рекорды (аркады без звёзд) ---------- */

  function best(id) {
    var m = get(dKey('best'), {});
    return m[id] || 0;
  }

  function setBest(id, value) {
    var m = get(dKey('best'), {});
    if (value > (m[id] || 0)) {
      m[id] = value;
      set(dKey('best'), m);
      return true;
    }
    return false;
  }

  /* ---------- Дневной лимит времени ---------- */

  function todayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  function limitMinutes() {
    var v = get(dKey('limitMinutes'), 20);
    return (typeof v === 'number' && v >= 0) ? v : 20;
  }

  function setLimitMinutes(m) { return set(dKey('limitMinutes'), m); }

  function usage() {
    var u = get(dKey('usage'), null);
    if (!u || u.day !== todayKey()) {
      u = { day: todayKey(), seconds: 0 };
      set(dKey('usage'), u);
    }
    return u;
  }

  function addUsage(seconds) {
    var u = usage();
    u.seconds += seconds;
    set(dKey('usage'), u);
    return u;
  }

  function resetUsage() { return set(dKey('usage'), { day: todayKey(), seconds: 0 }); }

  function remainingSeconds() {
    var lim = limitMinutes();
    if (lim <= 0) return Infinity;
    return Math.max(0, lim * 60 - usage().seconds);
  }

  /* ---------- Те же данные, но для произвольного профиля (для экрана «Дети») ---------- */

  function statsFor(id) { return get(dataKey(id, 'stats'), {}); }
  function achievementsFor(id) { return get(dataKey(id, 'achievements'), {}); }
  function bestFor(id, game) { return (get(dataKey(id, 'best'), {})[game]) || 0; }
  function limitFor(id) {
    var v = get(dataKey(id, 'limitMinutes'), 20);
    return (typeof v === 'number' && v >= 0) ? v : 20;
  }
  function setLimitFor(id, m) { return set(dataKey(id, 'limitMinutes'), m); }
  function totalStarsFor(id) {
    var all = statsFor(id);
    var sum = 0;
    for (var k in all) {
      if (Object.prototype.hasOwnProperty.call(all, k)) sum += (all[k].stars || 0);
    }
    return sum;
  }
  function usageFor(id) {
    var u = get(dataKey(id, 'usage'), null);
    if (!u || u.day !== todayKey()) {
      u = { day: todayKey(), seconds: 0 };
      set(dataKey(id, 'usage'), u);
    }
    return u;
  }
  function resetUsageFor(id) { return set(dataKey(id, 'usage'), { day: todayKey(), seconds: 0 }); }

  function reset() {
    ['stats', 'achievements', 'best', 'usage', 'limitMinutes'].forEach(function (k) {
      remove(dKey(k));
    });
  }

  global.Store = {
    get: get,
    set: set,

    profiles: profiles,
    activeId: activeId,
    profile: profile,
    setProfile: setProfile,
    addProfile: addProfile,
    switchProfile: switchProfile,
    removeProfile: removeProfile,

    gameStats: gameStats,
    recordResult: recordResult,
    allStats: allStats,
    totalStars: totalStars,
    achievements: achievements,
    unlockAchievement: unlockAchievement,
    achievementCount: achievementCount,
    best: best,
    setBest: setBest,
    limitMinutes: limitMinutes,
    setLimitMinutes: setLimitMinutes,
    usage: usage,
    addUsage: addUsage,
    resetUsage: resetUsage,
    remainingSeconds: remainingSeconds,

    statsFor: statsFor,
    achievementsFor: achievementsFor,
    bestFor: bestFor,
    limitFor: limitFor,
    setLimitFor: setLimitFor,
    totalStarsFor: totalStarsFor,
    usageFor: usageFor,
    resetUsageFor: resetUsageFor,

    reset: reset
  };
})(window);
