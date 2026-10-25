/* games/runner.js — «Дракончик»: бесконечный раннер на реакцию.
   Открывается на статусе «Умник». Без звёзд — только личный рекорд. */
(function (global) {
  'use strict';

  var el = UI.el;
  var OBSTACLES = ['🌵', '🪨', '🌲', '🍄'];
  var EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

  function start(root, App) {
    var hint = el('p', { class: 'game-hint' }, t('game.runner.hint'));

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

    var dragon = { x: 58, size: 42, bottom: 200, vy: 0, onGround: true, stride: 0, landing: 0 };
    var dust = [];
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
      var height = Math.max(0, groundY - dragon.bottom);
      groundY = H - 42;
      dragon.bottom = groundY - height;
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
      dragon.stride = 0;
      dragon.landing = 0;
      dust = [];
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
        dragon.landing = 0;
        puff(4);
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

    // Всё тело рисуется по частям: поза связана с физикой, а не с частотой кадров.
    function puff(count) {
      for (var i = 0; i < count; i++) {
        dust.push({ x: dragon.x - 10 + i * 4, y: groundY - 2,
          vx: -28 - i * 13, vy: -14 - (i % 3) * 9, age: 0, life: 0.3 + i * 0.025 });
      }
    }

    function oval(x, y, rx, ry, color) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    function shape(color, trace) {
      ctx.beginPath();
      trace();
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.stroke();
    }

    function leg(phase, far, airborne) {
      var swing = Math.sin(phase);
      var footX = airborne ? (dragon.vy < 0 ? -6 : 3) : swing * 8;
      var footY = airborne ? (dragon.vy < 0 ? -11 : -4) : -Math.max(0, Math.cos(phase)) * 7;
      var hipX = far ? -7 : 2;
      ctx.strokeStyle = far ? '#23784f' : '#206447';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(hipX, -15);
      ctx.quadraticCurveTo(hipX - 5 - swing * 3, -7, hipX + footX, footY - 3);
      ctx.stroke();
      ctx.lineWidth = 4.5;
      ctx.strokeStyle = far ? '#399d65' : '#75cf70';
      ctx.stroke();
      oval(hipX + footX + 2, footY - 2.5, 6, 2.7, far ? '#2d8d59' : '#67bd64');
      ctx.strokeStyle = '#226347';
      ctx.lineWidth = 1.5;
    }

    function drawDragon() {
      var airborne = !dragon.onGround;
      var height = Math.max(0, groundY - dragon.bottom);
      var phase = dragon.stride;
      var squash = dragon.landing > 0 ? Math.sin((1 - dragon.landing / 0.24) * Math.PI) : 0;
      var bob = airborne ? 0 : -Math.abs(Math.sin(phase)) * 1.8;
      var tilt = airborne ? Math.max(-0.16, Math.min(0.14, dragon.vy / 3800)) : Math.sin(phase) * 0.025;

      ctx.save();
      ctx.globalAlpha = Math.max(0.08, 0.2 - height / 850);
      oval(dragon.x, groundY + 2, Math.max(9, 20 - height * 0.07), 3, '#315c53');
      ctx.restore();

      ctx.save();
      ctx.translate(dragon.x, dragon.bottom + bob);
      ctx.scale(dragon.size / 42, dragon.size / 42);
      ctx.scale(1 + squash * 0.17 - (airborne && dragon.vy < -250 ? 0.04 : 0), 1 - squash * 0.22);
      ctx.rotate(tilt);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#226347';
      ctx.lineWidth = 1.5;

      // Хвост догоняет тело, а при прыжке тянется вниз.
      var tail = airborne ? 4 + Math.sin(elapsed * 10) * 2 : Math.sin(phase - 0.8) * 4;
      shape('#55b66a', function () {
        ctx.moveTo(-10, -21);
        ctx.bezierCurveTo(-22, -18, -24, -12 + tail, -31, -21 + tail);
        ctx.quadraticCurveTo(-27, -5 + tail, -9, -10);
      });

      leg(phase + Math.PI, true, airborne);

      // Крыло раскрывается в полёте и складывается при касании земли.
      var wing = airborne ? 10 + Math.sin(elapsed * 17) * 4 : 2 + Math.sin(phase) * 2;
      shape('#82a6dc', function () {
        ctx.moveTo(-5, -23);
        ctx.quadraticCurveTo(-18, -28 - wing, -23, -36 - wing);
        ctx.lineTo(-22, -21);
        ctx.lineTo(-16, -24);
        ctx.lineTo(-13, -18);
      });
      ctx.beginPath();
      ctx.moveTo(-5, -23); ctx.lineTo(-23, -36 - wing); ctx.stroke();

      shape('#69c775', function () {
        ctx.moveTo(-13, -14);
        ctx.bezierCurveTo(-23, -33, -7, -40, 5, -31);
        ctx.bezierCurveTo(17, -23, 12, -8, -1, -9);
      });
      oval(3, -20, 7, 10, '#d7eaa1');

      // Гребень, округлая мордочка и один хорошо читаемый глаз.
      shape('#f7c76a', function () {
        ctx.moveTo(-2, -34); ctx.lineTo(-6, -43); ctx.lineTo(2, -39);
        ctx.lineTo(4, -46); ctx.lineTo(10, -39);
      });
      shape('#78d17c', function () {
        ctx.moveTo(0, -28);
        ctx.bezierCurveTo(-5, -38, 0, -44, 9, -43);
        ctx.quadraticCurveTo(19, -43, 19, -35);
        ctx.bezierCurveTo(32, -36, 31, -25, 20, -25);
        ctx.quadraticCurveTo(9, -22, 0, -28);
      });
      oval(12, -36.5, 4, 5.2, '#fffdf0');
      oval(13.5, -36, 1.9, 3.2, '#203b44');
      oval(14, -37.2, 0.7, 1, '#fff');
      oval(25, -31.5, 1.1, 1, '#286b49');
      oval(17.5, -29, 3, 1.8, '#f4ab92');
      ctx.beginPath();
      ctx.moveTo(21, -27); ctx.quadraticCurveTo(25, -26, 27, -28); ctx.stroke();

      // Ручка и ближняя лапка движутся навстречу друг другу.
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#459d5e';
      ctx.beginPath();
      ctx.moveTo(7, -23);
      ctx.lineTo(airborne ? 13 : 9 - Math.sin(phase) * 3, airborne ? -20 : -17);
      ctx.stroke();
      leg(phase, false, airborne);
      ctx.restore();
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

      for (var j = 0; j < dust.length; j++) {
        var p = dust[j];
        ctx.save();
        ctx.globalAlpha = (1 - p.age / p.life) * 0.48;
        oval(p.x, p.y, 2 + p.age * 11, 1.5 + p.age * 6, '#f4edcc');
        ctx.restore();
      }
      drawDragon();
    }

    function frame(now) {
      if (!running) return;
      if (!last) last = now;
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      elapsed += dt;
      speed = Math.min(MAX_SPEED, BASE_SPEED + elapsed * ACCEL);
      if (dragon.onGround) dragon.stride = (dragon.stride + speed * dt * 0.07) % (Math.PI * 2);
      dragon.landing = Math.max(0, dragon.landing - dt);
      for (var d = dust.length - 1; d >= 0; d--) {
        var p = dust[d];
        p.age += dt;
        p.x += (p.vx - speed * 0.18) * dt;
        p.y += p.vy * dt;
        if (p.age >= p.life) dust.splice(d, 1);
      }

      if (!dragon.onGround) {
        dragon.vy += G * dt;
        dragon.bottom += dragon.vy * dt;
        if (dragon.bottom >= groundY) {
          dragon.bottom = groundY;
          dragon.vy = 0;
          dragon.onGround = true;
          dragon.landing = 0.24;
          dragon.stride = Math.PI / 2;
          puff(7);
        }
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
    global.addEventListener('resize', resize);

    raf = global.requestAnimationFrame(function () {
      resize();
      reset();
      raf = global.requestAnimationFrame(frame);
    });

    return function cleanup() {
      running = false;
      if (raf) { global.cancelAnimationFrame(raf); raf = null; }
      wrap.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
      global.removeEventListener('resize', resize);
    };
  }

  App.register('runner', start);
})(window);
