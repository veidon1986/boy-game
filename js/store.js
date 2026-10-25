/* store.js — сохранение настроек, профилей, прогресса и наград в localStorage.

   Данные делятся на два уровня:
   - общие для устройства (язык, звук) — ключи 'lang', 'sound';
   - данные конкретного ребёнка — ключи 'd.<profileId>.<...>'.
   Профили (дети) лежат в ключе 'profiles'. */
(function (global) {
  'use strict';

  var PREFIX = 'boygame.';
  var LEVELS = ['easy', 'medium', 'hard'];
  var readOnly = false;
  var lastStorageError = null;
  var SCHEMA_VERSION = 1;
  var historyStore = TaskHistory.create({ fallback: function (id, history) {
    if (!readOnly) writeRaw(id ? dataKey(id, 'taskHistory') : 'taskHistory', JSON.stringify(history));
  } });
  var usageStore = UsageStore.create({
    read: function (id) { return get(id ? dataKey(id, 'usage') : 'usage', null); },
    write: function (id, value) { return writeRaw(id ? dataKey(id, 'usage') : 'usage', JSON.stringify(value)); },
    readOnly: function () { return readOnly; }
  });

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
    if (readOnly) return value;
    try { global.localStorage.setItem(PREFIX + key, JSON.stringify(value)); }
    catch (e) { persistenceFailed(e); }
    return value;
  }

  function remove(key) {
    if (readOnly) return;
    try { global.localStorage.removeItem(PREFIX + key); } catch (e) {}
  }

  // Записать строку и убедиться, что она сохранилась.
  function writeRaw(key, value) {
    if (readOnly) return false;
    try {
      global.localStorage.setItem(PREFIX + key, value);
      return global.localStorage.getItem(PREFIX + key) === value;
    } catch (e) { persistenceFailed(e); return false; }
  }

  function persistenceFailed(error) {
    lastStorageError = error;
    if (global.App && App.els.toast) App.toast(t('storage.writeFailed'), 6000);
  }

  function forgetHistory(id) {
    if (readOnly) return Promise.resolve(false);
    var resets = get('historyResets', {});
    resets[id] = true;
    set('historyResets', resets);
    return historyStore.forget(id).then(function (success) {
      if (success) {
        var pending = get('historyResets', {});
        delete pending[id];
        set('historyResets', pending);
      }
      return success;
    });
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
        age: 'junior',
        createdAt: legacy.createdAt || Date.now()
      });
      r.activeId = id;
      var copied = true;
      ['stats', 'achievements', 'best', 'usage', 'limitMinutes'].forEach(function (k) {
        var v = raw(k);
        if (v !== null && !writeRaw(dataKey(id, k), v)) copied = false;
      });
      // Старые данные удаляются только после подтверждённой записи профиля и копий.
      if (copied && writeRaw('profiles', JSON.stringify(r))) {
        ['profile', 'stats', 'achievements', 'best', 'usage', 'limitMinutes'].forEach(remove);
      }
    } else {
      set('profiles', r);
    }
    _reg = r;
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
      if (p.age) cur.age = p.age;
      if (p.createdAt) cur.createdAt = p.createdAt;
    } else {
      var id = newId();
      r.list.push({ id: id, name: p.name, avatar: p.avatar, age: p.age || 'junior', createdAt: p.createdAt || Date.now() });
      r.activeId = id;
    }
    saveRegistry(r);
    return profile();
  }

  function addProfile(name, avatar, age) {
    usageStore.flush();
    var r = registry();
    var id = newId();
    r.list.push({ id: id, name: name, avatar: avatar, age: age || 'junior', createdAt: Date.now() });
    r.activeId = id;
    saveRegistry(r);
    return findById(r, id);
  }

  function setAge(age) {
    var r = registry();
    var cur = r.activeId ? findById(r, r.activeId) : null;
    if (cur) { cur.age = age; saveRegistry(r); }
    return profile();
  }

  function switchProfile(id) {
    usageStore.flush();
    var r = registry();
    if (findById(r, id)) { r.activeId = id; saveRegistry(r); }
    return profile();
  }

  function removeProfile(id) {
    if (!readOnly) { usageStore.discard(id); forgetHistory(id); }
    var r = registry();
    r.list = r.list.filter(function (p) { return p.id !== id; });
    ['stats', 'achievements', 'best', 'usage', 'limitMinutes', 'brainLevel', 'taskHistory', 'chessRating'].forEach(function (k) {
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

  /* ---------- Прогресс по уровням (игра «Умные загадки») ---------- */

  function brainLevel() {
    var v = get(dKey('brainLevel'), 1);
    return (typeof v === 'number' && v >= 1) ? v : 1;
  }

  function setBrainLevel(n) { return set(dKey('brainLevel'), n); }

  function taskHistory(gameId) {
    var id = activeId() || '';
    if (historyStore.ready(id)) return historyStore.list(id, gameId);
    var all = get(dKey('taskHistory'), {});
    return Array.isArray(all[gameId]) ? all[gameId] : [];
  }

  function rememberTask(gameId, signature, limit) {
    if (readOnly) return true;
    var id = activeId() || '';
    if (historyStore.ready(id)) return historyStore.remember(id, gameId, signature);
    var all = get(dKey('taskHistory'), {});
    var history = Array.isArray(all[gameId]) ? all[gameId] : [];
    if (history.indexOf(signature) >= 0) return false;
    history.push(signature);
    all[gameId] = history;
    set(dKey('taskHistory'), all);
    return true;
  }

  function prepareHistory() {
    if (readOnly || !global.indexedDB) return Promise.resolve(false);
    var id = activeId() || '';
    var reset = get('historyResets', {})[id] ? forgetHistory(id) : Promise.resolve();
    return reset.then(function () {
      return historyStore.prepare(id, get(id ? dataKey(id, 'taskHistory') : 'taskHistory', {}));
    }).then(function (ready) {
      if (historyStore.error() && historyStore.error().message === 'history-schema-too-new') throw historyStore.error();
      return ready;
    });
  }

  function ready() {
    if (readOnly) return Promise.resolve();
    var version = get('schemaVersion', 0);
    if (version > SCHEMA_VERSION) return Promise.reject(new Error('storage-schema-too-new'));
    return Promise.all(Object.keys(get('historyResets', {})).map(forgetHistory)).then(prepareHistory).then(function () {
      if (version < SCHEMA_VERSION) writeRaw('schemaVersion', JSON.stringify(SCHEMA_VERSION));
    });
  }

  function flush() {
    usageStore.flush();
    return historyStore.flush();
  }

  function chessRating() {
    var value = get(dKey('chessRating'), 600);
    return typeof value === 'number' && value >= 100 ? value : 600;
  }

  function setChessRating(value) { return set(dKey('chessRating'), Math.max(100, Math.round(value))); }

  /* ---------- Дневной лимит времени ---------- */

  function todayKey() {
    return usageStore.today();
  }

  function limitMinutes() {
    var v = get(dKey('limitMinutes'), 20);
    return (typeof v === 'number' && v >= 0) ? v : 20;
  }

  function setLimitMinutes(m) { return set(dKey('limitMinutes'), m); }

  function usage() {
    return usageStore.read(activeId() || '');
  }

  function addUsage(seconds) {
    return usageStore.add(activeId() || '', seconds);
  }

  function resetUsage() { return usageStore.reset(activeId() || ''); }

  function remainingSeconds() {
    var lim = limitMinutes();
    if (lim <= 0) return Infinity;
    return Math.max(0, lim * 60 - usage().seconds);
  }

  /* ---------- Те же данные, но для произвольного профиля (для экрана «Дети») ---------- */

  function allStatsFor(id) { return get(dataKey(id, 'stats'), {}); }
  function achievementsFor(id) { return get(dataKey(id, 'achievements'), {}); }
  function limitMinutesFor(id) { return limitFor(id); }
  function remainingSecondsFor(id) {
    if (limitMinutesFor(id) <= 0) return Infinity;
    return Math.max(0, limitMinutesFor(id) * 60 - usageFor(id).seconds);
  }
  function bestFor(id, game) { return (get(dataKey(id, 'best'), {})[game]) || 0; }
  function limitFor(id) {
    var v = get(dataKey(id, 'limitMinutes'), 20);
    return (typeof v === 'number' && v >= 0) ? v : 20;
  }
  function setLimitFor(id, m) { return set(dataKey(id, 'limitMinutes'), m); }
  function totalStarsFor(id) {
    var all = allStatsFor(id);
    var sum = 0;
    for (var k in all) {
      if (Object.prototype.hasOwnProperty.call(all, k)) sum += (all[k].stars || 0);
    }
    return sum;
  }
  function usageFor(id) {
    return usageStore.read(id);
  }
  function resetUsageFor(id) { return usageStore.reset(id); }

  function reset() {
    if (!readOnly) { usageStore.discard(activeId() || ''); forgetHistory(activeId() || ''); }
    ['stats', 'achievements', 'best', 'usage', 'limitMinutes', 'brainLevel', 'taskHistory', 'chessRating'].forEach(function (k) {
      remove(dKey(k));
    });
  }

  global.Store = {
    schemaVersion: SCHEMA_VERSION,
    ready: ready,
    prepareHistory: prepareHistory,
    flush: flush,
    storageError: function () { return lastStorageError; },
    get: get,
    set: set,
    setReadOnly: function (enabled) { readOnly = !!enabled; },

    profiles: profiles,
    activeId: activeId,
    profile: profile,
    setProfile: setProfile,
    addProfile: addProfile,
    setAge: setAge,
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
    brainLevel: brainLevel,
    setBrainLevel: setBrainLevel,
    taskHistory: taskHistory,
    rememberTask: rememberTask,
    chessRating: chessRating,
    setChessRating: setChessRating,
    limitMinutes: limitMinutes,
    setLimitMinutes: setLimitMinutes,
    usage: usage,
    addUsage: addUsage,
    resetUsage: resetUsage,
    remainingSeconds: remainingSeconds,

    statsFor: allStatsFor,
    achievementsFor: achievementsFor,
    allStatsFor: allStatsFor,
    bestFor: bestFor,
    limitFor: limitFor,
    setLimitFor: setLimitFor,
    totalStarsFor: totalStarsFor,
    usageFor: usageFor,
    resetUsageFor: resetUsageFor,
    limitMinutesFor: limitMinutesFor,
    remainingSecondsFor: remainingSecondsFor,
    dataKey: dataKey,

    reset: reset
  };
})(window);
