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

test('수동 매핑 축 턴테이블: 멈추고 30ms 동안 값이 안 바뀌면 같은 값을 한 번 더 보내 위젯의 스크래치 불을 끈다', async () => {
  const { createTurntableSettle } = require('../controller/controllerReader');
  const sent = [];
  const settle = createTurntableSettle(events => sent.push(...events), 30);
  settle.onEvents([{ type: 'axis', axis: 'X', direction: '-', discRaw: 100 }]);
  settle.onEvents([{ type: 'axis', axis: 'X', direction: '-', discRaw: 98 }]);
  // 버튼 매핑 턴테이블(physicalButton)이나 멈춤 이벤트는 타이머를 건드리지 않는다
  settle.onEvents([{ type: 'axis', axis: 'X', direction: '+', discRaw: 5, physicalButton: 8 }]);
  await new Promise(r => setTimeout(r, 15));
  assert.deepEqual(sent, []);
  await new Promise(r => setTimeout(r, 40));
  assert.deepEqual(sent.map(e => [e.discRaw, e.direction]), [[98, 'neutral']]);
  // 위젯 계산으로 차이 0 → 불이 꺼진다
  const delta = (a, b) => { let d = (b - a + 256) % 256; return d > 127 ? d - 256 : d; };
  assert.equal(delta(98, sent[0].discRaw), 0);
  // 닫으면 남은 타이머를 취소한다
  settle.onEvents([{ type: 'axis', axis: 'X', direction: '+', discRaw: 99 }]);
  settle.cancel();
  await new Promise(r => setTimeout(r, 50));
  assert.equal(sent.length, 1);
});

// 위젯 흉내: 실제 위젯의 턴테이블 그리기(createLatestThrottle)를 가짜 시계로 기록 시각대로 돌린다.
// 차이 +면 위쪽 불, -면 아래쪽 불, 0이면 끔
function widgetSim(interval = 20) {
  const { createLatestThrottle, discDelta } = require('../renderer/widget/logic');
  let clock = 0, last = null, lit = null, moves = 0;
  const timers = [];
  const throttle = createLatestThrottle(interval, value => {
    if (last !== null) { const d = discDelta(last, value); lit = d > 0 ? 'up' : d < 0 ? 'down' : null; if (d) moves++; }
    last = value;
  }, { now: () => clock, schedule: (fn, ms) => { const timer = { at: clock + ms, fn }; timers.push(timer); return timer; }, cancel: timer => timers.splice(timers.indexOf(timer), 1) });
  const advance = to => {
    for (;;) {
      timers.sort((a, b) => a.at - b.at);
      if (!timers.length || timers[0].at > to) break;
      const timer = timers.shift();
      clock = timer.at;
      timer.fn();
    }
    clock = to;
  };
  return { push: (value, at) => { advance(at); throttle.push(value); }, advance, state: () => ({ lit, moves, last }) };
}

test('수동 매핑 버튼 턴테이블: 주작콘 LR2 모드 실측(0x80 ↔ 0x7F 바로 전환, 멈춤 뒤 16ms 만에 다시 돌림)에서도 원판이 돌고 불이 맞게 켜지고 꺼진다', () => {
  // SCup = 버튼 8(0x80), SCdown = 버튼 1(0x7F의 한 비트). 방향을 바꾸면 한쪽을 떼면서 다른 쪽을 누른다
  const rec = require('./fixtures/phoenixwan-lr2-manual-mapping.json');
  const { createGenericParserState: newState, parseGenericControllerData } = require('../controller/controllerReader');
  const mapping = { 1: 17, 2: 18, 3: 19, 4: 20, 5: 21, 6: 22, 7: 23, SCup: 8, SCdown: 1 };
  for (const step of ['ttMixed', 'ttCwFast']) {
    const st = newState(null);
    const widget = widgetSim();
    widget.push(st.currentDiscRaw, -1000);
    const changes = rec.recordings.find(r => r.step === step).changes;
    for (const { t, data } of changes) {
      const axis = parseGenericControllerData(toBuffer(data), mapping, st).filter(e => e.type === 'axis');
      assert.ok(axis.length <= 1, '보고서 하나에 턴테이블 이벤트는 하나까지');
      axis.forEach(e => widget.push(e.discRaw, t));
      widget.advance(t + 19); // 다음 신호가 오기 전(가장 짧은 간격 16ms 이후), 위젯에 반영된 상태
      const expected = data.startsWith('80') ? 'up' : data.startsWith('7f') ? 'down' : null;
      if (t > 0) assert.equal(widget.state().lit, expected, `${step} ${t}ms ${data.slice(0, 2)} 뒤 불 상태`);
    }
    // 누른 횟수만큼 원판이 돈다 (씹히지 않음)
    const presses = changes.filter(c => !c.data.startsWith('00')).length;
    assert.equal(widget.state().moves, presses, step + ' 원판이 돈 횟수');
  }
});

test('위젯 턴테이블: 20ms보다 짧게 누르고 뗀 버튼 턴테이블도 원판이 돌고 불이 꺼진다', () => {
  const widget = widgetSim();
  widget.push(128, 0);
  widget.push(133, 30);  // 누름 (바로 그림)
  widget.push(133, 35);  // 뗌 (같은 값 = 멈춤, 20ms 안이라 미뤄짐)
  widget.advance(51);    // 누른 뒤 20ms가 차는 50ms에 멈춤을 그린다
  assert.equal(widget.state().lit, null);
  widget.push(138, 60);  // 누름
  widget.push(143, 62);  // 20ms 안에 한 번 더 누름 → 미뤄졌다가 그려짐
  widget.push(143, 64);  // 뗌
  widget.advance(81);
  assert.equal(widget.state().lit, 'up');
  widget.advance(110);
  assert.equal(widget.state().lit, null);   // 한 간격 뒤 한 번 더 그려서 끔
  assert.equal(widget.state().last, 143);
});

test('수동 매핑 턴테이블 입력: 버튼 턴테이블과 아날로그 턴테이블 중 하나만 읽고, 쓰지 않는 쪽 값은 지우지 않는다', () => {
  const { resolveTurntableInput } = require('../renderer/settings/formLogic');
  const { genericTurntable, sideConfig } = require('../inputManager');
  // 저장된 값이 없는 3.0.1 이하 설정: 축을 학습해 둔 사용자는 아날로그, 아니면 버튼
  assert.equal(resolveTurntableInput(undefined, 3), 'analog');
  assert.equal(resolveTurntableInput(null, null), 'button');
  assert.equal(resolveTurntableInput('button', 3), 'button');
  const mapping = { 1: 1, 2: 2, SCup: 13, SCdown: 14 };
  // 아날로그: SCup/SCdown은 읽지 않는다 (arcin 디지털 신호와 축이 섞여 원판이 튀지 않도록)
  assert.deepEqual(genericTurntable({ turntableInput: 'analog', genericMapping: mapping, genericAxis: 3 }), { genericMapping: { 1: 1, 2: 2 }, genericAxis: 3 });
  // 버튼: 축은 읽지 않는다
  assert.deepEqual(genericTurntable({ turntableInput: 'button', genericMapping: mapping, genericAxis: 3 }), { genericMapping: mapping, genericAxis: null });
  // 설정에 저장된 값은 그대로 (입력 방식만 고른다)
  const settings = { controllerProfile: 'AUTO', turntableInput: 'button', keyMapping: { GENERIC: mapping, GENERIC_AXIS: 3 } };
  const config = sideConfig(settings, 1);
  assert.equal(config.turntableInput, 'button');
  assert.equal(config.genericAxis, 3);
  assert.deepEqual(config.genericMapping, mapping);
});
