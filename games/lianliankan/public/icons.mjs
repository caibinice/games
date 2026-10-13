const paths = {
  back: '<path d="m14 5-7 7 7 7M7 12h14"/>',
  sound: '<path d="m11 5-5 4H3v6h3l5 4zM15 8q6 4 0 8m3-11q10 7 0 14"/>',
  mute: '<path d="m11 5-5 4H3v6h3l5 4zM16 9l6 6m0-6-6 6"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3h.01"/>',
  pause: '<path d="M8 5v14m8-14v14"/>',
  play: '<path d="m8 5 11 7-11 7z"/>',
  restart: '<path d="M4 9a8 8 0 1 1 1 9M4 4v6h6"/>',
  hint: '<path d="M9 18h6m-5 3h4M8 14c-5-4-2-11 4-11s9 7 4 11l-1 3H9z"/>',
  shuffle: '<path d="M3 6h3c4 0 6 12 10 12h5m-4-4 4 4-4 4M3 18h3c4 0 6-12 10-12h5m-4-4 4 4-4 4"/>',
  time: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  leaf: '<path d="M4 20C-1 8 8 3 21 3c0 13-5 22-17 17zm0 0L15 9"/>',
};
export const icon = name => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
