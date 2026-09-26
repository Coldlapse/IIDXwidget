// beatmania.app 서열표 사이트로 타건 수를 보낸다.
// 서버는 받은 수를 "요청이 도착한 시각의 한국 날짜" 기록에 더한다 (날짜를 지정하는 값은 없다).
const API_URL = 'https://beatmania.app/api/v1/update-typing-count/';
const MAX_PER_REQUEST = 600000; // 서버 한도: 요청 한 번에 1~600,000

// 요청 한 번. 결과: { ok: true, dailyTotal }
// 또는 { ok: false, reason: 'unauthorized' | 'dailyLimit' | 'rejected' | 'server' | 'network' | 'timeout', message, dailyTotal? }
async function uploadTypingCount({ token, count, timeoutMs = 10000, fetchImpl = fetch }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${token}` },
      body: JSON.stringify({ count }),
      signal: controller.signal
    });
    if (response.status === 401) return { ok: false, reason: 'unauthorized', message: 'invalid token' };

    const data = await response.json().catch(() => ({}));
    if (response.status === 400) {
      // 하루 합계 상한(2,000,000)을 넘으면 서버가 지금까지의 합계(daily_total)를 함께 돌려준다
      if (data.daily_total !== undefined) return { ok: false, reason: 'dailyLimit', message: data.error, dailyTotal: data.daily_total };
      return { ok: false, reason: 'rejected', message: data.error || 'bad request' };
    }
    if (!response.ok) return { ok: false, reason: 'server', message: `${response.status} ${response.statusText}` };
    if (data.status !== 'success') return { ok: false, reason: 'server', message: 'unexpected response' };
    return { ok: true, dailyTotal: data.daily_total ?? null };
  } catch (error) {
    if (error.name === 'AbortError') return { ok: false, reason: 'timeout', message: `${timeoutMs}ms` };
    return { ok: false, reason: 'network', message: error.message };
  } finally {
    clearTimeout(timer);
  }
}

// 서버 한도를 넘는 양은 나눠서 보낸다. 중간에 실패하면 거기서 멈춘다.
// onSent(count, dailyTotal): 한 번 보낼 때마다 호출 (보낸 만큼 바로 기록하도록)
// 결과: { ok, sent, dailyTotal, reason?, message? }
async function uploadInChunks({ token, count, timeoutMs, fetchImpl, onSent = () => {} }) {
  let sent = 0;
  let dailyTotal = null;
  while (sent < count) {
    const chunk = Math.min(MAX_PER_REQUEST, count - sent);
    const result = await uploadTypingCount({ token, count: chunk, timeoutMs, fetchImpl });
    if (!result.ok) return { ...result, sent, dailyTotal: result.dailyTotal ?? dailyTotal };
    sent += chunk;
    dailyTotal = result.dailyTotal;
    onSent(chunk, dailyTotal);
  }
  return { ok: true, sent, dailyTotal };
}

// 토큰이 누구의 것인지 (beatmania.app Synchronizer와 같은 API). 토큰을 넣는 순간 확인하고, 연결된 계정을 보여주는 데 쓴다.
// 결과: { kind: 'ok', username } | { kind: 'unauthorized' } | { kind: 'network', error }
const ME_URL = 'https://beatmania.app/api/v1/me/';

async function whoami({ token, timeoutMs = 10000, fetchImpl = fetch }) {
  try {
    const response = await fetchImpl(ME_URL, {
      headers: { 'Authorization': `Token ${token}` },
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (response.status === 401 || response.status === 403) return { kind: 'unauthorized' };
    if (!response.ok) return { kind: 'network', error: `HTTP ${response.status}` };
    const data = await response.json().catch(() => ({}));
    return data.username ? { kind: 'ok', username: data.username } : { kind: 'network', error: 'unexpected response' };
  } catch (error) {
    return { kind: 'network', error: error.message };
  }
}

module.exports = { uploadTypingCount, uploadInChunks, whoami, API_URL, ME_URL, MAX_PER_REQUEST };
