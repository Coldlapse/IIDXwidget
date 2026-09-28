// 리눅스 로그인 시 자동 실행: Electron의 setLoginItemSettings는 Windows·macOS만 지원하므로
// XDG 자동 실행 폴더(~/.config/autostart)에 .desktop 파일을 두고 지운다.
// AppImage로 실행 중이면 process.execPath는 임시로 풀린 경로라서, AppImage 파일 경로(APPIMAGE 환경 변수)를 쓴다
const fs = require('fs');
const os = require('os');
const path = require('path');

const FILE_NAME = 'iidxwidget.desktop';

function autostartDir(env = process.env, home = os.homedir()) {
  return path.join(env.XDG_CONFIG_HOME || path.join(home, '.config'), 'autostart');
}

// .desktop의 Exec 값: 공백 등이 있으면 따옴표로 감싼다 (Desktop Entry 명세)
function quoteExec(execPath) {
  return /[\s"'\\$`]/.test(execPath) ? `"${execPath.replace(/(["\\$`])/g, '\\$1')}"` : execPath;
}

function desktopEntry(execPath) {
  return [
    '[Desktop Entry]',
    'Type=Application',
    'Name=IIDXwidget',
    `Exec=${quoteExec(execPath)}`,
    'Terminal=false',
    'X-GNOME-Autostart-enabled=true',
    ''
  ].join('\n');
}

function isEnabled({ dir = autostartDir() } = {}) {
  return fs.existsSync(path.join(dir, FILE_NAME));
}

// enabled면 만들거나 경로를 새로 쓰고, 아니면 지운다. 바뀌었으면 true
function setEnabled(enabled, execPath, { dir = autostartDir() } = {}) {
  const file = path.join(dir, FILE_NAME);
  if (!enabled) {
    if (!fs.existsSync(file)) return false;
    fs.unlinkSync(file);
    return true;
  }
  const content = desktopEntry(execPath);
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === content) return false;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, content);
  return true;
}

module.exports = { autostartDir, desktopEntry, isEnabled, setEnabled };
