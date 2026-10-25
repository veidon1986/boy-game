// Minimal render surface for module lifecycle tests; no layout or browser storage.
function attachDOM(c) {
  class Node {
    constructor(tag = '') {
      this.tagName = tag.toUpperCase(); this.children = []; this.attributes = {};
      this.style = { setProperty() {} }; this.dataset = {}; this.className = '';
      this.textContent = ''; this.listeners = {}; this.clientWidth = 390;
      this.classList = {
        add: (...names) => { this.className += ' ' + names.join(' '); },
        remove: (...names) => { this.className = this.className.split(' ').filter(name => !names.includes(name)).join(' '); },
        contains: name => this.className.split(' ').includes(name),
        toggle: (name, on) => { if (on) this.classList.add(name); else this.classList.remove(name); }
      };
    }
    get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
    set textContent(value) { this._text = String(value); this.children = []; }
    appendChild(child) {
      if (child.parentNode) child.parentNode.removeChild(child);
      child.parentNode = this; this.children.push(child); return child;
    }
    removeChild(child) { this.children.splice(this.children.indexOf(child), 1); child.parentNode = null; }
    remove() { if (this.parentNode) this.parentNode.removeChild(this); }
    click() {
      if (this.disabled) return;
      const event = { currentTarget: this, target: this, detail: 0, preventDefault() {} };
      if (this.listeners.click) this.listeners.click.call(this, event);
      if (this.onclick) this.onclick.call(this, event);
    }
    setAttribute(key, value) { this.attributes[key] = String(value); }
    getAttribute(key) { return this.attributes[key]; }
    focus() {}
    addEventListener(key, value) { this.listeners[key] = value; }
    removeEventListener(key) { delete this.listeners[key]; }
    get firstChild() { return this.children[0]; }
    get lastChild() { return this.children[this.children.length - 1]; }
    getBoundingClientRect() { return { width: 390, height: 300, left: 0, top: 0 }; }
    getContext() {
      return new Proxy({}, { get: (_target, key) => key === 'createLinearGradient' ?
        () => ({ addColorStop() {} }) : () => {} });
    }
    querySelectorAll(selector) {
      return this.children.flatMap(child => {
        const attribute = selector.match(/^\[([^=]+)="([^"]+)"\]$/);
        const match = selector[0] === '.' ? selector.slice(1).split('.').every(name => child.className.split(' ').includes(name)) :
          attribute ? child.getAttribute(attribute[1]) === attribute[2] : child.tagName.toLowerCase() === selector.toLowerCase();
        return (match ? [child] : []).concat(child.querySelectorAll(selector));
      });
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  }
  const scheduled = new Map(), listeners = new Map();
  let nextTimer = 0;
  const schedule = callback => { scheduled.set(++nextTimer, callback); return nextTimer; };
  const cancel = id => scheduled.delete(id);
  Object.assign(c, {
    Node, innerWidth: 390, devicePixelRatio: 1,
    setTimeout: schedule, setInterval: schedule, requestAnimationFrame: schedule,
    clearTimeout: cancel, clearInterval: cancel, cancelAnimationFrame: cancel,
    addEventListener: (key, fn) => listeners.set(key, fn),
    removeEventListener: key => listeners.delete(key)
  });
  Object.assign(c.document, {
    createElement: tag => new Node(tag),
    createElementNS: (_namespace, tag) => new Node(tag),
    createTextNode: text => { const node = new Node(); node.textContent = String(text); return node; },
    addEventListener: (key, fn) => listeners.set(key, fn),
    removeEventListener: key => listeners.delete(key)
  });
  c.Sound = { isMusicEnabled: () => false, isEnabled: () => false, setMusicContext() {}, play() {} };
  return { node: () => new Node(), scheduled, listeners };
}
module.exports = { attachDOM };
