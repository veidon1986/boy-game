/* games/sorting.js — «Разложи по группам»: логика, классификация, обобщение. */
(function (global) {
  'use strict';

  var el = UI.el;

  var CATS = {
    animals:   { labelKey: 'cat.animals',   emoji: '🐾', items: ['🐶', '🐱', '🐰', '🐮', '🐸', '🐷', '🦊', '🐼', '🐔'] },
    food:      { labelKey: 'cat.food',      emoji: '🍽️', items: ['🍎', '🍌', '🍞', '🧀', '🍓', '🍕', '🥕', '🍇', '🍪'] },
    transport: { labelKey: 'cat.transport', emoji: '🛣️', items: ['🚗', '🚌', '✈️', '🚲', '🚀', '⛵', '🚂', '🚁', '🛵'] },
    round:     { labelKey: 'cat.round',     emoji: '⚪', items: ['🔵', '🔴', '🟢', '🟣', '🟠', '🟡'] },
    square:    { labelKey: 'cat.square',    emoji: '⬜', items: ['🟦', '🟥', '🟩', '🟪', '🟧', '🟨'] }
  };

  // Базовые параметры (5–6 лет); для других возрастов настраиваются ниже.
  var LEVELS = {
    easy:   { cats: 2, total: 6 },
    medium: { cats: 3, total: 9 },
    hard:   { cats: 3, total: 12 }
  };

  // Возрастная калибровка: младшим — меньше групп, старшим — больше.
  var CFG_BY_AGE = {
    preschool: { easy: { cats: 2, total: 6 }, medium: { cats: 2, total: 8 } },
    junior:    { easy: { cats: 2, total: 6 }, medium: { cats: 3, total: 9 }, hard: { cats: 3, total: 12 } },
    school:    { easy: { cats: 3, total: 9 }, medium: { cats: 3, total: 12 }, hard: { cats: 4, total: 16 } }
  };

  function configFor(age, level) {
    var table = CFG_BY_AGE[Ages.normalize(age)] || CFG_BY_AGE.junior;
    return table[level] || LEVELS[level];
  }

  function chooseCategories(k, age) {
    // Младшим — только наглядные темы (животные/еда/транспорт), без абстрактных фигур.
    var main = ['animals', 'food', 'transport'];
    var preschool = Ages.normalize(age) === 'preschool';
    if (k === 2) {
      if (!preschool && Math.random() < 0.4) return ['round', 'square'];
      return UI.sample(main, 2);
    }
    if (k === 3) {
      if (!preschool && Math.random() < 0.4) {
        return UI.shuffle(['round', 'square', UI.pick(main)]);
      }
      return UI.shuffle(main);
    }
    // k === 4: три наглядные темы + одна фигурная
    return UI.shuffle(main.concat([UI.pick(['round', 'square'])]));
  }

  function start(root, App) {
    var age = App.age();
    var maxIndex = Ages.levelIndex(age);
    var level = 'easy';
    var selected = null;
    var placed = 0;
    var mistakes = 0;
    var total = 0;
    var lastCats = null;

    root.appendChild(el('p', { class: 'game-hint' }, t('game.sorting.hint')));

    var difficulty = UI.segmented(Ages.levels(age).map(function (lv) {
      return { value: lv, label: t('common.' + lv) };
    }), level, function (v) { level = v; build(); });

    var stats = el('div', { class: 'game-stats' });
    var stage = el('div', { class: 'sort-stage' });

    root.appendChild(difficulty);
    root.appendChild(stats);
    root.appendChild(stage);

    function build() {
      selected = null; placed = 0; mistakes = 0;
      UI.clear(stage);

      var cfg = configFor(age, level);

      // Набор групп не повторяет предыдущее поле.
      var catIds, sig, tries = 0;
      do {
        catIds = chooseCategories(cfg.cats, age);
        sig = catIds.slice().sort().join(',');
        tries++;
      } while (sig === lastCats && tries < 20);
      lastCats = sig;

      var per = Math.floor(cfg.total / cfg.cats);
      total = per * cfg.cats;

      // Формируем предметы.
      var items = [];
      catIds.forEach(function (id) {
        UI.sample(CATS[id].items, per).forEach(function (emoji) {
          items.push({ cat: id, emoji: emoji });
        });
      });
      items = UI.shuffle(items);

      // Корзины.
      var bins = el('div', { class: 'sort-bins' });
      catIds.forEach(function (id) {
        var placedBox = el('div', { class: 'bin-placed' });
        var bin = el('button', {
          type: 'button',
          class: 'bin',
          onclick: function () { drop(id, bin); }
        }, [
          el('div', { class: 'bin-head' }, [
            el('span', { class: 'bin-emoji' }, CATS[id].emoji),
            el('span', { class: 'bin-label' }, t(CATS[id].labelKey))
          ]),
          placedBox
        ]);
        bin.dataset.cat = id;
        bins.appendChild(bin);
      });

      // Лоток с предметами.
      var tray = el('div', { class: 'sort-tray' });
      items.forEach(function (it) {
        var btn = el('button', {
          type: 'button', class: 'sort-item',
          onclick: function () { select(btn); }
        }, it.emoji);
        btn._cat = it.cat;
        tray.appendChild(btn);
      });

      stage.appendChild(el('div', { class: 'sort-label' }, t('game.sorting.desc')));
      stage.appendChild(tray);
      stage.appendChild(bins);
      updateStats();
    }

    function updateStats() {
      stats.textContent = placed + ' / ' + total;
    }

    function select(btn) {
      Sound.play('tap');
      if (selected === btn) {
        btn.classList.remove('selected');
        selected = null;
        return;
      }
      if (selected) selected.classList.remove('selected');
      selected = btn;
      btn.classList.add('selected');
    }

    function drop(catId, bin) {
      if (!selected) {
        bin.classList.add('nudge');
        setTimeout(function () { bin.classList.remove('nudge'); }, 400);
        return;
      }
      if (selected._cat === catId) {
        Sound.play('match');
        selected.classList.remove('selected');
        selected.classList.add('placed');
        selected.disabled = true;
        bin.querySelector('.bin-placed').appendChild(selected);
        selected = null;
        placed++;
        updateStats();
        if (placed === total) {
          setTimeout(finish, 500);
        }
      } else {
        Sound.play('wrong');
        mistakes++;
        bin.classList.add('shake');
        selected.classList.add('shake');
        var sel = selected;
        setTimeout(function () {
          bin.classList.remove('shake');
          if (sel) sel.classList.remove('shake');
        }, 500);
      }
    }

    function finish() {
      var playedLevel = level;
      var stars = mistakes <= 1 ? 3 : (mistakes <= 3 ? 2 : 1);

      // Адаптация: без ошибок — сложнее; много ошибок — проще.
      var target = level;
      if (mistakes === 0) target = Adaptive.up(level, maxIndex);
      else if (mistakes >= Math.ceil(total / 2)) target = Adaptive.down(level);

      var note = null;
      if (target !== level) {
        level = target;
        difficulty._setActive(level);
        note = t('level.next', { name: t('common.' + level) });
      }

      App.finishGame('sorting', stars, build, note, playedLevel);
    }

    build();
    return null;
  }

  App.register({
    id: 'sorting',
    ages: ['preschool', 'junior', 'school'],
    emoji: '🧩',
    titleKey: 'game.sorting',
    descKey: 'game.sorting.desc',
    start: start
  });
})(window);
