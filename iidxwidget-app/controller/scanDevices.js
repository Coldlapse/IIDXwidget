const HID = require('node-hid');

// 현재 연결된 HID 장치들 목록
const devices = HID.devices();

// "Controller INF&BMS" 찾기
const targetDevices = devices.filter(device => device.product && device.product.includes('Controller INF&BMS'));

if (targetDevices.length === 0) {
  console.log('🎮 Controller INF&BMS를 찾을 수 없습니다.');
} else {
  console.log('🎮 찾은 장치 목록:');
  console.log(targetDevices);
}
