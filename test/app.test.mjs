import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mountApp } from '../public/js/app.mjs';
import { messages, errorCodes } from '../public/js/i18n.mjs';

// This deliberately small DOM harness tests state transitions, not browser behavior.
class Element extends EventTarget {
  constructor(tag = 'div', document = null) {
    super(); this.tagName = tag.toUpperCase(); this.document = document; this.children = [];
    this.dataset = {}; this.attributes = {}; this.value = ''; this.hidden = false; this.disabled = false; this.text = '';
  }
  set textContent(value) { this.text = String(value); this.children = []; }
  get textContent() { return this.text + this.children.map((child) => child.textContent).join(''); }
  append(...children) {
    for (const child of children) {
      if (child.tagName === '#FRAGMENT') this.children.push(...child.children);
      else this.children.push(child);
    }
  }
  replaceChildren(...children) { this.children = []; this.text = ''; this.append(...children); }
  setAttribute(key, value) { this.attributes[key] = value; }
  click() { if (!this.disabled) this.dispatchEvent(new Event('click')); }
  focus() { this.document.activeElement = this; }
}
async function setup(t, locale = 'zh-Hant', clipboard) {
  const html = await readFile(new URL(locale === 'en' ? '../public/en/index.html' : '../public/index.html', import.meta.url), 'utf8');
  const elements = new Map();
  const document = {
    documentElement: { lang: locale }, activeElement: null,
    getElementById: (id) => elements.get(id),
    createElement: (tag) => new Element(tag, document),
    createDocumentFragment: () => new Element('#fragment', document)
  };
  for (const match of html.matchAll(/<([a-z]+)[^>]*\bid="([^"]+)"[^>]*>/gu)) elements.set(match[2], new Element(match[1], document));
  const page = new EventTarget();
  page.navigator = { clipboard };
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  const random = { calls: 0, fail: false, getRandomValues(slot) { this.calls += 1; if (this.fail) throw new Error('FAKE_PRIVATE_NAME'); slot[0] = 0; return slot; } };
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: random });
  const app = mountApp(document, page);
  t.after(() => { app.dispose(); Object.defineProperty(globalThis, 'crypto', descriptor); });
  const edit = (id, value) => { elements.get(id).value = value; elements.get(id).dispatchEvent(new Event('input')); };
  return { app, page, random, elements, edit, document, get: (id) => elements.get(id) };
}
const tick = async () => { await Promise.resolve(); await Promise.resolve(); };
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

test('A36: any source edit invalidates complete output, fallback and copy; changing back never restores it', async (t) => {
  const { app, get, edit } = await setup(t);
  assert.equal(get('workspace').hidden, false);
  assert.equal(get('generate').disabled, true);
  edit('roster', '甲\n乙\n丙\n丁\n戊');
  get('generate').click();
  assert.equal(get('result-list').children.length, 2);
  const revision = app.getSnapshot().contentRevision;
  get('copy').click();
  assert.equal(get('copy-fallback').hidden, false);
  edit('roster', '甲改\n乙\n丙\n丁\n戊');
  assert.equal(app.getSnapshot().result, null);
  assert.ok(app.getSnapshot().contentRevision > revision);
  assert.equal(get('copy').disabled, true);
  assert.equal(get('copy-text').value, '');
  assert.equal(get('copy-fallback').hidden, true);
  assert.equal(get('result-list').children.length, 0);
  edit('roster', '甲\n乙\n丙\n丁\n戊');
  assert.equal(app.getSnapshot().result, null);
  get('generate').click();
  edit('group-count', '3');
  assert.equal(get('copy').disabled, true);
  get('generate').click();
  edit('roster', '甲\n乙');
  assert.equal(get('group-count').value, '3');
  assert.equal(get('group-error').dataset.code, 'GROUP_COUNT_RANGE');
  assert.equal(get('generate').disabled, true);
  assert.equal(get('group-count').attributes['aria-invalid'], 'true');
});

test('A37: regroup starts with invalidation and a failed adapter never keeps a previous result', async (t) => {
  const { app, random, get, edit } = await setup(t);
  edit('roster', '甲\n乙');
  get('generate').click();
  assert.equal(get('generate').textContent, '重新分組');
  random.fail = true;
  get('generate').click();
  assert.equal(app.getSnapshot().result, null);
  assert.equal(get('copy').disabled, true);
  assert.equal(get('result-list').children.length, 0);
  assert.equal(get('generate').textContent, '產生分組');
  assert.equal(get('random-error').dataset.code, 'RANDOM_SOURCE_FAILED');
  assert.ok(!get('random-error').textContent.includes('FAKE_PRIVATE_NAME'));
});

for (const [locale, expected] of [['zh-Hant', '阿澄\n柏宇\n怡君\n昱安\n書妍\n子睿'], ['en', 'Alex\nBlair\nCasey\nDevon\nElliot\nFinley']]) {
  test(`A38: ${locale} sample resets without consuming random values`, async (t) => {
    const { random, get, edit } = await setup(t, locale);
    edit('group-count', '9');
    get('sample').click();
    assert.equal(get('roster').value, expected);
    assert.equal(get('group-count').value, '2');
    assert.equal(random.calls, 0);
    assert.equal(get('copy').disabled, true);
    assert.equal(get('sample-notice').textContent, messages[locale].sampleNotice);
    assert.equal(get('generate').textContent, messages[locale].generate);
    get('generate').click();
    assert.equal(get('sample-notice').hidden, true);
    assert.equal(get('sample-notice').textContent, '');
    const calls = random.calls;
    get('sample').click();
    assert.equal(random.calls, calls);
    assert.equal(get('result-list').children.length, 0);
  });
}

test('A40–A41: text nodes preserve HTML-looking names; missing/rejected clipboard retains readonly fallback', async (t) => {
  const writes = [];
  const { get, edit } = await setup(t, 'en', { writeText(text) { writes.push(text); return Promise.reject(new Error('FAKE_PRIVATE_NAME')); } });
  edit('roster', '<img src=x onerror=alert(1)>\nBlair');
  get('generate').click();
  assert.equal(writes.length, 0);
  assert.ok(get('result-list').textContent.includes('<img src=x onerror=alert(1)> (#1)'));
  assert.deepEqual(get('result-list').children[1].children[1].children.map((node) => node.tagName), ['LI']);
  get('copy').click();
  await tick();
  assert.deepEqual(writes, ['Group 1 (1 person)\nBlair (#2)\n\nGroup 2 (1 person)\n<img src=x onerror=alert(1)> (#1)\n']);
  assert.equal(get('copy-status').dataset.code, 'COPY_FAILED');
  assert.equal(get('copy-text').value, writes[0]);
  assert.equal(get('copy-fallback').hidden, false);
  assert.ok(!get('copy-status').textContent.includes('FAKE_PRIVATE_NAME'));
});

test('A42: input revisions prevent pending copy resolve or reject from resurrecting old status and text', async (t) => {
  for (const outcome of ['resolve', 'reject']) {
    await t.test(outcome, async (t) => {
      const pending = deferred();
      const { app, get, edit } = await setup(t, 'en', { writeText: () => pending.promise });
      get('sample').click(); get('generate').click(); get('copy').click();
      edit('roster', 'New fake person\nOther fake person');
      pending[outcome](outcome === 'reject' ? new Error('FAKE_PRIVATE_NAME') : undefined);
      await tick();
      assert.equal(app.getSnapshot().copyText, '');
      assert.equal(get('copy-status').textContent, '');
      assert.equal(get('copy-text').value, '');
      assert.equal(get('copy-fallback').hidden, true);
    });
  }
});

test('A42: newest copy sequence wins even when the content revision is unchanged', async (t) => {
  const first = deferred(); const second = deferred(); let calls = 0;
  const { app, get } = await setup(t, 'en', { writeText: () => ++calls === 1 ? first.promise : second.promise });
  get('sample').click(); get('generate').click(); get('copy').click(); get('copy').click();
  second.resolve(); await tick();
  assert.equal(get('copy-status').textContent, 'All groups copied.');
  first.reject(new Error('FAKE_PRIVATE_NAME')); await tick();
  assert.equal(get('copy-status').textContent, 'All groups copied.');
  assert.equal(get('copy-fallback').hidden, true);
  assert.equal(app.getSnapshot().copyRequestId, 2);
});

test('A42: regroup and pagehide invalidate pending copies without claiming OS cancellation', async (t) => {
  for (const action of ['regroup', 'pagehide']) {
    await t.test(action, async (t) => {
      const pending = deferred();
      const { page, get } = await setup(t, 'en', { writeText: () => pending.promise });
      get('sample').click(); get('generate').click(); get('copy').click();
      if (action === 'regroup') get('generate').click(); else page.dispatchEvent(new Event('pagehide'));
      pending.reject(new Error('FAKE_PRIVATE_NAME')); await tick();
      assert.equal(get('copy-status').textContent, '');
      assert.equal(get('copy-text').value, '');
      assert.equal(get('copy-fallback').hidden, true);
    });
  }
});

test('A43: clear/pagehide remove input, results, errors and references; persisted pageshow resets restored form values', async (t) => {
  const { app, page, get, document } = await setup(t);
  for (const action of ['clear', 'pagehide']) {
    get('sample').click(); get('generate').click(); get('copy').click();
    page.dispatchEvent(new Event('visibilitychange'));
    assert.notEqual(app.getSnapshot().result, null);
    if (action === 'clear') get('clear').click(); else page.dispatchEvent(new Event('pagehide'));
    const state = app.getSnapshot();
    assert.equal(state.rosterSource, ''); assert.equal(state.groupSource, '2');
    assert.deepEqual(state.participants, []); assert.equal(state.result, null);
    assert.equal(state.rosterError, null); assert.equal(state.groupError, null); assert.equal(state.copyText, '');
    assert.equal(get('roster').value, ''); assert.equal(get('group-count').value, '2');
    assert.equal(get('copy-text').value, ''); assert.equal(get('copy-status').textContent, '');
    assert.equal(get('random-error').textContent, ''); assert.equal(get('generate').textContent, '產生分組');
    assert.equal(get('roster-stats').textContent, '共 0 人 · 忽略 0 行');
    assert.equal(get('copy').disabled, true); assert.equal(get('generate').disabled, true);
  }
  assert.equal(document.activeElement, get('roster'));
  get('roster').value = 'Restored fake value';
  const pageshow = new Event('pageshow'); pageshow.persisted = true;
  page.dispatchEvent(pageshow);
  assert.equal(get('roster').value, '');
});

test('A44: fixed errors never echo fake private text, raw exceptions or stack', async (t) => {
  for (const locale of ['en', 'zh-Hant']) {
    assert.deepEqual(Object.keys(messages[locale].errors), [...errorCodes]);
    for (const code of errorCodes) {
      const text = messages[locale].errors[code](4, 5);
      assert.equal(typeof text, 'string');
      assert.ok(text.length > 10);
      assert.ok(!text.includes('FAKE_PRIVATE_NAME') && !text.includes('Error:') && !/\n\s+at\s+.+(?:\(|:\d)/u.test(text));
    }
  }
  const { get, edit } = await setup(t);
  edit('roster', '甲\nFAKE_PRIVATE_NAME\u0000');
  assert.equal(get('roster-error').dataset.code, 'NAME_CONTROL');
  assert.ok(!get('roster-error').textContent.includes('FAKE_PRIVATE_NAME'));
  assert.ok(get('roster-error').textContent.includes('2'));
});
