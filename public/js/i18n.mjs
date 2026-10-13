const zh = {
  generate: '產生分組', regroup: '重新分組',
  sampleNames: ['阿澄', '柏宇', '怡君', '昱安', '書妍', '子睿'],
  sampleNotice: '下列姓名是示範用假資料，尚未分組。',
  stats: (n, m) => `共 ${n} 人 · 忽略 ${m} 行`,
  invalidStats: (m) => `名單尚未有效 · 已忽略 ${m} 行`,
  groupRange: (n) => `可填 2–${Math.min(50, n)} 組；只接受整數。`,
  groupHeading: (n) => `第 ${n} 組`,
  people: (n) => `${n} 人`,
  member: (name, id) => `${name}（#${id}）`,
  generated: (n, k) => `已將 ${n} 人分成 ${k} 組，每人恰好出現一次。`,
  copySuccess: '已複製完整分組。',
  errors: {
    SOURCE_TOO_LONG: () => '名單超過 60,000 字元單位。請縮短後再試；工具不會截短名單。',
    ROSTER_TOO_FEW: () => '請輸入至少 2 位參與者，每人一行。',
    ROSTER_TOO_MANY: (line) => `第 ${line} 行使名單超過 500 人。請減少人數後再試。`,
    NAME_TOO_LONG: (line) => `第 ${line} 行的姓名超過 100 字元單位。請縮短後再試。`,
    NAME_CONTROL: (line) => `第 ${line} 行含有控制字元。請移除後再試。`,
    GROUP_COUNT_TOO_LONG: () => '組數欄超過 32 字元單位。請縮短後再試。',
    GROUP_COUNT_FORMAT: () => '組數只接受 0–9 的整數數字，例如 2；不能包含符號、小數或內部空白。',
    GROUP_COUNT_RANGE: (_line, max) => `請填 2–${max} 組。組數不能超過人數或 50 組。`,
    INPUT_SCHEMA_INVALID: () => '輸入格式無效。請重新輸入名單與組數。',
    RANDOM_SOURCE_FAILED: () => '無法取得隨機值，因此沒有產生或保留分組。請再試一次；若持續發生，請改用支援瀏覽器密碼學 API 的瀏覽器。',
    COPY_FAILED: () => '複製功能不可用。請選取下方文字後手動複製。'
  }
};

const en = {
  generate: 'Generate groups', regroup: 'Regroup',
  sampleNames: ['Alex', 'Blair', 'Casey', 'Devon', 'Elliot', 'Finley'],
  sampleNotice: 'These names are sample data and have not been grouped.',
  stats: (n, m) => `${n} people · ${m} blank lines ignored`,
  invalidStats: (m) => `List is not valid yet · ${m} blank lines ignored`,
  groupRange: (n) => `Enter 2–${Math.min(50, n)} groups; use whole numbers only.`,
  groupHeading: (n) => `Group ${n}`,
  people: (n) => `${n} ${n === 1 ? 'person' : 'people'}`,
  member: (name, id) => `${name} (#${id})`,
  generated: (n, k) => `${n} people assigned to ${k} groups, each appearing exactly once.`,
  copySuccess: 'All groups copied.',
  errors: {
    SOURCE_TOO_LONG: () => 'The list exceeds 60,000 character units. Shorten it and try again; the list will not be truncated.',
    ROSTER_TOO_FEW: () => 'Enter at least 2 participants, one per line.',
    ROSTER_TOO_MANY: (line) => `Line ${line} brings the list above 500 people. Reduce the list and try again.`,
    NAME_TOO_LONG: (line) => `The name on line ${line} exceeds 100 character units. Shorten it and try again.`,
    NAME_CONTROL: (line) => `Line ${line} contains a control character. Remove it and try again.`,
    GROUP_COUNT_TOO_LONG: () => 'The group count exceeds 32 character units. Shorten it and try again.',
    GROUP_COUNT_FORMAT: () => 'Use whole-number digits 0–9, such as 2. Symbols, decimals and internal spaces are not accepted.',
    GROUP_COUNT_RANGE: (_line, max) => `Enter 2–${max} groups. The count cannot exceed the number of people or 50 groups.`,
    INPUT_SCHEMA_INVALID: () => 'The input format is invalid. Enter the list and group count again.',
    RANDOM_SOURCE_FAILED: () => 'Random values are unavailable, so no groups were produced or kept. Try again, or use a browser with the Web Crypto API.',
    COPY_FAILED: () => 'Clipboard access is unavailable. Select the text below and copy it manually.'
  }
};

export const messages = Object.freeze({ 'zh-Hant': zh, en });
export const errorCodes = Object.freeze(Object.keys(zh.errors));
