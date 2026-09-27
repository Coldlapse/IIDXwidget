const test = require('node:test');
const assert = require('assert');
const { EventEmitter } = require('events');
const { groupProbeDevices, openProbe } = require('../controllerProbe');

const devices = [
  { vendorId: 0x046D, productId: 0xC54D, product: 'USB Receiver', usagePage: 1, usage: 6, interface: 0, path: 'kb' },      // 키보드: 뺀다
  { vendorId: 0x046D, productId: 0xC54D, product: 'USB Receiver', usagePage: 1, usage: 2, interface: 1, path: 'mouse' },   // 마우스: 뺀다
  { vendorId: 0x046D, productId: 0xC54D, product: 'USB Receiver', usagePage: 0xFF00, usage: 1, interface: 2, path: 'vendor' },
  { vendorId: 0x0E8F, productId: 0x1228, product: 'PHONENIXWAN', usagePage: 1, usage: 4, interface: 0, path: 'pad' },
  { vendorId: 0x0E8F, productId: 0x1228, product: 'PHONENIXWAN', usagePage: 12, usage: 1, interface: 1, path: 'media' }   // 미디어 키: 뺀다
];

test('수집 장치 목록: 키보드·마우스·미디어 키는 빼고, 제품별로 묶고, 게임패드를 앞에', () => {
  const groups = groupProbeDevices(devices);
  assert.deepEqual(groups.map(g => g.id), ['0E8F:1228', '046D:C54D']);
  assert.equal(groups[0].gamepad, true);
  assert.deepEqual(groups[0].interfaces.map(i => i.path), ['pad']);
  assert.deepEqual(groups[1].interfaces.map(i => i.path), ['vendor']);
});

test('수집 장치 열기: 인터페이스마다 신호를 넘기고, 못 연 것은 따로 알리고, 닫으면 모두 닫는다', () => {
  const opened = [];
  class FakeHID extends EventEmitter {
    constructor(path) {
      super();
      if (path === 'broken') throw new Error('access denied');
      this.path = path;
      this.closed = false;
      opened.push(this);
    }
    close() { this.closed = true; }
  }
  const group = { id: '0E8F:1228', vendorId: 0x0E8F, productId: 0x1228, name: 'PHONENIXWAN',
    interfaces: [{ path: 'pad', interface: 0, usagePage: 1, usage: 4 }, { path: 'broken', interface: 1, usagePage: 0xFF00, usage: 1 }] };
  const reports = [];
  const probe = openProbe(group, (index, data, time) => reports.push({ index, data, time }), { HID: { HID: FakeHID }, now: () => 12.5 });
  assert.equal(probe.opened.length, 1);
  assert.equal(probe.opened[0].vidPid, '0E8F:1228');
  assert.equal(probe.opened[0].path, undefined); // 장치 경로는 결과에 넣지 않는다
  assert.deepEqual(probe.failed, [{ index: 1, error: 'access denied' }]);
  opened[0].emit('data', Buffer.from([0x01, 0x80, 0xff]));
  assert.deepEqual(reports, [{ index: 0, data: '01 80 ff', time: 12.5 }]);
  probe.close();
  assert.equal(opened[0].closed, true);
});
