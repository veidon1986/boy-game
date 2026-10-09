/* audio.js — звуковые эффекты через Web Audio API (без файлов). */
(function (global) {
  'use strict';

  var ctx = null;
  var enabled = global.Store ? global.Store.get('sound', true) : true;

  function ensureCtx() {
    if (!enabled) return null;
    if (ctx) return ctx;
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch (e) { ctx = null; }
    return ctx;
  }

  function tone(freq, start, dur, type, gain) {
    var c = ensureCtx();
    if (!c) return;
    var t0 = c.currentTime + start;
    var osc = c.createOscillator();
    var g = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain || 0.18, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  var FX = {
    tap:   function () { tone(520, 0, 0.09, 'sine', 0.12); },
    flip:  function () { tone(660, 0, 0.08, 'triangle', 0.1); },
    match: function () { tone(784, 0, 0.12, 'sine', 0.16); tone(1046, 0.09, 0.16, 'sine', 0.14); },
    wrong: function () { tone(220, 0, 0.18, 'sawtooth', 0.1); tone(180, 0.1, 0.2, 'sawtooth', 0.09); },
    win:   function () {
      var notes = [523, 659, 784, 1046];
      for (var i = 0; i < notes.length; i++) tone(notes[i], i * 0.12, 0.22, 'sine', 0.16);
    },
    star:  function () { tone(1200, 0, 0.1, 'sine', 0.12); }
  };

  function play(name, force) {
    if (!enabled && !force) return;
    var fn = FX[name] || FX.tap;
    try { fn(); } catch (e) {}
  }

  function setEnabled(v) {
    enabled = !!v;
    global.Store && global.Store.set('sound', enabled);
    if (enabled) { ensureCtx(); if (ctx && ctx.state === 'suspended') ctx.resume(); }
    return enabled;
  }

  function isEnabled() { return enabled; }

  // Возобновляем контекст при первом касании (требование браузеров).
  function unlock() {
    var c = ensureCtx();
    if (c && c.state === 'suspended') c.resume();
  }

  global.Sound = {
    play: play,
    setEnabled: setEnabled,
    isEnabled: isEnabled,
    unlock: unlock
  };
})(window);
