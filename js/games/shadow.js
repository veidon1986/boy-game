/* games/shadow.js — сравни контур предмета с его силуэтом. */
(function (global) {
  'use strict';

  var el = UI.el;
  var NS = 'http://www.w3.org/2000/svg';
  var SHAPES = [
    {
      name: 'cat', color: '#f2a43a', parts: [
        ['path', { d: 'M15 48 L12 16 L34 31 Q50 22 66 31 L88 16 L85 49 Q83 78 50 80 Q17 78 15 48 Z' }],
        ['path', { d: 'M76 67 Q99 65 94 48', fill: 'none', stroke: true, width: 9 }]
      ]
    },
    {
      name: 'fish', color: '#42a8df', parts: [
        ['path', { d: 'M18 50 Q47 18 76 50 Q47 82 18 50 Z' }],
        ['path', { d: 'M72 50 L96 29 L96 71 Z' }],
        ['circle', { cx: 35, cy: 45, r: 4, fill: '#fff' }]
      ]
    },
    {
      name: 'house', color: '#ee765e', parts: [
        ['path', { d: 'M10 46 L50 12 L90 46 L82 46 L82 88 L18 88 L18 46 Z' }],
        ['rect', { x: 42, y: 59, width: 17, height: 29, fill: '#fff' }]
      ]
    },
    {
      name: 'car', color: '#705bd2', parts: [
        ['path', { d: 'M10 61 L17 43 L34 39 L46 22 L70 22 L83 42 L94 47 L96 67 L10 67 Z' }],
        ['circle', { cx: 29, cy: 69, r: 10 }], ['circle', { cx: 76, cy: 69, r: 10 }]
      ]
    },
    {
      name: 'tree', color: '#43a96b', parts: [
        ['rect', { x: 42, y: 55, width: 16, height: 38 }],
        ['circle', { cx: 50, cy: 34, r: 25 }], ['circle', { cx: 31, cy: 49, r: 18 }],
        ['circle', { cx: 69, cy: 49, r: 18 }]
      ]
    },
    {
      name: 'flower', color: '#d65b9a', parts: [
        ['path', { d: 'M50 51 Q47 72 50 94', fill: 'none', stroke: true, width: 8 }],
        ['path', { d: 'M49 75 Q31 60 27 74 Q37 85 49 80 Z' }],
        ['circle', { cx: 50, cy: 29, r: 14 }], ['circle', { cx: 32, cy: 43, r: 14 }],
        ['circle', { cx: 68, cy: 43, r: 14 }], ['circle', { cx: 39, cy: 61, r: 14 }],
        ['circle', { cx: 61, cy: 61, r: 14 }], ['circle', { cx: 50, cy: 45, r: 13, fill: '#ffd34f' }]
      ]
    },
    {
      name: 'butterfly', color: '#f08c43', parts: [
        ['path', { d: 'M48 48 Q23 9 12 27 Q4 47 43 54 Q5 61 17 81 Q34 90 48 58 Z' }],
        ['path', { d: 'M52 48 Q77 9 88 27 Q96 47 57 54 Q95 61 83 81 Q66 90 52 58 Z' }],
        ['rect', { x: 46, y: 39, width: 8, height: 31, rx: 4 }]
      ]
    },
    {
      name: 'boat', color: '#3f9d9a', parts: [
        ['path', { d: 'M9 65 L91 65 L75 86 L28 86 Z' }],
        ['path', { d: 'M46 16 L46 60 L17 60 Z' }], ['path', { d: 'M54 25 L83 60 L54 60 Z' }]
      ]
    }
  ];

  function makeShape(shape, silhouette) {
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    shape.parts.forEach(function (part) {
      var node = document.createElementNS(NS, part[0]);
      Object.keys(part[1]).forEach(function (key) {
        var value = part[1][key];
        if (key === 'fill') {
          node.setAttribute('fill', value === 'none' ? 'none' : (silhouette ? '#24203a' : value));
        } else if (key === 'stroke') {
          node.setAttribute('stroke', silhouette ? '#24203a' : shape.color);
        } else if (key === 'width') {
          node.setAttribute('stroke-width', value);
        } else {
          node.setAttribute(key, value);
        }
      });
      if (!part[1].fill && part[1].fill !== 'none') node.setAttribute('fill', silhouette ? '#24203a' : shape.color);
      svg.appendChild(node);
    });
    return svg;
  }

  function start(root, App) {
    var age = App.age();
    var level = 'easy';
    var round = 0;
    var firstTry = 0;
    var timer = null;
    var TOTAL = 6;
    var targetGenerator = null;
    var stage = el('div', { class: 'shadow-stage' });
    var stats = el('div', { class: 'game-stats' });
    var difficulty = UI.segmented(App.gameLevels('shadow').map(function (lv) {
      return { value: lv, label: t('common.' + lv) };
    }), level, function (v) { level = v; newSession(); });
    root.appendChild(el('p', { class: 'game-hint' }, t('game.shadow.hint')));
    root.appendChild(el('div', { class: 'shadow-method' }, [
      el('span', { class: 'shadow-method-icon', 'aria-hidden': 'true' }, '👀'),
      el('span', {}, t('game.shadow.method'))
    ]));
    root.appendChild(difficulty);
    root.appendChild(stats);
    root.appendChild(stage);

    function newSession() {
      if (timer) { clearTimeout(timer); timer = null; }
      round = 0; firstTry = 0;
      targetGenerator = UI.uniqueGenerator(function () {
        var target = UI.pick(SHAPES);
        var count = level === 'easy' ? 3 : 4;
        return {
          target: target,
          options: UI.shuffle([target].concat(UI.sample(SHAPES.filter(function (shape) {
            return shape.name !== target.name;
          }), count - 1)))
        };
      }, function (task) {
        return task.target.name + '|' + task.options.map(function (shape) { return shape.name; }).sort().join(',');
      }, 150, 'shadow');
      render();
    }
    function render() {
      if (round >= TOTAL) {
        App.finishGame('shadow', Math.max(1, Math.round(firstTry / TOTAL * 3)), newSession, null, level);
        return;
      }
      round++;
      stats.textContent = t('common.round') + ' ' + round + ' ' + t('common.of') + ' ' + TOTAL;
      UI.clear(stage);
      var task = targetGenerator();
      if (!task) { UI.showTaskPoolExhausted(root, App, targetGenerator); return; }
      var target = task.target;
      var options = task.options;
      var answered = false;
      var targetCard = el('div', { class: 'shadow-target', role: 'img', 'aria-label': t('game.shadow.target') });
      targetCard.appendChild(makeShape(target, false));
      stage.appendChild(targetCard);
      stage.appendChild(el('div', { class: 'shadow-target-label' }, t('game.shadow.target')));
      var grid = el('div', { class: 'shadow-grid' });
      var mistakes = 0;
      options.forEach(function (shape, index) {
        var button = el('button', {
          type: 'button', class: 'shadow-option',
          'aria-label': t('game.shadow.choice') + ' ' + (index + 1),
          onclick: function () {
            if (answered) return;
            if (shape.name === target.name) {
              answered = true;
              grid.querySelectorAll('button').forEach(function (choice) { choice.disabled = true; });
              button.classList.add('correct');
              if (!mistakes) firstTry++;
              Sound.play('match');
              timer = setTimeout(render, 650);
            } else {
              mistakes++;
              button.classList.add('wrong');
              Sound.play('wrong');
              setTimeout(function () { button.classList.remove('wrong'); }, 450);
            }
          }
        });
        button.appendChild(makeShape(shape, true));
        grid.appendChild(button);
      });
      stage.appendChild(grid);
      var clue = el('p', { class: 'shadow-clue hidden', 'aria-live': 'polite' });
      var clueButton = el('button', {
        type: 'button', class: 'btn shadow-hint-button',
        'aria-expanded': 'false',
        onclick: function () {
          var open = clue.classList.contains('hidden');
          clue.textContent = open ? t('game.shadow.clue.' + target.name) : '';
          clue.classList.toggle('hidden', !open);
          clueButton.setAttribute('aria-expanded', open ? 'true' : 'false');
        }
      }, '💡 ' + t('game.shadow.showHint'));
      stage.appendChild(clueButton);
      stage.appendChild(clue);
    }
    newSession();
    return function cleanup() { if (timer) clearTimeout(timer); };
  }

  App.register('shadow', start);
})(window);
