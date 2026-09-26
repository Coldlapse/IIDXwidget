// beatmania.app 서열표 사이트로 타건 수를 보낸다. 서버는 받은 수를 그날 기록에 더한다.
const API_URL = 'https://beatmania.app/api/v1/update-typing-count/';

// 결과: { ok: true, dailyTotal } 또는 { ok: false, reason: 'unauthorized' | 'server' | 'network' | 'timeout', message }
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
    if (!response.ok) return { ok: false, reason: 'server', message: `${response.status} ${response.statusText}` };

    const data = await response.json();
    if (data.status !== 'success') return { ok: false, reason: 'server', message: 'unexpected response' };
    return { ok: true, dailyTotal: data.daily_total ?? null };
  } catch (error) {
    if (error.name === 'AbortError') return { ok: false, reason: 'timeout', message: `${timeoutMs}ms` };
    return { ok: false, reason: 'network', message: error.message };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { uploadTypingCount, API_URL };
