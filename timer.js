// Web worker to run the timer

let interval;

self.addEventListener('message', (ev) => {
  if (ev.data === 'start') {
    let count = 0;
    interval = setInterval(() => {
      self.postMessage((new Date()).getTime());
    }, 100);
  } else if (ev.data === 'stop') {
      if (interval) {
          clearInterval(interval);
      }
  }
});
