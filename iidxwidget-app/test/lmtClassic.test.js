const test = require('node:test');
const assert = require('assert');
const {
  parseLmtData, createLmtParserState, listControllerDevices, chooseDevice, findAutoController, hasOfficiallySupportedController, describeDevice
} = require('../controller/controllerReader');
const fixture = require('./fixtures/lmt-classic-lr2.json');

// 실제 기록(컨트롤러 정보 수집, LR2 모드)을 순서대로 넣어 본다
const toBuffer = hex => Buffer.from(hex.split(' ').map(b => parseInt(b, 16)));
function replay(step, state = createLmtParserState()) {
  const changes = fixture.recordings.find(r => r.step === step).changes;
  return changes.flatMap(hex => parseLmtData(toBuffer(hex), state));
}
const presses = events => events.filter(e => e.type === 'button' && e.pressed).map(e => e.button);
const turns = events => events.filter(e => e.type === 'axis' && e.direction !== 'neutral').map(e => e.direction);

const LMT = { vendorId: 0x0E8F, productId: 0x1228, product: 'PHONENIXWAN', manufacturer: '(\\  ܤ\\ �X)', usagePage: 1, usage: 4, interface: 0, path: 'lmt-pad' };
const LMT_VENDOR_PAGE = { ...LMT, usagePage: 0xFF00, usage: 1, interface: 3, path: 'lmt-vendor' };
const OTHER_0E8F = { vendorId: 0x0E8F, productId: 0x1228, product: 'USB Gamepad', usagePage: 1, usage: 4, interface: 0, path: 'cheap-pad' };

test('LMT Classic: PHOENIXWAN 프로필에서 게임패드 인터페이스를 전용 파서로 연다', () => {
  const devices = [LMT, LMT_VENDOR_PAGE];
  assert.deepEqual(listControllerDevices('PHOENIXWAN', devices).map(d => d.path), ['lmt-pad']);
  assert.equal(chooseDevice('PHOENIXWAN', {}, devices).parser, 'PHOENIXWAN_LMT');
  // 일반 모드는 수동 매핑으로 쓰는 사람이 있어서 기타 컨트롤러(수동 매핑)에도 남긴다
  assert.equal(hasOfficiallySupportedController(devices), false);
  assert.equal(findAutoController(devices).device.path, 'lmt-pad');
  assert.equal(chooseDevice('AUTO', {}, devices).parser, 'GENERIC');
});

test('LMT Classic: 같은 VID:PID의 다른 게임패드(이름이 다름)는 기타 컨트롤러로 남는다', () => {
  assert.deepEqual(listControllerDevices('PHOENIXWAN', [OTHER_0E8F]), []);
  assert.equal(findAutoController([OTHER_0E8F]).device.path, 'cheap-pad');
});

test('장치 이름: node-hid가 깨뜨려 읽은 제조사 문자열은 빼고 보여준다', () => {
  assert.equal(describeDevice(LMT), 'PHONENIXWAN [0e8f:1228]');
  assert.equal(describeDevice({ vendorId: 0x1CCF, productId: 0x8048, manufacturer: 'DJ DAO', product: 'PHOENIXWAN' }), 'DJ DAO PHOENIXWAN [1ccf:8048]');
});

test('LMT Classic 실제 기록: 건반은 공식 주작콘과 같은 자리(buffer[2])에서 읽힌다', () => {
  assert.deepEqual(presses(replay('key1')), ['button 1', 'button 1', 'button 1']);
  assert.deepEqual(presses(replay('key7')), ['button 7', 'button 7', 'button 7']);
  // 연타: 기록의 누름 54번이 모두 이벤트가 된다 (기판은 입력을 빠뜨리지 않는다)
  const rapidPresses = fixture.recordings.find(r => r.step === 'rapid').changes.filter(hex => toBuffer(hex)[2] !== 0).length;
  assert.equal(presses(replay('rapid')).length, rapidPresses);
});

test('LMT Classic 실제 기록 (LR2 모드): 스크래치를 돌리기 시작하는 순간 방향이 잡힌다', () => {
  assert.deepEqual(turns(replay('ttCwSlow')), ['-']);           // 0x00 → -
  assert.deepEqual(turns(replay('ttCcwSlow')), ['+', '+']);     // 0xFF → +, 중간에 한 번 멈췄다 다시 돌림
  // 양방향 번갈아: 방향 신호가 들어온 횟수만큼 회전 이벤트가 나오고, 방향이 번갈아 나온다
  const mixed = fixture.recordings.find(r => r.step === 'ttMixed').changes.map(hex => toBuffer(hex)[7]);
  const signals = mixed.filter(v => v !== 0x80).length;
  const result = turns(replay('ttMixed'));
  assert.equal(result.length, signals);
  assert.ok(result.every((d, i) => i === 0 || d !== result[i - 1]));
  // 멈추면 중립 이벤트로 위아래 불빛이 꺼진다
  const last = replay('ttMixed').filter(e => e.type === 'axis').pop();
  assert.equal(last.direction, 'neutral');
});

test('LMT Classic: 축 자리에 절대 위치가 오면(일반 모드 추정) 움직이는 바이트의 위치를 쓴다', () => {
  // 7번이 아닌 다른 축 바이트(예: 6번)로 와도 찾는다
  const other = createLmtParserState();
  const frame6 = v => Buffer.from([0x01, 0, 0, 0, 0x0f, 0, v, 0x80, 0x80, 0x80]);
  const moved = [0x80, 0x81, 0x84].flatMap(v => parseLmtData(frame6(v), other)).filter(e => e.type === 'axis');
  assert.equal(other.positionByte, 6);
  assert.deepEqual(moved.map(e => e.discRaw), [0x81, 0x84]);

  const state = createLmtParserState();
  const frame = tt => Buffer.from([0x01, 0, 0, 0, 0x0f, 0, 0x80, tt, 0x80, 0x80]);
  const events = [0x40, 0x42, 0x45, 0x43].flatMap(v => parseLmtData(frame(v), state)).filter(e => e.type === 'axis');
  assert.equal(state.turntableMode, 'position');
  assert.deepEqual(events.map(e => e.discRaw), [0x40, 0x42, 0x45, 0x43]);
  assert.deepEqual(events.map(e => e.direction), ['neutral', '+', '+', '-']);
});
