const HID = require('node-hid');
let lastButtonByte = 0;
let isLR2Active = false;
let lr2DetectEnabled = false;
let lr2PatternCount = 0;
let normalPatternCount = 0;
let currentDiscRaw = 0;
let lastLR2Direction = 'neutral';
const LR2_ACTIVATE_THRESHOLD = 120;
const LR2_DEACTIVATE_THRESHOLD = 3;

function startControllerReader(mode, onDataCallback, options = {}) {
  // 🔁 상태 초기화
  isLR2Active = false;
  lr2PatternCount = 0;
  normalPatternCount = 0;
  currentDiscRaw = 0;
  lastLR2Direction = 'neutral';
  lr2DetectEnabled = !!options.lr2ModeEnabled;
  const devices = HID.devices();

  const deviceInfo = devices.find(d => {
    if (mode === 'PHOENIXWAN') {
      return d.vendorId === 0x1CCF && d.productId === 0x8048 && d.interface === 1;
    } else if (mode === 'FPS EMP Gen2') {
      return d.vendorId === 0x1CCF && d.productId === 0x8048 && d.interface === 0 && d.usagePage === 1;
    }
    return false;
  });

  if (!deviceInfo) {
    console.error(`❌ ${mode} 장치를 찾을 수 없습니다.`);
    return null;
  }

  console.log(`🎮 ${mode} 연결 시도:`, deviceInfo);

  let device;
  try {
    device = new HID.HID(deviceInfo.path);
    console.log(`🟢 ${mode} 연결 성공`);
  } catch (e) {
    console.error(`❌ ${mode} 장치 열기 실패:`, e);
    return null;
  }


  device.on('data', buffer => {
  try {
    if (!device || typeof device.read !== 'function') return;

    const xRaw = buffer[0];
    if (lr2DetectEnabled) detectLR2Mode(buffer, onDataCallback);
    const parsed = parseControllerData(buffer);

    if (isLR2Active) {
      const filtered = parsed.filter(event => !(event.type === 'axis' && event.axis === 'X'));

      let direction = 'neutral';
      if (xRaw === 0x80) direction = '+';
      else if (xRaw === 0x7F) direction = '-';

      if (direction !== 'neutral' && direction !== lastLR2Direction) {
        lastLR2Direction = direction;

        if (direction === '+') {
          currentDiscRaw = (currentDiscRaw + 5) % 256;
        } else if (direction === '-') {
          currentDiscRaw = (currentDiscRaw - 5 + 256) % 256;
        }

        filtered.push({
          type: 'axis',
          axis: 'X',
          direction,
          discRaw: currentDiscRaw,
          timestamp: Date.now()
        });

        onDataCallback(filtered);
      } else if (direction === 'neutral' && lastLR2Direction !== 'neutral') {
        lastLR2Direction = 'neutral';
        filtered.push({
          type: 'axis',
          axis: 'X',
          direction: 'neutral',
          discRaw: currentDiscRaw,
          timestamp: Date.now()
        });
        onDataCallback(filtered);
      } else {
        // 버튼만 눌린 경우 처리
        if (filtered.length > 0) {
          onDataCallback(filtered);
        }
      }
      return;
    }

    // ✅ 일반 모드일 경우 parsed 원본을 그대로 반영
    if (parsed.length > 0) onDataCallback(parsed);

  } catch (err) {
    if (err?.message?.includes('Object has been destroyed')) {
      console.warn('⚠️ HID device destroyed, ignoring further data events.');
    } else {
      console.error('❌ Error in device.on("data") handler:', err);
    }
  }
});


  device.on('error', err => {
    console.error('❌ 디바이스 에러:', err);
  });

  return {
    close: () => {
      try {
        device.removeAllListeners('data');
        device.removeAllListeners('error');
        device.close();
        console.log('🛑 HID 장치 안전하게 닫힘');
      } catch (e) {
        console.error('❌ HID 닫기 실패:', e);
      }
    }
  };


}

function detectLR2Mode(buffer, logCallback) {
  const xRaw = buffer[0];
  const isStatic = [0x80, 0x7F, 0x00].includes(xRaw);

  if (isStatic) {
    if (lr2PatternCount === 0) lr2FirstStaticTime = Date.now();
    lr2PatternCount++;
    normalPatternCount = 0;

    const duration = Date.now() - lr2FirstStaticTime;

    if (!isLR2Active && lr2PatternCount >= LR2_ACTIVATE_THRESHOLD && duration < 500) {
      isLR2Active = true;
      console.log('🔵 LR2 모드 활성화됨');
      if (typeof logCallback === 'function') {
        logCallback([{ type: 'log', message: '🔵 LR2 모드 활성화됨', timestamp: Date.now() }]);
      }
    }
  } else {
    lr2PatternCount = 0;
    normalPatternCount++;
    lr2FirstStaticTime = null;

    if (isLR2Active && normalPatternCount >= LR2_DEACTIVATE_THRESHOLD) {
      isLR2Active = false;
      console.log('⚪ LR2 모드 비활성화됨');
      if (typeof logCallback === 'function') {
        logCallback([{ type: 'log', message: '⚪ LR2 모드 비활성화됨', timestamp: Date.now() }]);
      }
    }
  }
}

function parseControllerData(buffer) {
  const events = [];
  const buttonByte = buffer[2];
  const now = Date.now();

  for (let i = 0; i < 7; i++) {
    const mask = 1 << i;
    const wasPressed = (lastButtonByte & mask) !== 0;
    const isPressed = (buttonByte & mask) !== 0;

    if (wasPressed !== isPressed) {
      events.push({
        type: 'button',
        button: `button ${i + 1}`,
        pressed: isPressed,
        timestamp: now
      });
    }
  }

  lastButtonByte = buttonByte;

  const xRaw = buffer[0];
  const direction = xRaw < 100 ? '-' : xRaw > 150 ? '+' : 'neutral';

  events.push({
    type: 'axis',
    axis: 'X',
    direction,
    discRaw: xRaw,
    timestamp: now
  });

  return events;
}

module.exports = { startControllerReader };
