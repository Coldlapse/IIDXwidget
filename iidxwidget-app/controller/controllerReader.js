let hidModule;
function getHID() { if (!hidModule) hidModule = require('node-hid'); return hidModule; }
const isPhoenix = d => d.vendorId === 0x1CCF && d.productId === 0x8048 && d.interface === 1;
const isFps = d => d.vendorId === 0x1CCF && d.productId === 0x8048 && d.interface === 0 && d.usagePage === 1;

function findExactDedicatedDevice(devices, profile) {
  return devices.find(d => d.path && (profile === 'PHOENIXWAN' ? isPhoenix(d) : profile === 'FPS EMP Gen2' ? isFps(d) : false));
}
function findAutoController(devices) {
  const usable = devices.filter(d => d.path);
  const phoenix = usable.find(isPhoenix); if (phoenix) return { device: phoenix, parser: 'PHOENIXWAN' };
  const fps = usable.find(isFps); if (fps) return { device: fps, parser: 'FPS_EMP' };
  const terms = /phoenixwan|fps|emp|infinitas|inf&bms|iidx|beatmania|yuancon|gamo2/i;
  const named = usable.find(d => terms.test(`${d.product || ''} ${d.manufacturer || ''}`) && !(d.usagePage === 1 && (d.usage === 2 || d.usage === 6)));
  if (named) return { device: named, parser: 'GENERIC' };
  const generic = usable.find(d => d.usagePage === 1 && (d.usage === 4 || d.usage === 5));
  return generic ? { device: generic, parser: 'GENERIC' } : null;
}
function parseGenericControllerData(buffer, mapping = {}, state = { previousButtons: 0 }) {
  if (!buffer?.length) return [];
  if (!Number.isInteger(state.currentDiscRaw)) state.currentDiscRaw = 128;
  const offset = buffer[0] !== 0 ? 1 : 0;
  let buttons = 0;
  for (let i = 0; i < Math.min(4, buffer.length - offset); i++) buttons = (buttons | ((buffer[offset + i] || 0) << (i * 8))) >>> 0;
  const changed = (buttons ^ (state.previousButtons >>> 0)) >>> 0, events = [], timestamp = Date.now();
  for (let i = 0; i < 32; i++) {
    const mask = (1 << i) >>> 0;
    if (!(changed & mask)) continue;
    const physicalButton = i + 1, pressed = !!(buttons & mask);
    events.push({ type: 'physical-button', physicalButton, pressed, timestamp });
    const logical = Object.keys(mapping).find(key => Number(mapping[key]) === physicalButton);
    if (/^[1-7]$/.test(logical)) events.push({ type: 'button', button: `button ${logical}`, physicalButton, pressed, timestamp });
    else if (pressed && (logical === 'SCup' || logical === 'SCdown')) {
      state.currentDiscRaw = (state.currentDiscRaw + (logical === 'SCup' ? 2 : -2) + 256) % 256;
      events.push({ type: 'axis', axis: 'X', direction: logical === 'SCup' ? '+' : '-', discRaw: state.currentDiscRaw, physicalButton, timestamp });
    }
  }
  state.previousButtons = buttons;
  return events;
}
function createDedicatedParserState() { return { lastButtonByte: 0, isLR2Active: false, lr2DetectEnabled: false, lr2PatternCount: 0, normalPatternCount: 0, lr2FirstStaticTime: null, currentDiscRaw: 0, lastLR2Direction: 'neutral' }; }
function parseControllerData(buffer, state) {
  const events = [], buttonByte = buffer[2], timestamp = Date.now();
  for (let i = 0; i < 7; i++) { const mask = 1 << i, pressed = !!(buttonByte & mask); if (!!(state.lastButtonByte & mask) !== pressed) events.push({ type: 'button', button: `button ${i + 1}`, pressed, timestamp }); }
  state.lastButtonByte = buttonByte;
  const xRaw = buffer[0]; events.push({ type: 'axis', axis: 'X', direction: xRaw < 100 ? '-' : xRaw > 150 ? '+' : 'neutral', discRaw: xRaw, timestamp });
  return events;
}
function detectLR2Mode(buffer, callback, state) {
  const isStatic = [0x80, 0x7F, 0x00].includes(buffer[0]);
  if (isStatic) { if (!state.lr2PatternCount) state.lr2FirstStaticTime = Date.now(); state.lr2PatternCount++; state.normalPatternCount = 0; if (!state.isLR2Active && state.lr2PatternCount >= 120 && Date.now() - state.lr2FirstStaticTime < 500) { state.isLR2Active = true; callback?.([{ type: 'log', message: '🔵 LR2 모드 활성화됨', timestamp: Date.now() }]); } }
  else { state.lr2PatternCount = 0; state.normalPatternCount++; state.lr2FirstStaticTime = null; if (state.isLR2Active && state.normalPatternCount >= 3) { state.isLR2Active = false; callback?.([{ type: 'log', message: '⚪ LR2 모드 비활성화됨', timestamp: Date.now() }]); } }
}
function handleDedicatedData(buffer, callback, state) {
  const xRaw = buffer[0]; if (state.lr2DetectEnabled) detectLR2Mode(buffer, callback, state);
  const parsed = parseControllerData(buffer, state); if (!state.isLR2Active) { if (parsed.length) callback(parsed); return; }
  const filtered = parsed.filter(e => !(e.type === 'axis' && e.axis === 'X')); let direction = xRaw === 0x80 ? '+' : xRaw === 0x7F ? '-' : 'neutral';
  if (direction !== 'neutral' && direction !== state.lastLR2Direction) { state.lastLR2Direction = direction; state.currentDiscRaw = (state.currentDiscRaw + (direction === '+' ? 5 : -5) + 256) % 256; filtered.push({ type: 'axis', axis: 'X', direction, discRaw: state.currentDiscRaw, timestamp: Date.now() }); }
  else if (direction === 'neutral' && state.lastLR2Direction !== 'neutral') { state.lastLR2Direction = 'neutral'; filtered.push({ type: 'axis', axis: 'X', direction, discRaw: state.currentDiscRaw, timestamp: Date.now() }); }
  if (filtered.length) callback(filtered);
}
function openReader(selection, callback, options) {
  const logger = options.logger || ((level, code, details) => console[level]?.(code, details || '')); let device;
  try { const HID = getHID(); device = new HID.HID(selection.device.path); logger('log', 'connected', { profile: options.profile }); } catch (error) { logger('error', 'openFailed', { profile: options.profile, error }); return null; }
  const dedicatedState = createDedicatedParserState(); dedicatedState.lr2DetectEnabled = selection.parser !== 'GENERIC' && !!options.lr2ModeEnabled;
  const genericState = { previousButtons: 0, currentDiscRaw: 128 };
  device.on('data', buffer => { try { if (selection.parser === 'GENERIC') { const events = parseGenericControllerData(buffer, options.genericMapping, genericState); if (events.length) callback(events); } else handleDedicatedData(buffer, callback, dedicatedState); } catch (error) { logger('error', 'dataError', { error }); } });
  device.on('error', error => logger('error', 'deviceError', { error }));
  return { parser: selection.parser, close() { try { device.removeAllListeners(); device.close(); } catch (error) { logger('error', 'closeFailed', { error }); } } };
}
function startControllerReader(profile, callback, options = {}) { const device = findExactDedicatedDevice(getHID().devices(), profile); if (!device) { options.logger?.('error', 'notFound', { profile }); return null; } return openReader({ device, parser: profile === 'PHOENIXWAN' ? 'PHOENIXWAN' : 'FPS_EMP' }, callback, { ...options, profile }); }
function startAutoControllerReader(callback, options = {}) { const selection = findAutoController(getHID().devices()); if (!selection) { options.logger?.('error', 'notFound', { profile: 'AUTO' }); return null; } return openReader(selection, callback, { ...options, profile: 'AUTO' }); }
module.exports = { startControllerReader, startAutoControllerReader, findExactDedicatedDevice, findAutoController, parseGenericControllerData, parseControllerData, createDedicatedParserState };
