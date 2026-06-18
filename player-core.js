// ===== ESTADO GLOBAL COM FILA =====
const AppState = {
    musics: [],
    currentMusicId: null,
    playing: false,
    currentTab: 'inicio',
    lyricsData: [],
    artists: [],           // lista de artistas vinda do Supabase
    favorites: new Set(),
    userPlaylists: [],
    isShuffle: false,
    isRepeat: false,
    currentPlaylistFilter: null,
    selectedTrackForMenu: null,
    selectedPlaylistForMenu: null,
    playlistModalMode: 'create',
    isUserScrolling: false,
    userScrollTimeout: null,
    history: [],        // array de { id, title, artist, cover, listenedSeconds, playedAt }
    MAX_HISTORY: 50,
    queue: [],
    userId: null,
    userProfile: { full_name: '', avatar_url: null, bio: '' }
};

const DOM = {
    audio: document.getElementById('audio'),
    searchInput: document.getElementById('searchInput'),
    musicList: document.getElementById('musicList'),
    playlistsContainer: document.getElementById('playlistsContainer'),
    playlistsRootView: document.getElementById('playlistsRootView'),
    playlistDetailView: document.getElementById('playlistDetailView'),
    backToPlaylistsBtn: document.getElementById('backToPlaylistsBtn'),
    playerBottomBar: document.getElementById('playerBottomBar'),
    playerBottomCover: document.getElementById('playerBottomCover'),
    playerBottomTitle: document.getElementById('playerBottomTitle'),
    playerBottomArtist: document.getElementById('playerBottomArtist'),
    playerBottomPlayBtn: document.getElementById('playerBottomPlayBtn'),
    miniProgressBar: document.getElementById('miniProgressBar'),
    lyricsFullScreen: document.getElementById('lyricsFullScreen'),
    lyricsTrackTitle: document.getElementById('lyricsTrackTitle'),
    lyricsTrackArtist: document.getElementById('lyricsTrackArtist'),
    lyricsContainer: document.getElementById('lyricsContainer'),
    bigPlayBtn: document.getElementById('bigPlayBtn'),
    shuffleBtn: document.getElementById('shuffleBtn'),
    repeatBtn: document.getElementById('repeatBtn'),
    progressBar: document.getElementById('progressBar'),
    progressFill: document.getElementById('progressFill'),
    currentTimeTxt: document.getElementById('currentTime'),
    totalTimeTxt: document.getElementById('totalTime'),
    playlistModal: document.getElementById('playlistModal'),
    newPlaylistName: document.getElementById('newPlaylistName'),
    confirmModalBtn: document.getElementById('confirmModalBtn'),
    cancelModalBtn: document.getElementById('cancelModalBtn'),
    homeTitle: document.getElementById('homeTitle')
};

// ===== HISTÓRICO LOCAL + SUPABASE =====

// Chave do localStorage por usuário
function _historyKey() { return `fenda_history_${AppState.userId}`; }
function _totalTimeKey() { return `fenda_totaltime_${AppState.userId}`; }
function _userNameKey() { return `fenda_username_${AppState.userId}`; }

// Carrega histórico local
function loadLocalHistory() {
    try {
        const raw = localStorage.getItem(_historyKey());
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

// Salva histórico local
function saveLocalHistory(history) {
    try {
        localStorage.setItem(_historyKey(), JSON.stringify(history.slice(0, 50)));
    } catch(e) { console.warn('[Cache] Erro ao salvar histórico:', e); }
}

// Salva tempo total ouvido (em segundos)
function addToTotalTime(seconds) {
    try {
        const key = _totalTimeKey();
        const current = parseInt(localStorage.getItem(key) || '0');
        localStorage.setItem(key, String(current + seconds));
    } catch {}
}

// Retorna tempo total ouvido formatado
function getTotalListenedTime() {
    try {
        const secs = parseInt(localStorage.getItem(_totalTimeKey()) || '0');
        const hours = Math.floor(secs / 3600);
        const mins = Math.floor((secs % 3600) / 60);
        if (hours > 0) return `${hours}h ${mins}min`;
        return `${mins}min`;
    } catch { return '0min'; }
}

// Salva nome do usuário localmente
function saveLocalUserName(name, email) {
    try {
        if (AppState.userId) {
            localStorage.setItem(_userNameKey(), JSON.stringify({ name, email, savedAt: Date.now() }));
        }
    } catch {}
}

// Carrega nome do usuário local
function loadLocalUserName() {
    try {
        const raw = localStorage.getItem(_userNameKey());
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

async function addToHistory(music, listenedSeconds = 0) {
    if (!music) return;

    // 1. Salva SEMPRE no localStorage (funciona offline)
    const history = loadLocalHistory();
    const existingIndex = history.findIndex(h => h.id === music.id);
    if (existingIndex !== -1) history.splice(existingIndex, 1);
    history.unshift({
        id: music.id,
        title: music.title,
        artist: music.artist,
        cover: music.cover,
        listenedSeconds,
        playedAt: Date.now()
    });
    saveLocalHistory(history);

    // 2. Atualiza tempo total ouvido localmente
    if (listenedSeconds > 5) addToTotalTime(listenedSeconds);

    // 3. Atualiza AppState imediatamente
    AppState.history = history;

    // 4. Tenta salvar no Supabase em background (não bloqueia)
    if (AppState.userId && navigator.onLine) {
        window.addToListeningHistory?.(AppState.userId, music.id, listenedSeconds)
            .catch(() => console.warn('[Cache] Histórico não sincronizado (offline)'));
    }
}

window.getTotalListenedTime = getTotalListenedTime;
window.loadLocalHistory = loadLocalHistory;
window.saveLocalUserName = saveLocalUserName;
window.loadLocalUserName = loadLocalUserName;

let playCounts = JSON.parse(localStorage.getItem('play_counts') || '{}');
function incrementPlayCount(musicId) {
    playCounts[musicId] = (playCounts[musicId] || 0) + 1;
    localStorage.setItem('play_counts', JSON.stringify(playCounts));
}


// ===================================================
// ===== SISTEMA DE CACHE LOCAL (IndexedDB) ==========
// ===================================================
const CACHE_VERSION = 2;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutos

const CacheDB = {
    _db: null,

    async open() {
        if (this._db) return this._db;
        return new Promise((resolve, reject) => {
            const req = indexedDB.open('FendaMusicAppCache', CACHE_VERSION);
            req.onerror = () => reject(req.error);
            req.onsuccess = () => { this._db = req.result; resolve(this._db); };
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                // Usa out-of-line keys para suportar qualquer tipo de id (UUID, int, etc.)
                ['musics','playlists','artists','favorites','history','profile','searchHistory'].forEach(store => {
                    if (!db.objectStoreNames.contains(store))
                        db.createObjectStore(store);
                });
                if (!db.objectStoreNames.contains('meta'))
                    db.createObjectStore('meta', { keyPath: 'key' });
            };
        });
    },

    async setMeta(key, value) {
        const db = await this.open();
        return new Promise((res, rej) => {
            const tx = db.transaction('meta', 'readwrite');
            tx.objectStore('meta').put({ key, value, updatedAt: Date.now() });
            tx.oncomplete = () => res(true);
            tx.onerror = () => rej(tx.error);
        });
    },

    async getMeta(key) {
        const db = await this.open();
        return new Promise((res) => {
            const tx = db.transaction('meta', 'readonly');
            const req = tx.objectStore('meta').get(key);
            req.onsuccess = () => res(req.result?.value ?? null);
            req.onerror = () => res(null);
        });
    },

    async saveList(storeName, items) {
        const db = await this.open();
        return new Promise((res, rej) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            store.clear();
            // Usa índice numérico como chave para evitar conflito com UUIDs
            items.forEach((item, i) => store.put(item, i));
            tx.oncomplete = () => res(true);
            tx.onerror = () => rej(tx.error);
        });
    },

    async getList(storeName) {
        const db = await this.open();
        return new Promise((res) => {
            const tx = db.transaction(storeName, 'readonly');
            const req = tx.objectStore(storeName).getAll(); // getAll() funciona com out-of-line keys
            req.onsuccess = () => res(req.result ?? []);
            req.onerror = () => res([]);
        });
    },

    async saveSingle(storeName, obj) {
        return this.saveList(storeName, [obj]);
    },

    async getSingle(storeName) {
        const list = await this.getList(storeName);
        return list[0] ?? null;
    },

    async isFresh(userId) {
        const cachedUserId = await this.getMeta('userId');
        const cachedAt = await this.getMeta('cachedAt');
        if (!cachedAt || !cachedUserId) return false;
        if (cachedUserId !== userId) return false;
        return (Date.now() - cachedAt) < CACHE_TTL_MS;
    },

    async saveAll({ musics, artists, playlists, favorites, history, profile, searchHistory, userId }) {
        try {
            await Promise.all([
                this.saveList('musics', musics || []),
                this.saveList('artists', artists || []),
                this.saveList('playlists', playlists || []),
                this.saveList('favorites', (favorites || []).map((id, i) => ({ id: i, musicId: id }))),
                this.saveList('history', (history || []).map((h, i) => ({ ...h, id: i }))),
                this.saveSingle('profile', profile || {}),
                this.saveList('searchHistory', (searchHistory || []).map((t, i) => ({ id: i, term: t }))),
                this.setMeta('userId', userId),
                this.setMeta('cachedAt', Date.now()),
            ]);
            console.log('[Cache] ✅ Dados salvos');
            return true;
        } catch (e) {
            console.warn('[Cache] ⚠️ Erro ao salvar:', e);
            return false;
        }
    },

    async loadAll() {
        try {
            const [musics, artists, playlists, favRows, history, profile, searchRows] = await Promise.all([
                this.getList('musics'),
                this.getList('artists'),
                this.getList('playlists'),
                this.getList('favorites'),
                this.getList('history'),
                this.getSingle('profile'),
                this.getList('searchHistory'),
            ]);
            return {
                musics,
                artists,
                playlists,
                favorites: favRows.map(r => r.musicId),
                history,
                profile: profile || {},
                searchHistory: searchRows.map(r => r.term),
            };
        } catch (e) {
            console.warn('[Cache] ⚠️ Erro ao carregar:', e);
            return null;
        }
    },

    async clear() {
        try {
            const db = await this.open();
            const stores = ['musics','artists','playlists','favorites','history','profile','searchHistory','meta'];
            return new Promise((res) => {
                const tx = db.transaction(stores, 'readwrite');
                stores.forEach(s => tx.objectStore(s).clear());
                tx.oncomplete = () => res(true);
                tx.onerror = () => res(false);
            });
        } catch(e) { return false; }
    }
};

window.CacheDB = CacheDB;

// ===== CACHE OFFLINE DE ÁUDIO =====
const DB_NAME = 'FendaMusicAudio_v4'; // nome novo = banco novo, sem conflito com versões antigas
const DB_VERSION = 1;
let db = null;

function openCacheDB() {
    return new Promise((resolve, reject) => {
        if (db) return resolve(db);
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => { db = request.result; resolve(db); };
        request.onupgradeneeded = (e) => {
            const database = e.target.result;
            // Out-of-line keys: put(value, key) — chave passada separada do objeto
            if (!database.objectStoreNames.contains('audio'))
                database.createObjectStore('audio');
            if (!database.objectStoreNames.contains('metadata'))
                database.createObjectStore('metadata');
        };
    });
}

// Verifica se uma música está salva offline
async function isMusicCached(musicId) {
    try {
        const database = await openCacheDB();
        return new Promise((resolve) => {
            const tx = database.transaction('metadata', 'readonly');
            const req = tx.objectStore('metadata').get(musicId);
            req.onsuccess = () => resolve(!!req.result);
            req.onerror = () => resolve(false);
        });
    } catch { return false; }
}

// Baixa e salva a música no IndexedDB com progresso
async function cacheAudio(music) {
    const url = music.src;
    const musicId = music.id;
    try {
        showToast('Baixando música...', 'success');

        const response = await fetch(url);
        if (!response.ok) throw new Error('Falha ao baixar áudio');

        // Lê com progresso se possível
        const contentLength = response.headers.get('Content-Length');
        let blob;
        if (contentLength && response.body) {
            const total = parseInt(contentLength);
            const reader = response.body.getReader();
            const chunks = [];
            let received = 0;
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
                received += value.length;
                const pct = Math.round((received / total) * 100);
                showToast(`Baixando... ${pct}%`, 'success');
            }
            blob = new Blob(chunks);
        } else {
            blob = await response.blob();
        }

        const database = await openCacheDB();
        await new Promise((resolve, reject) => {
            const tx = database.transaction(['audio', 'metadata'], 'readwrite');
            // put(value, key) — chave fora do objeto, funciona com int e UUID
            tx.objectStore('audio').put({ blob }, musicId);
            tx.objectStore('metadata').put({
                musicId,
                title: music.title,
                artist: music.artist,
                cover: music.cover,
                url,
                size: blob.size,
                cachedAt: Date.now()
            }, musicId);
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });

        showToast(`"${music.title}" salva para ouvir offline!`, 'success');
        // Atualiza ícone do botão de download na UI
        _updateDownloadBtn(musicId, true);
        return true;
    } catch (err) {
        showToast('Erro ao salvar: ' + err.message, 'danger');
        return false;
    }
}

// Remove música do cache offline
async function removeCachedAudio(musicId) {
    try {
        const database = await openCacheDB();
        await new Promise((resolve, reject) => {
            const tx = database.transaction(['audio', 'metadata'], 'readwrite');
            tx.objectStore('audio').delete(musicId);
            tx.objectStore('metadata').delete(musicId);
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
        showToast('Música removida do armazenamento offline', 'success');
        _updateDownloadBtn(musicId, false);
        return true;
    } catch (err) {
        showToast('Erro ao remover: ' + err.message, 'danger');
        return false;
    }
}

// Retorna todas as músicas salvas offline (para tela de gerenciamento)
async function getAllCachedMusics() {
    try {
        const database = await openCacheDB();
        return new Promise((resolve) => {
            const tx = database.transaction('metadata', 'readonly');
            const req = tx.objectStore('metadata').getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
        });
    } catch { return []; }
}

// Retorna o blob URL da música cacheada (para reprodução)
async function getCachedAudioUrl(music) {
    try {
        const database = await openCacheDB();
        const record = await new Promise((resolve) => {
            const tx = database.transaction('audio', 'readonly');
            const req = tx.objectStore('audio').get(music.id);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
        });
        if (record && record.blob) return URL.createObjectURL(record.blob);
        // Compatibilidade: algumas versões salavam o blob direto
        if (record instanceof Blob) return URL.createObjectURL(record);
        return null;
    } catch { return null; }
}

// Atualiza visualmente o botão de download na tela
function _updateDownloadBtn(musicId, isCached) {
    const btn = document.querySelector(`[data-download-id="${musicId}"]`);
    if (!btn) return;
    btn.innerHTML = isCached
        ? '<span class="material-symbols-rounded">download_done</span>'
        : '<span class="material-symbols-rounded">download</span>';
    btn.title = isCached ? 'Remover download' : 'Baixar para ouvir offline';
    btn.dataset.cached = isCached ? '1' : '0';
}

// Toggle: baixa se não tem, remove se já tem
async function toggleOfflineMusic(music) {
    const cached = await isMusicCached(music.id);
    if (cached) {
        await removeCachedAudio(music.id);
    } else {
        await cacheAudio(music);
    }
}

// ===== FILA (sem mudanças) =====
function addToQueue(music, insertNext = false) {
    if (!music) return;
    if (insertNext) {
        const currentIndex = AppState.queue.findIndex(m => m.id === AppState.currentMusicId);
        AppState.queue.splice(currentIndex + 1, 0, music);
    } else {
        AppState.queue.push(music);
    }
    if (typeof window.renderQueue === 'function') window.renderQueue();
    showToast(`${music.title} adicionado${insertNext ? ' à seguir' : ' à fila'}`, "success");
}

function removeFromQueue(index) {
    if (index >= 0 && index < AppState.queue.length) {
        const removed = AppState.queue.splice(index, 1)[0];
        if (typeof window.renderQueue === 'function') window.renderQueue();
        showToast(`${removed.title} removido da fila`, "danger");
    }
}

function clearQueue() {
    AppState.queue = [];
    if (typeof window.renderQueue === 'function') window.renderQueue();
    showToast("Fila limpa", "success");
}

function playNextFromQueue() {
    if (AppState.queue.length > 0) {
        const next = AppState.queue.shift();
        if (typeof window.renderQueue === 'function') window.renderQueue();
        playMusicTrack(next);
        return true;
    }
    return false;
}

// ===== REPRODUÇÃO =====
let currentListenStartTime = 0;
let currentListenMusicId = null;

async function playMusicTrack(music) {
    if (!DOM.audio || !music) return;
    
    // Salva o tempo ouvido da música anterior
    if (currentListenMusicId && DOM.audio.currentTime > 0) {
        const elapsed = Math.floor(DOM.audio.currentTime);
        await addToHistory(AppState.musics.find(m => m.id === currentListenMusicId), elapsed);
    }
    
    const isDifferentTrack = AppState.currentMusicId !== music.id;
    AppState.currentMusicId = music.id;
    AppState.playing = true;
    currentListenMusicId = music.id;
    currentListenStartTime = Date.now();

    incrementPlayCount(music.id);

    let audioUrl = music.src;
    const cachedBlobUrl = await getCachedAudioUrl(music);
    if (cachedBlobUrl) audioUrl = cachedBlobUrl;

    if (isDifferentTrack) {
        DOM.audio.src = audioUrl;
        let rawLyricsText = "";
        if (music.lrc && (music.lrc.startsWith('http://') || music.lrc.startsWith('https://'))) {
            try {
                const response = await fetch(music.lrc);
                if (response.ok) rawLyricsText = await response.text();
                else rawLyricsText = "[00:00.00] Letra indisponível.";
            } catch (err) {
                rawLyricsText = "[00:00.00] Erro ao carregar letra.";
            }
        } else { rawLyricsText = music.lrc || ""; }
        if (typeof window.parseLyrics === 'function') AppState.lyricsData = window.parseLyrics(rawLyricsText);
        if (typeof window.buildLyricsMarkup === 'function') window.buildLyricsMarkup();
    }

    DOM.audio.play()
        .then(() => {
            if (typeof window.updatePlayerVisibility === 'function') window.updatePlayerVisibility(music);
            if (typeof window.updatePlayerUIState === 'function') window.updatePlayerUIState();
            if (typeof window.updateMediaSession === 'function') window.updateMediaSession(music);
        })
        .catch(() => {
            AppState.playing = false;
            if (typeof window.updatePlayerUIState === 'function') window.updatePlayerUIState();
        });
}

function togglePlayMusic(music) {
    if (!DOM.audio) return;
    if (!music) music = AppState.musics.find(m => m.id === AppState.currentMusicId);
    if (!music) return;
    if (AppState.currentMusicId !== music.id) { playMusicTrack(music); return; }
    if (AppState.playing) { DOM.audio.pause(); AppState.playing = false; }
    else { DOM.audio.play().catch(()=>{}); AppState.playing = true; }
    if (typeof window.updatePlayerUIState === 'function') window.updatePlayerUIState();
}

function handleNextTrack() {
    if (AppState.queue.length > 0) {
        const nextMusic = AppState.queue.shift();
        if (typeof window.renderQueue === 'function') window.renderQueue();
        playMusicTrack(nextMusic);
        return;
    }
    if (AppState.musics.length === 0) return;
    let nextIndex = 0;
    if (AppState.isShuffle) {
        nextIndex = Math.floor(Math.random() * AppState.musics.length);
    } else {
        const currentIdx = AppState.musics.findIndex(m => m.id === AppState.currentMusicId);
        nextIndex = (currentIdx + 1) % AppState.musics.length;
    }
    playMusicTrack(AppState.musics[nextIndex]);
}

function handlePrevTrack() {
    if (AppState.musics.length === 0) return;
    const currentIdx = AppState.musics.findIndex(m => m.id === AppState.currentMusicId);
    let prevIndex = currentIdx - 1;
    if (prevIndex < 0) prevIndex = AppState.musics.length - 1;
    playMusicTrack(AppState.musics[prevIndex]);
}

function formatTime(secs) {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    container.innerHTML = ''; 
    const toast = document.createElement('div');
    toast.className = `premium-toast ${type}`;
    const icon = type === 'success' ? 'check_circle' : 'error';
    toast.innerHTML = `<span class="material-symbols-rounded">${icon}</span><p style="margin:0;">${message}</p>`;
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 3000);
}

// ===== NAVEGAÇÃO POR ABAS =====
function initTabs() {
    const navButtons = document.querySelectorAll('.nav-bar .nav-btn');
    const tabContents = document.querySelectorAll('.main-content .tab-content');
    if (navButtons.length === 0) return;
    function switchTab(tabId, btn) {
        if (!tabId) return;
        if (typeof window.closePlaylistDetail === 'function') window.closePlaylistDetail();
        navButtons.forEach(b => b.classList.remove('active'));
        tabContents.forEach(t => t.classList.remove('active'));
        if (btn) btn.classList.add('active');
        const activeTab = document.getElementById(tabId);
        if (activeTab) activeTab.classList.add('active');
        AppState.currentTab = tabId;
        if (tabId === 'inicio' && typeof window.renderHome === 'function') window.renderHome();
        if (tabId === 'buscar' && typeof window.initSearch === 'function') window.initSearch();
        if (tabId === 'biblioteca' && typeof window.renderLibrary === 'function') window.renderLibrary();
        if (tabId === 'perfil' && typeof window.renderProfile === 'function') window.renderProfile();
    }
    navButtons.forEach(btn => {
        const tabId = btn.getAttribute('data-tab');
        const handler = (e) => { e.preventDefault(); e.stopPropagation(); switchTab(tabId, btn); };
        btn.removeEventListener('click', handler);
        btn.removeEventListener('touchstart', handler);
        btn.addEventListener('click', handler);
        btn.addEventListener('touchstart', handler, { passive: false });
    });
}

function initKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
        const tag = e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        switch(e.key) {
            case ' ': case 'Space': e.preventDefault(); togglePlayMusic(); break;
            case 'ArrowLeft': e.preventDefault(); handlePrevTrack(); break;
            case 'ArrowRight': e.preventDefault(); handleNextTrack(); break;
            case 'f': case 'F': if (typeof window.expandLyricsScreen === 'function') window.expandLyricsScreen(); break;
            case 'Escape': const lyricsScreen = document.getElementById('lyricsFullScreen'); if (lyricsScreen && lyricsScreen.classList.contains('expanded') && typeof window.collapseLyricsScreen === 'function') window.collapseLyricsScreen(); break;
        }
    });
}

// ===== CARREGAR DADOS INICIAIS DO USUÁRIO =====
async function loadInitialData() {
    // ── PASSO 1: carrega o que tiver no cache IMEDIATAMENTE ─────────
    // (Independente de estar online ou offline, e independente do TTL)
    await _loadAllFromCache();

    // ── PASSO 2: se online, atualiza em background ──────────────────
    if (navigator.onLine) {
        console.log('[Cache] 🌐 Online — atualizando dados em background...');
        _fetchAllFromSupabase().then(() => {
            if (typeof window.renderHome === 'function') window.renderHome();
            if (typeof window.renderLibrary === 'function') window.renderLibrary();
            if (typeof window.renderProfile === 'function') window.renderProfile();
        }).catch(e => console.warn('[Cache] Falha ao atualizar online:', e));
    } else {
        console.log('[Cache] 📴 Offline — usando dados do cache');
    }
}

async function _fetchAllFromSupabase() {
    // ── Se offline, carrega tudo do cache e para por aqui ───────────
    if (!navigator.onLine) {
        console.log('[Cache] 📴 Offline — carregando tudo do cache local...');
        await _loadAllFromCache();
        return;
    }

    // ── Online: busca do Supabase ────────────────────────────────────
    const supabasePromise = (async () => {
        if (typeof window.loadMusicsFromSupabase === 'function') {
            try { return await window.loadMusicsFromSupabase(); } catch (err) { return []; }
        }
        return [];
    })();
    const localDataPromise = new Promise(resolve => {
        const local = localStorage.getItem('supabase_player_fallback');
        resolve(local ? JSON.parse(local) : []);
    });
    const [musicsFromSupabase, localData] = await Promise.all([supabasePromise, localDataPromise]);
    const allMusics = [...musicsFromSupabase, ...localData];
    const uniqueMusics = [];
    const ids = new Set();
    for (const m of allMusics) { if (!ids.has(m.id)) { ids.add(m.id); uniqueMusics.push(m); } }
    AppState.musics = uniqueMusics;

    // Sincroniza e carrega artistas
    if (typeof window.syncArtistsFromMusics === 'function') {
        await window.syncArtistsFromMusics(AppState.musics);
    }
    AppState.artists = typeof window.loadAllArtists === 'function'
        ? await window.loadAllArtists()
        : [];

    // Dados do usuário
    let profile = {}, playlists = [], history = [], favorites = [], searchTerms = [];
    if (AppState.userId) {
        const [p, pl, hi, fav, st] = await Promise.all([
            window.getUserProfile(AppState.userId),
            window.loadUserPlaylists(AppState.userId),
            window.loadListeningHistory(AppState.userId, 20),
            window.loadUserFavorites(AppState.userId),
            window.loadSearchHistory(AppState.userId, 5)
        ]);
        profile      = p   || {};
        playlists    = pl  || [];
        favorites    = fav || [];
        searchTerms  = st  || [];
        AppState.userProfile   = profile;
        AppState.userPlaylists = playlists;
        AppState.favorites     = new Set(favorites);
        AppState.history = (hi || []).map(h => ({
            id: h.music_id,
            title:  AppState.musics.find(m => m.id === h.music_id)?.title  || '',
            artist: AppState.musics.find(m => m.id === h.music_id)?.artist || '',
            cover:  AppState.musics.find(m => m.id === h.music_id)?.cover  || '',
            listenedSeconds: h.listened_seconds,
            playedAt: new Date(h.played_at).getTime()
        }));
        window.recentSearchesGlobal = searchTerms;
        if (typeof window.renderRecentSearches === 'function') window.renderRecentSearches();
    }

    // ── Salva tudo no cache para a próxima vez ────────────────────────
    if (AppState.userId) {
        CacheDB.saveAll({
            musics:        AppState.musics,
            artists:       AppState.artists,
            playlists:     AppState.userPlaylists,
            favorites:     [...AppState.favorites],
            history:       AppState.history,
            profile:       AppState.userProfile,
            searchHistory: searchTerms,
            userId:        AppState.userId,
        });
    }
}

// Carrega tudo do cache local (IndexedDB + localStorage)
async function _loadAllFromCache() {
    // 1. CacheDB (músicas, artistas, playlists, favoritos do Supabase)
    const cached = await CacheDB.loadAll();
    if (cached) {
        AppState.musics        = cached.musics    || [];
        AppState.artists       = cached.artists   || [];
        AppState.userPlaylists = cached.playlists || [];
        AppState.favorites     = new Set(cached.favorites || []);
        if (cached.profile && cached.profile.full_name) {
            AppState.userProfile = cached.profile;
        }
    }

    // 2. UserCacheDB (perfil, playlists, favoritos, histórico do Supabase)
    if (AppState.userId && window.UserCacheDB) {
        const [profile, playlists, favorites, history, searchTerms] = await Promise.all([
            window.UserCacheDB.get('profile',       AppState.userId),
            window.UserCacheDB.get('playlists',     AppState.userId),
            window.UserCacheDB.get('favorites',     AppState.userId),
            window.UserCacheDB.get('history',       AppState.userId),
            window.UserCacheDB.get('searchHistory', AppState.userId),
        ]);
        if (profile)     AppState.userProfile   = profile;
        if (playlists)   AppState.userPlaylists = playlists;
        if (favorites)   AppState.favorites     = new Set(favorites);
        if (searchTerms) {
            window.recentSearchesGlobal = searchTerms;
            if (typeof window.renderRecentSearches === 'function') window.renderRecentSearches();
        }
        // Histórico do Supabase cache (se localStorage não tiver)
        if (history && history.length > 0 && AppState.history.length === 0) {
            AppState.history = history.map(h => ({
                id: h.music_id,
                title:  AppState.musics.find(m => m.id === h.music_id)?.title  || '',
                artist: AppState.musics.find(m => m.id === h.music_id)?.artist || '',
                cover:  AppState.musics.find(m => m.id === h.music_id)?.cover  || '',
                listenedSeconds: h.listened_seconds || 0,
                playedAt: h.played_at ? new Date(h.played_at).getTime() : Date.now()
            }));
        }
    }

    // 3. Histórico local (localStorage — sempre mais atualizado)
    const localHistory = loadLocalHistory();
    if (localHistory.length > 0) AppState.history = localHistory;

    // 4. Nome do usuário do localStorage
    const localUser = loadLocalUserName();
    if (localUser && (!AppState.userProfile?.full_name)) {
        AppState.userProfile = { ...AppState.userProfile, full_name: localUser.name };
        localStorage.setItem('user_email', localUser.email);
    }

    // 5. Músicas baixadas offline — adiciona ao AppState.musics se não estiver
    if (window.getAllCachedMusics) {
        const cachedMusics = await window.getAllCachedMusics();
        cachedMusics.forEach(meta => {
            const alreadyIn = AppState.musics.find(m => m.id === meta.musicId);
            if (!alreadyIn) {
                AppState.musics.push({
                    id: meta.musicId,
                    title: meta.title,
                    artist: meta.artist,
                    cover: meta.cover,
                    src: meta.url,
                    _offlineOnly: true
                });
            }
        });
    }

    console.log('[Cache] ✅ Carregado offline:', {
        músicas: AppState.musics.length,
        playlists: AppState.userPlaylists.length,
        favoritos: AppState.favorites.size,
        histórico: AppState.history.length,
        nome: AppState.userProfile?.full_name
    });
}

// Atualiza silenciosamente em background sem travar a UI
async function _refreshFromSupabaseInBackground() {
    try {
        await _fetchAllFromSupabase();
        // Re-renderiza as telas com dados frescos
        if (typeof window.renderHome === 'function') window.renderHome();
        if (typeof window.renderLibrary === 'function') window.renderLibrary();
        if (typeof window.renderProfile === 'function') window.renderProfile();
        console.log('[Cache] 🔄 Dados atualizados em background');
    } catch(e) {
        console.warn('[Cache] Background refresh falhou (offline?):', e);
    }
}

async function initApp() {
    await loadInitialData();
    if (typeof window.renderHome === 'function') window.renderHome();
    if (typeof window.renderLibrary === 'function') window.renderLibrary();
    if (typeof window.renderProfile === 'function') window.renderProfile();
    if (typeof window.renderQueue === 'function') window.renderQueue();
    if (typeof window.initSearch === 'function') window.initSearch();
}

function checkDeepLink() {
    const urlParams = new URLSearchParams(window.location.search);
    const musicId = urlParams.get('music_id');
    const timestamp = parseInt(urlParams.get('t')) || 0;
    if (musicId && AppState.musics.length > 0) {
        const targetMusic = AppState.musics.find(m => m.id == musicId);
        if (targetMusic) {
            setTimeout(() => {
                playMusicTrack(targetMusic);
                if (timestamp > 0 && DOM.audio) { DOM.audio.addEventListener('loadedmetadata', () => { DOM.audio.currentTime = timestamp; }, { once: true }); }
                showToast(`Tocando: ${targetMusic.title}${timestamp ? ` a partir de ${formatTime(timestamp)}` : ''}`, "success");
            }, 500);
        } else showToast("Música não encontrada", "danger");
    }
}

function calculateTotalMinutesListened() {
    // Usa o tempo total acumulado no localStorage (mais preciso)
    if (AppState.userId) {
        const key = `fenda_totaltime_${AppState.userId}`;
        const secs = parseInt(localStorage.getItem(key) || '0');
        if (secs > 0) return Math.floor(secs / 60);
    }
    // Fallback: soma do histórico atual
    let totalSeconds = 0;
    AppState.history.forEach(item => totalSeconds += item.listenedSeconds || 0);
    return Math.floor(totalSeconds / 60);
}

// ===== INICIALIZAÇÃO PRINCIPAL (COM CRIAÇÃO DE PERFIL AUTOMÁTICA) =====
document.addEventListener('DOMContentLoaded', async () => {

    // ✅ PASSO 1: inicializa abas e UI imediatamente, sem esperar nada
    initTabs();
    initKeyboardShortcuts();
    if (typeof window.initMenusAndSearch === 'function') window.initMenusAndSearch();
    if (typeof window.setupPlaylistModal === 'function') window.setupPlaylistModal();
    if (typeof window.setupPlaylistDetailEvents === 'function') window.setupPlaylistDetailEvents();
    if (typeof window.initAudioAndLyricsEngine === 'function') window.initAudioAndLyricsEngine();

    // Configura botão da fila (se existir)
    const queueBtn = document.getElementById('playerBottomQueueBtn');
    if (queueBtn) {
        queueBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const modal = document.getElementById('queueModal');
            if (modal) {
                if (typeof window.renderQueue === 'function') window.renderQueue();
                modal.classList.add('active');
            }
        });
    }

    // ✅ PASSO 2: agora verifica sessão em paralelo
    const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
    
    if (sessionError) {
        console.error('Erro ao obter sessão:', sessionError);
        window.location.href = 'login.html';
        return;
    }
    
    if (!session) {
        window.location.href = 'login.html';
        return;
    }
    
    // Armazena o ID do usuário logado
    AppState.userId = session.user.id;
    
    // === GARANTE QUE O PERFIL EXISTE (CRIA SE NÃO EXISTIR) ===
    const userEmail = session.user.email;
    // Nome vindo do Google (ou outro provider) - fallback para parte do email
    const userName = session.user.user_metadata?.full_name || 
                     session.user.user_metadata?.name || 
                     userEmail.split('@')[0];
    
    async function ensureProfileExists() {
        try {
            // Verifica se já existe um perfil para este usuário
            const { data: existing, error: selectError } = await supabaseClient
                .from('profiles')
                .select('id')
                .eq('id', AppState.userId)
                .maybeSingle(); // não lança erro se não achar
            
            if (selectError && selectError.code !== 'PGRST116') {
                console.error('Erro ao verificar perfil:', selectError);
                return false;
            }
            
            if (!existing) {
                // Cria o perfil
                const { error: insertError } = await supabaseClient
                    .from('profiles')
                    .insert([{
                        id: AppState.userId,
                        full_name: userName,
                        email: userEmail,
                        bio: 'Apaixonado por música.',
                        avatar_url: null,
                        created_at: new Date(),
                        updated_at: new Date()
                    }]);
                
                if (insertError) {
                    console.error('Erro ao criar perfil:', insertError);
                    return false;
                }
                console.log('✅ Perfil criado para:', userName);
                return true;
            }
            return true;
        } catch (err) {
            console.error('Falha inesperada em ensureProfileExists:', err);
            return false;
        }
    }
    
    // ✅ PASSO 3: salva userId e email no localStorage para acesso offline
    localStorage.setItem('user_email', userEmail);
    localStorage.setItem('fenda_userId', AppState.userId);

    // Carrega histórico local imediatamente (antes de qualquer chamada de rede)
    const localHistory = loadLocalHistory();
    if (localHistory.length > 0) {
        AppState.history = localHistory;
    }

    // Carrega nome do usuário do cache local imediatamente
    const localUser = loadLocalUserName();
    if (localUser) {
        AppState.userProfile = { full_name: localUser.name, email: localUser.email };
        localStorage.setItem('user_name', localUser.name);
    }

    if (navigator.onLine) {
        // Online: garante perfil e carrega dados frescos
        try {
            await ensureProfileExists();
            const profileData = await window.getUserProfile(AppState.userId);
            AppState.userProfile = profileData;
            localStorage.setItem('user_name', profileData.full_name || userName);
            saveLocalUserName(profileData.full_name || userName, userEmail);
        } catch(e) {
            console.warn('[Cache] Não foi possível carregar perfil online:', e);
            if (!AppState.userProfile?.full_name) {
                AppState.userProfile = { full_name: userName, email: userEmail };
            }
        }
    } else {
        // Offline: usa dados locais
        console.log('[Cache] 📴 Offline no login — usando dados locais');
        if (!AppState.userProfile?.full_name) {
            AppState.userProfile = { full_name: userName, email: userEmail };
        }
    }

    await initApp();
    checkDeepLink();
});

function showConfirmDialog(title, message, onConfirm, onCancel) {
    const modal = document.getElementById('confirmModal');
    const titleEl = document.getElementById('confirmModalTitle');
    const messageEl = document.getElementById('confirmModalMessage');
    const cancelBtn = document.getElementById('confirmModalCancelBtn');
    const okBtn = document.getElementById('confirmModalOkBtn');
    
    if (!modal) return;
    
    titleEl.innerText = title;
    messageEl.innerText = message;
    
    function closeModal() {
        modal.classList.remove('active');
        cancelBtn.removeEventListener('click', cancelHandler);
        okBtn.removeEventListener('click', okHandler);
    }
    
    function cancelHandler() {
        if (onCancel) onCancel();
        closeModal();
    }
    
    function okHandler() {
        if (onConfirm) onConfirm();
        closeModal();
    }
    
    cancelBtn.addEventListener('click', cancelHandler);
    okBtn.addEventListener('click', okHandler);
    
    modal.classList.add('active');
}

window.showConfirmDialog = showConfirmDialog;

window.AppState = AppState;
window.DOM = DOM;
window.playMusicTrack = playMusicTrack;
window.togglePlayMusic = togglePlayMusic;
window.showToast = showToast;
window.handleNextTrack = handleNextTrack;
window.handlePrevTrack = handlePrevTrack;
window.formatTime = formatTime;
window.cacheAudio = cacheAudio;
window.getCachedAudioUrl = getCachedAudioUrl;
window.isMusicCached = isMusicCached;
window.removeCachedAudio = removeCachedAudio;
window.getAllCachedMusics = getAllCachedMusics;
window.toggleOfflineMusic = toggleOfflineMusic;
window.addToQueue = addToQueue;
window.removeFromQueue = removeFromQueue;
window.clearQueue = clearQueue;
window.calculateTotalMinutesListened = calculateTotalMinutesListened;
window.addToHistory = addToHistory; // expor para outras funções
window.CacheDB = CacheDB;
window.clearAppCache = async () => {
    await CacheDB.clear();
    console.log('[Cache] 🗑️ Cache apagado');
};