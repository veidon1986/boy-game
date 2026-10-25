const test = require('node:test');
const assert = require('node:assert/strict');
const { application } = require('./helpers.cjs');
const { attachDOM } = require('./dom-fixture.cjs');
test('extracted app sections render with existing profiles and settings', () => {
  const { context: c } = application();
  const dom = attachDOM(c);
  c.navigator = { userAgent: 'fixture' };
  c.Store.addProfile('Fixture', '🧪', 'junior');
  c.App.els = Object.fromEntries(['screen','overlay','toast','title','homeBtn','musicBtn','soundBtn','langBtn'].map(key => [key, dom.node()]));
  for (const name of ['renderHome','showProfiles','showAddProfile','editProfile','showOnboarding','showParentSettings','showParentsGate','showPermissionsConsent','showAdminAuth','openAchievements','showInstallHint']) {
    assert.doesNotThrow(() => c.App[name](), name);
  }
});
