// 자동 업데이트. 이벤트 리스너는 한 번만 등록하고, 수동 확인인지는 플래그로 구분한다.
const { app, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');

function stripHtmlToText(html) {
  return html
    .replace(/<\/p>/gi, '\n\n')     // 문단 끝에 줄바꿈 2번
    .replace(/<p[^>]*>/gi, '')      // 문단 시작 태그 제거
    .replace(/<br\s*\/?>/gi, '\n')  // 줄바꿈
    .replace(/<\/?div[^>]*>/gi, '\n') // div 줄바꿈
    .replace(/<[^>]+>/g, '')        // 나머지 태그 제거
    .trim();
}

// electron-updater는 릴리스 노트를 문자열 또는 [{ version, note }] 배열로 준다
function releaseNotesText(notes) {
  if (Array.isArray(notes)) return notes.map(n => stripHtmlToText(n.note || '')).join('\n\n');
  return stripHtmlToText(notes || '');
}

// t(key, values): 번역 함수, store: skippedVersion 저장용 electron-store
function setupUpdater({ t, store, logger }) {
  autoUpdater.logger = logger;
  autoUpdater.autoDownload = false;

  let manualCheck = false;
  let checking = false;

  const finishCheck = () => {
    manualCheck = false;
    checking = false;
  };

  autoUpdater.on('checking-for-update', () => console.log('🔍 업데이트 확인 중...'));

  autoUpdater.on('update-available', (info) => {
    const isManual = manualCheck;
    finishCheck();
    console.log('📦 업데이트 발견됨:', info.version);

    // 자동 확인에서는 사용자가 건너뛴 버전을 다시 묻지 않는다
    if (!isManual && info.version === store.get('skippedVersion')) {
      console.log(`🚫 스킵된 버전 ${info.version} – 알림 건너뜀`);
      return;
    }

    const buttons = [t('update.update'), t('common.later')];
    if (!isManual) buttons.push(t('update.skip'));
    const result = dialog.showMessageBoxSync({
      type: 'info',
      title: t('update.availableTitle'),
      message: t('update.available', { version: info.version, notes: releaseNotesText(info.releaseNotes) }),
      buttons,
      cancelId: 1,
      defaultId: 0
    });

    if (result === 0) {
      autoUpdater.downloadUpdate();
    } else if (result === 2) {
      store.set('skippedVersion', info.version);
      console.log(`⚠️ ${info.version} 을(를) 스킵 목록에 추가`);
    }
  });

  autoUpdater.on('update-not-available', () => {
    const isManual = manualCheck;
    finishCheck();
    console.log('✅ 현재 최신 버전입니다.');
    if (isManual) {
      dialog.showMessageBox({ type: 'info', title: t('menu.checkUpdates'), message: t('update.current') });
    }
  });

  autoUpdater.on('error', (err) => {
    const isManual = manualCheck;
    finishCheck();
    console.error('❌ 업데이트 오류:', err);
    if (isManual) {
      dialog.showMessageBox({ type: 'error', title: t('update.errorTitle'), message: t('update.error', { message: err.message }) });
    }
  });

  autoUpdater.on('update-downloaded', () => {
    const confirm = dialog.showMessageBoxSync({
      type: 'question',
      title: t('update.readyTitle'),
      message: t('update.ready'),
      buttons: [t('update.restartNow'), t('update.later')],
      defaultId: 0,
      cancelId: 1
    });
    if (confirm === 0) autoUpdater.quitAndInstall(); // ✅ 종료 후 설치
  });

  function check(isManual) {
    if (!app.isPackaged) {
      console.log('ℹ️ 개발 실행에서는 업데이트를 확인하지 않습니다.');
      if (isManual) dialog.showMessageBox({ type: 'info', title: t('menu.checkUpdates'), message: t('update.current') });
      return;
    }
    // 확인이 진행 중이면 수동 확인 표시만 남기고 결과를 기다린다
    if (isManual) manualCheck = true;
    if (checking) return;
    checking = true;
    autoUpdater.checkForUpdates().catch(() => {}); // 오류는 'error' 이벤트에서 처리
  }

  return {
    checkOnStartup: () => check(false),
    checkManually: () => check(true)
  };
}

module.exports = { setupUpdater, stripHtmlToText, releaseNotesText };
