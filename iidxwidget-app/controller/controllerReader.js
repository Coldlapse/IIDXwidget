const HID = require('node-hid');

const TARGET_VENDOR_ID = 0x1CCF;
const TARGET_PRODUCT_ID = 0x8048;

let device;
let lastButtonByte = 0;

function startControllerReader(onDataCallback) {
  const HID = require('node-hid');
  const TARGET_VENDOR_ID = 0x1CCF;
  const TARGET_PRODUCT_ID = 0x8048;

  const devices = HID.devices();
  const deviceInfo = devices.find(d => d.vendorId === TARGET_VENDOR_ID && d.productId === TARGET_PRODUCT_ID && d.interface === 1);

  if (!deviceInfo) {
    console.error('❌ PHOENIXWAN controller not found.');
    return null;
  }

  const device = new HID.HID(deviceInfo.path);
  console.log('🎮 PHOENIXWAN connected.');

  device.on('data', buffer => {
    try {
      const parsed = parseControllerData(buffer);
      if (parsed.length > 0) onDataCallback(parsed);
    } catch (e) {
      console.error('❌ Failed to parse HID data:', e);
    }
  });

  device.on('error', err => {
    console.error('❌ Device error:', err);
  });

  return device; // ✅ 중요한 부분
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
