const CATALOG_URL = 'tracks.json';
const QUEUE_SIZE = 50;
const CF_PROXY = 'https://summer-sound-bd21.benjaminphinisee.workers.dev';
const LOCAL_PROXY = 'http://localhost:8888/stream';
const MAX_RETRIES = 3;

let catalog = [];
let queue = [];
let historyList = [];
let localProxyAvailable = false;
let consecutiveFailures = 0;

const audioEl = document.getElementById('audio');
const titleEl = document.getElementById('track-title');
const artistEl = document.getElementById('track-artist');
const historyEl = document.getElementById('history-list');
const btnPlay = document.getElementById('btn-play');
const btnSkip = document.getElementById('btn-skip');

/**
 * Check if local proxy is running (optional, for local dev).
 */
async function checkLocalProxy() {
  try {
    const res = await fetch('http://localhost:8888/health', { signal: AbortSignal.timeout(2000) });
    const data = await res.json();
    localProxyAvailable = data.status === 'ok';
  } catch {
    localProxyAvailable = false;
  }
  setTimeout(checkLocalProxy, 60000);
}

/**
 * Get playback URL:
 * 1. Local proxy if running (fastest for local dev)
 * 2. Cloudflare Worker (always-on, handles CORS + redirects + 401s)
 */
function getPlayUrl(originalUrl) {
  if (localProxyAvailable) {
    return `${LOCAL_PROXY}?url=${encodeURIComponent(originalUrl)}`;
  }
  return `${CF_PROXY}/?url=${encodeURIComponent(originalUrl)}`;
}

async function init() {
  await checkLocalProxy();

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
  audioEl._originalUrl = track.url;
  audioEl._currentTrack = track;
  titleEl.textContent = track.title || 'Untitled';
  artistEl.textContent = track.creator || 'Unknown Artist';

  addToHistory(track);
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

audioEl.addEventListener('error', () => {
  console.warn(`Failed to load: ${audioEl._currentTrack?.title || 'unknown'}`);
  consecutiveFailures++;
  if (consecutiveFailures >= MAX_RETRIES) {
    titleEl.textContent = 'Skipping troubled tracks...';
    artistEl.textContent = 'Cloudflare proxy active — retrying';
  }
  setTimeout(playNext, 500);
});

setInterval(() => {
  if (!audioEl.src) return;
  const duration = audioEl.duration || 0;
  const current = audioEl.currentTime || 0;
  const nearEnd = duration > 0 && current > duration - 3;
  const stuck = audioEl.paused && current > 0 && consecutiveFailures === 0;
  if (nearEnd || stuck) playNext();
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
