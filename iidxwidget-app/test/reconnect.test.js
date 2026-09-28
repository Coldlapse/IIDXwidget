// 컨트롤러를 뽑았다 다시 꽂으면 앱을 다시 켜지 않아도 입력이 이어져야 한다
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
    this.closed = false;
    opened.push(this);
  }
  close() { this.closed = true; }
}
const hidPath = require.resolve('node-hid', { paths: [path.join(__dirname, '..', 'controller')] });
require.cache[hidPath] = { id: hidPath, filename: hidPath, loaded: true, exports: { HID: FakeHID, devices: () => connected.slice() } };

const controllerReader = require('../controller/controllerReader');
const { createInputManager } = require('../inputManager');

const PHOENIX = { vendorId: 0x1CCF, productId: 0x8048, product: 'Controller INF&BMS', usagePage: 1, usage: 4, interface: 1, path: 'phoenix' };
const settings = { controllerProfile: 'PHOENIXWAN', widget: { buttonLayout: '1P' }, keyMapping: {} };
const wait = ms => new Promise(r => setTimeout(r, ms));

test('연결이 끊기면 누르고 있던 건반을 떼고, 다시 꽂으면 자동으로 이어서 읽는다', async () => {
  connected.push(PHOENIX);
  const events = [];
  const logs = [];
  const inputs = createInputManager({ dispatch: e => events.push(...e), logger: (level, code) => logs.push(code), reconnectIntervalMs: 20 });
  inputs.start(settings);
  assert.equal(opened.length, 1);

  // 1번 건반을 누른 채 USB를 뽑는다
  opened[0].emit('data', Buffer.from([0, 0, 0b1, 0]));
  assert.deepEqual(events.filter(e => e.type === 'button').map(e => [e.button, e.pressed]), [['button 1', true]]);
  connected.length = 0;
  opened[0].emit('error', new Error('could not read from HID device'));
  assert.ok(logs.includes('deviceDisconnected'));
  assert.equal(opened[0].closed, true);
  assert.deepEqual(events.filter(e => e.type === 'button').map(e => [e.button, e.pressed]), [['button 1', true], ['button 1', false]]);

  // 빠져 있는 동안은 조용히 다시 찾는다 ('찾을 수 없음' 로그가 쌓이지 않음)
  await wait(80);
  assert.equal(opened.length, 1);
  assert.ok(!logs.includes('notFound'));

  // 다시 꽂으면 새로 열고 입력이 이어진다
  connected.push(PHOENIX);
  await wait(60);
  assert.equal(opened.length, 2);
  events.length = 0;
  opened[1].emit('data', Buffer.from([0, 0, 0b10, 0]));
  assert.deepEqual(events.filter(e => e.type === 'button').map(e => [e.button, e.pressed, e.side]), [['button 2', true, 1]]);

  inputs.stop();
  assert.equal(opened[1].closed, true);
});

test('앱을 켤 때 없던 컨트롤러도 나중에 꽂으면 잡힌다', async () => {
  connected.length = 0;
  opened.length = 0;
  const inputs = createInputManager({ dispatch: () => {}, logger: () => {}, reconnectIntervalMs: 20 });
  inputs.start(settings);
  assert.equal(opened.length, 0);
  connected.push(PHOENIX);
  await wait(60);
  assert.equal(opened.length, 1);
  inputs.stop();
});

test('기타 컨트롤러가 끊기면 누르고 있던 버튼 턴테이블도 멈춘 것으로 보낸다', () => {
  const state = controllerReader.createGenericParserState(null);
  controllerReader.parseGenericControllerData(Buffer.from([0, 0]), { SCup: 1 }, state);
  controllerReader.parseGenericControllerData(Buffer.from([1, 0]), { SCup: 1 }, state);
  // openReader와 같은 방식: 이전 버튼 상태에서 모두 뗀 것으로
  const releaseEvents = controllerReader.parseGenericControllerData(Buffer.from([0, 0]), { SCup: 1 }, state);
  assert.deepEqual(releaseEvents.filter(e => e.type === 'axis').map(e => e.direction), ['neutral']);
  const dedicated = controllerReader.createDedicatedParserState();
  dedicated.lastButtonByte = 0b101;
  assert.deepEqual(controllerReader.releaseDedicatedButtons(dedicated).map(e => [e.button, e.pressed]), [['button 1', false], ['button 3', false]]);
  assert.equal(dedicated.lastButtonByte, 0);
});
