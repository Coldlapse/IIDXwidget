const test = require('node:test');
const assert = require('assert');
const {
  listControllerDevices, chooseDevice, findAutoController, hasOfficiallySupportedController,
  createDedicatedParserState, handleDedicatedData, DEDICATED_LAYOUTS
} = require('../controller/controllerReader');
const fixture = require('./fixtures/arcin-infinitas.json');

const ARCIN = { vendorId: 0x1CCF, productId: 0x8048, product: 'arcin (red1p)', usagePage: 1, usage: 5, interface: 0, path: 'arcin-1p' };
const ARCIN_2P = { ...ARCIN, product: 'arcin (red2p)', path: 'arcin-2p' };
const PHOENIX = { vendorId: 0x1CCF, productId: 0x8048, product: 'PHOENIXWAN', usagePage: 1, usage: 4, interface: 1, path: 'phoenix' };
const FPS = { vendorId: 0x1CCF, productId: 0x8048, product: 'FPS EMP', usagePage: 1, usage: 5, interface: 0, path: 'fps' };

test('arcin 프로필: 이름이 arcin인 1CCF:8048 장치만, 주작콘·FPS 목록에는 안 섞인다', () => {
  const devices = [ARCIN, ARCIN_2P, PHOENIX, FPS];
  assert.deepEqual(listControllerDevices('ARCIN', devices).map(d => d.path), ['arcin-1p', 'arcin-2p']);
  assert.equal(chooseDevice('ARCIN', {}, devices).parser, 'ARCIN');
  // 기존 프로필은 그대로 (arcin은 interface 0·게임패드라 예전에는 FPS 목록에 섞여 들어갔다)
  assert.deepEqual(listControllerDevices('PHOENIXWAN', devices).map(d => d.path), ['phoenix']);
  assert.deepEqual(listControllerDevices('FPS EMP Gen2', devices).map(d => d.path), ['fps']);
});

test('기타 컨트롤러(수동 매핑): arcin을 포함해 공식 지원 컨트롤러도 목록에 나온다', () => {
  // 이슈: arcin이 같은 ID(1CCF:8048)라 기타 컨트롤러에서 "연결된 장치 없음"이 되던 문제
  assert.equal(findAutoController([ARCIN]).device.path, 'arcin-1p');
  assert.equal(chooseDevice('AUTO', {}, [ARCIN]).parser, 'GENERIC');
  assert.deepEqual(listControllerDevices('AUTO', [PHOENIX, FPS, ARCIN]).map(d => d.path), ['phoenix', 'fps', 'arcin-1p']);
  assert.equal(hasOfficiallySupportedController([ARCIN]), false);
  assert.equal(hasOfficiallySupportedController([PHOENIX]), true);
});

// 실측 기록은 바뀐 신호만 남아 있다. 장치는 1ms마다 같은 값을 계속 보내므로 각 값을 여러 번 이어서 넣는다
const toBuffer = hex => Buffer.from(hex.split(' ').map(b => parseInt(b, 16)));
function play(step, { lr2 = false, hold = 5 } = {}) {
  const state = createDedicatedParserState(DEDICATED_LAYOUTS.ARCIN);
  state.lr2DetectEnabled = lr2 && !!state.layout.lr2;
  const events = [];
  for (const hex of fixture.recordings.find(r => r.step === step).changes) {
    for (let i = 0; i < hold; i++) handleDedicatedData(toBuffer(hex), e => events.push(...e), state, () => {});
  }
  return { events, state };
}
const presses = events => events.filter(e => e.type === 'button' && e.pressed).map(e => e.button);
const discs = events => events.filter(e => e.type === 'axis').map(e => e.discRaw);

test('arcin 실제 기록: 건반은 buffer[1], E버튼은 건반으로 읽지 않는다', () => {
  assert.deepEqual(presses(play('key1').events), ['button 1', 'button 1', 'button 1']);
  assert.deepEqual(presses(play('key7').events), ['button 7', 'button 7', 'button 7']);
  assert.deepEqual(presses(play('extra').events), []);
  const rapid = fixture.recordings.find(r => r.step === 'rapid').changes.filter(hex => toBuffer(hex)[1] !== 0).length;
  assert.equal(presses(play('rapid').events).length, rapid);
});

test('arcin 실제 기록: 턴테이블은 buffer[3]의 절대 위치를 그대로 쓴다 (원본 주작콘 일반 모드와 같은 처리)', () => {
  const cw = fixture.recordings.find(r => r.step === 'ttCwSlow').changes.map(hex => toBuffer(hex)[3]);
  const got = [...new Set(discs(play('ttCwSlow').events))];
  assert.deepEqual(got, [...new Set(cw)]);
  // 양방향 번갈아 돌린 기록도 값 그대로 따라간다
  const mixed = fixture.recordings.find(r => r.step === 'ttMixed').changes.map(hex => toBuffer(hex)[3]);
  assert.deepEqual([...new Set(discs(play('ttMixed').events))], [...new Set(mixed)]);
});

test('arcin: LR2 값을 모르므로 LR2 모드 감지를 켜도 LR2로 바뀌지 않는다', () => {
  assert.equal(DEDICATED_LAYOUTS.ARCIN.lr2, null);
  const { state } = play('ttCwSlow', { lr2: true, hold: 200 });
  assert.equal(state.lr2DetectEnabled, false);
  assert.equal(state.isLR2Active, false);
});

// ─── 2P 보드, 디지털 턴테이블, 이름을 바꾼 arcin, 방향 반전, 같은 기판 두 대 ─────────

const fixture2p = require('./fixtures/arcin-2p-digital-tt.json');
const { listControllerDevices: listDevices, reverseTurntableEvents } = require('../controller/controllerReader');

function feed(reports, state = createDedicatedParserState(DEDICATED_LAYOUTS.ARCIN)) {
  const events = [];
  const logs = [];
  for (const buffer of reports) handleDedicatedData(buffer, e => events.push(...e), state, (level, code) => logs.push(code));
  return { events, logs, state };
}
const repeat = (bytes, n) => Array.from({ length: n }, () => Buffer.from(bytes));

test('arcin 2P 실제 기록: 1P와 같은 배치이고, 펌웨어 디지털 턴테이블 비트(buffer[2] 0x10/0x20)는 건반으로 읽지 않는다', () => {
  const play2p = step => feed(fixture2p.recordings.find(r => r.step === step).changes.flatMap(hex => repeat(toBuffer(hex), 5)));
  assert.deepEqual(presses(play2p('key1').events), ['button 1', 'button 1', 'button 1']);
  assert.deepEqual(presses(play2p('key7').events), Array(5).fill('button 7'));
  // 스크를 돌리는 동안 디지털 비트가 켜지지만 축이 살아 있으므로 축 값을 그대로 쓴다
  const { events, logs } = play2p('ttCwSlow');
  assert.deepEqual(presses(events), []);
  const cw = fixture2p.recordings.find(r => r.step === 'ttCwSlow').changes.map(hex => toBuffer(hex)[3]);
  assert.deepEqual([...new Set(discs(events))], [...new Set(cw)]);
  assert.ok(!logs.includes('digitalTTActivated'));
});

test('arcin 디지털 턴테이블만 켠 경우: 축이 127에 멈춰 있으면 디지털 신호로 방향을 만든다 (시계 방향 = 값이 줄어듦)', () => {
  // 펌웨어 소스 기준: 디지털만 켜면 축은 127 고정, 시계 방향 0x10 / 반시계 방향 0x20 (멈춘 뒤 200ms 유지)
  const { events, logs, state } = feed([
    ...repeat([1, 0, 0x00, 127, 127], 300),
    ...repeat([1, 0, 0x10, 127, 127], 200),
    ...repeat([1, 0, 0x00, 127, 127], 50),
    ...repeat([1, 0, 0x20, 127, 127], 200),
    ...repeat([1, 0, 0x00, 127, 127], 50)
  ]);
  assert.ok(logs.includes('digitalTTActivated'));
  assert.equal(state.isDigitalTTActive, true);
  const moves = events.filter(e => e.type === 'axis' && e.direction !== 'neutral');
  // 켜지기 전 127 신호들은 방향이 'neutral'이므로 빠진다. 방향이 바뀔 때만 한 번씩
  assert.deepEqual(moves.map(e => [e.direction, e.discRaw]), [['-', 122], ['+', 127]]);
  assert.equal(events.filter(e => e.type === 'axis').slice(-1)[0].direction, 'neutral');
  assert.deepEqual(presses(events), []);
});

test('arcin: 실행 중 턴테이블 모드를 바꿔도 따라간다 (디지털 → 아날로그)', () => {
  const state = createDedicatedParserState(DEDICATED_LAYOUTS.ARCIN);
  feed([...repeat([1, 0, 0, 127, 127], 300), ...repeat([1, 0, 0x10, 127, 127], 10)], state);
  assert.equal(state.isDigitalTTActive, true);
  const { events, logs } = feed([[1, 0, 0, 126, 127], [1, 0, 0, 125, 127], [1, 0, 0, 124, 127]].map(b => Buffer.from(b)), state);
  assert.ok(logs.includes('digitalTTDeactivated'));
  assert.deepEqual(discs(events), [126, 125, 124]);
});

test('arcin: 아날로그만 쓰다가 우연히 127에서 멈춰도 디지털 신호가 없으면 아무 회전도 만들지 않는다', () => {
  const { events } = feed([...repeat([1, 0, 0, 127, 127], 600)]);
  assert.deepEqual(events.filter(e => e.type === 'axis' && e.direction !== 'neutral'), []);
});

test('arcin 판정: 라벨을 바꿔 이름에 arcin이 없어도 제조사(zyp)로 알아본다', () => {
  const renamed = { vendorId: 0x1CCF, productId: 0x8048, product: 'MY IIDX', manufacturer: 'zyp', usagePage: 1, usage: 5, interface: 0, path: 'renamed' };
  assert.deepEqual(listControllerDevices('ARCIN', [renamed, FPS]).map(d => d.path), ['renamed']);
  assert.deepEqual(listControllerDevices('FPS EMP Gen2', [renamed, FPS]).map(d => d.path), ['fps']);
});

test('턴테이블 방향 반전: 축·방향 신호는 뒤집고, 버튼으로 매핑한 턴테이블(SCup/SCdown)과 건반은 그대로 둔다', () => {
  const axis = { type: 'axis', axis: 'X', direction: '-', discRaw: 10 };
  const scButton = { type: 'axis', axis: 'X', direction: '+', discRaw: 130, physicalButton: 8 };
  const key = { type: 'button', button: 'button 1', pressed: true };
  const neutral = { type: 'axis', axis: 'X', direction: 'neutral', discRaw: 122 };
  assert.deepEqual(reverseTurntableEvents([axis, scButton, key, neutral]), [
    { ...axis, direction: '+', discRaw: 245 }, scButton, key, { ...neutral, discRaw: 133 }
  ]);
  // 255 − 값이면 위젯의 회전량(discDelta)이 정확히 반대가 된다
  const delta = (a, b) => { let d = (b - a + 256) % 256; return d > 127 ? d - 256 : d; };
  assert.equal(delta(255 - 10, 255 - 7), -delta(10, 7));
  assert.equal(delta(255 - 250, 255 - 3), -delta(250, 3));
});

test('같은 기판 두 대: 장치 목록에 시리얼 끝 4자리로 구분하고, 경로가 바뀌어도 시리얼로 같은 장치를 찾는다', () => {
  const a = { ...ARCIN, product: 'arcin', serialNumber: '1234ABCD', path: 'port1' };
  const b = { ...ARCIN, product: 'arcin', serialNumber: '5678EF01', path: 'port2' };
  const names = listDevices('ARCIN', [a, b]).map(d => d.name);
  assert.equal(names[0], 'arcin [1ccf:8048] (S/N …ABCD)');
  assert.equal(names[1], 'arcin [1ccf:8048] (S/N …EF01)');
  // 시리얼이 없으면 번호
  assert.deepEqual(listDevices('ARCIN', [{ ...a, serialNumber: '' }, { ...b, serialNumber: '' }]).map(d => d.name.slice(-2)), ['#1', '#2']);
  // 2P 보드를 다른 USB 포트에 꽂아 경로가 바뀐 경우
  const moved = { ...b, path: 'port3' };
  assert.equal(chooseDevice('ARCIN', { devicePath: 'port2', deviceSerial: '5678EF01' }, [a, moved]).device.path, 'port3');
  // 경로가 그대로면 경로가 우선
  assert.equal(chooseDevice('ARCIN', { devicePath: 'port1', deviceSerial: '5678EF01' }, [a, b]).device.path, 'port1');
});

test('arcin 펌웨어가 늘 함께 내보내는 키보드 인터페이스(interface 1)는 arcin·주작콘 목록 어디에도 넣지 않는다', () => {
  // 예전에는 이 키보드 쪽이 arcin 목록에 섞여, 먼저 잡히면 입력이 안 들어오고 DP에서는 2P 자리에 1P 보드의 키보드가 잡힐 수 있었다
  const keyboard = { ...ARCIN, usagePage: 1, usage: 6, interface: 1, path: 'arcin-1p-kb' };
  const devices = [keyboard, ARCIN, ARCIN_2P];
  assert.deepEqual(listControllerDevices('ARCIN', devices).map(d => d.path), ['arcin-1p', 'arcin-2p']);
  assert.equal(chooseDevice('ARCIN', {}, devices).device.path, 'arcin-1p');
  assert.equal(chooseDevice('ARCIN', { excludePaths: ['arcin-1p'] }, devices).device.path, 'arcin-2p');
  assert.deepEqual(listControllerDevices('PHOENIXWAN', devices), []);
  assert.deepEqual(listControllerDevices('AUTO', devices).map(d => d.path), ['arcin-1p', 'arcin-2p']);
});
