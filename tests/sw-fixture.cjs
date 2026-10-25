const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { root } = require('./helpers.cjs');
function worker() {
  const handlers = {}, stores = new Map(), scope = 'https://fixture.test/boy-game/';
  const key = request => new URL(typeof request === 'string' ? request : request.url, scope);
  const caches = {
    keys: async () => [...stores.keys()],
    delete: async name => stores.delete(name),
    open: async name => {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return {
        addAll: async requests => { for (const request of requests) {
          const url = key(request), file = url.pathname.replace('/boy-game/', '') || 'index.html';
          store.set(url.href, fs.readFileSync(path.join(root, file), 'utf8'));
        } },
        match: async (request, options) => { const url = key(request); if (options?.ignoreSearch) url.search = ''; return store.get(url.href); }
      };
    }
  };
  const c = vm.createContext({
    URL, Request, Response, Set, caches,
    fetch: () => Promise.reject(new Error('offline')),
    self: { registration: { scope }, clients: { claim: async () => {} }, skipWaiting() {}, addEventListener: (type, handler) => { handlers[type] = handler; } }
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'sw.js'), 'utf8'), c);
  return {
    stores,
    install: async () => { let work; handlers.install({ waitUntil: p => { work = p; } }); await work; },
    activate: async () => { let work; handlers.activate({ waitUntil: p => { work = p; } }); await work; },
    request: (file, mode = 'cors') => {
      let response;
      handlers.fetch({ request: { method: 'GET', mode, url: new URL(file, scope).href }, respondWith: p => { response = p; } });
      return response;
    }
  };
}
module.exports = { worker };
