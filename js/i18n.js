/* i18n.js — простой двуязычный словарь RU/EN.
   Использование: t('home') или t('stars', {n: 3}). */
(function (global) {
  'use strict';

  var STRINGS = {
    ru: {
      'app.title': 'Игры',
      'home': 'Домой',
      'sound.on': 'Звук включён',
      'sound.off': 'Звук выключен',

      'home.subtitle': 'Выбери игру и играй!',
      'home.stars': 'Звёздочки',

      'common.easy': 'Легко',
      'common.medium': 'Средне',
      'common.hard': 'Сложно',
      'common.play': 'Играть',
      'common.again': 'Ещё раз',
      'common.next': 'Дальше',
      'common.round': 'Задание',
      'common.of': 'из',
      'common.correct': 'Верно!',
      'common.tryAgain': 'Попробуй ещё',
      'common.wellDone': 'Молодец!',
      'common.great': 'Отлично!',
      'common.keepGoing': 'Хорошо!',
      'common.result.stars': 'Ты собрал {n} из 3 звёздочек',
      'level.up': 'Сложнее: {name} 📈',
      'level.down': 'Проще: {name} 📉',
      'level.next': 'Следующий уровень: {name}',

      'welcome.title': 'Как тебя зовут?',
      'welcome.nameLabel': 'Как тебя зовут?',
      'welcome.namePlaceholder': 'Твоё имя',
      'welcome.avatarLabel': 'Выбери аватарку',
      'welcome.start': 'Начать!',
      'welcome.defaultName': 'Друг',

      'age.label': 'Возраст',
      'age.years': 'лет',
      'age.hint': 'Игры подбираются по возрасту ребёнка',
      'age.parentOnly': 'Смена возраста — только для родителей',

      'profile.title': 'Профиль',
      'profile.save': 'Сохранить',
      'profile.cancel': 'Отмена',

      'home.greeting': 'Привет, {name}!',
      'home.achievements': 'Награды',
      'home.rankLabel': 'Статус',

      'ach.new': 'Новая награда!',
      'ach.newMultiple': 'Новые награды!',
      'ach.ok': 'Ура!',
      'ach.screen.title': 'Мои награды',
      'ach.locked': 'Ещё не открыто',
      'ach.progress': 'Открыто: {got} из {total}',

      'ach.first.title': '«{game}»: первая победа!',
      'ach.first.desc': 'Ты впервые прошёл игру «{game}»',
      'ach.perfect.title': '«{game}»: 3★ на уровне «{level}»',
      'ach.perfect.desc': 'Три звезды в игре «{game}» (уровень «{level}»)',
      'ach.stars3.title': 'Первые звёзды!',
      'ach.stars3.desc': 'Собрано 3 звезды',
      'ach.stars8.title': 'Копилка звёзд',
      'ach.stars8.desc': 'Собрано 8 звёзд',
      'ach.stars15.title': 'Звёздный герой!',
      'ach.stars15.desc': 'Собраны все 15 звёзд',
      'ach.stars1.title': 'Первые звёзды!',
      'ach.stars1.desc': 'Собрано звёзд: {n}',
      'ach.stars2.title': 'Копилка звёзд',
      'ach.stars2.desc': 'Собрано звёзд: {n}',
      'ach.stars3.title': 'Звёздный герой!',
      'ach.stars3.desc': 'Все звёзды собраны: {n}',
      'ach.allgames.title': 'Все игры пройдены',
      'ach.allgames.desc': 'Ты поиграл во все игры',

      'rank.rookie': 'Новичок',
      'rank.explorer': 'Исследователь',
      'rank.smart': 'Умник',
      'rank.master': 'Мастер',
      'rank.genius': 'Гений',

      'game.runner': 'Дракончик',
      'game.runner.desc': 'Беги и прыгай!',
      'game.runner.hint': 'Тапай по экрану или жми Пробел, чтобы прыгать',
      'runner.score': 'Счёт',
      'runner.best': 'Рекорд',
      'runner.record': 'Новый рекорд!',
      'runner.gameover': 'Ой, попался!',
      'runner.again': 'Ещё раз',
      'runner.locked': 'Откроется на статусе «Умник»',
      'runner.lockedTitle': 'Ещё закрыто',
      'runner.needRank': 'Нужен статус «Умник»: {got} из {need} наград',

      'limit.chip': 'Осталось',
      'limit.used': 'Использовано сегодня',
      'limit.of': 'из',
      'limit.unlimited': 'Без лимита',
      'limit.warn5': 'Скоро перерыв: осталось 5 минут',
      'limit.warn1': 'Последняя минута!',
      'limit.upTitle': 'Отдохнём!',
      'limit.up': 'На сегодня хватит! Увидимся завтра 🌙',
      'limit.ok': 'Хорошо',
      'limit.parents': 'Для родителей',
      'limit.parentsTitle': 'Родительский контроль',
      'limit.limitLabel': 'Лимит игры в день',
      'limit.min': 'мин',
      'limit.reset': 'Сбросить сегодня',
      'limit.resetDone': 'Лимит на сегодня сброшен',
      'limit.gateTitle': 'Только для взрослых',
      'limit.gateHint': 'Реши пример, чтобы войти',
      'limit.gateQ': 'Сколько будет {a} × {b}?',
      'limit.gateWrong': 'Неверно, попробуй ещё',
      'limit.enter': 'Войти',
      'limit.close': 'Закрыть',
      'limit.forChild': 'Ребёнок',
      'limit.saved': 'Лимит сохранён',

      'profiles.switch': 'Дети',
      'profiles.selectTitle': 'Кто играет?',
      'profiles.active': 'Играет',
      'profiles.add': 'Добавить ребёнка',
      'admin.open': 'Админ-панель',
      'profiles.addBtn': 'Добавить',
      'profiles.newTitle': 'Новый игрок',
      'profiles.delete': 'Удалить',
      'profiles.deleteTitle': 'Удалить профиль?',
      'profiles.deleteConfirm': 'Удалить «{name}» и весь его прогресс? Это нельзя отменить.',
      'profiles.removed': 'Профиль удалён',
      'profiles.switched': 'Привет, {name}!',

      'game.memory': 'Найди пару',
      'game.memory.desc': 'Переворачивай карточки и находи одинаковые',
      'game.memory.hint': 'Найди все одинаковые пары',
      'game.memory.pairs': 'Пары',
      'game.memory.moves': 'Ходы',

      'game.sequence': 'Что дальше?',
      'game.sequence.desc': 'Продолжи последовательность',
      'game.sequence.hint': 'Что должно быть дальше?',

      'game.sorting': 'Разложи по группам',
      'game.sorting.desc': 'Отнеси предметы в нужную группу',
      'game.sorting.hint': 'Выбери предмет и его группу',

      'game.math': 'Счёт и примеры',
      'game.math.desc': 'Считай предметы и решай примеры',
      'game.math.hint': 'Сколько получится?',
      'game.math.count': 'Посчитай и выбери число',
      'game.math.sum': 'Сколько всего?',
      'game.math.rest': 'Сколько осталось?',
      'game.math.missing': 'Какое число пропущено?',

      'game.odd': 'Что лишнее?',
      'game.odd.desc': 'Найди предмет, который не подходит',
      'game.odd.hint': 'Найди лишний предмет',

      'game.find': 'Найди такого же',
      'game.find.desc': 'Найди картинку, как у меня',
      'game.find.hint': 'Нажми на такую же картинку',

      'game.words': 'Найди слово',
      'game.words.desc': 'Прочитай и выбери подходящее слово',
      'game.words.hint': 'Какое слово подходит к картинке?',

      'cat.animals': 'Животные',
      'cat.food': 'Еда',
      'cat.transport': 'Транспорт',
      'cat.red': 'Красные',
      'cat.blue': 'Синие',
      'cat.green': 'Зелёные',
      'cat.yellow': 'Жёлтые',
      'cat.round': 'Круглые',
      'cat.square': 'Квадратные',

      'install.hint': 'Совет: добавь игру на домашний экран, чтобы играть без интернета.',
      'install.close': 'Понятно'
    },
    en: {
      'app.title': 'Games',
      'home': 'Home',
      'sound.on': 'Sound on',
      'sound.off': 'Sound off',

      'home.subtitle': 'Pick a game and play!',
      'home.stars': 'Stars',

      'common.easy': 'Easy',
      'common.medium': 'Medium',
      'common.hard': 'Hard',
      'common.play': 'Play',
      'common.again': 'Again',
      'common.next': 'Next',
      'common.round': 'Task',
      'common.of': 'of',
      'common.correct': 'Correct!',
      'common.tryAgain': 'Try again',
      'common.wellDone': 'Well done!',
      'common.great': 'Great!',
      'common.keepGoing': 'Nice!',
      'common.result.stars': 'You got {n} of 3 stars',
      'level.up': 'Harder: {name} 📈',
      'level.down': 'Easier: {name} 📉',
      'level.next': 'Next level: {name}',

      'welcome.title': 'What is your name?',
      'welcome.nameLabel': 'What is your name?',
      'welcome.namePlaceholder': 'Your name',
      'welcome.avatarLabel': 'Pick an avatar',
      'welcome.start': 'Start!',
      'welcome.defaultName': 'Friend',

      'age.label': 'Age',
      'age.years': 'yrs',
      'age.hint': 'Games are chosen for the child’s age',
      'age.parentOnly': 'Changing age is parent-only',

      'profile.title': 'Profile',
      'profile.save': 'Save',
      'profile.cancel': 'Cancel',

      'home.greeting': 'Hi, {name}!',
      'home.achievements': 'Awards',
      'home.rankLabel': 'Rank',

      'ach.new': 'New award!',
      'ach.newMultiple': 'New awards!',
      'ach.ok': 'Yay!',
      'ach.screen.title': 'My awards',
      'ach.locked': 'Not unlocked yet',
      'ach.progress': 'Unlocked: {got} of {total}',

      'ach.first.title': '“{game}”: first win!',
      'ach.first.desc': 'You completed “{game}” for the first time',
      'ach.perfect.title': '“{game}”: 3★ on “{level}”',
      'ach.perfect.desc': 'Three stars in “{game}” (level “{level}”)',
      'ach.stars3.title': 'First stars!',
      'ach.stars3.desc': 'Collected 3 stars',
      'ach.stars8.title': 'Star piggy bank',
      'ach.stars8.desc': 'Collected 8 stars',
      'ach.stars15.title': 'Star hero!',
      'ach.stars15.desc': 'All 15 stars collected',
      'ach.stars1.title': 'First stars!',
      'ach.stars1.desc': 'Stars collected: {n}',
      'ach.stars2.title': 'Star piggy bank',
      'ach.stars2.desc': 'Stars collected: {n}',
      'ach.stars3.title': 'Star hero!',
      'ach.stars3.desc': 'All stars collected: {n}',
      'ach.allgames.title': 'All games completed',
      'ach.allgames.desc': 'You played every game',

      'rank.rookie': 'Rookie',
      'rank.explorer': 'Explorer',
      'rank.smart': 'Clever',
      'rank.master': 'Master',
      'rank.genius': 'Genius',

      'game.runner': 'Little Dragon',
      'game.runner.desc': 'Run and jump!',
      'game.runner.hint': 'Tap the screen or press Space to jump',
      'runner.score': 'Score',
      'runner.best': 'Best',
      'runner.record': 'New record!',
      'runner.gameover': 'Oops, caught!',
      'runner.again': 'Again',
      'runner.locked': 'Unlocks at the “Clever” rank',
      'runner.lockedTitle': 'Still locked',
      'runner.needRank': 'Needs the “Clever” rank: {got} of {need} awards',

      'limit.chip': 'Left',
      'limit.used': 'Used today',
      'limit.of': 'of',
      'limit.unlimited': 'No limit',
      'limit.warn5': 'Break soon: 5 minutes left',
      'limit.warn1': 'Last minute!',
      'limit.upTitle': 'Time to rest!',
      'limit.up': 'That’s enough for today! See you tomorrow 🌙',
      'limit.ok': 'Okay',
      'limit.parents': 'For parents',
      'limit.parentsTitle': 'Parental controls',
      'limit.limitLabel': 'Daily play limit',
      'limit.min': 'min',
      'limit.reset': 'Reset today',
      'limit.resetDone': 'Today’s limit reset',
      'limit.gateTitle': 'Grown-ups only',
      'limit.gateHint': 'Solve the example to enter',
      'limit.gateQ': 'What is {a} × {b}?',
      'limit.gateWrong': 'Wrong, try again',
      'limit.enter': 'Enter',
      'limit.close': 'Close',
      'limit.forChild': 'Child',
      'limit.saved': 'Limit saved',

      'profiles.switch': 'Kids',
      'profiles.selectTitle': 'Who’s playing?',
      'profiles.active': 'Playing',
      'profiles.add': 'Add a child',
      'admin.open': 'Admin panel',
      'profiles.addBtn': 'Add',
      'profiles.newTitle': 'New player',
      'profiles.delete': 'Delete',
      'profiles.deleteTitle': 'Delete profile?',
      'profiles.deleteConfirm': 'Delete “{name}” and all their progress? This cannot be undone.',
      'profiles.removed': 'Profile deleted',
      'profiles.switched': 'Hi, {name}!',

      'game.memory': 'Find a Pair',
      'game.memory.desc': 'Flip the cards and find matching pairs',
      'game.memory.hint': 'Find all matching pairs',
      'game.memory.pairs': 'Pairs',
      'game.memory.moves': 'Moves',

      'game.sequence': 'What Comes Next?',
      'game.sequence.desc': 'Continue the sequence',
      'game.sequence.hint': 'What comes next?',

      'game.sorting': 'Sort the Groups',
      'game.sorting.desc': 'Put the items in the right group',
      'game.sorting.hint': 'Pick an item, then its group',

      'game.math': 'Counting & Math',
      'game.math.desc': 'Count objects and solve simple problems',
      'game.math.hint': 'How many?',
      'game.math.count': 'Count and choose the number',
      'game.math.sum': 'How many in total?',
      'game.math.rest': 'How many are left?',
      'game.math.missing': 'Which number is missing?',

      'game.odd': 'What’s Odd?',
      'game.odd.desc': 'Find the item that does not belong',
      'game.odd.hint': 'Find the odd one out',

      'game.find': 'Find the Same',
      'game.find.desc': 'Find the picture that matches mine',
      'game.find.hint': 'Tap the matching picture',

      'game.words': 'Find the Word',
      'game.words.desc': 'Read and choose the right word',
      'game.words.hint': 'Which word matches the picture?',

      'cat.animals': 'Animals',
      'cat.food': 'Food',
      'cat.transport': 'Transport',
      'cat.red': 'Red',
      'cat.blue': 'Blue',
      'cat.green': 'Green',
      'cat.yellow': 'Yellow',
      'cat.round': 'Round',
      'cat.square': 'Square',

      'install.hint': 'Tip: add the game to your home screen to play offline.',
      'install.close': 'Got it'
    }
  };

  var current = 'ru';

  function setLang(lang) {
    current = STRINGS[lang] ? lang : 'ru';
    try { document.documentElement.setAttribute('lang', current); } catch (e) {}
    return current;
  }

  function getLang() { return current; }

  function t(key, vars) {
    var table = STRINGS[current] || STRINGS.ru;
    var s = table[key];
    if (s === undefined) s = (STRINGS.ru[key] !== undefined ? STRINGS.ru[key] : key);
    if (vars) {
      for (var k in vars) {
        if (Object.prototype.hasOwnProperty.call(vars, k)) {
          s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), String(vars[k]));
        }
      }
    }
    return s;
  }

  global.I18N = { setLang: setLang, getLang: getLang, t: t, strings: STRINGS };
  global.t = t;
})(window);
