/* game-loader.js — загрузка зависимостей и реализации выбранной игры. */
(function (global) {
  'use strict';
  function create(options) {
    options = options || {};
    var loaded = Object.create(null);
    function browserScript(file) {
      return new Promise(function (resolve, reject) {
        var script = document.createElement('script');
        var timer = setTimeout(function () { finish(new Error('Script timed out: ' + file)); }, 15000);
        function finish(error) {
          clearTimeout(timer);
          script.onload = script.onerror = null;
          if (error) { script.remove(); reject(error); }
          else resolve();
        }
        script.src = file + '?build=' + global.AppBuild.id;
        script.async = false;
        script.onload = function () { finish(); };
        script.onerror = function () { finish(new Error('Script could not load: ' + file)); };
        document.head.appendChild(script);
      });
    }
    function script(file) {
      if (!loaded[file]) loaded[file] = Promise.resolve().then(function () {
        return (options.loadScript || browserScript)(file);
      }).catch(function (error) { delete loaded[file]; throw error; });
      return loaded[file];
    }
    return {
      load: function (game) {
        return game.scripts.concat([game.file]).reduce(function (chain, file) {
          return chain.then(function () { return script(file); });
        }, Promise.resolve());
      }
    };
  }
  global.GameLoader = { create: create };
})(window);
