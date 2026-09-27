const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { translations, normalizeLanguage, translate } = require('../localization/translations');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const getNested = (object, key) => key.split('.').reduce((value, part) => value && value[part], object);

assert.equal(normalizeLanguage(), 'ko');
assert.equal(normalizeLanguage('invalid'), 'ko');
assert.equal(translate('en', 'menu.settings'), 'Settings');
assert.equal(translate('ko', 'records.uploadNow', { count: 3 }), '지금 전송 (3타)');

// 영어에 없는 키는 한국어로 대체
translations.ko.__fallbackTest = '한국어';
assert.equal(translate('en', '__fallbackTest'), '한국어');
delete translations.ko.__fallbackTest;

// 코드와 HTML에서 쓰는 번역 키를 모두 모아 두 언어에 다 있는지 확인
const sources = [
  'main.js', 'updater.js',
  'renderer/settings/settings.html', 'renderer/settings/settings.js',
  'renderer/chatter/chatter.html', 'renderer/chatter/chatter.js',
  'renderer/logs/logs.html',
  'renderer/records/records.html', 'renderer/records/records.js',
  'renderer/about/about.html', 'renderer/about/about.js'
];
const keyPatterns = [
  /data-i18n(?:-placeholder)?="([\w.]+)"/g,        // HTML 속성
  /\bt\(\s*'([\w.]+)'/g,                           // t('key') / i18n.t('key')
  /translate\([^,]+,\s*[`']([\w.]+)[`']/g          // translate(lang, 'key')
];
const usedKeys = new Set();
for (const file of sources) {
  const text = read(file);
  for (const pattern of keyPatterns) for (const m of text.matchAll(pattern)) usedKeys.add(m[1]);
}
// 조건부로 만드는 키 / 로거 코드로 만드는 키
['settings.savedPortChanged', 'settings.discImageUp', 'widget.disconnected', 'widget.reconnecting', 'records.autoUploadOn', 'records.autoUploadOff',
 ...['busy', 'noToken', 'noData', 'unauthorized', 'dailyLimit', 'rejected', 'server', 'network', 'timeout'].map(r => `records.error.${r}`),
 ...['upload', 'inputs', 'servers'].map(k => `shutdown.step.${k}`),
 ...['notFound', 'connected', 'openFailed', 'deviceError', 'closed', 'closeFailed', 'dataError', 'lr2Activated', 'lr2Deactivated'].map(c => `controller.${c}`)
].forEach(key => usedKeys.add(key));

assert.ok(usedKeys.size > 50, `too few keys found (${usedKeys.size}), key patterns may be broken`);
for (const key of usedKeys) {
  for (const language of ['ko', 'en']) {
    assert.equal(typeof getNested(translations[language], key), 'string', `missing ${language} translation: ${key}`);
  }
}

// 두 언어의 키 구성이 같은지
const flatten = (object, prefix = '') => Object.entries(object).flatMap(([k, v]) =>
  typeof v === 'object' ? flatten(v, `${prefix}${k}.`) : [`${prefix}${k}`]);
assert.deepEqual(flatten(translations.en).sort(), flatten(translations.ko).sort());

console.log(`localization tests passed (${usedKeys.size} keys)`);
