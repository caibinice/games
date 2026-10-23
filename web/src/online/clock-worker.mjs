// A render frame is not a game clock: hidden/occluded tabs can stop rAF.
// Keep the host's simulation tick independent from Canvas/Vue painting.
let timer;
self.onmessage = ({ data }) => {
  clearInterval(timer);
  if (data === true) timer = setInterval(() => self.postMessage(0), 1000 / 60);
};
