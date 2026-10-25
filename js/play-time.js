/* play-time.js — измерение активных отрезков, включая уход в фон. */
(function (global) {
  'use strict';
  function create(options) {
    var last = options.now();
    var lastFlush = last;
    var visible = options.visible();
    function sample() {
      var now = options.now();
      var seconds = Math.max(0, (now - last) / 1000);
      last = now;
      if (visible && options.active() && seconds) options.add(seconds);
      if (now - lastFlush >= 10000) { options.flush(); lastFlush = now; }
    }
    return {
      sample: sample,
      visibility: function () { sample(); visible = options.visible(); options.flush(); lastFlush = options.now(); },
      checkpoint: function () { sample(); options.flush(); lastFlush = options.now(); },
      suspend: function () { sample(); visible = false; options.flush(); }
    };
  }
  global.PlayTime = { create: create };
})(window);
