// 컨트롤러를 여러 대 꽂았을 때 1P·2P가 제 장치를 잡는지, 장치 조회(비동기)를 기다리는 동안 설정이 바뀌어도 꼬이지 않는지
const test = require('node:test');
const assert = require('assert');
const path = require('path');
const { EventEmitter } = require('events');

// 가짜 node-hid: 연결된 장치 목록, 연 장치, 장치 조회 시간을 테스트에서 조작한다
const connected = [];
const opened = [];
const unopenable = new Set(); // 열면 실패하는 장치 (리눅스 권한 없음 등)
const scan = { delayMs: 0, calls: 0, active: 0, maxActive: 0 };
class FakeHID extends EventEmitter {
  constructor(devicePath) {
    super();
    if (!connected.some(d => d.path === devicePath) || unopenable.has(devicePath)) throw new Error('cannot open');
    this.path = devicePath;
    this.closed = false;
    opened.push(this);
  }
  close() { this.closed = true; }
}
const wait = ms => new Promise(r => setTimeout(r, ms));
async function devicesAsync() {
  scan.calls++;
  scan.maxActive = Math.max(scan.maxActive, ++scan.active);
  const snapshot = connected.slice();
  await wait(scan.delayMs);
  scan.active--;
  return snapshot;
}
const hidPath = require.resolve('node-hid', { paths: [path.join(__dirname, '..', 'controller')] });
require.cache[hidPath] = { id: hidPath, filename: hidPath, loaded: true, exports: { HID: FakeHID, devices: () => connected.slice(), devicesAsync } };

const { createInputManager } = require('../inputManager');
// 입력을 켤 때마다 남기는 로그를 끈다 (많이 찍히면 node 테스트 실행기가 결과를 읽다가 깨지는 경우가 있었다)
console.log = () => {};

const phoenix = (p, serialNumber) => ({ vendorId: 0x1CCF, productId: 0x8048, product: 'PHOENIXWAN', manufacturer: 'Konami', usagePage: 1, usage: 4, interface: 1, path: p, serialNumber });
const A = phoenix('A', 'SA');
const B = phoenix('B', 'SB');
const PAD = { vendorId: 0x045E, productId: 0x028E, product: 'Xbox Controller', usagePage: 1, usage: 5, interface: 0, path: 'X' };
const side = (profile, device) => ({ controllerProfile: profile, controllerDevice: device?.path || null, controllerDeviceSerial: device?.serialNumber || null, keyMapping: {} });
const dp = (p1, p2) => ({ ...p1, widget: { buttonLayout: 'DP' }, player2: p2 });
const ph = d => side('PHOENIXWAN', d);

function reset() {
  connected.length = 0;
  opened.length = 0;
  unopenable.clear();
  Object.assign(scan, { delayMs: 0, calls: 0, active: 0, maxActive: 0 });
}
function manager(logs = [], reconnectIntervalMs = 20) {
  return createInputManager({ dispatch: () => {}, logger: (level, code) => logs.push(code), reconnectIntervalMs });
}
// 사이드별로 지금 읽는 장치 (KB 목록은 장치를 조회하지 않는다)
const inUse = async inputs => (await inputs.listDevices('KB')).inUse;
const plug = (...devices) => connected.push(...devices);
function unplug(devicePath) {
  connected.splice(connected.findIndex(d => d.path === devicePath), 1);
  for (const h of opened.filter(h => h.path === devicePath && !h.closed)) h.emit('error', new Error('could not read from HID device'));
}
const leaked = () => opened.filter(h => !h.closed).length;

test('둘 다 꽂혀 있으면 저장한 장치를 잡는다. USB 포트를 바꿔도 시리얼로 찾는다', async () => {
  reset();
  plug(A, B);
  const inputs = manager();
  await inputs.start(dp(ph(A), ph(B)));
  assert.deepEqual(await inUse(inputs), { 1: 'A', 2: 'B' });
  inputs.stop();
  reset();
  plug({ ...B, path: 'B2' }, { ...A, path: 'A2' });
  await inputs.start(dp(ph(A), ph(B)));
  assert.deepEqual(await inUse(inputs), { 1: 'A2', 2: 'B2' });
  inputs.stop();
  assert.equal(leaked(), 0);
});

test('1P 콘이 빠진 채 켜도 2P 콘을 1P로 가져가지 않는다', async () => {
  reset();
  plug(B);
  const inputs = manager();
  await inputs.start(dp(ph(A), ph(B)));
  assert.deepEqual(await inUse(inputs), { 2: 'B' });
  plug(A);
  await wait(60);
  assert.deepEqual(await inUse(inputs), { 1: 'A', 2: 'B' });
  inputs.stop();
});

test('허브 전원이 나갔다 돌아오며 2P가 먼저 인식돼도 1P·2P가 뒤바뀌지 않는다', async () => {
  reset();
  plug(A, B);
  const inputs = manager();
  await inputs.start(dp(ph(A), ph(B)));
  unplug('A');
  unplug('B');
  await wait(30);
  plug(B);
  await wait(60);
  assert.deepEqual(await inUse(inputs), { 2: 'B' });
  plug(A);
  await wait(60);
  assert.deepEqual(await inUse(inputs), { 1: 'A', 2: 'B' });
  inputs.stop();
  assert.equal(leaked(), 0);
});

test('자동 실행으로 앱이 먼저 켜지고 컨트롤러가 하나씩 인식돼도 제자리로 간다', async () => {
  reset();
  const inputs = manager();
  await inputs.start(dp(ph(A), ph(B)));
  plug(B);
  await wait(60);
  plug(A);
  await wait(60);
  assert.deepEqual(await inUse(inputs), { 1: 'A', 2: 'B' });
  inputs.stop();
});

test('같은 시리얼을 쓰는 기판 두 대: 다른 사이드가 저장한 경로의 장치는 시리얼이 같아도 가져가지 않는다', async () => {
  reset();
  const A1 = phoenix('A', 'SAME');
  const B1 = phoenix('B', 'SAME');
  plug(B1);
  const inputs = manager();
  await inputs.start(dp(ph(A1), ph(B1)));
  assert.deepEqual(await inUse(inputs), { 2: 'B' });
  inputs.stop();
});

test('저장한 장치가 없는 사이드는 비어 있는 장치를 잡는다 (예전처럼)', async () => {
  reset();
  plug(A, B);
  const inputs = manager();
  await inputs.start(dp(ph(null), ph(B)));
  assert.deepEqual(await inUse(inputs), { 1: 'A', 2: 'B' });
  inputs.stop();
  // 처음 쓰는 장치(저장한 장치가 아닌 새 콘)로 바꿔 꽂은 경우도 잡는다
  reset();
  const C = phoenix('C', 'SC');
  plug(C, B);
  await inputs.start(dp(ph(A), ph(B)));
  assert.deepEqual(await inUse(inputs), { 1: 'C', 2: 'B' });
  inputs.stop();
});

test('기타 컨트롤러 사이드는 다른 사이드의 전용 콘을 가져가지 않는다', async () => {
  reset();
  plug(PAD, B);
  const inputs = manager();
  // 1P 기타 컨트롤러(장치를 저장하지 않음) + 2P 주작콘
  await inputs.start(dp(side('AUTO', null), ph(B)));
  assert.deepEqual(await inUse(inputs), { 1: 'X', 2: 'B' });
  unplug('B');
  unplug('X');
  await wait(30);
  plug(B);
  await wait(60);
  assert.deepEqual(await inUse(inputs), { 2: 'B' });
  plug(PAD);
  await wait(60);
  assert.deepEqual(await inUse(inputs), { 1: 'X', 2: 'B' });
  inputs.stop();
  // 기타 컨트롤러로 주작콘을 쓰려고 그 장치를 직접 골라 저장했다면 그대로 잡는다
  reset();
  plug(A, B);
  await inputs.start(dp(side('AUTO', A), ph(B)));
  assert.deepEqual(await inUse(inputs), { 1: 'A', 2: 'B' });
  inputs.stop();
});

test('장치를 찾는 동안 멈추면(앱 종료 등) 장치를 열지 않는다', async () => {
  reset();
  plug(A);
  scan.delayMs = 40;
  const inputs = manager();
  const starting = inputs.start(dp(ph(A), ph(B)));
  inputs.stop();
  await starting;
  await wait(60);
  assert.equal(opened.length, 0);
});

test('빠르게 두 번 저장하면 마지막 설정으로 한 벌만 열린다', async () => {
  reset();
  plug(A, B);
  scan.delayMs = 30;
  const inputs = manager();
  const first = inputs.start(dp(ph(A), ph(B)));
  const second = inputs.start(dp(ph(B), ph(A)));
  await Promise.all([first, second]);
  assert.deepEqual(await inUse(inputs), { 1: 'B', 2: 'A' });
  assert.equal(opened.length, 2);
  inputs.stop();
  assert.equal(leaked(), 0);
});

test('다시 연결은 조회가 겹치지 않고, 조회 중에 저장해도 사이드마다 한 대만 연다', async () => {
  reset();
  scan.delayMs = 30;
  const inputs = manager();
  await inputs.start(dp(ph(A), ph(B)));
  await wait(150);
  assert.equal(scan.maxActive, 1);
  // 다시 연결 조회가 도는 중에 꽂고 저장한다
  plug(A, B);
  inputs.start(dp(ph(A), ph(B)));
  await wait(150);
  assert.deepEqual(await inUse(inputs), { 1: 'A', 2: 'B' });
  assert.equal(opened.filter(h => !h.closed).length, 2);
  assert.equal(scan.maxActive, 1);
  inputs.stop();
  assert.equal(leaked(), 0);
});

test('설정 창이 동시에 여러 번 물어도 장치 조회는 한 번', async () => {
  reset();
  plug(A, B);
  scan.delayMs = 20;
  const inputs = manager();
  const [one, two] = await Promise.all([inputs.listDevices('PHOENIXWAN'), inputs.listDevices('PHOENIXWAN')]);
  assert.equal(scan.calls, 1);
  assert.deepEqual(one.devices.map(d => d.path), ['A', 'B']);
  assert.deepEqual(two.devices.map(d => d.path), ['A', 'B']);
});

test('매핑 학습: 찾는 동안 멈추면 열지 않고, 학습 중인 장치는 다른 사이드가 다시 연결하며 가져가지 않는다', async () => {
  reset();
  scan.delayMs = 20;
  const inputs = manager([], 60);
  // 1P 기타 컨트롤러(장치 미지정)가 빠진 상태에서, 2P 설정 창이 새로 꽂은 Xbox 패드로 학습을 시작한다 (2P 주작콘은 없음)
  await inputs.start(dp(side('AUTO', null), ph(B)));
  plug(PAD);
  const cancelled = inputs.startMappingSession(2, () => {}, 'X');
  inputs.stopMappingSession();
  assert.equal(await cancelled, null);
  assert.equal(opened.filter(h => !h.closed).length, 0);
  const session = await inputs.startMappingSession(2, () => {}, 'X');
  assert.equal(session.status, 'generic');
  await wait(100);
  assert.deepEqual(await inUse(inputs), {});
  inputs.stopMappingSession();
  inputs.stop();
  assert.equal(leaked(), 0);
});

test('턴테이블 미리보기: 장치를 찾는 동안 멈추거나 다른 장치로 바꾸면 늦게 온 요청은 열지 않는다', async () => {
  reset();
  plug(A, B);
  scan.delayMs = 20;
  const inputs = manager();
  const stale = inputs.startTurntablePreview(1, { profile: 'PHOENIXWAN', devicePath: 'A' }, () => {});
  const latest = inputs.startTurntablePreview(1, { profile: 'PHOENIXWAN', devicePath: 'B' }, () => {});
  assert.equal(await stale, false);
  assert.equal(await latest, true);
  assert.deepEqual(opened.filter(h => !h.closed).map(h => h.path), ['B']);
  const ended = inputs.startTurntablePreview(2, { profile: 'PHOENIXWAN', devicePath: 'A' }, () => {});
  inputs.endTurntablePreview();
  assert.equal(await ended, false);
  assert.equal(leaked(), 0);
});

test('다시 연결하며 열기에 실패해도(리눅스 권한 등) 같은 오류 로그는 한 번만 남긴다', async () => {
  reset();
  plug(A);
  unopenable.add('A');
  const logs = [];
  const inputs = manager(logs);
  await inputs.start({ ...ph(A), widget: { buttonLayout: '1P' } });
  await wait(150);
  // 켤 때 한 번, 다시 연결을 시도하며 한 번
  assert.equal(logs.filter(code => code === 'openFailed').length, 2);
  assert.ok(!logs.includes('notFound'));
  inputs.stop();
});
