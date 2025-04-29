const HID = require('node-hid');

const TARGET_VENDOR_ID = 0x1CCF;
const TARGET_PRODUCT_ID = 0x8048;

let device;
let lastButtonByte = 0;

function startControllerReader(onDataCallback) {
  const devices = HID.devices();
  const targetDeviceInfo = devices.find(d =>
    d.vendorId === TARGET_VENDOR_ID &&
    d.productId === TARGET_PRODUCT_ID &&
    d.interface === 1
  );

  if (!targetDeviceInfo) {
    console.error('❌ Controller INF&BMS not found.');
    return;
  }

  try {
    device = new HID.HID(targetDeviceInfo.path);
    console.log('🎮 Controller INF&BMS connected.');

    // ⚠️ 일단 초기화 커맨드는 주석 처리
    // try {
    //   device.write([0x00]);
    //   console.log('📡 Initialization command sent.');
    // } catch (initErr) {
    //   console.warn('⚠️ Initialization command failed (may still work).');
    // }

    device.on('data', (data) => {
      // console.log('Raw buffer:', data);  // 컨트롤러 추가 시에만 디버깅 

      try {
        const parsedList = parseControllerData(data);
        if (parsedList && parsedList.length > 0) {
          onDataCallback(parsedList);
        }
      } catch (err) {
        console.error('❌ parseControllerData() failed:', err);
      }
    });

    device.on('error', (err) => {
      console.error('❌ Device error:', err);
    });

  } catch (err) {
    console.error('❌ Failed to open device:', err);
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
        button: `Button ${i + 1}`,
        pressed: isPressed,
        timestamp: now
      });
    }
  }

  lastButtonByte = buttonByte;

  const xAxis = buffer[3];
  if (xAxis < 100) {
    events.push({ type: 'axis', axis: 'X', direction: '-', timestamp: now });
  } else if (xAxis > 150) {
    events.push({ type: 'axis', axis: 'X', direction: '+', timestamp: now });
  } else {
    events.push({ type: 'axis', axis: 'X', direction: 'neutral', timestamp: now });
  }

  return events;
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
        button: `Button ${i + 1}`,
        pressed: isPressed,
        timestamp: now
      });
    }
  }

  lastButtonByte = buttonByte;

  // ====== X축 관련 ======
  const xAxisRaw = buffer[0]; // 0번째 바이트 (스크래치 raw)

  const xEvent = {
    type: 'axis',
    axis: 'X',
    direction: 'neutral', // 기본
    discRaw: xAxisRaw,
    timestamp: now
  };

  // x축 방향 추정
  if (xAxisRaw < 100) {
    xEvent.direction = '-';
  } else if (xAxisRaw > 150) {
    xEvent.direction = '+';
  }

  events.push(xEvent);

  return events;
}


module.exports = { startControllerReader };
