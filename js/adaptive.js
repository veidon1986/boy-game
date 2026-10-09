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
    // Верхний доступный уровень (младшим возрастам «сложно» недоступно).
    this.maxIndex = (typeof opts.maxIndex === 'number') ? opts.maxIndex : LEVELS.length - 1;
    if (indexOf(this.level) > this.maxIndex) this.level = LEVELS[this.maxIndex];
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
    j = Math.max(0, Math.min(this.maxIndex, j));
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
  Adaptive.up = function (level, maxIndex) {
    var hi = (typeof maxIndex === 'number') ? maxIndex : LEVELS.length - 1;
    return LEVELS[Math.min(hi, indexOf(level) + 1)];
  };
  Adaptive.down = function (level) { return LEVELS[Math.max(0, indexOf(level) - 1)]; };
  Adaptive.LEVELS = LEVELS;

  global.Adaptive = Adaptive;
})(window);
