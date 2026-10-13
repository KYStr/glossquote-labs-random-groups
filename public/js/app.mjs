import { parseRoster, parseGroupCount, generateGroups, createCopyText } from './core/random-groups.mjs';
import { messages } from './i18n.mjs';

export function mountApp(document, page = globalThis) {
  const locale = document.documentElement.lang === 'en' ? 'en' : 'zh-Hant';
  const copy = messages[locale];
  const ids = ['workspace', 'roster', 'group-count', 'roster-stats', 'roster-error', 'group-error',
    'group-help', 'generate', 'sample', 'clear', 'sample-notice', 'random-error', 'result-list',
    'empty-result', 'copy', 'copy-status', 'copy-fallback', 'copy-text', 'operation-status', 'regroup-notice'];
  const elements = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
  if (ids.some((id) => !elements[id])) throw new Error('INPUT_SCHEMA_INVALID');
  const state = {
    rosterSource: '', groupSource: '2', participants: [], ignoredLineCount: 0,
    rosterError: null, groupError: null, result: null, copyText: '', copyStatus: '',
    contentRevision: 0, copyRequestId: 0, showValidation: false
  };
  const listeners = [];
  function listen(target, type, callback) {
    target.addEventListener(type, callback);
    listeners.push([target, type, callback]);
  }
  function errorMessage(error) {
    const max = Math.min(50, state.participants.length || 500);
    return (copy.errors[error.code] || copy.errors.INPUT_SCHEMA_INVALID)(error.lineNumber, max);
  }
  function displayError(element, error) {
    element.textContent = error ? errorMessage(error) : '';
    element.hidden = !error;
    if (error) element.dataset.code = error.code;
    else delete element.dataset.code;
  }
  function cryptoAvailable() {
    try { return typeof globalThis.crypto?.getRandomValues === 'function'; } catch { return false; }
  }
  function invalidate() {
    state.contentRevision += 1;
    state.result = null;
    state.copyText = '';
    state.copyStatus = '';
    elements['result-list'].replaceChildren();
    elements['empty-result'].hidden = false;
    elements.copy.disabled = true;
    elements['copy-status'].textContent = '';
    delete elements['copy-status'].dataset.code;
    elements['copy-fallback'].hidden = true;
    elements['copy-text'].value = '';
    elements['operation-status'].textContent = '';
    elements['regroup-notice'].hidden = true;
    elements.generate.textContent = copy.generate;
    displayError(elements['random-error'], null);
  }
  function validate() {
    state.rosterSource = elements.roster.value;
    state.groupSource = elements['group-count'].value;
    const roster = parseRoster(state.rosterSource);
    state.participants = roster.ok ? roster.participants : [];
    state.ignoredLineCount = roster.ignoredLineCount;
    state.rosterError = roster.ok ? null : roster;
    const group = parseGroupCount(state.groupSource, roster.ok ? roster.participants.length : 500);
    state.groupError = group.ok ? null : group;
    elements['roster-stats'].textContent = roster.ok
      ? copy.stats(roster.participants.length, roster.ignoredLineCount)
      : state.rosterSource === '' ? copy.stats(0, 0) : copy.invalidStats(roster.ignoredLineCount);
    elements['group-help'].textContent = copy.groupRange(roster.ok ? roster.participants.length : 500);
    displayError(elements['roster-error'], state.showValidation ? state.rosterError : null);
    displayError(elements['group-error'], state.showValidation ? state.groupError : null);
    elements.roster.setAttribute('aria-invalid', String(state.showValidation && !roster.ok));
    elements['group-count'].setAttribute('aria-invalid', String(state.showValidation && !group.ok));
    const available = cryptoAvailable();
    elements.generate.disabled = !roster.ok || !group.ok || !available;
    if (!available) displayError(elements['random-error'], { code: 'RANDOM_SOURCE_FAILED' });
    return { roster, group };
  }
  function edited() {
    invalidate();
    state.showValidation = true;
    elements['sample-notice'].textContent = '';
    elements['sample-notice'].hidden = true;
    validate();
  }
  function generate() {
    invalidate();
    elements['sample-notice'].textContent = '';
    elements['sample-notice'].hidden = true;
    state.showValidation = true;
    const { roster, group } = validate();
    if (!roster.ok || !group.ok) return;
    const result = generateGroups(roster.participants, group.value);
    if (!result.ok) {
      displayError(elements['random-error'], result);
      return;
    }
    state.contentRevision += 1;
    state.result = result;
    const fragment = document.createDocumentFragment();
    for (const group of result.groups) {
      const section = document.createElement('section');
      section.className = 'group';
      const header = document.createElement('div');
      header.className = 'group-heading';
      const title = document.createElement('h3');
      title.textContent = copy.groupHeading(group.groupNumber);
      const count = document.createElement('span');
      count.className = 'group-count';
      count.textContent = copy.people(group.count);
      header.append(title, count);
      const list = document.createElement('ul');
      for (const { id, name } of group.participants) {
        const member = document.createElement('li');
        member.textContent = copy.member(name, id);
        list.append(member);
      }
      section.append(header, list);
      fragment.append(section);
    }
    elements['result-list'].replaceChildren(fragment);
    elements['empty-result'].hidden = true;
    elements.copy.disabled = false;
    elements.generate.textContent = copy.regroup;
    elements['regroup-notice'].hidden = false;
    elements['operation-status'].textContent = copy.generated(result.participantCount, result.groups.length);
  }
  function clear({ focus = false } = {}) {
    invalidate();
    elements.roster.value = '';
    elements['group-count'].value = '2';
    state.rosterSource = '';
    state.groupSource = '2';
    state.participants = [];
    state.ignoredLineCount = 0;
    state.rosterError = null;
    state.groupError = null;
    state.showValidation = false;
    elements['sample-notice'].textContent = '';
    elements['sample-notice'].hidden = true;
    displayError(elements['roster-error'], null);
    displayError(elements['group-error'], null);
    elements.roster.setAttribute('aria-invalid', 'false');
    elements['group-count'].setAttribute('aria-invalid', 'false');
    elements['roster-stats'].textContent = copy.stats(0, 0);
    elements['group-help'].textContent = copy.groupRange(500);
    elements.generate.disabled = true;
    if (focus) elements.roster.focus();
  }
  function sample() {
    invalidate();
    elements.roster.value = copy.sampleNames.join('\n');
    elements['group-count'].value = '2';
    state.showValidation = true;
    validate();
    elements['sample-notice'].textContent = copy.sampleNotice;
    elements['sample-notice'].hidden = false;
  }
  function copyGroups() {
    if (!state.result) return;
    const revision = state.contentRevision;
    const requestId = ++state.copyRequestId;
    state.copyText = createCopyText(state.result.groups, locale);
    state.copyStatus = '';
    elements['copy-status'].textContent = '';
    delete elements['copy-status'].dataset.code;
    elements['copy-fallback'].hidden = true;
    elements['copy-text'].value = '';
    const current = () => revision === state.contentRevision && requestId === state.copyRequestId && state.result !== null;
    const failed = () => {
      if (!current()) return;
      state.copyStatus = 'COPY_FAILED';
      elements['copy-status'].textContent = copy.errors.COPY_FAILED();
      elements['copy-status'].dataset.code = 'COPY_FAILED';
      elements['copy-text'].value = state.copyText;
      elements['copy-fallback'].hidden = false;
    };
    try {
      const clipboard = page.navigator?.clipboard;
      if (!clipboard || typeof clipboard.writeText !== 'function') { failed(); return; }
      Promise.resolve(clipboard.writeText(state.copyText)).then(() => {
        if (!current()) return;
        state.copyStatus = 'COPIED';
        state.copyText = '';
        elements['copy-status'].textContent = copy.copySuccess;
      }, failed);
    } catch { failed(); }
  }

  listen(elements.roster, 'input', edited);
  listen(elements['group-count'], 'input', edited);
  listen(elements.generate, 'click', generate);
  listen(elements.sample, 'click', sample);
  listen(elements.clear, 'click', () => clear({ focus: true }));
  listen(elements.copy, 'click', copyGroups);
  listen(page, 'pagehide', () => clear());
  listen(page, 'pageshow', (event) => { if (event.persisted) clear(); });
  clear();
  if (!cryptoAvailable()) displayError(elements['random-error'], { code: 'RANDOM_SOURCE_FAILED' });
  elements.workspace.hidden = false;
  return {
    getSnapshot: () => ({ ...state, participants: state.participants.map((person) => ({ ...person })) }),
    dispose() {
      clear();
      for (const [target, type, callback] of listeners) target.removeEventListener(type, callback);
    }
  };
}

if (typeof globalThis.document !== 'undefined') mountApp(globalThis.document);
