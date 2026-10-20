/* audio.js — звуковые эффекты и синтезированные мелодии через Web Audio API. */
(function (global) {
  'use strict';

  var ctx = null;
  var enabled = global.Store ? global.Store.get('sound', true) : true;
  var musicEnabled = global.Store ? global.Store.get('music', true) : true;
  var musicContext = 'menu';
  var activeTrack = null;
  var musicTimer = null;
  var musicStep = 0;
  var musicBus = null;
  var majorScale = [0, 2, 4, 7, 9, 12, 14, 16, 19];

  function track(bpm, root, melody, bass) {
    return {
      bpm: Math.max(88, Math.min(116, bpm)),
      root: root,
      melody: melody,
      bass: bass,
      progression: [0, 7, 9, 5]
    };
  }

  // Самостоятельные мелодии с широкими подъёмами и припевными рок-хуками.
  var TRACKS = {
    menu: track(116, 48,
      [7, 7, 4, 2, 0, 2, 4, 7, 8, 7, 4, 2, 0, null, 2, 0],
      [0, null, 4, 2, 0, null, 5, 4, 0, null, 4, 2, 5, null, 4, 2]),
    memory: track(104, 45,
      [0, 4, 2, 6, 4, null, 2, 0, 2, 6, 7, 4, 2, 0, null, 0],
      [0, null, 2, 4, null, 4, 5, null, 0, null, 2, 4, 2, null, 5, null]),
    sequence: track(122, 50,
      [4, 4, 7, 8, null, 7, 4, 2, 0, 2, 4, 7, 8, 7, 4, null],
      [0, 0, null, 4, 0, null, 5, 4, 2, 0, null, 4, 2, null, 5, null]),
    sorting: track(112, 43,
      [2, 0, 2, 4, 7, 4, 2, 0, 4, 2, 0, 2, 4, 7, 4, null],
      [0, null, 2, null, 0, 4, null, 5, 0, null, 2, 4, 2, null, 5, null]),
    math: track(128, 48,
      [0, 2, 4, 7, 4, 7, 8, 7, 4, 2, 0, 2, 4, 7, 8, 4],
      [0, 4, null, 5, 0, null, 4, 5, 2, null, 4, null, 0, 5, null, 4]),
    odd: track(108, 46,
      [7, 4, 2, 4, 0, 2, 4, null, 7, 8, 7, 4, 2, 4, 0, null],
      [0, null, 4, null, 2, 2, null, 5, 0, null, 4, null, 2, null, 5, 4]),
    find: track(120, 41,
      [4, 7, 8, 7, 4, 2, 4, 7, 8, 7, 4, 2, 0, 2, 4, null],
      [0, null, 0, 4, 2, null, 5, null, 0, 4, null, 5, 2, null, 4, null]),
    puzzle: track(98, 53,
      [0, 4, 7, 4, 2, 6, 4, 2, 0, 4, 7, 8, 7, 4, 2, 0],
      [0, null, 4, null, 0, 4, null, 5, 2, null, 4, null, 2, null, 5, null]),
    shadow: track(106, 39,
      [0, null, 2, 4, 2, null, 4, 7, 4, 2, 0, null, 2, 4, 7, 2],
      [0, null, 4, null, 2, null, 5, 4, 0, null, 4, null, 2, null, 5, null]),
    story: track(102, 48,
      [0, 2, 4, 6, 7, 6, 4, 2, 0, 4, 6, 7, 8, 7, 4, 2],
      [0, null, null, 4, 0, null, 4, null, 2, null, 5, null, 0, null, 4, null]),
    maze: track(114, 43,
      [4, 2, 0, 2, 4, 7, 4, 2, 7, 4, 2, 0, 2, 4, 7, 4],
      [0, null, 4, null, 2, 4, null, 5, 0, null, 4, null, 2, null, 5, 4]),
    symmetry: track(110, 50,
      [8, 7, 4, 2, 4, 7, 8, 7, 4, 2, 0, 2, 4, 7, 4, 2],
      [0, null, 4, null, 2, null, 5, 4, 0, null, 4, null, 2, null, 5, null]),
    robot: track(132, 41,
      [0, 0, 4, 7, 4, 0, 2, 4, 7, 8, 7, 4, 2, 0, 4, 7],
      [0, 4, null, 4, 0, 5, null, 4, 0, 4, null, 5, 2, 4, null, 5]),
    wordbuild: track(126, 45,
      [2, 4, 7, 8, 7, 4, 2, 4, 0, 4, 7, 8, 7, 8, 4, 2],
      [0, null, 4, 0, 2, null, 5, null, 0, 4, null, 5, 2, null, 4, 5]),
    brain: track(100, 39,
      [0, 7, 4, null, 2, 4, 7, 4, 2, 0, 4, 2, 7, 4, 2, 0],
      [0, null, 0, null, 4, null, 5, null, 2, null, 2, 4, 0, null, 5, null]),
    words: track(124, 48,
      [4, 4, 7, 8, 6, 7, 4, 2, 0, 4, 7, 8, 7, 4, 2, null],
      [0, 0, null, 4, 2, null, 5, 4, 0, 0, null, 4, 2, null, 5, null]),
    runner: track(136, 43,
      [0, 4, 7, 4, 0, 4, 7, 8, 6, 7, 4, 2, 0, 2, 4, 7],
      [0, 4, 0, null, 2, 5, null, 4, 0, 4, 0, null, 2, 5, null, 4])
  };

  function ensureCtx() {
    if (ctx) return ctx;
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      musicBus = ctx.createGain();
      musicBus.gain.setValueAtTime(0.58, ctx.currentTime);
      musicBus.connect(ctx.destination);
    } catch (e) { ctx = null; musicBus = null; }
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

  function musicNote(freq, start, duration, volume, type) {
    if (!ctx || ctx.state !== 'running') return;
    var now = ctx.currentTime + (start || 0);
    var osc = ctx.createOscillator();
    var doubled = type === 'sawtooth' ? ctx.createOscillator() : null;
    var filter = ctx.createBiquadFilter();
    var gain = ctx.createGain();
    osc.type = type || 'sawtooth';
    osc.frequency.setValueAtTime(freq, now);
    if (doubled) {
      doubled.type = 'sawtooth';
      doubled.frequency.setValueAtTime(freq, now);
      osc.detune.setValueAtTime(-3, now);
      doubled.detune.setValueAtTime(3, now);
    }
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(700, now);
    filter.frequency.exponentialRampToValueAtTime(2200, now + Math.min(0.1, duration * 0.4));
    filter.frequency.exponentialRampToValueAtTime(850, now + duration);
    filter.Q.setValueAtTime(0.8, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(volume * 0.2, now + duration * 0.58);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(filter);
    if (doubled) doubled.connect(filter);
    filter.connect(gain);
    gain.connect(musicBus || ctx.destination);
    osc.start(now);
    if (doubled) doubled.start(now);
    osc.stop(now + duration + 0.02);
    if (doubled) doubled.stop(now + duration + 0.02);
  }

  function stopMusic() {
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  }

  function canPlayMusic() {
    return musicEnabled && !!activeTrack && !document.hidden && ctx && ctx.state === 'running';
  }

  function midiFreq(note) { return 440 * Math.pow(2, (note - 69) / 12); }

  function rockKick() {
    if (!ctx || ctx.state !== 'running') return;
    var now = ctx.currentTime;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.14);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    osc.connect(gain);
    gain.connect(musicBus || ctx.destination);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  function softBackbeat() {
    if (!ctx || ctx.state !== 'running') return;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    var now = ctx.currentTime;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(250, now + 0.09);
    gain.gain.setValueAtTime(0.035, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
    osc.connect(gain);
    gain.connect(musicBus || ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  function majorNote(degree) {
    return majorScale[degree] || 0;
  }

  function playMusicStep() {
    if (!canPlayMusic()) { stopMusic(); return; }
    var step = musicStep % activeTrack.melody.length;
    var lead = activeTrack.melody[step];
    var bass = activeTrack.bass[step];
    if (lead !== null) {
      var leadFreq = midiFreq(activeTrack.root + 24 + majorNote(lead));
      musicNote(leadFreq, 0, 0.26, 0.032, 'sawtooth');
      musicNote(leadFreq * 2, 0.025, 0.16, 0.008, 'triangle');
    }
    if (bass !== null) musicNote(midiFreq(activeTrack.root + majorNote(bass)), 0, 0.28, 0.024, 'triangle');
    if (step % 8 === 0) {
      var bar = Math.floor((musicStep % 32) / 8);
      var chordRoot = activeTrack.root + 12 + activeTrack.progression[bar];
      var third = bar === 2 ? 3 : 4;
      musicNote(midiFreq(chordRoot), 0.015, 0.42, 0.009, 'sawtooth');
      musicNote(midiFreq(chordRoot + third), 0.03, 0.39, 0.008, 'sawtooth');
      musicNote(midiFreq(chordRoot + 7), 0.045, 0.35, 0.007, 'sawtooth');
    }
    if (step % 8 === 0 || step % 8 === 4) rockKick();
    if (step % 8 === 2 || step % 8 === 6) softBackbeat();
    musicStep++;
  }

  function startMusic() {
    if (musicTimer || !musicEnabled || !activeTrack || document.hidden || !ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().then(function () {
        if (!musicTimer) startMusic();
      }).catch(function () {});
      return;
    }
    if (ctx.state !== 'running') return;
    playMusicStep();
    musicTimer = setInterval(playMusicStep, 30000 / activeTrack.bpm);
  }

  function setMusicEnabled(v) {
    musicEnabled = !!v;
    global.Store && global.Store.set('music', musicEnabled);
    if (musicEnabled) {
      var c = ensureCtx();
      if (c && c.state === 'suspended') c.resume().then(startMusic).catch(function () {});
      else startMusic();
    } else {
      stopMusic();
    }
    return musicEnabled;
  }

  function setMusicContext(value) {
    var nextTrack = value === 'pause' ? null : TRACKS[value] || TRACKS.menu;
    if (nextTrack === activeTrack && value === musicContext) return;
    stopMusic();
    musicContext = value;
    activeTrack = nextTrack;
    musicStep = 0;
    if (activeTrack) startMusic();
  }

  function isMusicEnabled() { return musicEnabled; }

  // Возобновляем контекст при первом касании (требование браузеров).
  function unlock() {
    var c = ensureCtx();
    if (c && c.state === 'suspended') c.resume().then(startMusic).catch(function () {});
    else startMusic();
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stopMusic();
    else startMusic();
  });

  global.Sound = {
    play: play,
    setEnabled: setEnabled,
    isEnabled: isEnabled,
    unlock: unlock,
    setMusicEnabled: setMusicEnabled,
    isMusicEnabled: isMusicEnabled,
    setMusicContext: setMusicContext
  };
})(window);
