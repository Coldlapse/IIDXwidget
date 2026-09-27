const test = require('node:test');
const assert = require('assert');
const {
  listControllerDevices, chooseDevice, findAutoController, describeDevice,
  createDedicatedParserState, handleDedicatedData, DEDICATED_LAYOUTS
} = require('../controller/controllerReader');
const fixture = require('./fixtures/lmt-classic-lr2.json');

const LMT = { vendorId: 0x0E8F, productId: 0x1228, product: 'PHONENIXWAN', manufacturer: '(\\  ܤ\\ �X)', usagePage: 1, usage: 4, interface: 0, path: 'lmt-pad' };
const LMT_VENDOR_PAGE = { ...LMT, usagePage: 0xFF00, usage: 1, interface: 3, path: 'lmt-vendor' };
const OTHER_0E8F = { vendorId: 0x0E8F, productId: 0x1228, product: 'USB Gamepad', usagePage: 1, usage: 4, interface: 0, path: 'cheap-pad' };
const PHOENIX = { vendorId: 0x1CCF, productId: 0x8048, product: 'PHOENIXWAN', interface: 1, path: 'phoenix' };

test('LMT Classic 프로필: 게임패드 인터페이스를 원본 주작콘과 같은 처리로 연다', () => {
  const devices = [LMT, LMT_VENDOR_PAGE, PHOENIX];
  assert.deepEqual(listControllerDevices('PHOENIXWAN LMT Classic', devices).map(d => d.path), ['lmt-pad']);
  assert.equal(chooseDevice('PHOENIXWAN LMT Classic', {}, devices).parser, 'PHOENIXWAN_LMT');
  // PHOENIXWAN+ 프로필은 그대로 (LMT를 잡지 않는다)
  assert.deepEqual(listControllerDevices('PHOENIXWAN', devices).map(d => d.path), ['phoenix']);
  // 이름이 다른 같은 VID:PID 게임패드는 LMT 프로필에 안 나온다
  assert.deepEqual(listControllerDevices('PHOENIXWAN LMT Classic', [OTHER_0E8F]), []);
});

test('기타 컨트롤러(수동 매핑)는 그대로: LMT Classic도 고를 수 있고 수동 매핑으로 읽는다', () => {
  assert.equal(findAutoController([LMT]).device.path, 'lmt-pad');
  assert.equal(chooseDevice('AUTO', {}, [LMT]).parser, 'GENERIC');
});

test('장치 이름: node-hid가 깨뜨려 읽은 제조사 문자열은 빼고 보여준다', () => {
  assert.equal(describeDevice(LMT), 'PHONENIXWAN [0e8f:1228]');
});

// 실제 기록(LR2 모드)은 바뀐 신호만 남아 있다. 장치는 1ms마다 같은 값을 계속 보내므로, 각 값을 여러 번 이어서 넣는다
const toBuffer = hex => Buffer.from(hex.split(' ').map(b => parseInt(b, 16)));
const REST = '01 00 00 00 0f 00 80 80 80 80';
function stream(step, holdReports = 20) {
  const changes = fixture.recordings.find(r => r.step === step).changes;
  return [...Array(150).fill(REST), ...changes.flatMap(hex => Array(holdReports).fill(hex))];
}
function play(frames, { lr2 = true } = {}) {
  const state = createDedicatedParserState(DEDICATED_LAYOUTS.PHOENIXWAN_LMT);
  state.lr2DetectEnabled = lr2;
  const events = [];
  const logs = [];
  for (const hex of frames) handleDedicatedData(toBuffer(hex), e => events.push(...e), state, (level, code) => logs.push(code));
  return { events, logs, state };
}
const presses = events => events.filter(e => e.type === 'button' && e.pressed).map(e => e.button);
const turns = events => events.filter(e => e.type === 'axis' && e.direction !== 'neutral').map(e => e.direction);

test('LMT Classic 실제 기록: 건반은 원본 주작콘과 같은 자리(buffer[2])', () => {
  assert.deepEqual(presses(play(stream('key1')).events), ['button 1', 'button 1', 'button 1']);
  assert.deepEqual(presses(play(stream('key7')).events), ['button 7', 'button 7', 'button 7']);
  const rapid = fixture.recordings.find(r => r.step === 'rapid').changes.filter(hex => toBuffer(hex)[2] !== 0).length;
  assert.equal(presses(play(stream('rapid')).events).length, rapid);
});

test('LMT Classic 실제 기록: LR2 모드 감지를 켜면 원본 주작콘처럼 LR2 모드로 바뀌고, 방향이 바뀔 때마다 돈다', () => {
  const { events, logs, state } = play(stream('ttMixed'));
  assert.ok(logs.includes('lr2Activated'));
  assert.equal(state.isLR2Active, true);
  const signals = fixture.recordings.find(r => r.step === 'ttMixed').changes.filter(hex => toBuffer(hex)[7] !== 0x80).length;
  const result = turns(events);
  assert.equal(result.length, signals);
  assert.ok(result.every((d, i) => i === 0 || d !== result[i - 1]));
  assert.deepEqual(turns(play(stream('ttCwSlow')).events), ['-']); // 시계 방향 = 0x00
  assert.equal(events.filter(e => e.type === 'axis').pop().direction, 'neutral'); // 멈추면 불빛을 끈다
});

test('원본 주작콘 배치는 그대로 (buffer[0] 턴테이블, 0x80/0x7F LR2)', () => {
  assert.deepEqual(DEDICATED_LAYOUTS.PHOENIXWAN, { keyByte: 2, turntableByte: 0, lr2: { plus: 0x80, minus: 0x7F, rest: 0x00 } });
  const state = createDedicatedParserState();
  state.lr2DetectEnabled = true;
  const events = [];
  const frame = x => Buffer.from([x, 0, 0]);
  for (let i = 0; i < 130; i++) handleDedicatedData(frame(0x00), () => {}, state, () => {});
  assert.equal(state.isLR2Active, true);
  handleDedicatedData(frame(0x80), e => events.push(...e), state, () => {});
  assert.deepEqual(turns(events), ['+']);
});
