// 🎛 컨트롤러 정보 수집: 공식 지원하지 않는 컨트롤러의 전용 프로필을 만들기 위해 원본 신호를 기록한다.
// 앱이 입력을 읽는 것과 같은 node-hid로 장치를 연다 (브라우저 WebHID에는 안 보이는 기판이 있어서).
// 장치 고르기·결과 정리는 순수 함수로 두고, 실제로 여닫는 것만 node-hid를 쓴다.

const hex4 = n => (n || 0).toString(16).padStart(4, '0').toUpperCase();
const vidPidOf = d => `${hex4(d.vendorId)}:${hex4(d.productId)}`;

// 키보드·마우스·미디어 키·터치는 컨트롤러가 아니므로 뺀다 (키 입력을 기록하지 않기 위해서이기도 하다)
function isExcludedCollection(d) {
  if (d.usagePage === 1 && (d.usage === 2 || d.usage === 6)) return true; // 마우스, 키보드
  return d.usagePage === 12 || d.usagePage === 13; // 소비자 제어(미디어 키), 디지타이저
}

// 수집할 수 있는 장치를 기기별로 묶는다. 게임패드·조이스틱이 있는 기기를 앞에 둔다.
// 같은 기판 두 대(1P·2P)는 VID:PID가 같으므로 시리얼(없으면 제품 이름)까지 보고 따로 묶는다
function groupProbeDevices(devices) {
  const groups = new Map();
  for (const d of devices) {
    if (isExcludedCollection(d)) continue;
    const vidPid = vidPidOf(d);
    const serial = (d.serialNumber || '').trim();
    const id = `${vidPid}|${serial || (d.product || '').trim()}`;
    if (!groups.has(id)) {
      groups.set(id, { id, vidPid, serial, vendorId: d.vendorId, productId: d.productId, name: (d.product || '').trim(), manufacturer: (d.manufacturer || '').trim(), gamepad: false, interfaces: [] });
    }
    const group = groups.get(id);
    if (!group.name && d.product) group.name = d.product.trim();
    if (d.usagePage === 1 && (d.usage === 4 || d.usage === 5)) group.gamepad = true;
    group.interfaces.push({ path: d.path, interface: d.interface, usagePage: d.usagePage, usage: d.usage });
  }
  return [...groups.values()].sort((a, b) => (b.gamepad - a.gamepad) || a.id.localeCompare(b.id));
}

// 결과 파일에 넣을 장치 정보 (장치 경로는 PC마다 다른 값이라 넣지 않는다)
const interfaceInfo = (group, i) => ({ index: i, vidPid: group.vidPid, vendorId: group.vendorId, productId: group.productId, product: group.name,
  interface: group.interfaces[i].interface, usagePage: group.interfaces[i].usagePage, usage: group.interfaces[i].usage });

// 제품의 인터페이스를 모두 열고 신호를 onReport(index, hex, 시각ms)로 넘긴다. 반환값은 닫기 함수와 연 인터페이스 정보
function openProbe(group, onReport, { HID = require('node-hid'), now = () => Number(process.hrtime.bigint()) / 1e6 } = {}) {
  const opened = [];
  const failed = [];
  group.interfaces.forEach((info, index) => {
    try {
      const device = new HID.HID(info.path);
      device.on('data', buffer => onReport(index, buffer.toString('hex').replace(/(..)(?!$)/g, '$1 '), now()));
      device.on('error', () => {});
      opened.push({ index, device });
    } catch (error) {
      failed.push({ index, error: error.message });
    }
  });
  return {
    opened: opened.map(o => interfaceInfo(group, o.index)),
    failed,
    close() { opened.forEach(o => { try { o.device.close(); } catch (e) {} }); opened.length = 0; }
  };
}

module.exports = { groupProbeDevices, isExcludedCollection, openProbe, vidPidOf };
