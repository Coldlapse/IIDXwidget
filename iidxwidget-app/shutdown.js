// 종료 절차. 단계를 순서대로 한 번만 실행하고, 각 단계의 진행 상황을 알린다.
// 단계가 실패하거나 시간을 넘겨도 다음 단계로 넘어가서, 종료가 막히지 않게 한다.

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// steps: [{ key, run: async () => (선택) { detail }, timeoutMs, skip?: () => boolean }]
// onProgress(key, status, detail): status = 'running' | 'done' | 'failed' | 'skipped'
// minDurationMs: 사용자가 진행 상황을 읽을 수 있도록 전체 절차를 최소 이 시간만큼 보여준다
function createShutdown({ steps, onProgress = () => {}, minDurationMs = 0 }) {
  let running = null;

  async function runStep(step) {
    if (step.skip?.()) {
      onProgress(step.key, 'skipped');
      return;
    }
    onProgress(step.key, 'running');
    let timer;
    try {
      const result = await Promise.race([
        Promise.resolve().then(step.run),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), step.timeoutMs ?? 5000); })
      ]);
      onProgress(step.key, 'done', result?.detail);
    } catch (error) {
      onProgress(step.key, 'failed', error.message);
    } finally {
      clearTimeout(timer);
    }
  }

  // 여러 번 불려도 같은 절차 하나만 진행된다
  function run() {
    if (!running) {
      running = (async () => {
        const started = Date.now();
        for (const step of steps) await runStep(step);
        const remaining = minDurationMs - (Date.now() - started);
        if (remaining > 0) await sleep(remaining);
      })();
    }
    return running;
  }

  return { run, get started() { return running !== null; } };
}

module.exports = { createShutdown };
