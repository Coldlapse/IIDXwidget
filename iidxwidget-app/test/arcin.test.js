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

test('기타 컨트롤러(수동 매핑): arcin은 목록에 나오고, 주작콘·FPS는 지금처럼 빠진다', () => {
  // 이슈: arcin이 같은 ID(1CCF:8048)라 기타 컨트롤러에서 "연결된 장치 없음"이 되던 문제
  assert.equal(findAutoController([ARCIN]).device.path, 'arcin-1p');
  assert.equal(chooseDevice('AUTO', {}, [ARCIN]).parser, 'GENERIC');
  assert.equal(findAutoController([PHOENIX, FPS]), null);
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
