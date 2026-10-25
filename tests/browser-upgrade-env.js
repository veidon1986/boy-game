/* Injected by the loopback-only release-check server before any app script. */
(function () {
  'use strict';
  if (window.parent === window || !window.parent.ReleaseFixture) throw new Error('Missing isolated fixture');
  var fixture = window.parent.ReleaseFixture;
  Object.defineProperty(window, 'localStorage', { value: fixture.storage });
  var nativeDB = window.indexedDB;
  Object.defineProperty(window, 'indexedDB', { value: {
    open: function (name, version) {
      if (name !== 'boygame-history') throw new Error('Unexpected fixture database: ' + name);
      return nativeDB.open(fixture.dbName, version);
    }
  } });
  // Runs before main.js's DOMContentLoaded listener and creates data with the OLD Store.
  document.addEventListener('DOMContentLoaded', function () {
    if (fixture.beforeBoot) fixture.beforeBoot(window);
    else if (!fixture.seeded) fixture.seed(window);
    fixture.loads++;
  });
})();
