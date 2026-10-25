/* task-history.js — версия 1 истории задач, атомарный импорт и записи IndexedDB. */
(function (global) {
  'use strict';
  var VERSION = 1;

  function create(options) {
    options = options || {};
    var opening = null;
    var profiles = Object.create(null);
    var pending = [];
    var lastError = null;

    function report(profile, state, error) {
      lastError = error;
      state.failed = true;
      if (state.ready && options.fallback) options.fallback(profile, snapshot(state));
    }

    function snapshot(state) {
      var out = Object.create(null);
      Object.keys(state.groups).forEach(function (game) { out[game] = Array.from(state.groups[game]); });
      return out;
    }

    function track(promise) {
      pending.push(promise);
      promise.then(function () { pending = pending.filter(function (item) { return item !== promise; }); });
      return promise;
    }

    function open() {
      if (opening) return opening;
      opening = new Promise(function (resolve, reject) {
        if (!global.indexedDB) { reject(new Error('indexeddb-unavailable')); return; }
        var settled = false;
        var request = global.indexedDB.open(options.name || 'boygame-history', VERSION);
        request.onupgradeneeded = function () {
          var db = request.result;
          var tasks = db.createObjectStore('tasks', { keyPath: ['profile', 'game', 'signature'] });
          tasks.createIndex('profile', 'profile', { unique: false });
          db.createObjectStore('migrations', { keyPath: 'profile' });
        };
        request.onerror = function () { settled = true; reject(request.error && request.error.name === 'VersionError' ? new Error('history-schema-too-new') : (request.error || new Error('indexeddb-open-failed'))); };
        request.onblocked = function () { settled = true; reject(new Error('indexeddb-blocked')); };
        request.onsuccess = function () {
          var db = request.result;
          if (settled) { db.close(); return; }
          settled = true;
          db.onversionchange = function () { db.close(); opening = null; };
          resolve(db);
        };
      });
      return opening;
    }

    function prepare(profile, legacy) {
      if (profiles[profile]) return profiles[profile].loading;
      var state = { groups: Object.create(null), ready: false, failed: false };
      profiles[profile] = state;
      state.loading = open().then(function (db) {
        return new Promise(function (resolve, reject) {
          var tx = db.transaction(['tasks', 'migrations'], 'readwrite');
          var tasks = tx.objectStore('tasks');
          var migrations = tx.objectStore('migrations');
          var marker = migrations.get(profile);
          var future = false;
          marker.onsuccess = function () {
            if (marker.result && marker.result.version > VERSION) { future = true; tx.abort(); return; }
            // Импорт объединением повторяем безопасно: это также подбирает записи
            // localStorage, созданные при временном отказе IndexedDB или старой версией.
            Object.keys(legacy || {}).forEach(function (game) {
              if (!Array.isArray(legacy[game])) return;
              legacy[game].forEach(function (signature) {
                if (typeof signature === 'string') tasks.put({ profile: profile, game: game, signature: signature });
              });
            });
            migrations.put({ profile: profile, version: VERSION });
            var read = tasks.index('profile').getAll(profile);
            read.onsuccess = function () {
              read.result.forEach(function (row) {
                if (!state.groups[row.game]) state.groups[row.game] = new Set();
                state.groups[row.game].add(row.signature);
              });
            };
          };
          tx.oncomplete = function () { state.ready = true; resolve(true); };
          tx.onabort = tx.onerror = function () {
            reject(new Error(future ? 'history-schema-too-new' : 'history-import-failed'));
          };
        });
      }).catch(function (error) { report(profile, state, error); return false; });
      return state.loading;
    }

    function remember(profile, game, signature) {
      var state = profiles[profile];
      if (!state || !state.ready) return false;
      if (!state.groups[game]) state.groups[game] = new Set();
      if (state.groups[game].has(signature)) return false;
      state.groups[game].add(signature);
      if (state.failed) {
        if (options.fallback) options.fallback(profile, snapshot(state));
      } else {
        track(open().then(function (db) {
          return new Promise(function (resolve, reject) {
            var tx = db.transaction('tasks', 'readwrite');
            tx.objectStore('tasks').put({ profile: profile, game: game, signature: signature });
            tx.oncomplete = function () { resolve(true); };
            tx.onerror = tx.onabort = function () { reject(new Error('history-write-failed')); };
          });
        }).catch(function (error) { report(profile, state, error); return false; }));
      }
      return true;
    }

    function forget(profile) {
      // Только явный сброс/удаление профиля вызывает этот метод.
      var state = profiles[profile] || { groups: Object.create(null), ready: false, failed: false };
      profiles[profile] = state;
      state.groups = Object.create(null);
      state.ready = false;
      if (!global.indexedDB) return Promise.resolve(false);
      state.loading = track(open().then(function (db) {
        return new Promise(function (resolve, reject) {
          var tx = db.transaction(['tasks', 'migrations'], 'readwrite');
          var request = tx.objectStore('tasks').index('profile').openCursor(profile);
          request.onsuccess = function () {
            var cursor = request.result;
            if (cursor) { cursor.delete(); cursor.continue(); }
          };
          tx.objectStore('migrations').put({ profile: profile, version: VERSION });
          tx.oncomplete = function () {
            state.groups = Object.create(null);
            if (profiles[profile] === state) delete profiles[profile];
            resolve(true);
          };
          tx.onerror = tx.onabort = function () { reject(new Error('history-delete-failed')); };
        });
      }).catch(function (error) { report(profile, state, error); return false; }));
      return state.loading;
    }

    return {
      prepare: prepare, remember: remember, forget: forget,
      ready: function (profile) { return !!(profiles[profile] && profiles[profile].ready); },
      list: function (profile, game) {
        var state = profiles[profile];
        return state && state.groups[game] ? Array.from(state.groups[game]) : [];
      },
      flush: function () { return Promise.all(pending.slice()); },
      error: function () { return lastError; },
      close: function () { return opening ? opening.then(function (db) { db.close(); }).catch(function () {}) : Promise.resolve(); }
    };
  }

  global.TaskHistory = { version: VERSION, create: create };
})(window);
