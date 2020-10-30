interface WaitForOptions {
  timeout?: number;
  interval?: number;
}

export async function waitFor(
  callback: () => Promise<void>,
  { timeout = 5000, interval = 50 }: WaitForOptions
) {
  let overallTimeoutTimer: any;
  let intervalId: any;

  await new Promise(async (resolve, reject) => {
    let timeOver = { current: false };

    overallTimeoutTimer = setTimeout(() => (timeOver.current = true), timeout);
    intervalId = setInterval(async () => {
      try {
        await callback();
        resolve();
      } catch (e) {
        if (timeOver.current) {
          reject(e);
        }
      }
    }, interval);
  });

  clearTimeout(overallTimeoutTimer);
  clearInterval(intervalId);
}
