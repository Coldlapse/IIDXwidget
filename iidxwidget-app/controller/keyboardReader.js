const { GlobalKeyboardListener } = require('node-global-key-listener');

function startGlobalKeyboardReader(mapping, onEventCallback) {
  let currentDiscRaw = 128; // ✅ 스크래치 초기값
  const pressed = new Set();
  const gkl = new GlobalKeyboardListener();

  const keyToAction = {};
  for (const [action, key] of Object.entries(mapping)) {
    keyToAction[key] = action;
  }

  const listener = event => {

    const code = (event.rawKey?.standardName?.trim()) || event.rawKey?.name || '';

    console.log('log: ',code);

    const isDown = event.state === 'DOWN';
    const normalized = normalizeKeyName(code);
    const action = keyToAction[normalized];
    if (!action) return;

    if (isDown) {
      if (pressed.has(normalized)) return;
      pressed.add(normalized);

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
        pressed.delete(normalized);
      
        if (/^[1-7]$/.test(action)) {
          onEventCallback({ type: 'button', button: `button ${action}`, pressed: false });
        } else if (action === 'SCup' || action === 'SCdown') {
          // 🔥 등 해제를 위해 discRaw 변화 없이 이벤트 전송
          onEventCallback({ type: 'axis', axis: 'X', discRaw: currentDiscRaw });
        }
      }
  };

  gkl.addListener(listener);

  console.log('🟢 Global keyboard listener active');

  return {
    stop: () => gkl.removeListener(listener)
  };
}

function normalizeKeyName(name) {
    const lower = name.toLowerCase();
    // 🅰️ A~Z -> KeyA~KeyZ
    if (lower.length === 1 && /[a-z]/.test(lower)) return `Key${lower.toUpperCase()}`;
  
    // 🔢 상단 숫자 0~9 -> Digit0~Digit9
    if (/^[0-9]$/.test(name)) return `Digit${name}`;
  
    // 🧮 넘버패드 숫자
    if (/^numpad\s?[0-9]$/.test(lower)) {
      const num = lower.replace(/\D/g, '');
      return `Numpad${num}`;
    }

    // Function Rows
    if (/^f[1-9]$|^f1[0-9]$|^f2[0-4]$/.test(lower)) return lower.toUpperCase();

    const symbolMap = {
      'semicolon': 'Semicolon',
      'quote': 'Quote',
      'comma': 'Comma',
      'dot': 'Period',
      'forward slash': 'Slash',
      'backslash': 'Backslash',
      'square bracket open': 'BracketLeft',
      'square bracket close': 'BracketRight',
      'minus': 'Minus',
      'equal': 'Equal',
      'section': 'Backquote',

      'num lock': 'NumLock',
      'numpad plus': 'NumpadAdd',
      'numpad minus': 'NumpadSubtract',
      'numpad divide': 'NumpadDivide',
      'numpad multiply': 'NumpadMultiply',
      'numpad dot': 'NumpadDecimal',

      'scroll lock': 'ScrollLock',
      'pause': 'Pause',

      'left shift': 'ShiftLeft',
      'right shift': 'ShiftRight',
      'left ctrl': 'ControlLeft',
      'right ctrl': 'ControlRight',
      'hanja': 'ControlRight',
      'left alt': 'AltLeft',
      'right alt': 'AltRight',
      'kana': 'AltRight',
      'left meta': 'MetaLeft',
      'right meta': 'MetaRight',
      'apps': 'ContextMenu',
      'space': 'Space',
      'enter': 'Enter',
      'return': 'Enter',
      'tab': 'Tab',
      'backspace': 'Backspace',
      'escape': 'Escape',
      'caps lock': 'CapsLock',

      'insert': 'Insert',
      'ins': 'Insert',
      'delete': 'Delete',
      'home': 'Home',
      'end': 'End',
      'page up': 'PageUp',
      'page down': 'PageDown',
      'up arrow': 'ArrowUp',
      'down arrow': 'ArrowDown',
      'left arrow': 'ArrowLeft',
      'right arrow': 'ArrowRight',
    };

    const mapped = symbolMap[lower];
    if (mapped) return mapped;
  
    // Default
    return name.replace(/\s+/g, '');
  }
  

module.exports = { startGlobalKeyboardReader };
