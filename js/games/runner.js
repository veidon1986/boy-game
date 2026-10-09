/* games/runner.js — «Дракончик»: бесконечный раннер на реакцию.
   Открывается на статусе «Умник». Без звёзд — только личный рекорд. */
(function (global) {
  'use strict';

  var el = UI.el;
  var OBSTACLES = ['🌵', '🪨', '🌲', '🍄'];
  var EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

  function start(root, App) {
    var hint = el('p', { class: 'game-hint' }, t('runner.hint'));

    var scoreEl = el('span', { class: 'stat' });
    var bestEl = el('span', { class: 'stat' });
    var hud = el('div', { class: 'game-stats' }, [scoreEl, bestEl]);

    var canvas = el('canvas', { class: 'runner-canvas' });
    var wrap = el('div', { class: 'runner-wrap' }, canvas);

    root.appendChild(hint);
    root.appendChild(hud);
    root.appendChild(wrap);

    var ctx = canvas.getContext('2d');
    var dpr = 1, W = 320, H = 240, groundY = 200;

    var raf = null;
    var last = 0;
    var running = false;
    var over = false;

    var best = Store.best('runner');

    var G = 2100;          // гравитация, px/с²
    var JUMP = 690;        // сила прыжка
    var BASE_SPEED = 250;  // начальная скорость, px/с
    var MAX_SPEED = 560;
    var ACCEL = 9;         // прирост скорости, px/с за секунду

    var dragon = { x: 58, size: 42, bottom: 200, vy: 0, onGround: true };
    var obstacles = [];
    var speed = BASE_SPEED;
    var distance = 0;
    var spawnGap = 0;
    var elapsed = 0;

    function resize() {
      dpr = global.devicePixelRatio || 1;
      var rect = wrap.getBoundingClientRect();
      W = Math.max(260, Math.round(rect.width) || 320);
      H = Math.max(200, Math.min(320, Math.round(W * 0.46)));
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      groundY = H - 42;
      dragon.bottom = groundY;
    }

    function updateHud() {
      scoreEl.textContent = t('runner.score') + ': ' + Math.floor(distance);
      bestEl.textContent = t('runner.best') + ': ' + Math.floor(best);
    }

    function reset() {
      obstacles = [];
      speed = BASE_SPEED;
      distance = 0;
      elapsed = 0;
      dragon.bottom = groundY;
      dragon.vy = 0;
      dragon.onGround = true;
      spawnGap = 280;
      over = false;
      running = true;
      last = 0;
      updateHud();
    }

    function jump() {
      if (!running || over) return;
      if (dragon.onGround) {
        dragon.vy = -JUMP;
        dragon.onGround = false;
        Sound.play('tap');
      }
    }

    function spawnObstacle() {
      obstacles.push({ emoji: UI.pick(OBSTACLES), size: UI.randInt(30, 40), x: W + 20 });
    }

    function hit() {
      var dl = dragon.x - dragon.size * 0.26;
      var dr = dragon.x + dragon.size * 0.26;
      var db = dragon.bottom;
      var dtp = dragon.bottom - dragon.size * 0.72;
      for (var i = 0; i < obstacles.length; i++) {
        var ob = obstacles[i];
        var ol = ob.x - ob.size * 0.18;
        var or = ob.x + ob.size * 0.16;
        var obTop = groundY - ob.size * 0.82;
        if (dr > ol && dl < or && db > obTop && dtp < groundY) return true;
      }
      return false;
    }

    function draw() {
      var grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#8fd3ff');
      grad.addColorStop(1, '#d8f2ff');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      ctx.font = '28px ' + EMOJI_FONT;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('☀️', W - 46, 14);

      // земля
      ctx.fillStyle = '#a7e08a';
      ctx.fillRect(0, groundY, W, H - groundY);
      ctx.fillStyle = '#7cc65a';
      ctx.fillRect(0, groundY, W, 5);

      // препятствия
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      for (var i = 0; i < obstacles.length; i++) {
        var ob = obstacles[i];
        ctx.font = Math.round(ob.size * 1.15) + 'px ' + EMOJI_FONT;
        ctx.fillText(ob.emoji, ob.x + ob.size * 0.5, groundY + 2);
      }

      // дракончик
      ctx.font = Math.round(dragon.size * 1.1) + 'px ' + EMOJI_FONT;
      ctx.fillText('🐉', dragon.x, dragon.bottom + 3);
    }

    function frame(now) {
      if (!running) return;
      if (!last) last = now;
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      elapsed += dt;
      speed = Math.min(MAX_SPEED, BASE_SPEED + elapsed * ACCEL);

      if (!dragon.onGround) {
        dragon.vy += G * dt;
        dragon.bottom += dragon.vy * dt;
        if (dragon.bottom >= groundY) { dragon.bottom = groundY; dragon.vy = 0; dragon.onGround = true; }
      }

      for (var i = obstacles.length - 1; i >= 0; i--) {
        var ob = obstacles[i];
        ob.x -= speed * dt;
        if (ob.x + ob.size < -10) obstacles.splice(i, 1);
      }
      spawnGap -= speed * dt;
      if (spawnGap <= 0) {
        spawnObstacle();
        spawnGap = Math.round(speed * (0.9 + Math.random() * 0.8));
      }

      distance += speed * dt * 0.12;

      if (hit()) { gameOver(); return; }

      draw();
      updateHud();
      raf = global.requestAnimationFrame(frame);
    }

    function gameOver() {
      over = true;
      running = false;
      if (raf) { global.cancelAnimationFrame(raf); raf = null; }
      Sound.play('wrong');

      var score = Math.floor(distance);
      var isRecord = score > best;
      if (isRecord) { best = score; Store.setBest('runner', score); }
      updateHud();

      var body = el('div', { class: 'result' }, [
        el('div', { class: 'result-emoji' }, '🐉'),
        el('div', { class: 'result-title' }, t('runner.gameover')),
        el('p', { class: 'result-text' }, t('runner.score') + ': ' + score),
        el('p', { class: 'result-text' }, t('runner.best') + ': ' + Math.floor(best)),
        isRecord ? el('div', { class: 'result-note' }, '🏆 ' + t('runner.record')) : null,
        el('div', { class: 'result-actions' }, [
          el('button', {
            type: 'button', class: 'btn primary',
            onclick: function () {
              App.hideOverlay();
              if (App.canPlay()) { reset(); raf = global.requestAnimationFrame(frame); }
              else App.showBlocked();
            }
          }, '🔁 ' + t('runner.again')),
          el('button', {
            type: 'button', class: 'btn',
            onclick: function () { App.hideOverlay(); App.goHome(); }
          }, '🏠 ' + t('home'))
        ])
      ]);
      App.showOverlay(body);
    }

    function onPointer(e) { if (e) e.preventDefault(); jump(); }
    function onKey(e) {
      if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); jump(); }
    }

    wrap.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);

    global.requestAnimationFrame(function () {
      resize();
      reset();
      raf = global.requestAnimationFrame(frame);
    });

    return function cleanup() {
      running = false;
      if (raf) { global.cancelAnimationFrame(raf); raf = null; }
      wrap.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }

  App.register({
    id: 'runner',
    emoji: '🐉',
    titleKey: 'game.runner',
    descKey: 'game.runner.desc',
    requires: 'rank.smart',
    noStars: true,
    start: start
  });
})(window);
