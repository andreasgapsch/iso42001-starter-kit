// Worker im Vite-Bundle (als Inline-Worker eingebettet).
self.onmessage = (e: MessageEvent<{ n: number }>) => {
  let summe = 0;
  for (let i = 1; i <= e.data.n; i++) summe += i;
  self.postMessage({ summe });
};
