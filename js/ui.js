/* ui.js — маленькие DOM-помощники и общие элементы интерфейса. */
(function (global) {
  'use strict';

  var t = global.t || function (key) { return key; };

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        var v = attrs[k];
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'style' && typeof v === 'object') {
          for (var s in v) { if (Object.prototype.hasOwnProperty.call(v, s)) node.style[s] = v[s]; }
        } else if (k.slice(0, 2) === 'on' && typeof v === 'function') {
          node.addEventListener(k.slice(2).toLowerCase(), v);
        } else if (v === true) {
          node.setAttribute(k, '');
        } else {
          node.setAttribute(k, v);
        }
      }
    }
    appendAll(node, children);
    return node;
  }

  function appendAll(parent, children) {
    if (children === null || children === undefined) return;
    if (Array.isArray(children)) {
      for (var i = 0; i < children.length; i++) appendAll(parent, children[i]);
    } else if (children instanceof Node) {
      parent.appendChild(children);
    } else {
      parent.appendChild(document.createTextNode(String(children)));
    }
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function unique(arr) {
    var seen = {}, out = [];
    for (var i = 0; i < arr.length; i++) {
      var k = String(arr[i]);
      if (!seen[k]) { seen[k] = 1; out.push(arr[i]); }
    }
    return out;
  }

  function sample(arr, n) { return shuffle(unique(arr)).slice(0, n); }

  // Сегментированная кнопка выбора уровня сложности.
  function segmented(options, value, onChange) {
    var group = el('div', { class: 'segmented', role: 'group' });
    var btns = [];
    options.forEach(function (opt) {
      var btn = el('button', {
        type: 'button',
        class: 'seg-btn' + (opt.value === value ? ' active' : ''),
        onclick: function () {
          Sound.play('tap');
          group._setActive(opt.value);
          onChange(opt.value);
        }
      }, opt.label);
      btns.push({ value: opt.value, el: btn });
      group.appendChild(btn);
    });
    // Внешнее переключение активного уровня (без вызова onChange).
    group._setActive = function (val) {
      btns.forEach(function (b) { b.el.classList.toggle('active', b.value === val); });
    };
    return group;
  }

  // Генератор, который не повторяет уже выданные элементы (по ключу).
  function uniqueGenerator(make, keyFn, maxTries, historyKey, pool) {
    maxTries = maxTries || 60;
    var seen = Object.create(null);
    var persistentSeen = Object.create(null);
    if (historyKey && global.Store && global.Store.taskHistory) {
      global.Store.taskHistory(historyKey).forEach(function (key) { persistentSeen[key] = 1; });
    }
    function next(prefer) {
      var item, key, fresh = false, fallback = null;
      next.exhausted = false;
      if (pool) {
        var remaining = pool().filter(function (candidate) {
          var signature = keyFn(candidate);
          return seen[signature] === undefined && persistentSeen[signature] === undefined;
        });
        if (!remaining.length) { next.exhausted = true; return null; }
        var preferred = typeof prefer === 'function' ? remaining.filter(prefer) : remaining;
        item = pick(preferred.length ? preferred : remaining);
        key = keyFn(item);
        seen[key] = persistentSeen[key] = 1;
        if (historyKey && global.Store) global.Store.rememberTask(historyKey, key);
        return item;
      }
      for (var i = 0; i < maxTries; i++) {
        item = make();
        key = keyFn(item);
        if (seen[key] === undefined && persistentSeen[key] === undefined) {
          if (typeof prefer === 'function' && !prefer(item)) {
            if (!fallback) fallback = { item: item, key: key };
            continue;
          }
          fresh = true;
          break;
        }
      }
      if (!fresh && fallback) { item = fallback.item; key = fallback.key; fresh = true; }
      if (fresh) {
        seen[key] = persistentSeen[key] = 1;
        if (historyKey && global.Store && global.Store.rememberTask) global.Store.rememberTask(historyKey, key, 1000);
      }
      return fresh ? item : null;
    }
    next.reset = function () { seen = Object.create(null); };
    return next;
  }

  function showTaskPoolExhausted(root, App, generator) {
    var exhausted = !generator || generator.exhausted === true;
    clear(root);
    root.appendChild(el('div', { class: 'chess-course-complete' }, [
      el('div', { class: 'chess-course-icon' }, '✅'),
      el('h2', {}, t(exhausted ? 'common.tasksComplete' : 'common.taskSearchRetry')),
      el('p', {}, t(exhausted ? 'common.tasksCompleteText' : 'common.taskSearchRetryText')),
      exhausted ? null : el('button', { type: 'button', class: 'btn primary wide', onclick: function () { App.startGame(App.current); } }, t('common.again')),
      el('button', { type: 'button', class: 'btn primary wide', onclick: function () { App.goHome(); } }, '🏠 ' + t('chess.home'))
    ]));
  }

  // Ряд звёздочек (заполненные/пустые).
  function starsRow(n, max) {
    var wrap = el('div', { class: 'stars-row' });
    for (var i = 0; i < max; i++) {
      wrap.appendChild(el('span', { class: 'star' + (i < n ? ' on' : '') }, '★'));
    }
    return wrap;
  }

  function cardButton(className, onClick, children) {
    return el('button', { type: 'button', class: className, onclick: onClick }, children);
  }

  global.UI = {
    el: el,
    clear: clear,
    randInt: randInt,
    pick: pick,
    shuffle: shuffle,
    unique: unique,
    sample: sample,
    segmented: segmented,
    uniqueGenerator: uniqueGenerator,
    showTaskPoolExhausted: showTaskPoolExhausted,
    starsRow: starsRow,
    cardButton: cardButton
  };
})(window);
