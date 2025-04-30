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
    const code = event.name;
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
    if (/^num\s?[0-9]$/.test(lower)) {
      const num = lower.replace(/\D/g, '');
      return `Numpad${num}`;
    }
  
    switch (lower) {
      case 'left shift': return 'ShiftLeft';
      case 'right shift': return 'ShiftRight';
      case 'left ctrl':
      case 'lcontrol': return 'ControlLeft';
      case 'right ctrl':
      case 'rcontrol': return 'ControlRight';
      case 'space': return 'Space';
      case 'enter': return 'Enter';
      case 'tab': return 'Tab';
      case 'backspace': return 'Backspace';
      case 'escape': return 'Escape';
      case 'capslock': return 'CapsLock';
      case 'minus': return 'Minus';
      case 'equal': return 'Equal';
      default:
        return name.replace(/\s+/g, '');
    }
  }
  

module.exports = { startGlobalKeyboardReader };
