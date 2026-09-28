const assert = require('assert');
const { findExactDedicatedDevice, findAutoController, hasOfficiallySupportedController, listControllerDevices, chooseDevice, parseGenericControllerData, parseControllerData, createDedicatedParserState } = require('../controller/controllerReader');
const phoenix = { path: 'phoenix', vendorId: 0x1CCF, productId: 0x8048, interface: 1, usagePage: 1 };
const fps = { path: 'fps', vendorId: 0x1CCF, productId: 0x8048, interface: 0, usagePage: 1 };
const arduino = { path: 'arduino', vendorId: 0x2341, productId: 0x8036, manufacturer: 'Arduino LLC', product: 'Arduino Leonardo', interface: 2, usagePage: 1, usage: 4 };
const keyboard = { path: 'keyboard', usagePage: 1, usage: 6 };
assert.equal(findAutoController([arduino]).device, arduino);
assert.equal(findExactDedicatedDevice([arduino], 'PHOENIXWAN'), undefined);
assert.equal(findExactDedicatedDevice([arduino], 'FPS EMP Gen2'), undefined);
// 기타 컨트롤러: 공식 지원 컨트롤러(주작콘·FPS)도 수동 매핑으로 고를 수 있다 (게임패드로 잡히는 인터페이스라면)
assert.equal(findAutoController([{ ...phoenix, usage: 4 }]).device.path, "phoenix");
assert.equal(findAutoController([{ ...phoenix, usage: 4 }]).parser, "GENERIC");
assert.equal(findAutoController([phoenix, arduino]).device, arduino); // 게임패드가 아닌 인터페이스(usage 없음)는 여전히 후보가 아니다
assert.equal(hasOfficiallySupportedController([keyboard, phoenix]), true);
assert.equal(hasOfficiallySupportedController([keyboard, arduino]), false);
assert.equal(findAutoController([keyboard]), null);
const neutral = Buffer.from([6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]);
const button1 = Buffer.from([6,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0]);
const button2 = Buffer.from([6,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0]);
const state = { previousButtons: 0 };
assert.deepEqual(parseGenericControllerData(neutral, { 1: 1 }, state), []);
let events = parseGenericControllerData(button1, { 1: 1 }, state);
assert.deepEqual(events.map(e => [e.type, e.physicalButton, e.pressed, e.button]), [['physical-button',1,true,undefined],['button',1,true,'button 1']]);
events = parseGenericControllerData(neutral, { 1: 1 }, state);
assert.deepEqual(events.map(e => [e.type, e.pressed]), [['physical-button',false],['button',false]]);
events = parseGenericControllerData(button2, { 7: 2 }, state);
assert.equal(events.find(e => e.type === 'button').button, 'button 7');
const turntableState = { previousButtons: 0, currentDiscRaw: 128 };
events = parseGenericControllerData(button1, { SCup: 1 }, turntableState);
// 버튼 매핑 턴테이블은 주작콘 LR2 모드와 같다: 누르면 5칸, 떼면 같은 값으로 한 번 더 (위젯의 스크래치 불 끄기)
assert.deepEqual(events.map(e => e.type), ['physical-button', 'axis']);
assert.equal(events[1].discRaw, 133);
assert.equal(events[1].direction, '+');
events = parseGenericControllerData(neutral, { SCup: 1 }, turntableState);
assert.deepEqual(events.map(e => [e.type, e.discRaw, e.direction]), [['physical-button', undefined, undefined], ['axis', 133, 'neutral']]);
events = parseGenericControllerData(button2, { SCdown: 2 }, turntableState);
assert.equal(events.find(e => e.type === 'axis').discRaw, 128);
assert.equal(events.find(e => e.type === 'axis').direction, '-');
const report = Buffer.from([128, 0, 1]);
const pState = createDedicatedParserState(), fState = createDedicatedParserState();
assert.deepEqual(parseControllerData(report, pState).map(e => e.type), ['button','axis']);
assert.deepEqual(parseControllerData(report, fState).map(e => e.type), ['button','axis']);
assert.equal(findExactDedicatedDevice([keyboard], 'KB'), undefined);
console.log('controllerReader tests passed');

// report ID가 없는 장치: 첫 바이트가 버튼 1~8
{
  const { createGenericParserState } = require('../controller/controllerReader');
  const mapping = { 1: 1, 3: 3 };
  const s = createGenericParserState();
  const pressed = events => events.filter(e => e.type === 'button').map(e => `${e.button} ${e.pressed ? 'down' : 'up'}`);
  assert.deepEqual(pressed(parseGenericControllerData(Buffer.from([0, 0, 0, 0]), mapping, s)), []);
  assert.equal(s.hasReportId, false);
  assert.deepEqual(pressed(parseGenericControllerData(Buffer.from([1, 0, 0, 0]), mapping, s)), ['button 1 down']);
  assert.deepEqual(pressed(parseGenericControllerData(Buffer.from([5, 0, 0, 0]), mapping, s)), ['button 3 down']);
  assert.deepEqual(pressed(parseGenericControllerData(Buffer.from([0, 0, 0, 0]), mapping, s)), ['button 1 up', 'button 3 up']);
}

// report ID가 없는 장치인데 연결 순간 버튼 1이 눌려 있던 경우: 버튼을 떼는 순간 판단을 바로잡음
{
  const { createGenericParserState } = require('../controller/controllerReader');
  const mapping = { 1: 1, 2: 2 };
  const s = createGenericParserState();
  const pressed = events => events.filter(e => e.type === 'button').map(e => `${e.button} ${e.pressed ? 'down' : 'up'}`);
  parseGenericControllerData(Buffer.from([1, 0, 0, 0]), mapping, s); // 처음엔 report ID로 오인
  assert.equal(s.hasReportId, true);
  assert.deepEqual(pressed(parseGenericControllerData(Buffer.from([0, 0, 0, 0]), mapping, s)), []);
  assert.equal(s.hasReportId, false);
  assert.deepEqual(pressed(parseGenericControllerData(Buffer.from([2, 0, 0, 0]), mapping, s)), ['button 2 down']);
}

// 버튼 5–8번째 바이트(33–64번 버튼)도 읽는다
{
  const { createGenericParserState } = require('../controller/controllerReader');
  const st = createGenericParserState();
  parseGenericControllerData(Buffer.from([0, 0, 0, 0, 0, 0]), { 1: 33 }, st);
  const ev = parseGenericControllerData(Buffer.from([0, 0, 0, 0, 1, 0]), { 1: 33 }, st);
  assert.deepEqual(ev.filter(e => e.type === 'button').map(e => e.button), ['button 1']);
}

// M6: 학습한 축 바이트는 턴테이블 값으로 쓰고 버튼으로 읽지 않는다
{
  const { createGenericParserState } = require('../controller/controllerReader');
  const st = createGenericParserState(1); // report ID 없이 1번 바이트가 축
  let ev = parseGenericControllerData(Buffer.from([0, 128, 0]), { 1: 1 }, st);
  assert.deepEqual(ev, []);
  ev = parseGenericControllerData(Buffer.from([0, 131, 0]), { 1: 1 }, st);
  assert.deepEqual(ev.map(e => [e.type, e.discRaw, e.direction]), [['axis', 131, '+']]);
  ev = parseGenericControllerData(Buffer.from([0, 10, 0]), { 1: 1 }, st); // 131→10은 뒤로 121칸
  assert.equal(ev[0].direction, '-');
  assert.equal(ev.some(e => e.type === 'physical-button'), false);

  // 첫 바이트가 축인 게임패드: report ID로 오인하지 않는다
  const st0 = createGenericParserState(0);
  // 축 바이트도 번호 자리를 차지하므로 두 번째 바이트의 첫 비트가 9번 버튼
  parseGenericControllerData(Buffer.from([128, 0]), { 1: 9 }, st0);
  ev = parseGenericControllerData(Buffer.from([128, 1]), { 1: 9 }, st0);
  assert.deepEqual(ev.filter(e => e.type === 'button').map(e => e.button), ['button 1']);
}

// 축 학습: 가장 많은 값을 보인 바이트를 고른다
{
  const { findAxisByte } = require('../controller/controllerReader');
  const reports = Array.from({ length: 40 }, (_, i) => Buffer.from([3, i % 2, (i * 7) % 256]));
  assert.deepEqual(findAxisByte(reports), { byteIndex: 2, distinct: 40 });
  assert.equal(findAxisByte(reports.slice(0, 3)), null);
}

console.log('controllerReader report-id tests passed');

// 장치 목록·선택 (1P·2P에 각각 장치 할당)
{
  const phoenixA = { ...phoenix, path: 'phoenix-A', manufacturer: 'Konami', product: 'PHOENIXWAN' };
  const phoenixB = { ...phoenix, path: 'phoenix-B', manufacturer: 'Konami', product: 'PHOENIXWAN' };
  const devices = [phoenixA, arduino, phoenixB, keyboard];
  // 같은 이름이 여러 개면 번호가 붙는다
  assert.deepEqual(listControllerDevices('PHOENIXWAN', devices).map(d => d.path), ['phoenix-A', 'phoenix-B']);
  // 드롭다운을 접어도 보이도록 번호는 이름 앞에 붙는다
  assert.equal(listControllerDevices('PHOENIXWAN', devices)[0].name, '[#1] Konami PHOENIXWAN [1ccf:8048]');
  assert.equal(listControllerDevices('PHOENIXWAN', devices)[1].name, '[#2] Konami PHOENIXWAN [1ccf:8048]');
  // 하나뿐이면 번호 없음
  assert.ok(!/#d$/.test(listControllerDevices('AUTO', devices)[0].name));
  assert.deepEqual(listControllerDevices('KB', devices), []);
  // 고른 장치가 있으면 그 장치, 없으면 첫 장치
  assert.equal(chooseDevice('PHOENIXWAN', { devicePath: 'phoenix-B' }, devices).device.path, 'phoenix-B');
  assert.equal(chooseDevice('PHOENIXWAN', { devicePath: 'gone' }, devices).device.path, 'phoenix-A');
  // 다른 사이드가 쓰는 장치는 건너뛴다 (같은 컨트롤러 두 대)
  assert.equal(chooseDevice('PHOENIXWAN', { excludePaths: ['phoenix-A'] }, devices).device.path, 'phoenix-B');
  assert.equal(chooseDevice('PHOENIXWAN', { devicePath: 'phoenix-A', excludePaths: ['phoenix-A'] }, devices).device.path, 'phoenix-B');
  assert.equal(chooseDevice('PHOENIXWAN', { excludePaths: ['phoenix-A', 'phoenix-B'] }, devices), null);
  assert.equal(chooseDevice('AUTO', {}, devices).parser, 'GENERIC');
  console.log('device selection tests passed');
}

// Button Turntable legacy (수동 매핑 전용, 기본 꺼짐): 3.0.1까지 방식. 누를 때 2칸, 떼도 멈춤을 보내지 않는다
{
  const { createGenericParserState } = require('../controller/controllerReader');
  const press = Buffer.from([0x80, 0, 0]), release = Buffer.from([0, 0, 0]); // 첫 바이트 비트 7 = 버튼 8
  const legacy = createGenericParserState(null, { buttonTurntableLegacy: true });
  parseGenericControllerData(release, { SCup: 8 }, legacy);
  let ev = parseGenericControllerData(press, { SCup: 8 }, legacy).filter(e => e.type === 'axis');
  assert.deepEqual(ev.map(e => [e.discRaw, e.direction]), [[130, '+']]);
  ev = parseGenericControllerData(release, { SCup: 8 }, legacy).filter(e => e.type === 'axis');
  assert.deepEqual(ev, []);
  // 기본(꺼짐)은 LR2 모드처럼 5칸, 떼면 멈춤
  const normal = createGenericParserState(null);
  assert.equal(normal.buttonTurntableLegacy, false);
  parseGenericControllerData(release, { SCup: 8 }, normal);
  ev = parseGenericControllerData(press, { SCup: 8 }, normal).filter(e => e.type === 'axis');
  assert.deepEqual(ev.map(e => [e.discRaw, e.direction]), [[133, '+']]);
  ev = parseGenericControllerData(release, { SCup: 8 }, normal).filter(e => e.type === 'axis');
  assert.deepEqual(ev.map(e => [e.discRaw, e.direction]), [[133, 'neutral']]);
}
