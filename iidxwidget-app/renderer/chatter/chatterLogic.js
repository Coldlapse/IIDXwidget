// 채터링 감지 창: 건반 그룹 안에서 유독 튀는 건반 찾기. 브라우저와 node 테스트에서 함께 쓴다.
(function (root) {
  // 흰 건반(1·3·5·7)과 검은 건반(2·4·6)은 치는 손가락이 달라 채터링 수치 경향도 다르므로 따로 비교한다
  const GROUPS = [['1', '3', '5', '7'], ['2', '4', '6']];
  const OUTLIER_RATIO = 2;        // 그룹 평균의 2배 이상이면 강조
  const MIN_GROUP_AVERAGE = 10;   // 그룹 평균이 이 이상인 그룹만 강조한다 (횟수가 적을 때 1~2회로 튀어 보이는 것 방지)

  // counts: { 버튼: 횟수 } → 강조할 버튼 목록
  function findOutliers(counts) {
    const groups = GROUPS.map(group => {
      const values = group.map(button => counts[button] || 0);
      return { group, values, average: values.reduce((a, b) => a + b, 0) / group.length };
    });
    const outliers = [];
    for (const { group, values, average } of groups) {
      if (average < MIN_GROUP_AVERAGE) continue;
      group.forEach((button, i) => {
        if (values[i] >= average * OUTLIER_RATIO) outliers.push(button);
      });
    }
    return outliers;
  }

  const api = { GROUPS, OUTLIER_RATIO, MIN_GROUP_AVERAGE, findOutliers };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.chatterLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
