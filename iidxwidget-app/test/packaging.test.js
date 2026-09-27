const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const { build } = require('../package.json');

// build.files는 허용 목록이다. 새 모듈을 만들고 여기에 안 넣으면 설치본에서만 require가 실패해 앱이 켜지지 않는다
const included = file => build.files.some(pattern => !pattern.startsWith('!') &&
  (pattern === file || (pattern.endsWith('/**') && file.startsWith(pattern.slice(0, -2)))));

test('설치본에 들어가는 파일이 require하는 앱 파일도 모두 설치본에 들어간다', () => {
  const queue = ['main.js', 'preload.js'];
  const seen = new Set();
  while (queue.length) {
    const file = queue.shift();
    if (seen.has(file)) continue;
    seen.add(file);
    assert.ok(included(file), `package.json build.files에 없음: ${file}`);
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    for (const m of source.matchAll(/require\(\s*'(\.{1,2}\/[^']+)'\s*\)/g)) {
      let target = path.posix.normalize(path.posix.join(path.posix.dirname(file), m[1]));
      if (!target.endsWith('.js')) target += '.js';
      if (fs.existsSync(path.join(root, target))) queue.push(target);
    }
  }
  assert.ok(seen.has('controllerProbe.js'));
});
