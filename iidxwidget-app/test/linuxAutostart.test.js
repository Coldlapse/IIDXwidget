const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { autostartDir, desktopEntry, isEnabled, setEnabled } = require('../linuxAutostart');

test('리눅스 자동 실행: XDG 자동 실행 폴더에 .desktop을 만들고 지운다', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'iidx-autostart-'));
  try {
    assert.equal(isEnabled({ dir }), false);
    assert.equal(setEnabled(true, '/home/me/Apps/IIDXwidget-3.0.3-x86_64.AppImage', { dir }), true);
    assert.equal(isEnabled({ dir }), true);
    const content = fs.readFileSync(path.join(dir, 'iidxwidget.desktop'), 'utf8');
    assert.match(content, /^\[Desktop Entry\]/);
    assert.match(content, /^Exec=\/home\/me\/Apps\/IIDXwidget-3\.0\.3-x86_64\.AppImage$/m);
    // 같은 내용이면 다시 쓰지 않고, 경로가 바뀌면(새 버전 AppImage) 새로 쓴다
    assert.equal(setEnabled(true, '/home/me/Apps/IIDXwidget-3.0.3-x86_64.AppImage', { dir }), false);
    assert.equal(setEnabled(true, '/home/me/Apps/IIDXwidget-3.0.4-x86_64.AppImage', { dir }), true);
    assert.equal(setEnabled(false, '', { dir }), true);
    assert.equal(isEnabled({ dir }), false);
    assert.equal(setEnabled(false, '', { dir }), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('리눅스 자동 실행: 경로에 공백이 있으면 따옴표로 감싸고, XDG_CONFIG_HOME을 따른다', () => {
  assert.match(desktopEntry('/home/me/My Apps/IIDXwidget.AppImage'), /^Exec="\/home\/me\/My Apps\/IIDXwidget\.AppImage"$/m);
  assert.equal(autostartDir({ XDG_CONFIG_HOME: '/custom' }, '/home/me'), path.join('/custom', 'autostart'));
  assert.equal(autostartDir({}, '/home/me'), path.join('/home/me', '.config', 'autostart'));
});
