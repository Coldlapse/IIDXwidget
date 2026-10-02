// 따오(IIDXOLLER) 신기판: PHOENIXWAN+ LMT Classic의 PS2/BLE·EAC2dx/HID 모드, RED-LMS 더블콘 (2026-10-02 실측 재생)
const test = require('node:test');
const assert = require('assert');
const path = require('path');
const { EventEmitter } = require('events');

// 가짜 node-hid: 연결된 장치 목록과, 연 장치를 테스트에서 조작한다
const connected = [];
const opened = [];
class FakeHID extends EventEmitter {
  constructor(devicePath) {
    super();
    if (!connected.some(d => d.path === devicePath)) throw new Error('not connected');
    this.path = devicePath;
    opened.push(this);
  }
  close() {}
}
const hidPath = require.resolve('node-hid', { paths: [path.join(__dirname, '..', 'controller')] });
require.cache[hidPath] = { id: hidPath, filename: hidPath, loaded: true, exports: { HID: FakeHID, devices: () => connected.slice() } };

const { listControllerDevices, chooseDevice, startControllerReader, findAutoController } = require('../controller/controllerReader');
const ps2 = require('./fixtures/dao-lmt-ps2-2p.json');
const hid = require('./fixtures/dao-lmt-hid-2p-reversed.json');
const red = require('./fixtures/dao-red-lms.json');

const base = { vendorId: 0x1CCF, productId: 0x8048, usagePage: 1 };
const LMT_PS2 = { ...base, product: 'PHONENIXWAN PS2 and BLE mode', usage: 4, interface: 1, path: 'lmt-ps2' };
const LMT_HID = { ...base, product: 'PHONENIXWAN', usage: 4, interface: 0, path: 'lmt-hid' };
const LMT_HID_SILENT = { ...base, product: 'PHONENIXWAN', interface: 1, path: 'lmt-hid-if1' };
const LMT_LR2 = { vendorId: 0x0E8F, productId: 0x1228, product: 'PHONENIXWAN', usagePage: 1, usage: 4, interface: 0, path: 'lmt-lr2' };
const RED_1P = { ...base, product: 'RED-LMS 1P', usage: 4, interface: 0, path: 'red-1p' };
const RED_2P = { ...base, product: 'RED-LMS 2P', usage: 4, interface: 0, path: 'red-2p' };
const RED_2P_SILENT = { ...base, product: 'RED-LMS 2P', interface: 1, path: 'red-2p-if1' };
const PHOENIX = { ...base, product: 'PHOENIXWAN', manufacturer: 'Konami', usage: 4, interface: 1, path: 'phoenix' };
const PHOENIX_LR2 = { ...base, product: 'Controller INF&BMS', usage: 4, interface: 1, path: 'phoenix-lr2' };
const FPS = { ...base, product: 'FPS EMP', usage: 4, interface: 0, path: 'fps' };
const ALL = [LMT_PS2, LMT_HID, LMT_HID_SILENT, LMT_LR2, RED_1P, RED_2P, RED_2P_SILENT, PHOENIX, PHOENIX_LR2, FPS];
const paths = list => list.map(d => d.path);

test('장치 찾기: LMT 프로필은 세 모드를 모두, RED-LMS 프로필은 1P·2P 게임패드만 잡는다', () => {
  assert.deepEqual(paths(listControllerDevices('PHOENIXWAN LMT Classic', ALL)), ['lmt-ps2', 'lmt-hid', 'lmt-lr2']);
  assert.deepEqual(paths(listControllerDevices('RED-LMS', ALL)), ['red-1p', 'red-2p']);
  assert.equal(chooseDevice('PHOENIXWAN LMT Classic', { devicePath: 'lmt-ps2' }, ALL).parser, 'DAO_PS2');
  assert.equal(chooseDevice('PHOENIXWAN LMT Classic', { devicePath: 'lmt-hid' }, ALL).parser, 'DAO_HID');
  assert.equal(chooseDevice('PHOENIXWAN LMT Classic', { devicePath: 'lmt-lr2' }, ALL).parser, 'PHOENIXWAN_LMT');
  assert.equal(chooseDevice('RED-LMS', {}, ALL).parser, 'DAO_HID');
  // DP: 다른 사이드가 쓰는 장치는 빼고 고른다
  assert.equal(chooseDevice('RED-LMS', { excludePaths: ['red-1p'] }, ALL).device.path, 'red-2p');
});

test('장치 찾기: 주작콘·FPS 프로필은 따오 기판의 조용한 인터페이스를 잡지 않는다 (PS2/BLE 모드는 지금처럼 PHOENIXWAN+로도 잡힌다)', () => {
  assert.deepEqual(paths(listControllerDevices('PHOENIXWAN', ALL)), ['lmt-ps2', 'phoenix', 'phoenix-lr2']);
  assert.deepEqual(paths(listControllerDevices('FPS EMP Gen2', ALL)), ['fps']);
  // 기타 컨트롤러(수동 매핑)는 그대로 모두 고를 수 있다
  assert.equal(findAutoController([RED_2P]).parser, 'GENERIC');
});

// 기록은 바뀐 신호만 남아 있다. 장치는 1ms마다 같은 값을 계속 보내므로 각 값을 여러 번 이어서 넣는다
const toBuffer = hex => Buffer.from(hex.split(' ').map(b => parseInt(b, 16)));
const changes = (recordings, step) => recordings.find(r => r.step === step).changes;
function play(device, profile, frames, options = {}) {
  connected.length = 0;
  connected.push(device);
  const events = [];
  const reader = startControllerReader(profile, e => events.push(...e), { devicePath: device.path, logger: () => {}, ...options });
  const hidDevice = opened[opened.length - 1];
  for (const hex of frames) for (let i = 0; i < 5; i++) hidDevice.emit('data', toBuffer(hex));
  reader.close();
  return events;
}
// 위젯과 같은 계산: 값이 줄면 시계 방향
function spin(events) {
  const values = events.filter(e => e.type === 'axis' && e.axis === 'X').map(e => e.discRaw);
  let cw = 0, ccw = 0, maxStep = 0;
  for (let i = 1; i < values.length; i++) {
    let d = (values[i] - values[i - 1] + 256) % 256;
    if (d > 127) d -= 256;
    if (d < 0) cw++; else if (d > 0) ccw++;
    maxStep = Math.max(maxStep, Math.abs(d));
  }
  return { cw, ccw, maxStep, values };
}
const presses = events => events.filter(e => e.type === 'button' && e.pressed).map(e => e.button);

test('LMT PS2/BLE 모드 (순정, 2P): 건반은 주작콘 자리, 턴테이블은 설정 없이 손과 같은 방향', () => {
  const rec = ps2.recordings;
  assert.deepEqual(presses(play(LMT_PS2, 'PHOENIXWAN LMT Classic', changes(rec, 'key1'))), ['button 1', 'button 1', 'button 1']);
  assert.deepEqual(presses(play(LMT_PS2, 'PHOENIXWAN LMT Classic', changes(rec, 'key7'))), ['button 7', 'button 7', 'button 7']);
  const cw = spin(play(LMT_PS2, 'PHOENIXWAN LMT Classic', [...changes(rec, 'idle'), ...changes(rec, 'ttCwSlow')]));
  assert.ok(cw.cw > 100 && cw.ccw === 0, JSON.stringify(cw));
  // 처음 돌리기 전의 0은 위치가 아니다: 0에서 실제 위치로 건너뛰며 원판이 크게 튀지 않는다
  assert.ok(cw.maxStep <= 2, `maxStep ${cw.maxStep}`);
  const ccw = spin(play(LMT_PS2, 'PHOENIXWAN LMT Classic', changes(rec, 'ttCcwSlow')));
  assert.ok(ccw.ccw > 100 && ccw.cw === 0);
  // 앱의 '턴테이블 방향 반전'을 켜면 반대로 돈다
  const reversed = spin(play(LMT_PS2, 'PHOENIXWAN LMT Classic', changes(rec, 'ttCwSlow'), { turntableReverse: true }));
  assert.ok(reversed.ccw > 100 && reversed.cw === 0);
  // PHOENIXWAN+ 프로필로 쓰던 사람은 지금과 같다 (콘이 보내는 그대로)
  const asPhoenix = spin(play(LMT_PS2, 'PHOENIXWAN', changes(rec, 'ttCwSlow')));
  assert.ok(asPhoenix.ccw > 100 && asPhoenix.cw === 0);
});

test('LMT EAC2dx/HID 모드 (#6, IIDXOLLER 반전 켬): 앱의 반전을 켜면 손과 같은 방향', () => {
  const rec = hid.recordings;
  assert.deepEqual(presses(play(LMT_HID, 'PHOENIXWAN LMT Classic', changes(rec, 'key1'))), ['button 1', 'button 1', 'button 1']);
  const asStock = spin(play(LMT_HID, 'PHOENIXWAN LMT Classic', changes(rec, 'ttCwSlow')));
  assert.ok(asStock.ccw > 100 && asStock.cw === 0); // 순정 기준으로 읽으므로 콘에서 반전한 만큼 반대
  const fixed = spin(play(LMT_HID, 'PHOENIXWAN LMT Classic', changes(rec, 'ttCwSlow'), { turntableReverse: true }));
  assert.ok(fixed.cw > 100 && fixed.ccw === 0);
  const mixed = spin(play(LMT_HID, 'PHOENIXWAN LMT Classic', changes(rec, 'ttMixed'), { turntableReverse: true }));
  assert.ok(mixed.cw > 50 && mixed.ccw > 50 && mixed.maxStep <= 2);
  // E 버튼(buffer[3])은 건반으로 읽지 않는다
  assert.deepEqual(presses(play(LMT_HID, 'PHOENIXWAN LMT Classic', changes(rec, 'extra'))), []);
});

test('RED-LMS: 2P 순정은 설정 없이, 1P(IIDXOLLER 반전 켬)는 앱의 반전을 켜면 손과 같은 방향', () => {
  const p1 = red.sides['1P'];
  const p2 = red.sides['2P'];
  const stock2P = spin(play(RED_2P, 'RED-LMS', changes(p2, 'ttCwSlow')));
  assert.ok(stock2P.cw > 100 && stock2P.ccw <= 3, JSON.stringify(stock2P));
  const ccw2P = spin(play(RED_2P, 'RED-LMS', changes(p2, 'ttCcwSlow')));
  assert.ok(ccw2P.ccw > 100 && ccw2P.cw === 0);
  const reversed1P = spin(play(RED_1P, 'RED-LMS', changes(p1, 'ttCwSlow'), { turntableReverse: true }));
  assert.ok(reversed1P.cw > 100 && reversed1P.ccw === 0);
  assert.deepEqual(presses(play(RED_2P, 'RED-LMS', changes(p2, 'key7'))), ['button 7', 'button 7', 'button 7']);
  const chord = changes(p1, 'chord').map(toBuffer);
  const expected = chord.reduce((n, b, i) => n + [...Array(7).keys()].filter(k => (b[2] & (1 << k)) && !(i && (chord[i - 1][2] & (1 << k)))).length, 0);
  assert.equal(presses(play(RED_1P, 'RED-LMS', changes(p1, 'chord'))).length, expected);
});
