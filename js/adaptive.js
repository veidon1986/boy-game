/* adaptive.js — общий помощник адаптивной сложности.
   Поднимает уровень после серии успехов и опускает после ошибок. */
(function (global) {
  'use strict';

  var LEVELS = ['easy', 'medium', 'hard'];

  function indexOf(level) {
    var i = LEVELS.indexOf(level);
    return i < 0 ? 0 : i;
  }

  function Adaptive(opts) {
    opts = opts || {};
    this.level = LEVELS[indexOf(opts.level)];
    this.upStreak = opts.upStreak || 3;   // сколько успехов подряд для повышения
    this.downFails = opts.downFails || 2; // сколько ошибок для понижения
    this.onChange = opts.onChange || function () {};
    this.streak = 0;
    this.fails = 0;
  }

  Adaptive.prototype.reset = function () { this.streak = 0; this.fails = 0; };

  Adaptive.prototype.setLevel = function (level) {
    this.level = LEVELS[indexOf(level)];
    this.reset();
  };

  Adaptive.prototype._shift = function (dir) {
    var j = indexOf(this.level) + dir;
    j = Math.max(0, Math.min(LEVELS.length - 1, j));
    var changed = j !== indexOf(this.level);
    this.reset();
    if (!changed) return false;
    this.level = LEVELS[j];
    return true;
  };

  Adaptive.prototype.correct = function () {
    this.streak++;
    this.fails = 0;
    if (this.streak >= this.upStreak && this._shift(1)) {
      this.onChange(this.level, 'up');
    }
  };

  Adaptive.prototype.wrong = function () {
    this.fails++;
    this.streak = 0;
    if (this.fails >= this.downFails && this._shift(-1)) {
      this.onChange(this.level, 'down');
    }
  };

  // Для игр с одним полем (память, сортировка): соседний уровень.
  Adaptive.up = function (level) { return LEVELS[Math.min(LEVELS.length - 1, indexOf(level) + 1)]; };
  Adaptive.down = function (level) { return LEVELS[Math.max(0, indexOf(level) - 1)]; };
  Adaptive.LEVELS = LEVELS;

  global.Adaptive = Adaptive;
})(window);
