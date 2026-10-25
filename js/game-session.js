/* game-session.js — совместимый жизненный цикл игры: запуск, пауза и очистка. */
(function (global) {
  'use strict';

  function start(game, root, app) {
    var result = game.start(root, app);
    // Прежние игры возвращают cleanup(); новые могут вернуть набор методов.
    var hooks = typeof result === 'function' ? { destroy: result } : result;
    if (!hooks || typeof hooks.destroy !== 'function') throw new Error('Game must return cleanup or { destroy }: ' + game.id);
    if ((hooks.pause || hooks.resume) && (typeof hooks.pause !== 'function' || typeof hooks.resume !== 'function')) throw new Error('Game pause requires both pause and resume: ' + game.id);
    var destroyed = false;
    var paused = false;
    return {
      isPaused: function () { return paused; },
      destroy: function () {
        if (destroyed) return;
        destroyed = true;
        hooks.destroy();
      },
      pause: function () {
        if (destroyed || paused || !hooks.pause) return false;
        if (hooks.pause() === false) return false;
        paused = true;
        return true;
      },
      resume: function () {
        if (destroyed || !paused || !hooks.resume) return false;
        if (hooks.resume() === false) return false;
        paused = false;
        return true;
      }
    };
  }

  global.GameSession = { start: start };
})(window);
