const assert = require('assert');
const { discDelta, formatUptime } = require('../renderer/widget/logic');
const { resolveImageUrl } = require('../renderer/shared/imageUrl');
const { buildGenericMapping, validatePorts, validateMALength } = require('../renderer/settings/formLogic');

assert.equal(formatUptime(3725), '1:02:05');

// L9: 첫 값은 회전 없음, 0/255 경계는 짧은 쪽으로
assert.equal(discDelta(null, 40), 0);
assert.equal(discDelta(250, 4), 10);
assert.equal(discDelta(4, 250), -10);

// M2: 앱 창(file://)은 앱 서버 주소를 붙이고, OBS(http)는 그대로
assert.equal(resolveImageUrl('/userImages/a.png', { protocol: 'file:', serverPort: 8080 }), 'http://127.0.0.1:8080/userImages/a.png');
assert.equal(resolveImageUrl('/userImages/a.png', { protocol: 'http:', serverPort: 8080 }), '/userImages/a.png');
assert.equal(resolveImageUrl(null, { protocol: 'file:', serverPort: 8080 }), '');

// M5: 빈 칸은 해제, 중복·범위 밖은 알림
let result = buildGenericMapping([{ key: '1', value: '3' }, { key: '2', value: '' }, { key: 'SCup', value: '9' }]);
assert.deepEqual(result.mapping, { '1': 3, SCup: 9 });
assert.deepEqual(result.duplicates, []);
result = buildGenericMapping([{ key: '1', value: '3' }, { key: '2', value: '3' }]);
assert.deepEqual(result.duplicates, [['1', '2']]);
result = buildGenericMapping([{ key: '1', value: '65' }, { key: '2', value: '1.5' }]);
assert.deepEqual(result.invalid, ['1', '2']);

// M7 / 포트
assert.equal(validatePorts(8080, 5678), true);
assert.equal(validatePorts(8080, 8080), false);
assert.equal(validatePorts(80, 5678), false);
assert.equal(validateMALength(200), true);
assert.equal(validateMALength(-5), false);
assert.equal(validateMALength(NaN), false);

console.log('renderer logic tests passed');

// KPS 스피드미터: 0~중점 70%, 중점~최대 30%, 최대에서 멈춤
{
  const { kpsGauge } = require('../renderer/widget/logic');
  assert.deepEqual(kpsGauge(0, 'iidx'), { fraction: 0, heat: 0 });
  assert.deepEqual(kpsGauge(10, 'iidx'), { fraction: 0.35, heat: 0 });
  assert.deepEqual(kpsGauge(20, 'iidx'), { fraction: 0.7, heat: 0 });
  assert.equal(kpsGauge(30, 'iidx').heat, 0.5);
  assert.ok(Math.abs(kpsGauge(30, 'iidx').fraction - 0.85) < 1e-9);
  assert.deepEqual(kpsGauge(40, 'iidx'), { fraction: 1, heat: 1 });
  assert.deepEqual(kpsGauge(99, 'iidx'), { fraction: 1, heat: 1 });
  assert.deepEqual(kpsGauge(30, 'bms'), { fraction: 0.7, heat: 0 });
  assert.deepEqual(kpsGauge(60, 'bmsInsane'), { fraction: 1, heat: 1 });
  assert.deepEqual(kpsGauge(10, 'unknown'), kpsGauge(10, 'iidx'));
  console.log('kps gauge tests passed');
}
