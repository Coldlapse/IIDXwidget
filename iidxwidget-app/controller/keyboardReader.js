const { uIOhook, UiohookKey } = require('uiohook-napi');

// uiohook keycode -> KeyboardEvent.code (설정 화면에서 저장하는 형식)
const KEYCODE_TO_CODE = buildKeycodeTable();

let activeReaders = 0;

function startGlobalKeyboardReader(mapping, onEventCallback) {
  let currentDiscRaw = 128; // ✅ 스크래치 초기값
  const pressed = new Set();

  const keyToAction = {};
  for (const [action, key] of Object.entries(mapping)) {
    keyToAction[key] = action;
  }

  const handle = (event, isDown) => {
    const code = KEYCODE_TO_CODE[event.keycode];
    const action = code && keyToAction[code];
    if (!action) return;

    if (isDown) {
      if (pressed.has(code)) return;
      pressed.add(code);

      if (/^[1-7]$/.test(action)) {
        onEventCallback({ type: 'button', button: `button ${action}`, pressed: true });
      } else if (action === 'SCup') {
        currentDiscRaw = (currentDiscRaw + 2) % 256;
        onEventCallback({ type: 'axis', axis: 'X', discRaw: currentDiscRaw });
      } else if (action === 'SCdown') {
        currentDiscRaw = (currentDiscRaw - 2 + 256) % 256;
        onEventCallback({ type: 'axis', axis: 'X', discRaw: currentDiscRaw });
      }
    } else {
      pressed.delete(code);

      if (/^[1-7]$/.test(action)) {
        onEventCallback({ type: 'button', button: `button ${action}`, pressed: false });
      } else if (action === 'SCup' || action === 'SCdown') {
        // 🔥 등 해제를 위해 discRaw 변화 없이 이벤트 전송
        onEventCallback({ type: 'axis', axis: 'X', discRaw: currentDiscRaw });
      }
    }
  };

  const onDown = e => handle(e, true);
  const onUp = e => handle(e, false);

  uIOhook.on('keydown', onDown);
  uIOhook.on('keyup', onUp);
  if (activeReaders++ === 0) uIOhook.start();

  console.log('🟢 Global keyboard listener active');

  let stopped = false;
  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      uIOhook.off('keydown', onDown);
      uIOhook.off('keyup', onUp);
      if (--activeReaders === 0) uIOhook.stop();
    }
  };
}

function buildKeycodeTable() {
  const renamed = {
    Ctrl: 'ControlLeft',
    CtrlRight: 'ControlRight',
    Alt: 'AltLeft',
    AltRight: 'AltRight',
    Shift: 'ShiftLeft',
    ShiftRight: 'ShiftRight',
    Meta: 'MetaLeft',
    MetaRight: 'MetaRight',
    // 설정 화면에서 Enter / NumpadEnter를 모두 'Enter'로 저장함
    NumpadEnter: 'Enter',
    // NumLock 꺼진 상태의 넘버패드
    NumpadInsert: 'Numpad0',
    NumpadEnd: 'Numpad1',
    NumpadArrowDown: 'Numpad2',
    NumpadPageDown: 'Numpad3',
    NumpadArrowLeft: 'Numpad4',
    NumpadArrowRight: 'Numpad6',
    NumpadHome: 'Numpad7',
    NumpadArrowUp: 'Numpad8',
    NumpadPageUp: 'Numpad9',
    NumpadDelete: 'NumpadDecimal',
  };

  const table = {};
  for (const [name, keycode] of Object.entries(UiohookKey)) {
    if (renamed[name]) table[keycode] = renamed[name];
    else if (/^[A-Z]$/.test(name)) table[keycode] = `Key${name}`;
    else if (/^[0-9]$/.test(name)) table[keycode] = `Digit${name}`;
    else table[keycode] = name;
  }

  // UiohookKey에 없는 키 (Windows 한국어 키보드에서 실측)
  table[0x0070] = 'AltRight';     // 한/영 (VK_HANGUL)
  table[0x0079] = 'ControlRight'; // 한자 (VK_HANJA)
  table[0x0E5D] = 'ContextMenu';
  table[0x0E45] = 'Pause';

  return table;
}

module.exports = { startGlobalKeyboardReader };
