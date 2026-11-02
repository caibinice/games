// Additional plants are code-native SVG illustrations; classic GIFs are local assets.
export const CUSTOM_ART = {
  puffshroom:
    '<ellipse cx="45" cy="70" rx="21" ry="6" fill="#345f36"/><path d="M35 44h22l6 27H32Z" fill="#e4d6be"/><path d="M17 44C12 11 72 9 77 44Q47 59 17 44" fill="#ae78b8" stroke="#67457d" stroke-width="3"/><ellipse cx="38" cy="26" rx="8" ry="5" fill="#e5bfda"/><circle cx="40" cy="57" r="3" fill="#3a313b"/><circle cx="53" cy="57" r="3" fill="#3a313b"/>',
  lilypad:
    '<ellipse cx="44" cy="65" rx="37" ry="16" fill="#204e3a"/><path d="M44 60 79 42C92 61 72 77 45 76 17 77-3 60 17 44q12-13 28-9Z" fill="#83b94d" stroke="#467a34" stroke-width="3"/><path d="m18 61 25 3m0 0 23 1M43 63l1-19" stroke="#b8d36d" stroke-width="2"/>',
  flowerpot:
    '<ellipse cx="45" cy="74" rx="25" ry="6" fill="#744a3444"/><path d="m22 37 9 36h30l9-36Z" fill="#c48052" stroke="#7e4e35" stroke-width="3"/><path d="M18 30h54v13H18Z" fill="#e4a16c" stroke="#7e4e35" stroke-width="3"/><ellipse cx="45" cy="32" rx="24" ry="6" fill="#5c4332"/>',
  squash:
    '<ellipse cx="44" cy="76" rx="27" ry="6" fill="#264d3355"/><path d="M25 74Q7 34 34 22c1-14 17-14 19 0 28 3 30 40 11 52Z" fill="#94b34d" stroke="#426334" stroke-width="3"/><path d="M26 37 40 42m10 0 14-8" stroke="#37532c" stroke-width="5"/><ellipse cx="35" cy="47" rx="5" ry="7" fill="#e4e1c4"/><ellipse cx="55" cy="47" rx="5" ry="7" fill="#e4e1c4"/><circle cx="36" cy="48" r="2.5" fill="#223629"/><circle cx="54" cy="48" r="2.5" fill="#223629"/><path d="m31 63 25-1" stroke="#37532c" stroke-width="4"/>',
  chomper:
    '<path d="M43 53q-1 18-8 23m6-4q-24-18-26-5 1 15 26 5m1 0q28-17 30-5-2 15-30 5" fill="#73a948" stroke="#386a3b" stroke-width="3"/><path d="M19 43Q6 1 49 8q34 4 25 33L47 32l25 20q-29 23-53-9" fill="#8e5ba8" stroke="#503977" stroke-width="3"/><path d="m24 36 5 13 7-11 6 13 6-10 7 10 9-9" fill="#fff5cf"/><circle cx="39" cy="24" r="5" fill="#ebe8c7"/><circle cx="40" cy="24" r="2" fill="#3a2f45"/>',
  cabbage:
    '<path d="M23 68q-6-12-16-6 4 18 26 12m21-1q28-19 30-6-6 14-30 6" fill="#579b49" stroke="#346e3a" stroke-width="3"/><path d="M31 71 48 44l11 4-8 26Z" fill="#bf9963" stroke="#75593e" stroke-width="3"/><path d="M41 53 15 27l6-8 29 26Z" fill="#d5ae78" stroke="#75593e" stroke-width="3"/><circle cx="24" cy="23" r="19" fill="#85b962" stroke="#3f7b43" stroke-width="3"/><path d="M19 6q20 14 4 35M8 20q18 7 31 0" fill="none" stroke="#bdd28a" stroke-width="4"/><circle cx="58" cy="45" r="15" fill="#a9c671" stroke="#527a3f" stroke-width="3"/><circle cx="53" cy="43" r="3" fill="#314b2d"/><circle cx="64" cy="43" r="3" fill="#314b2d"/>',
};
const images = new Map();
export function plantImage(id) {
  if (!images.has(id))
    images.set(
      id,
      CUSTOM_ART[id]
        ? 'data:image/svg+xml,' +
            encodeURIComponent(
              `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 90">${CUSTOM_ART[id]}</svg>`,
            )
        : new URL('./assets/plants/' + id + '.gif', import.meta.url).href,
    );
  return images.get(id);
}
export function plantIcon(id, alt = '') {
  return `<img src="${plantImage(id)}" alt="${alt}" draggable="false">`;
}
export const ICONS = {
  sun: '☀',
  shovel: '♠',
  pause: 'Ⅱ',
  full: '⛶',
  music: '♫',
  help: '?',
  back: '↗',
  close: '×',
};
