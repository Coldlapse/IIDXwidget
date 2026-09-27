const test = require('node:test');
const assert = require('assert');
const { findOutliers } = require('../renderer/chatter/chatterLogic');

test('그룹(1·3·5·7 / 2·4·6) 평균의 2배 이상인 건반만 강조', () => {
  // 흰 건반 평균 (20+20+20+70)/4 = 32.5 → 70만 2배 이상
  assert.deepEqual(findOutliers({ 1: 20, 3: 20, 5: 20, 7: 70, 2: 30, 4: 30, 6: 30 }), ['7']);
  // 검은 건반만 높아도, 검은 건반끼리 비슷하면 강조 없음
  assert.deepEqual(findOutliers({ 1: 10, 3: 10, 5: 10, 7: 10, 2: 60, 4: 55, 6: 65 }), []);
  // 검은 건반 평균 (10+10+40)/3 = 20 → 40 (정확히 2배)도 강조
  assert.deepEqual(findOutliers({ 2: 10, 4: 10, 6: 40 }), ['6']);
  // 아무것도 없으면 강조 없음
  assert.deepEqual(findOutliers({}), []);
  // 한 건반만 있으면 그 건반이 강조된다 (평균의 4배)
  assert.deepEqual(findOutliers({ 3: 1 }), ['3']);
});
