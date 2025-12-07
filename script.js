// script.js — per-ayat audio yang stabil + START button
const startBtn = document.getElementById('startBtn');
const surahSelect = document.getElementById('surahSelect');
const reciterSelect = document.getElementById('reciterSelect');
const speed = document.getElementById('speed');
const speedLabel = document.getElementById('speedLabel');

const statusDiv = document.getElementById('status');
const ayahList = document.getElementById('ayahList');
const translationDiv = document.getElementById('translation');

const player = document.getElementById('player');
const ambFile = document.getElementById('ambFile');
const ambToggle = document.getElementById('ambToggle');
const ambience = document.getElementById('ambience');

const playBtn = document.getElementById('playBtn');
const pauseBtn = document.getElementById('pauseBtn');
const stopBtn = document.getElementById('stopBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');

let started = false;
let ayats = [];         // array of {index, numberInSurah, text, audio, translation}
let currentIndex = 0;
let usePerAyahAudio = true; // detect per reciter
let totalAyahs = 0;

function setStatus(msg){
  statusDiv.textContent = 'Status: ' + msg;
  console.log('[status]', msg);
}

// Populate surah list
async function loadSurahList(){
  setStatus('Memuat daftar surah...');
  try{
    const r = await fetch('https://api.alquran.cloud/v1/surah');
    const j = await r.json();
    j.data.forEach(s=>{
      const opt = document.createElement('option');
      opt.value = s.number;
      opt.textContent = `${s.number}. ${s.englishName} — ${s.name}`;
      surahSelect.appendChild(opt);
    });
    surahSelect.value = 1;
    setStatus('Daftar surah siap.');
    await loadSurah(1); // autoload surah 1
  } catch(e){
    console.error(e); setStatus('Gagal memuat daftar surah.');
  }
}

// Load surah with reciter edition (tries to get per-ayah audio)
async function loadSurah(n){
  setStatus('Memuat surah ' + n + ' ...');
  ayahList.innerHTML = '';
  translationDiv.innerHTML = '';
  try{
    const reciter = reciterSelect.value; // e.g. ar.alafasy
    // fetch Arabic with selected edition (some editions include audio url per ayah)
    const arabRes = await fetch(`https://api.alquran.cloud/v1/surah/${n}/${reciter}`);
    const transRes = await fetch(`https://api.alquran.cloud/v1/surah/${n}/id.indonesian`);
    const arabJson = await arabRes.json();
    const transJson = await transRes.json();

    // build ayats
    ayats = arabJson.data.ayahs.map((a, idx) => {
      return {
        index: idx,
        numberInSurah: a.numberInSurah,
        text: a.text,
        audio: a.audio || null,
        translation: (transJson.data.ayahs[idx] && transJson.data.ayahs[idx].text) || ''
      };
    });

    totalAyahs = ayats.length;
    // detect availability of per-ayah audio
    usePerAyahAudio = ayats.some(x => x.audio);
    if(!usePerAyahAudio){
      setStatus('Per-ayat audio tidak tersedia untuk reciter ini. Akan menggunakan fallback surah penuh jika ingin memutar.');
    } else {
      setStatus('Per-ayat audio tersedia. Siap diputar.');
    }

    renderAyahList();
    currentIndex = 0;
    showTranslation(0);
  } catch(err){
    console.error(err);
    setStatus('Gagal memuat surah. Coba ulang.');
    ayahList.innerHTML = '<div class="hint">Gagal memuat ayat.</div>';
  }
}

// Render ayah list
function renderAyahList(){
  ayahList.innerHTML = '';
  ayats.forEach(a=>{
    const el = document.createElement('div');
    el.className = 'ayah';
    el.dataset.index = a.index;
    el.innerHTML = `<div class="arabic">${a.text}</div>
                    <div class="meta"><div>(${a.numberInSurah})</div></div>`;
    el.addEventListener('click', ()=> {
      currentIndex = a.index;
      playCurrentAyah();
    });
    ayahList.appendChild(el);
  });
}

// Show translation in right pane
function showTranslation(idx){
  if(!ayats[idx]) { translationDiv.innerHTML = ''; return; }
  translationDiv.innerHTML = `<strong>Ayat ${ayats[idx].numberInSurah}</strong><p>${ayats[idx].translation}</p>`;
}

// Play current ayah
async function playCurrentAyah(){
  if(!started){ setStatus('Tekan START terlebih dahulu'); return; }
  const a = ayats[currentIndex];
  if(!a){ setStatus('Ayat tidak ditemukan'); return; }

  // highlight
  document.querySelectorAll('.ayah').forEach(el=>el.classList.remove('active'));
  const activeEl = document.querySelector(`.ayah[data-index="${currentIndex}"]`);
  if(activeEl) activeEl.classList.add('active');
  activeEl?.scrollIntoView({behavior:'smooth', block:'center'});

  // show translation
  showTranslation(currentIndex);

  // if per-ayat audio available -> play it
  if(a.audio){
    try{
      player.src = a.audio;
      player.playbackRate = Number(speed.value);
      await player.play();
      setStatus(`Memainkan ayat ${a.numberInSurah}`);
    } catch(e){
      console.warn('play error', e);
      setStatus('Gagal memutar ayat (cek koneksi).');
    }
    return;
  }

  // fallback: try CDN full surah (will play whole surah, not exact per-ayat)
  setStatus('Per-ayat audio tidak tersedia. Memainkan full-surah (fallback).');
  const reciterSlug = reciterSelect.value.replace('ar.',''); // attempt slug
  const surahNum = String(surahSelect.value).padStart(2,'0');
  const cdnUrl = `https://cdn.islamic.network/quran/audio-surah/128/${reciterSlug}/${surahSelect.value}.mp3`;
  try{
    player.src = cdnUrl;
    player.playbackRate = Number(speed.value);
    await player.play();
  }catch(e){
    console.warn(e);
    setStatus('Gagal memutar fallback surah.');
  }
}

// Event: when audio ends
player.addEventListener('ended', ()=>{
  // if per-ayah audio -> move to next ayah automatically
  if(usePerAyahAudio){
    if(currentIndex < totalAyahs - 1){
      currentIndex++;
      playCurrentAyah();
    } else {
      setStatus('Selesai Surah.');
    }
  } else {
    setStatus('Selesai (full-surah).');
  }
});

// START button: must be clicked to allow audio
startBtn.addEventListener('click', async ()=>{
  started = true;
  // try to play ambience if file chosen or default (none by default)
  try{
    ambience.volume = 0.12;
    // do not autoplay ambience if no src set; you can set ambience.src if you want built-in
    // ambience.play(); // optional
  }catch(e){ /* ignore */ }
  setStatus('Audio diizinkan — silakan pilih ayat lalu Play.');
  startBtn.style.display = 'none';
});

// Play/Pause/Stop/Prev/Next controls
playBtn.addEventListener('click', ()=> { if(!started){ setStatus('Tekan START dulu'); return;} playCurrentAyah(); });
pauseBtn.addEventListener('click', ()=> { player.pause(); setStatus('Dijeda'); });
stopBtn.addEventListener('click', ()=> { player.pause(); player.currentTime = 0; setStatus('Dihentikan'); });
prevBtn.addEventListener('click', ()=> {
  if(currentIndex>0){ currentIndex--; playCurrentAyah(); }
});
nextBtn.addEventListener('click', ()=> {
  if(currentIndex < totalAyahs-1){ currentIndex++; playCurrentAyah(); }
});

// reciter or surah change reload data
reciterSelect.addEventListener('change', ()=> {
  loadSurah(surahSelect.value);
});
surahSelect.addEventListener('change', ()=> {
  loadSurah(surahSelect.value);
});

// speed control
speed.addEventListener('input', ()=> {
  speedLabel.textContent = speed.value + 'x';
  player.playbackRate = Number(speed.value);
});

// ambience file
ambFile.addEventListener('change', (e)=>{
  const f = e.target.files[0];
  if(!f) return;
  const url = URL.createObjectURL(f);
  ambience.src = url;
  setStatus('File ambience siap — tekan Nyalakan Ambience.');
});
ambToggle.addEventListener('click', ()=>{
  if(!started){ setStatus('Tekan START dulu supaya ambience dapat diputar.'); return; }
  if(ambience.paused){
    ambience.play().then(()=>{ setStatus('Ambience menyala'); ambToggle.textContent = '🔇 Matikan Ambience'; }).catch(e=>{ setStatus('Ambience diblokir oleh browser'); });
  } else {
    ambience.pause();
    ambToggle.textContent = '🔊 Nyalakan Ambience';
    setStatus('Ambience dimatikan');
  }
});

// init
loadSurahList();
setStatus('Siap. Tekan START kemudian pilih surah.');