const CATALOG_URL = 'tracks.json';
const QUEUE_SIZE = 50;

let catalog = [];
let queue = [];
let historyList = [];

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

  audioEl.src = track.url;
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

audioEl.addEventListener('ended', playNext);

// Safety net: if playback stalls or finishes without firing "ended", skip ahead
setInterval(() => {
  if (!audioEl.src) return;

  const duration = audioEl.duration || 0;
  const current  = audioEl.currentTime || 0;

  const nearEnd = duration > 0 && current > duration - 3;
  const stuck   = audioEl.paused && current > 0;

  if (nearEnd || stuck) {
    playNext();
  }
}, 8000); // check about every 8 seconds

btnPlay.addEventListener('click', () => {
  if (audioEl.paused) audioEl.play().catch(() => {});
  else audioEl.pause();
});

btnSkip.addEventListener('click', () => {
  audioEl.pause();
  playNext();
});

window.addEventListener('load', init);
