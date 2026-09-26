const assert = require('assert');
const { findExactDedicatedDevice, findAutoController, parseGenericControllerData, parseControllerData, createDedicatedParserState } = require('../controller/controllerReader');
const phoenix = { path: 'phoenix', vendorId: 0x1CCF, productId: 0x8048, interface: 1, usagePage: 1 };
const fps = { path: 'fps', vendorId: 0x1CCF, productId: 0x8048, interface: 0, usagePage: 1 };
const arduino = { path: 'arduino', vendorId: 0x2341, productId: 0x8036, manufacturer: 'Arduino LLC', product: 'Arduino Leonardo', interface: 2, usagePage: 1, usage: 4 };
const keyboard = { path: 'keyboard', usagePage: 1, usage: 6 };
assert.equal(findAutoController([arduino]).device, arduino);
assert.equal(findExactDedicatedDevice([arduino], 'PHOENIXWAN'), undefined);
assert.equal(findExactDedicatedDevice([arduino], 'FPS EMP Gen2'), undefined);
assert.equal(findAutoController([arduino, phoenix]).device, phoenix);
assert.equal(findAutoController([arduino, fps]).device, fps);
assert.equal(findAutoController([keyboard]), null);
const neutral = Buffer.from([6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]);
const button1 = Buffer.from([6,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0]);
const button2 = Buffer.from([6,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0]);
const state = { previousButtons: 0 };
assert.deepEqual(parseGenericControllerData(neutral, { 1: 1 }, state), []);
let events = parseGenericControllerData(button1, { 1: 1 }, state);
assert.deepEqual(events.map(e => [e.type, e.physicalButton, e.pressed, e.button]), [['physical-button',1,true,undefined],['button',1,true,'button 1']]);
events = parseGenericControllerData(neutral, { 1: 1 }, state);
assert.deepEqual(events.map(e => [e.type, e.pressed]), [['physical-button',false],['button',false]]);
events = parseGenericControllerData(button2, { 7: 2 }, state);
assert.equal(events.find(e => e.type === 'button').button, 'button 7');
const turntableState = { previousButtons: 0, currentDiscRaw: 128 };
events = parseGenericControllerData(button1, { SCup: 1 }, turntableState);
assert.deepEqual(events.map(e => e.type), ['physical-button', 'axis']);
assert.equal(events[1].discRaw, 130);
assert.equal(events[1].direction, '+');
events = parseGenericControllerData(neutral, { SCup: 1 }, turntableState);
assert.deepEqual(events.map(e => e.type), ['physical-button']);
events = parseGenericControllerData(button2, { SCdown: 2 }, turntableState);
assert.equal(events.find(e => e.type === 'axis').discRaw, 128);
assert.equal(events.find(e => e.type === 'axis').direction, '-');
assert.ok(!parseGenericControllerData.toString().includes('detectLR2Mode'));
const report = Buffer.from([128, 0, 1]);
const pState = createDedicatedParserState(), fState = createDedicatedParserState();
assert.deepEqual(parseControllerData(report, pState).map(e => e.type), ['button','axis']);
assert.deepEqual(parseControllerData(report, fState).map(e => e.type), ['button','axis']);
assert.equal(findExactDedicatedDevice([keyboard], 'KB'), undefined);
console.log('controllerReader tests passed');

// report ID가 없는 장치: 첫 바이트가 버튼 1~8
{
  const { createGenericParserState } = require('../controller/controllerReader');
  const mapping = { 1: 1, 3: 3 };
  const s = createGenericParserState();
  const pressed = events => events.filter(e => e.type === 'button').map(e => `${e.button} ${e.pressed ? 'down' : 'up'}`);
  assert.deepEqual(pressed(parseGenericControllerData(Buffer.from([0, 0, 0, 0]), mapping, s)), []);
  assert.equal(s.hasReportId, false);
  assert.deepEqual(pressed(parseGenericControllerData(Buffer.from([1, 0, 0, 0]), mapping, s)), ['button 1 down']);
  assert.deepEqual(pressed(parseGenericControllerData(Buffer.from([5, 0, 0, 0]), mapping, s)), ['button 3 down']);
  assert.deepEqual(pressed(parseGenericControllerData(Buffer.from([0, 0, 0, 0]), mapping, s)), ['button 1 up', 'button 3 up']);
}

// report ID가 없는 장치인데 연결 순간 버튼 1이 눌려 있던 경우: 버튼을 떼는 순간 판단을 바로잡음
{
  const { createGenericParserState } = require('../controller/controllerReader');
  const mapping = { 1: 1, 2: 2 };
  const s = createGenericParserState();
  const pressed = events => events.filter(e => e.type === 'button').map(e => `${e.button} ${e.pressed ? 'down' : 'up'}`);
  parseGenericControllerData(Buffer.from([1, 0, 0, 0]), mapping, s); // 처음엔 report ID로 오인
  assert.equal(s.hasReportId, true);
  assert.deepEqual(pressed(parseGenericControllerData(Buffer.from([0, 0, 0, 0]), mapping, s)), []);
  assert.equal(s.hasReportId, false);
  assert.deepEqual(pressed(parseGenericControllerData(Buffer.from([2, 0, 0, 0]), mapping, s)), ['button 2 down']);
}

console.log('controllerReader report-id tests passed');
