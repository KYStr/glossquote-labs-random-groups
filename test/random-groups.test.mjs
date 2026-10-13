import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRoster, parseGroupCount, generateGroups, generateGroupsWithUint32Source as generate, createCopyText } from '../public/js/core/random-groups.mjs';

const two = [{ id: 1, name: '甲' }, { id: 2, name: '乙' }];
const five = [...two, { id: 3, name: '丙' }, { id: 4, name: '丁' }, { id: 5, name: '戊' }];
const names = (count) => Array.from({ length: count }, (_, index) => ({ id: index + 1, name: `示範${index + 1}` }));
const ids = (result) => result.groups.flatMap((group) => group.participants.map((person) => person.id));
const error = (code, lineNumber = null, ignoredLineCount = 0) => ({ ok: false, code, lineNumber, ignoredLineCount });

test('A01–A05: empty, newline normalization, ignored lines, and duplicate stable IDs', () => {
  assert.deepEqual(parseRoster(''), error('ROSTER_TOO_FEW'));
  assert.deepEqual(parseRoster('甲\n乙'), { ok: true, participants: two, ignoredLineCount: 0 });
  assert.deepEqual(parseRoster('甲\r\n\r\n 乙 \r丙'), { ok: true, participants: five.slice(0, 3), ignoredLineCount: 1 });
  assert.deepEqual(parseRoster('\n \t\n甲\n乙\n'), { ok: true, participants: two, ignoredLineCount: 3 });
  assert.deepEqual(parseRoster('甲\n甲\n乙'), { ok: true, participants: [two[0], { id: 2, name: '甲' }, { id: 3, name: '乙' }], ignoredLineCount: 0 });
});

test('A06–A09: exact source and participant limits, no truncation', () => {
  const source = '甲\n乙\n' + '\n'.repeat(59996);
  assert.equal(source.length, 60000);
  assert.deepEqual(parseRoster(source), { ok: true, participants: two, ignoredLineCount: 59997 });
  assert.deepEqual(parseRoster(source + '\n'), error('SOURCE_TOO_LONG'));
  assert.deepEqual(parseRoster(names(500).map((person) => person.name).join('\n')).participants, names(500));
  assert.deepEqual(parseRoster(names(501).map((person) => person.name).join('\n')), error('ROSTER_TOO_MANY', 501));
  assert.deepEqual(parseRoster('\n' + names(501).map((person) => person.name).join('\n')), error('ROSTER_TOO_MANY', 502, 1));
});

test('A10–A18: UTF-16 limits, JS trim, C0/C1 rejection, first physical line', () => {
  for (const name of ['x'.repeat(100), '😀'.repeat(50)]) {
    assert.equal(parseRoster(name + '\n乙').participants[0].name, name);
  }
  for (const name of ['x'.repeat(101), '😀'.repeat(51)]) assert.deepEqual(parseRoster(name + '\n乙'), error('NAME_TOO_LONG', 1));
  assert.deepEqual(parseRoster('　甲　\n乙').participants, two);
  assert.deepEqual(parseRoster(' \t甲\t \n乙').participants, two);
  assert.deepEqual(parseRoster('甲\t乙\n丙'), error('NAME_CONTROL', 1));
  for (const control of ['\u0000', '\u007f', '\u0085']) assert.deepEqual(parseRoster('甲\n乙' + control + '丙'), error('NAME_CONTROL', 2));
  assert.deepEqual(parseRoster('\n甲\nFAKE_PRIVATE_NAME\u0001\n' + 'x'.repeat(101)), error('NAME_CONTROL', 3, 1));
});

test('A19–A24: bounded ASCII-only integer grammar and exact range', () => {
  assert.deepEqual(parseGroupCount(' 0002\t', 2), { ok: true, value: 2 });
  assert.deepEqual(parseGroupCount(' '.repeat(15) + '2' + ' '.repeat(16), 2), { ok: true, value: 2 });
  assert.deepEqual(parseGroupCount(' '.repeat(16) + '2' + ' '.repeat(16), 2), { ok: false, code: 'GROUP_COUNT_TOO_LONG' });
  for (const value of ['', '+2', '-2', '2.0', '2e0', '1,000', '２', '\u00a02\u00a0', '2 0', '\u30002', '\ufeff2']) {
    assert.deepEqual(parseGroupCount(value, 10), { ok: false, code: 'GROUP_COUNT_FORMAT' });
  }
  for (const [value, n] of [['0', 10], ['1', 10], ['51', 50], ['3', 2], ['0', 51], ['9'.repeat(32), 500]]) {
    assert.deepEqual(parseGroupCount(value, n), { ok: false, code: 'GROUP_COUNT_RANGE' });
  }
  assert.deepEqual(parseGroupCount('2', 50), { ok: true, value: 2 });
  assert.deepEqual(parseGroupCount('50', 50), { ok: true, value: 50 });
  assert.deepEqual(parseGroupCount('0'.repeat(31) + '2', 2), { ok: true, value: 2 });
  for (const n of [1, 501, NaN, '2', 2.5]) assert.deepEqual(parseGroupCount('2', n), { ok: false, code: 'INPUT_SCHEMA_INVALID' });
  assert.deepEqual(parseGroupCount(2, 2), { ok: false, code: 'INPUT_SCHEMA_INVALID' });
});

test('A25: hand-calculated all-zero five-person permutation and groups', () => {
  let calls = 0;
  assert.deepEqual(generate(five, 2, () => { calls += 1; return 0; }), {
    ok: true,
    groups: [
      { groupNumber: 1, participants: [{ id: 2, name: '乙' }, { id: 3, name: '丙' }, { id: 4, name: '丁' }], count: 3 },
      { groupNumber: 2, participants: [{ id: 5, name: '戊' }, { id: 1, name: '甲' }], count: 2 }
    ],
    participantCount: 5
  });
  assert.equal(calls, 4);
});

test('A26–A27: rejected maximum uint32 consumes another sample at n=5 and n=3', () => {
  const sequence5 = [4294967295, 5, 1, 2, 1];
  let calls = 0;
  assert.deepEqual(ids(generate(five, 2, () => sequence5[calls++])), [5, 4, 3, 2, 1]);
  assert.equal(calls, 5);
  const sequence3 = [4294967295, 5, 0];
  calls = 0;
  const result = generate(five.slice(0, 3), 2, () => sequence3[calls++]);
  assert.deepEqual(result.groups.map((group) => group.participants.map((person) => person.id)), [[2, 1], [3]]);
  assert.equal(calls, 3);
});

test('A28: exactly 128 rejected samples, with acceptance allowed on attempt 128', () => {
  let calls = 0;
  assert.deepEqual(generate(five.slice(0, 3), 2, () => { calls += 1; return 4294967295; }), { ok: false, code: 'RANDOM_SOURCE_FAILED' });
  assert.equal(calls, 128);
  calls = 0;
  assert.equal(generate(five.slice(0, 3), 2, () => ++calls < 128 ? 4294967295 : 0).ok, true);
  assert.equal(calls, 129); // The next Fisher–Yates range still draws its own sample.
});

test('A29–A30: invalid samples, exceptions and unavailable production API fail closed', () => {
  for (const value of [-1, 1.5, 4294967296, NaN, '1', undefined, null, Infinity]) {
    let calls = 0;
    assert.deepEqual(generate(two, 2, () => { calls += 1; return value; }), { ok: false, code: 'RANDOM_SOURCE_FAILED' });
    assert.equal(calls, 1);
  }
  assert.deepEqual(generate(two, 2, () => { throw new Error('FAKE_PRIVATE_ERROR'); }), { ok: false, code: 'RANDOM_SOURCE_FAILED' });
  assert.deepEqual(generate(two, 2, null), { ok: false, code: 'RANDOM_SOURCE_FAILED' });
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  const originalRandom = Math.random;
  try {
    Math.random = () => { throw new Error('FORBIDDEN_FALLBACK'); };
    for (const crypto of [undefined, {}, { getRandomValues() { throw new Error('FAKE_PRIVATE_ERROR'); } }]) {
      Object.defineProperty(globalThis, 'crypto', { configurable: true, value: crypto });
      assert.deepEqual(generateGroups(two, 2), { ok: false, code: 'RANDOM_SOURCE_FAILED' });
    }
  } finally {
    Object.defineProperty(globalThis, 'crypto', descriptor);
    Math.random = originalRandom;
  }
});

test('A31–A32: balanced complete allocation across bounded sizes and fixed sample vectors', () => {
  for (const [n, k, expected] of [[4, 3, [2, 1, 1]], [8, 3, [3, 3, 2]], [500, 2, [250, 250]], [500, 50, Array(50).fill(10)]]) {
    assert.deepEqual(generate(names(n), k, () => 0).groups.map((group) => group.count), expected);
  }
  for (const [n, k] of [[2, 2], [7, 3], [50, 50], [51, 50], [137, 17], [500, 49]]) {
    for (const sample of [0, 123456789, 2147483648, 4000000000]) {
      const input = names(n);
      const result = generate(input, k, () => sample);
      assert.equal(result.ok, true);
      assert.equal(result.groups.length, k);
      assert.equal(result.participantCount, n);
      assert.deepEqual(ids(result).sort((a, b) => a - b), input.map((person) => person.id));
      const sizes = result.groups.map((group) => group.count);
      assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1);
      for (const person of result.groups.flatMap((group) => group.participants)) assert.equal(person.name, `示範${person.id}`);
    }
  }
});

test('A33: production adapter retains Crypto receiver and draws for N=2', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  let calls = 0;
  const crypto = { getRandomValues(slot) { assert.equal(this, crypto); assert.ok(slot instanceof Uint32Array); assert.equal(slot.length, 1); calls += 1; slot[0] = 0; return slot; } };
  try {
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: crypto });
    assert.deepEqual(ids(generateGroups(two, 2)), [2, 1]);
    assert.equal(calls, 1);
  } finally { Object.defineProperty(globalThis, 'crypto', descriptor); }
});

test('A34: exact input schema rejection before random source access', () => {
  const invalidInputs = [null, {}, [], [two[0]], [two[0], two[0]], [{ id: 1, name: '甲' }, { id: 3, name: '乙' }],
    [{ id: 1, name: '甲', extra: true }, two[1]], [{ id: 1, name: ' 甲' }, two[1]],
    [{ id: 1, name: 'x'.repeat(101) }, two[1]], [{ id: 1, name: '\u0000甲' }, two[1]],
    [{ id: '1', name: '甲' }, two[1]], [{ id: 1, name: '' }, two[1]], new Array(2), names(501)];
  const accessor = { name: '甲' };
  Object.defineProperty(accessor, 'id', { enumerable: true, get() { throw new Error('SHOULD_NOT_READ'); } });
  invalidInputs.push([accessor, two[1]], Object.assign([...two], { extra: true }));
  for (const input of invalidInputs) {
    let calls = 0;
    assert.deepEqual(generate(input, 2, () => { calls += 1; return 0; }), { ok: false, code: 'INPUT_SCHEMA_INVALID' });
    assert.equal(calls, 0);
  }
  for (const k of [0, 1, 3, 2.5, NaN, '2']) {
    let calls = 0;
    assert.deepEqual(generate(two, k, () => { calls += 1; return 0; }), { ok: false, code: 'INPUT_SCHEMA_INVALID' });
    assert.equal(calls, 0);
  }
  assert.deepEqual(parseRoster(null), error('INPUT_SCHEMA_INVALID'));
});

test('A35: frozen source participants remain unchanged, result owns copies', () => {
  const input = Object.freeze(five.map((person) => Object.freeze({ ...person })));
  const result = generate(input, 2, () => 0);
  assert.deepEqual(input, five);
  assert.notEqual(result.groups[0].participants[0], input[1]);
  result.groups[0].participants[0].name = '改動的假名';
  assert.deepEqual(input, five);
});

test('A39–A40: literal bilingual LF copy text, including HTML-looking names', () => {
  const groups = [
    { groupNumber: 1, participants: [{ id: 2, name: '乙' }, { id: 3, name: '丙' }, { id: 4, name: '丁' }], count: 3 },
    { groupNumber: 2, participants: [{ id: 5, name: '戊' }, { id: 1, name: '甲' }], count: 2 }
  ];
  assert.equal(createCopyText(groups, 'zh-Hant'), '第 1 組（3 人）\n乙（#2）\n丙（#3）\n丁（#4）\n\n第 2 組（2 人）\n戊（#5）\n甲（#1）\n');
  assert.equal(createCopyText(groups, 'en'), 'Group 1 (3 people)\n乙 (#2)\n丙 (#3)\n丁 (#4)\n\nGroup 2 (2 people)\n戊 (#5)\n甲 (#1)\n');
  const source = '<img src=x onerror=alert(1)>\n乙';
  const result = generate(parseRoster(source).participants, 2, () => 0);
  assert.equal(createCopyText(result.groups, 'en'), 'Group 1 (1 person)\n乙 (#2)\n\nGroup 2 (1 person)\n<img src=x onerror=alert(1)> (#1)\n');
  assert.throws(() => createCopyText(groups, 'unknown'), { message: 'INPUT_SCHEMA_INVALID' });
  assert.throws(() => createCopyText([{ ...groups[0], count: 999 }, groups[1]], 'en'), { message: 'INPUT_SCHEMA_INVALID' });
  assert.throws(() => createCopyText([groups[1], groups[0]], 'en'), { message: 'INPUT_SCHEMA_INVALID' });
});
