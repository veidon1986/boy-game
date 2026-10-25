const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

// A fresh JS realm and memory-only storage for every test: never opens a user's browser.
function application(search = '', options = {}) {
  const data = new Map();
  const context = vm.createContext({
    console, Date, Math, setTimeout, clearTimeout, setInterval, clearInterval,
    location: { hostname: 'localhost', search },
    document: { documentElement: { setAttribute() {} }, addEventListener() {}, removeEventListener() {} },
    localStorage: {
      getItem: key => data.has(key) ? data.get(key) : null,
      setItem: (key, value) => data.set(key, String(value)),
      removeItem: key => data.delete(key)
    }
  });
  context.window = context;
  context.self = context;
  const scripts = [...fs.readFileSync(path.join(root, 'index.html'), 'utf8')
    .matchAll(/<script src="([^"]+)"/g)].map(match => match[1]);
  const loaded = new Set();
  function load(file) {
    if (loaded.has(file)) return;
    loaded.add(file);
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  }
  for (const file of scripts.filter(file => file !== 'js/main.js')) load(file);
  if (options.eager !== false) {
    for (const game of context.GameCatalog.list) {
      for (const file of [...game.scripts, game.file]) load(file);
    }
  }
  return { context, data };
}

module.exports = { application, root };
