const CATALOG_URL = 'tracks.json';
const QUEUE_SIZE = 50;
const MAX_RETRIES = 5;

let catalog = [];
let queue = [];
let historyList = [];
let consecutiveFailures = 0;
let offlineMode = false;
let loadTimeout = null;
let advancing = false;

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
    if (track && !recent.has(track.id) && !queue.some(t => t.id === track.id)) {
      queue.push(track);
    }
  }
}

function stopWatchdog() {
  if (loadTimeout) {
    clearTimeout(loadTimeout);
    loadTimeout = null;
  }
}

function scheduleNext(reason = '') {
  if (advancing) return;
  if (offlineMode) {
    titleEl.textContent = 'Offline. Waiting for connection...';
    return;
  }

  advancing = true;
  stopWatchdog();
  setTimeout(() => {
    advancing = false;
    playNext();
  }, 800);
}

function playNext() {
  if (offlineMode) {
    titleEl.textContent = 'Offline. Waiting for connection...';
    return;
  }

  if (queue.length === 0) refillQueue();
  const track = queue.shift();
  if (!track) return;

  refillQueue();
  stopWatchdog();

  audioEl.src = track.url;
  audioEl._currentTrack = track;
  titleEl.textContent = track.title || 'Untitled';
  artistEl.textContent = track.creator || 'Unknown Artist';

  addToHistory(track);
  audioEl.load();
  audioEl.play().catch(() => {
    if (navigator.onLine) scheduleNext('play failed');
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
  scheduleNext('ended');
});

audioEl.addEventListener('canplay', () => {
  consecutiveFailures = 0;
  stopWatchdog();
});

audioEl.addEventListener('error', () => {
  console.warn(`Failed: ${audioEl._currentTrack?.title}`);
  consecutiveFailures++;

  if (!navigator.onLine) {
    offlineMode = true;
    stopWatchdog();
    titleEl.textContent = 'Offline. Waiting for connection...';
    return;
  }

  if (consecutiveFailures >= MAX_RETRIES) {
    consecutiveFailures = 0;
    titleEl.textContent = 'Skipping troubled tracks...';
  }

  scheduleNext('error');
});

audioEl.addEventListener('waiting', () => {
  if (offlineMode || !navigator.onLine) {
    offlineMode = true;
    stopWatchdog();
    titleEl.textContent = 'Offline. Waiting for connection...';
    return;
  }

  stopWatchdog();
  loadTimeout = setTimeout(() => {
    console.warn('Stuck loading, skipping...');
    scheduleNext('stuck loading');
  }, 8000);
});

audioEl.addEventListener('playing', () => {
  stopWatchdog();
  consecutiveFailures = 0;
});

window.addEventListener('online', () => {
  offlineMode = false;
  consecutiveFailures = 0;
  titleEl.textContent = 'Back online. Resuming...';
  playNext();
});

window.addEventListener('offline', () => {
  offlineMode = true;
  stopWatchdog();
  audioEl.pause();
  titleEl.textContent = 'Offline. Waiting for connection...';
});

setInterval(() => {
  if (offlineMode) return;
  if (!audioEl.src || audioEl.paused) return;

  const duration = audioEl.duration || 0;
  const current = audioEl.currentTime || 0;
  const nearEnd = duration > 0 && current > duration - 3;

  if (nearEnd && navigator.onLine) {
    scheduleNext('near end');
  }
}, 5000);

btnPlay.addEventListener('click', () => {
  if (offlineMode) {
    titleEl.textContent = 'Offline. Waiting for connection...';
    return;
  }

  consecutiveFailures = 0;
  if (audioEl.paused) audioEl.play().catch(() => {});
  else audioEl.pause();
});

btnSkip.addEventListener('click', () => {
  consecutiveFailures = 0;
  audioEl.pause();
  scheduleNext('manual skip');
});

window.addEventListener('load', init);
