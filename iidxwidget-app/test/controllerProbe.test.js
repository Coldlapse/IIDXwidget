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
  assert.deepEqual(groups.map(g => g.vidPid), ['0E8F:1228', '046D:C54D']);
  assert.equal(groups[0].gamepad, true);
  assert.deepEqual(groups[0].interfaces.map(i => i.path), ['pad']);
  assert.deepEqual(groups[1].interfaces.map(i => i.path), ['vendor']);
});

test('같은 기판 두 대(VID:PID가 같음)는 시리얼로 따로 묶는다', () => {
  // 예전에는 VID:PID로만 묶어서 arcin 1P·2P가 한 항목으로 합쳐지고 이름도 하나만 보였다
  const arcins = [
    { vendorId: 0x1CCF, productId: 0x8048, product: 'arcin (red1p)', serialNumber: 'A1B2C3D4', usagePage: 1, usage: 5, interface: 0, path: 'p1' },
    { vendorId: 0x1CCF, productId: 0x8048, product: 'arcin (red2p)', serialNumber: '11223344', usagePage: 1, usage: 5, interface: 0, path: 'p2' }
  ];
  const groups = groupProbeDevices(arcins);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.map(g => g.name).sort(), ['arcin (red1p)', 'arcin (red2p)']);
  assert.deepEqual(groups.map(g => g.interfaces.length), [1, 1]);
  // 시리얼이 없으면 이름으로 가른다
  assert.equal(groupProbeDevices(arcins.map(({ serialNumber, ...d }) => d)).length, 2);
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
  const group = { id: '0E8F:1228|PHONENIXWAN', vidPid: '0E8F:1228', vendorId: 0x0E8F, productId: 0x1228, name: 'PHONENIXWAN',
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
