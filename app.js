const CATALOG_URL = 'tracks.json';
const QUEUE_SIZE = 50;
const MAX_RETRIES = 5;

let catalog = [];
let queue = [];
let historyList = [];
let consecutiveFailures = 0;

const audioEl = document.getElementById('audio');
const titleEl = document.getElementById('track-title');
const artistEl = document.getElementById('track-artist');
const historyEl = document.getElementById('history-list');
const btnPlay = document.getElementById('btn-play');
const btnSkip = document.getElementById('btn-skip');

async function init() {
  try {
    const res = await fetch(CATALOG_URL);
    catalog = await res.json();
  } catch (e) {
    titleEl.textContent = 'Failed to load catalog.';
    return;
  }

  if (!Array.isArray(catalog) || catalog.length === 0) {
    titleEl.textContent = 'Catalog is empty.';
    return;
  }

  refillQueue();
  playNext();
}

function refillQueue() {
  const recent = new Set(historyList.slice(0, 100).map(t => t.id));
  while (queue.length < QUEUE_SIZE) {
    const idx = Math.floor(Math.random() * catalog.length);
    const track = catalog[idx];
    if (!recent.has(track.id)) queue.push(track);
  }
}

function playNext() {
  if (queue.length === 0) refillQueue();
  const track = queue.shift();
  if (!track) return;
  refillQueue();

  // Play archive.org directly — their CDN supports CORS on download URLs
  audioEl.src = track.url;
  audioEl._currentTrack = track;
  titleEl.textContent = track.title || 'Untitled';
  artistEl.textContent = track.creator || 'Unknown Artist';

  addToHistory(track);
  audioEl.load();
  audioEl.play().catch(() => {});
}

function addToHistory(track) {
  historyList.unshift(track);
  if (historyList.length > 30) historyList.pop();

  historyEl.innerHTML = '';
  for (const t of historyList) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.textContent = `${t.creator || 'Unknown'} \u2013 ${t.title || 'Untitled'}`;
    a.href = t.url;
    a.target = '_blank';
    li.appendChild(a);
    historyEl.appendChild(li);
  }
}

audioEl.addEventListener('ended', () => {
  consecutiveFailures = 0;
  playNext();
});

audioEl.addEventListener('canplay', () => {
  consecutiveFailures = 0;
});

audioEl.addEventListener('error', () => {
  console.warn(`Failed: ${audioEl._currentTrack?.title}`);
  consecutiveFailures++;
  if (consecutiveFailures >= MAX_RETRIES) {
    consecutiveFailures = 0;
    titleEl.textContent = 'Skipping a few troubled tracks...';
  }
  setTimeout(playNext, 800);
});

// Watchdog: skip if stuck loading too long
let loadTimeout = null;
audioEl.addEventListener('waiting', () => {
  loadTimeout = setTimeout(() => {
    console.warn('Stuck loading, skipping...');
    playNext();
  }, 8000);
});
audioEl.addEventListener('playing', () => {
  if (loadTimeout) { clearTimeout(loadTimeout); loadTimeout = null; }
  consecutiveFailures = 0;
});

// Safety net interval
setInterval(() => {
  if (!audioEl.src) return;
  const duration = audioEl.duration || 0;
  const current = audioEl.currentTime || 0;
  const nearEnd = duration > 0 && current > duration - 3;
  if (nearEnd) playNext();
}, 5000);

btnPlay.addEventListener('click', () => {
  consecutiveFailures = 0;
  if (audioEl.paused) audioEl.play().catch(() => {});
  else audioEl.pause();
});

btnSkip.addEventListener('click', () => {
  consecutiveFailures = 0;
  audioEl.pause();
  playNext();
});

window.addEventListener('load', init);
