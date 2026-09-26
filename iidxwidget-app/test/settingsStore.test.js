const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const store = require('../settingsStore');

// 2.x 설정 파일: GENERIC 매핑 없음, 이미지가 LAN IP 절대주소, 잘못된 MA 키 이름
const v2File = {
  serverPort: 8080,
  controllerProfile: 'KB',
  apiToken: 'secret-token',
  keyMapping: { KB: { '1': 'KeyA' } },
  widget: {
    discImagePath: 'http://192.168.0.13:8080/userImages/disc_1.png',
    GlobalReleaseMALength: 150
  }
};

// H2: 이전 설정에도 GENERIC 기본 매핑이 채워진다
const merged = store.withDefaults(v2File);
assert.deepEqual(merged.keyMapping.GENERIC, store.DEFAULT_SETTINGS.keyMapping.GENERIC);
assert.equal(merged.keyMapping.KB['1'], 'KeyA');
assert.equal(merged.keyMapping.GENERIC_AXIS, null);
// 2.x 설정에 없던 새 옵션은 기본값으로 채워진다
assert.equal(merged.widget.showKeyRelease, true);
assert.equal(merged.autoUploadOnQuit, false);

// M2: 절대주소 → 상대 경로, L3: MA 키 이름 통일
assert.equal(merged.widget.discImagePath, '/userImages/disc_1.png');
assert.equal(merged.widget.globalMALength, 150);
assert.equal('GlobalReleaseMALength' in merged.widget, false);
assert.equal(store.toRelativeImagePath('https://example.com/a.png'), null);

// M5: 매핑은 통째로 교체되어, 지운 키가 기본값으로 되살아나지 않는다
const updated = store.applyUpdate(merged, { keyMapping: { GENERIC: { '1': 3 } } });
assert.deepEqual(updated.keyMapping.GENERIC, { '1': 3 });
assert.deepEqual(updated.keyMapping.KB, merged.keyMapping.KB); // 보내지 않은 매핑은 유지
// 설정 창이 모르는 값(언어 등)은 유지된다
assert.equal(store.applyUpdate({ ...merged, language: 'en' }, { serverPort: 9000 }).language, 'en');
// null로 이미지 삭제
assert.equal(store.applyUpdate(merged, { widget: { discImagePath: null } }).widget.discImagePath, null);

// H1: 위젯에 내보내는 설정에는 토큰이 없다
const pub = store.publicSettings(merged);
assert.equal('apiToken' in pub, false);
assert.equal('keyMapping' in pub, false);
assert.equal(pub.widget.discImagePath, '/userImages/disc_1.png');

assert.deepEqual(store.referencedImageFiles(merged), ['disc_1.png']);

// 파일 읽기/쓰기: 깨진 파일은 기본값, 쓰기는 임시 파일을 거친다
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'iidx-settings-'));
const file = path.join(dir, 'settings.json');
assert.equal(store.readSettingsFile(file).existed, false);
fs.writeFileSync(file, '{ broken');
assert.ok(store.readSettingsFile(file).error);
store.writeSettingsFile(file, merged);
assert.equal(store.readSettingsFile(file).settings.widget.globalMALength, 150);
assert.equal(fs.existsSync(`${file}.tmp`), false);
fs.rmSync(dir, { recursive: true });

console.log('settingsStore tests passed');

// 계정: 토큰은 설정 저장으로 바뀌지 않고, 설정 창에도 가지 않는다 (main이 암호화해서 따로 저장)
const withAccount = { ...merged, apiTokenEnc: 'ENCRYPTED', apiUsername: 'sadang' };
const saved = store.applyUpdate(withAccount, { apiToken: 'plain', apiTokenEnc: 'forged', apiUsername: 'x', serverPort: 9001 });
assert.equal(saved.apiTokenEnc, 'ENCRYPTED');
assert.equal(saved.apiUsername, 'sadang');
assert.equal('apiToken' in saved, 'apiToken' in merged); // 2.x 평문 토큰은 main이 시작할 때 암호화해서 지운다
assert.equal(saved.serverPort, 9001);
const forWindow = store.settingsForWindow(withAccount);
for (const key of ['apiToken', 'apiTokenEnc', 'apiUsername']) assert.equal(key in forWindow, false, key);
assert.equal(forWindow.serverPort, merged.serverPort);
assert.equal(store.DEFAULT_SETTINGS.apiTokenEnc, null);
assert.equal('apiToken' in store.DEFAULT_SETTINGS, false);
console.log('settingsStore account tests passed');
