/* usage-store.js — дневное время в памяти с добавочным сохранением. */
(function (global) {
  'use strict';
  function create(options) {
    var pending = Object.create(null);
    function today() {
      var d = new Date();
      return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
    }
    function read(id) {
      var day = today();
      var saved = options.read(id);
      var seconds = saved && saved.day === day ? Number(saved.seconds) || 0 : 0;
      var extra = pending[id];
      return { day: day, seconds: seconds + (extra && extra.day === day ? extra.seconds : 0) };
    }
    function flush() {
      if (options.readOnly()) return;
      Object.keys(pending).forEach(function (id) {
        var extra = pending[id];
        if (extra.day !== today()) { delete pending[id]; return; }
        var value = read(id);
        // Повторно читаем сохранённую сумму: другая вкладка могла добавить время.
        if (options.write(id, value)) delete pending[id];
      });
    }
    return {
      read: read, flush: flush,
      add: function (id, seconds) {
        if (options.readOnly() || !isFinite(seconds) || seconds <= 0) return read(id);
        if (!pending[id] || pending[id].day !== today()) pending[id] = { day: today(), seconds: 0 };
        pending[id].seconds += seconds;
        return read(id);
      },
      reset: function (id) {
        if (options.readOnly()) return read(id);
        var value = { day: today(), seconds: 0 };
        if (options.write(id, value)) delete pending[id];
        return value;
      },
      discard: function (id) { delete pending[id]; },
      today: today
    };
  }
  global.UsageStore = { create: create };
})(window);
