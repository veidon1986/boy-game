/* analytics.js — добровольная, отключённая по умолчанию аналитика. */
(function (global) {
  'use strict';

  var config = global.BOYGAME_ANALYTICS_CONFIG || {};
  var base = String(config.endpoint || '').replace(/\/+$/, '');
  var policy = String(config.privacyUrl || '');
  var secureEndpoint = /^https:\/\//i.test(base) ||
    (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(base) &&
     /^(localhost|127\.0\.0\.1)$/.test(global.location.hostname));
  var validPolicy = /^https:\/\//i.test(policy) || (/^\/(?!\/)/.test(policy));
  var configured = config.enabled === true && secureEndpoint && validPolicy;

  function consented() {
    return configured && Store.get('analyticsEnabled', false) === true;
  }

  function makeId() {
    if (!global.crypto || !global.crypto.getRandomValues) return null;
    var bytes = new Uint8Array(16);
    global.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    var hex = Array.prototype.map.call(bytes, function (b) {
      return (b + 0x100).toString(16).slice(1);
    }).join('');
    return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20);
  }

  function playerId(profile) {
    if (!profile || !profile.id || !consented()) return null;
    var ids = Store.get('analyticsPlayerIds', {});
    var id = ids[profile.id] || '';
    if (typeof id !== 'string' || !id) {
      id = makeId();
      if (!id) return null;
      ids[profile.id] = id;
      Store.set('analyticsPlayerIds', ids);
    }
    return id;
  }

  function request(path, options) {
    return fetch(base + path, options);
  }

  function recordLaunch(gameId) {
    if (!consented() || typeof gameId !== 'string') return;
    var id = playerId(Store.profile());
    if (!id) return;
    request('/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: id, gameId: gameId })
    }).catch(function () { /* статистика не влияет на игру при отсутствии сети */ });
  }

  function getStats(token) {
    return request('/stats?days=30', {
      headers: { 'Authorization': 'Bearer ' + token }
    }).then(function (response) {
      if (!response.ok) throw new Error(response.status === 401 ? 'unauthorized' : 'request');
      return response.json();
    });
  }

  function deletePlayerId(id) {
    if (!id) return Promise.resolve();
    return request('/player', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: id })
    }).then(function (response) {
      if (!response.ok) throw new Error('request');
    });
  }

  function deletePlayer(profile) {
    var ids = Store.get('analyticsPlayerIds', {});
    var id = profile && profile.id && ids[profile.id];
    return deletePlayerId(id).then(function () {
      if (profile && profile.id) {
        var latest = Store.get('analyticsPlayerIds', {});
        delete latest[profile.id];
        Store.set('analyticsPlayerIds', latest);
      }
    }).catch(function () {
      Store.set('analyticsDeletePending', true);
      throw new Error('delete_failed');
    });
  }

  function hasPendingDeletion() {
    return Store.get('analyticsDeletePending', false) === true;
  }

  function revoke() {
    Store.set('analyticsEnabled', false);
    var ids = Store.get('analyticsPlayerIds', {});
    var pending = Object.keys(ids).map(function (profileId) {
      return { profileId: profileId, id: ids[profileId] };
    }).filter(function (item) { return !!item.id; });
    return Promise.all(pending.map(function (item) {
      return deletePlayerId(item.id).then(function () {
        delete ids[item.profileId];
        Store.set('analyticsPlayerIds', ids);
      });
    })).then(function () {
      Store.set('analyticsDeletePending', false);
    }).catch(function () {
      Store.set('analyticsDeletePending', true);
      throw new Error('delete_failed');
    });
  }

  function retryDeletion() {
    var ids = Store.get('analyticsPlayerIds', {});
    var pending = Object.keys(ids).map(function (profileId) {
      return { profileId: profileId, id: ids[profileId] };
    }).filter(function (item) { return !!item.id; });
    return Promise.all(pending.map(function (item) {
      return deletePlayerId(item.id).then(function () {
        delete ids[item.profileId];
        Store.set('analyticsPlayerIds', ids);
      });
    })).then(function () {
      Store.set('analyticsDeletePending', false);
    });
  }

  global.Analytics = {
    configured: function () { return configured; },
    consented: consented,
    hasPendingDeletion: hasPendingDeletion,
    revoke: revoke,
    retryDeletion: retryDeletion,
    privacyUrl: validPolicy ? policy : '',
    recordLaunch: recordLaunch,
    getStats: getStats,
    deletePlayer: deletePlayer
  };
})(window);
