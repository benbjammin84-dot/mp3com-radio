const CATALOG_URL = 'tracks.json';
const QUEUE_SIZE = 50;
const PROXY_URL = 'http://localhost:8888/stream';
const MAX_RETRIES = 3; // skip after this many failures in a row

let catalog = [];
let queue = [];
let historyList = [];
let proxyAvailable = false;
let consecutiveFailures = 0;

const audioEl = document.getElementById('audio');
const titleEl = document.getElementById('track-title');
const artistEl = document.getElementById('track-artist');
const historyEl = document.getElementById('history-list');
const btnPlay = document.getElementById('btn-play');
const btnSkip = document.getElementById('btn-skip');

/**
 * Check if the Nice TV local proxy is running.
 */
async function checkProxy() {
  try {
    const res = await fetch('http://localhost:8888/health', { signal: AbortSignal.timeout(2000) });
    const data = await res.json();
    proxyAvailable = data.status === 'ok';
  } catch {
    proxyAvailable = false;
  }
  // Re-check every 60 seconds
  setTimeout(checkProxy, 60000);
}

/**
 * Get the playback URL — through proxy if available, direct otherwise.
 */
function getPlayUrl(originalUrl) {
  if (proxyAvailable) {
    return `${PROXY_URL}?url=${encodeURIComponent(originalUrl)}`;
  }
  return originalUrl;
}

async function init() {
  // Check proxy first
  await checkProxy();

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

  audioEl.src = getPlayUrl(track.url);
  audioEl._originalUrl = track.url; // keep original for retry logic
  audioEl._currentTrack = track;
  titleEl.textContent = track.title || 'Untitled';
  artistEl.textContent = track.creator || 'Unknown Artist';

  addToHistory(track);
  audioEl.play().catch(() => {
    // autoplay blocked, user needs to interact first
  });
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

// Handle load errors — skip to next track on 401/403/network failure
audioEl.addEventListener('error', () => {
  console.warn(`Failed to load: ${audioEl._currentTrack?.title || 'unknown'}`);
  consecutiveFailures++;

  if (consecutiveFailures >= MAX_RETRIES) {
    // If proxy isn't running and we're getting repeated failures, note it
    if (!proxyAvailable) {
      titleEl.textContent = 'Streams blocked — start the proxy (node proxy.js)';
      artistEl.textContent = 'Run the Nice TV proxy on port 8888 for best results';
      return;
    }
  }

  // Auto-skip to next track
  setTimeout(playNext, 500);
});

// Safety net: if playback stalls or finishes without firing "ended", skip ahead
setInterval(() => {
  if (!audioEl.src) return;

  const duration = audioEl.duration || 0;
  const current  = audioEl.currentTime || 0;

  const nearEnd = duration > 0 && current > duration - 3;
  const stuck   = audioEl.paused && current > 0 && consecutiveFailures === 0;

  if (nearEnd || stuck) {
    playNext();
  }
}, 8000);

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
