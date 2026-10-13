const UINT32_SPACE = 4294967296;
const MAX_ATTEMPTS = 128;
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/u;

const rosterError = (code, lineNumber = null, ignoredLineCount = 0) =>
  ({ ok: false, code, lineNumber, ignoredLineCount });
const failure = (code) => ({ ok: false, code });

export function parseRoster(source) {
  if (typeof source !== 'string') return rosterError('INPUT_SCHEMA_INVALID');
  if (source.length > 60000) return rosterError('SOURCE_TOO_LONG');
  const lines = source === '' ? [] : source.replace(/\r\n?/gu, '\n').split('\n');
  const participants = [];
  let ignoredLineCount = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const name = lines[index].trim();
    if (name === '') {
      ignoredLineCount += 1;
      continue;
    }
    if (name.length > 100) return rosterError('NAME_TOO_LONG', index + 1, ignoredLineCount);
    if (CONTROL.test(name)) return rosterError('NAME_CONTROL', index + 1, ignoredLineCount);
    if (participants.length === 500) return rosterError('ROSTER_TOO_MANY', index + 1, ignoredLineCount);
    participants.push({ id: participants.length + 1, name });
  }
  if (participants.length < 2) return rosterError('ROSTER_TOO_FEW', null, ignoredLineCount);
  return { ok: true, participants, ignoredLineCount };
}

export function parseGroupCount(source, participantCount) {
  if (typeof source !== 'string' || !Number.isInteger(participantCount) || participantCount < 2 || participantCount > 500) {
    return failure('INPUT_SCHEMA_INVALID');
  }
  if (source.length > 32) return failure('GROUP_COUNT_TOO_LONG');
  const digits = source.replace(/^[\u0009-\u000d\u0020]+|[\u0009-\u000d\u0020]+$/gu, '');
  if (!/^[0-9]+$/u.test(digits)) return failure('GROUP_COUNT_FORMAT');
  const value = BigInt(digits);
  if (value < 2n || value > BigInt(Math.min(50, participantCount))) return failure('GROUP_COUNT_RANGE');
  return { ok: true, value: Number(value) };
}

function exactRecord(value, keys) {
  if (value === null || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const ownKeys = Reflect.ownKeys(value);
  return ownKeys.length === keys.length && keys.every((key) =>
    Object.hasOwn(value, key) && Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value'));
}

function validName(name) {
  return typeof name === 'string' && name.length >= 1 && name.length <= 100 && name === name.trim() && !CONTROL.test(name);
}

function validParticipants(participants) {
  if (!Array.isArray(participants) || participants.length < 2 || participants.length > 500) return false;
  if (Reflect.ownKeys(participants).length !== participants.length + 1) return false;
  const seen = new Set();
  for (let index = 0; index < participants.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(participants, String(index));
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) return false;
    const participant = descriptor.value;
    if (!exactRecord(participant, ['id', 'name']) || !Number.isInteger(participant.id) ||
        participant.id < 1 || participant.id > participants.length || seen.has(participant.id) || !validName(participant.name)) return false;
    seen.add(participant.id);
  }
  return true;
}

function validInput(participants, groupCount) {
  try {
    return validParticipants(participants) && Number.isInteger(groupCount) && groupCount >= 2 &&
      groupCount <= Math.min(50, participants.length);
  } catch {
    return false;
  }
}

function uniformBelow(n, nextUint32) {
  const limit = Math.floor(UINT32_SPACE / n) * n;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const sample = nextUint32();
    if (!Number.isInteger(sample) || sample < 0 || sample >= UINT32_SPACE) throw new Error('RANDOM_SOURCE_FAILED');
    if (sample < limit) return sample % n;
  }
  throw new Error('RANDOM_SOURCE_FAILED');
}

function shuffleAndSplit(participants, groupCount, nextUint32) {
  try {
    if (typeof nextUint32 !== 'function') return failure('RANDOM_SOURCE_FAILED');
    const ids = participants.map(({ id }) => id);
    for (let index = ids.length - 1; index > 0; index -= 1) {
      const other = uniformBelow(index + 1, nextUint32);
      [ids[index], ids[other]] = [ids[other], ids[index]];
    }
    const byId = new Map(participants.map(({ id, name }) => [id, { id, name }]));
    const base = Math.floor(ids.length / groupCount);
    const remainder = ids.length % groupCount;
    const groups = [];
    let offset = 0;
    for (let index = 0; index < groupCount; index += 1) {
      const count = base + (index < remainder ? 1 : 0);
      groups.push({
        groupNumber: index + 1,
        participants: ids.slice(offset, offset + count).map((id) => byId.get(id)),
        count
      });
      offset += count;
    }
    return { ok: true, groups, participantCount: participants.length };
  } catch {
    return failure('RANDOM_SOURCE_FAILED');
  }
}

export function generateGroups(participants, groupCount) {
  if (!validInput(participants, groupCount)) return failure('INPUT_SCHEMA_INVALID');
  try {
    const crypto = globalThis.crypto;
    if (!crypto || typeof crypto.getRandomValues !== 'function') return failure('RANDOM_SOURCE_FAILED');
    return shuffleAndSplit(participants, groupCount, () => {
      const slot = new Uint32Array(1);
      crypto.getRandomValues(slot);
      return slot[0];
    });
  } catch {
    return failure('RANDOM_SOURCE_FAILED');
  }
}

// This explicit seam is used only by offline deterministic tests.
export function generateGroupsWithUint32Source(participants, groupCount, nextUint32) {
  if (!validInput(participants, groupCount)) return failure('INPUT_SCHEMA_INVALID');
  return shuffleAndSplit(participants, groupCount, nextUint32);
}

function validGroups(groups) {
  if (!Array.isArray(groups) || groups.length < 2 || groups.length > 50 || Reflect.ownKeys(groups).length !== groups.length + 1) return false;
  const flat = [];
  for (let index = 0; index < groups.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(groups, String(index));
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) return false;
    const group = descriptor.value;
    if (!exactRecord(group, ['groupNumber', 'participants', 'count']) || group.groupNumber !== index + 1 ||
        !Array.isArray(group.participants) || !Number.isInteger(group.count) || group.count < 1 ||
        group.count !== group.participants.length || group.count > 250 ||
        Reflect.ownKeys(group.participants).length !== group.count + 1) return false;
    for (let member = 0; member < group.count; member += 1) {
      const entry = Object.getOwnPropertyDescriptor(group.participants, String(member));
      if (!entry || !Object.hasOwn(entry, 'value')) return false;
      flat.push(entry.value);
      if (flat.length > 500) return false;
    }
  }
  if (!validParticipants(flat)) return false;
  const base = Math.floor(flat.length / groups.length);
  const remainder = flat.length % groups.length;
  return groups.every((group, index) => group.count === base + (index < remainder ? 1 : 0));
}

export function createCopyText(groups, locale) {
  let valid = false;
  try { valid = (locale === 'zh-Hant' || locale === 'en') && validGroups(groups); } catch { /* Fixed failure below. */ }
  if (!valid) throw new TypeError('INPUT_SCHEMA_INVALID');
  return groups.map((group) => {
    const heading = locale === 'zh-Hant'
      ? `第 ${group.groupNumber} 組（${group.count} 人）`
      : `Group ${group.groupNumber} (${group.count} ${group.count === 1 ? 'person' : 'people'})`;
    const names = group.participants.map(({ id, name }) => locale === 'zh-Hant' ? `${name}（#${id}）` : `${name} (#${id})`);
    return [heading, ...names].join('\n');
  }).join('\n\n') + '\n';
}
