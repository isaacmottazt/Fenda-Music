// ===== MOTOR DE ÁUDIO, SINCRONISMO E LETRAS .LRC (player-audio-lyrics.js) =====

function initAudioAndLyricsEngine() {
    if (!DOM.audio) return;

    DOM.audio.addEventListener('timeupdate', () => {
        const current = DOM.audio.currentTime;
        const duration = DOM.audio.duration || 0;

        if (duration > 0) {
            const pct = (current / duration) * 100;
            if (DOM.progressFill) DOM.progressFill.style.width = `${pct}%`;
            if (DOM.miniProgressBar) DOM.miniProgressBar.style.width = `${pct}%`;
        }

        if (DOM.currentTimeTxt) DOM.currentTimeTxt.textContent = formatTime(current);
        if (DOM.totalTimeTxt && duration > 0) DOM.totalTimeTxt.textContent = formatTime(duration);

        updateLyricsHighlight(current);
        
        if (navigator.mediaSession && navigator.mediaSession.setPositionState && duration && !DOM.audio.paused) {
            navigator.mediaSession.setPositionState({
                duration: duration,
                playbackRate: DOM.audio.playbackRate,
                position: current
            });
        }
    });

    DOM.audio.addEventListener('ended', () => {
        if (AppState.isRepeat) {
            DOM.audio.currentTime = 0;
            DOM.audio.play().catch(()=>{});
        } else {
            handleNextTrack();
        }
    });

    if (DOM.playerBottomPlayBtn) DOM.playerBottomPlayBtn.addEventListener('click', (e) => { e.stopPropagation(); togglePlayMusic(); });
    if (DOM.bigPlayBtn) DOM.bigPlayBtn.addEventListener('click', () => togglePlayMusic());

    
    const prevBtn = document.getElementById('prevBtn');
    
    if (prevBtn) prevBtn.addEventListener('click', () => handlePrevTrack());

    if (DOM.progressBar) {
        DOM.progressBar.addEventListener('click', (e) => {
            const rect = DOM.progressBar.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const width = rect.width;
            const duration = DOM.audio.duration || 0;
            if (duration > 0) {
                DOM.audio.currentTime = (clickX / width) * duration;
            }
        });
    }

    if (DOM.shuffleBtn) {
        DOM.shuffleBtn.addEventListener('click', () => {
            AppState.isShuffle = !AppState.isShuffle;
            DOM.shuffleBtn.classList.toggle('active', AppState.isShuffle);
        });
    }
    if (DOM.repeatBtn) {
        DOM.repeatBtn.addEventListener('click', () => {
            AppState.isRepeat = !AppState.isRepeat;
            DOM.repeatBtn.classList.toggle('active', AppState.isRepeat);
        });
    }

    const scroller = document.getElementById('lyricsScroller');
    if (scroller) {
        scroller.addEventListener('scroll', () => {
            AppState.isUserScrolling = true;
            clearTimeout(AppState.userScrollTimeout);
            AppState.userScrollTimeout = setTimeout(() => { AppState.isUserScrolling = false; }, 3000);
        });
    }

    // ===== Botão de compartilhar (movido para fora do timeupdate) =====
    const shareBtn = document.getElementById('shareMusicBtn');
    if (shareBtn && !shareBtn.hasAttribute('data-listener-added')) {
        shareBtn.setAttribute('data-listener-added', 'true');
        shareBtn.addEventListener('click', () => {
            const music = AppState.musics.find(m => m.id === AppState.currentMusicId);
            if (!music) {
                showToast("Nenhuma música tocando no momento", "danger");
                return;
            }
            const currentTime = DOM.audio ? Math.floor(DOM.audio.currentTime) : 0;
            const baseUrl = window.location.href.split('?')[0];
            const musicLink = `${baseUrl}?music_id=${music.id}&t=${currentTime}`;
            const text = `🎵 Estou ouvindo "${music.title}" - ${music.artist} ${currentTime ? `aos ${formatTime(currentTime)}` : ''}! 🎧\n\nOuça aqui: ${musicLink}`;
            
            if (navigator.share) {
                navigator.share({ title: music.title, text: `Ouça "${music.title}" - ${music.artist}`, url: musicLink });
            } else {
                navigator.clipboard.writeText(text);
                showToast("Link copiado! Compartilhe com os amigos.", "success");
            }
        });
    }
}

function parseLyrics(text) {
    if (!text) return [];
    const lines = text.split('\n');
    const result = [];
    const timeReg = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;

    lines.forEach(line => {
        const match = timeReg.exec(line);
        if (match) {
            const min = parseInt(match[1]);
            const sec = parseInt(match[2]);
            const ms = parseInt(match[3]);
            const time = min * 60 + sec + (ms > 99 ? ms / 1000 : ms / 100);
            const lyric = line.replace(timeReg, '').trim();
            if (lyric) result.push({ time, text: lyric });
        }
    });
    return result.sort((a, b) => a.time - b.time);
}

function buildLyricsMarkup() {
    if (!DOM.lyricsContainer) return;
    DOM.lyricsContainer.innerHTML = '';

    if (AppState.lyricsData.length === 0) {
        DOM.lyricsContainer.innerHTML = `<div class="lyric-line active" style="text-align:center; padding-top:40px;">Letra Instrumental ou Não Disponível</div>`;
        return;
    }

    AppState.lyricsData.forEach((line, index) => {
        const p = document.createElement('p');
        p.className = 'lyric-line';
        p.id = `lyric-line-${index}`;
        p.textContent = line.text;
        p.addEventListener('click', () => {
            if (DOM.audio) DOM.audio.currentTime = line.time;
        });
        DOM.lyricsContainer.appendChild(p);
    });
}

function updateLyricsHighlight(currentTime) {
    if (AppState.lyricsData.length === 0) return;
    
    let activeIndex = -1;
    for (let i = 0; i < AppState.lyricsData.length; i++) {
        if (currentTime >= AppState.lyricsData[i].time) {
            activeIndex = i;
        } else {
            break;
        }
    }

    if (activeIndex !== -1) {
        document.querySelectorAll('.lyric-line').forEach(el => el.classList.remove('active'));
        const activeLineEl = document.getElementById(`lyric-line-${activeIndex}`);
        if (activeLineEl) {
            activeLineEl.classList.add('active');
            const scroller = document.getElementById('lyricsScroller');
            if (scroller && !AppState.isUserScrolling) {
                const scrollerHeight = scroller.clientHeight;
                const lineTop = activeLineEl.offsetTop;
                const lineHeight = activeLineEl.clientHeight;
                scroller.scrollTop = lineTop - scrollerHeight / 2 + lineHeight / 2;
            }
        }
    }
}

function updatePlayerVisibility(music) {
    if (!music) return;
    if (DOM.playerBottomBar) DOM.playerBottomBar.style.display = 'flex';
    if (DOM.playerBottomCover) DOM.playerBottomCover.src = music.cover || 'https://via.placeholder.com/150';
    if (DOM.playerBottomTitle) DOM.playerBottomTitle.textContent = music.title;
    if (DOM.playerBottomArtist) DOM.playerBottomArtist.textContent = music.artist;

    if (DOM.lyricsTrackTitle) DOM.lyricsTrackTitle.textContent = music.title;
    if (DOM.lyricsTrackArtist) DOM.lyricsTrackArtist.textContent = music.artist;
}

function updatePlayerUIState() {
    const icon = AppState.playing ? 'pause' : 'play_arrow';
    if (DOM.playerBottomPlayBtn) DOM.playerBottomPlayBtn.innerHTML = `<span class="material-symbols-rounded">${icon}</span>`;
    if (DOM.bigPlayBtn) DOM.bigPlayBtn.innerHTML = `<span class="material-symbols-rounded">${icon}</span>`;

    document.querySelectorAll('.inline-play-btn').forEach(btn => {
        const cardId = parseInt(btn.getAttribute('data-id'));
        const card = btn.closest('.music-card');
        if (cardId === AppState.currentMusicId) {
            btn.classList.add('active-inline');
            if (AppState.playing) {
                btn.innerHTML = `<span class="material-symbols-rounded" style="font-size:16px;">pause</span>`;
                card?.classList.add('playing');
                card?.classList.remove('paused');
            } else {
                btn.innerHTML = `<span class="material-symbols-rounded" style="font-size:16px;">play_arrow</span>`;
                card?.classList.remove('playing');
                card?.classList.add('paused');
            }
        } else {
            btn.innerHTML = `<span class="material-symbols-rounded" style="font-size:16px;">play_arrow</span>`;
            btn.classList.remove('active-inline');
            card?.classList.remove('playing');
            card?.classList.remove('paused');
        }
    });
}

function updateMediaSession(music) {
    if (!navigator.mediaSession) return;
    
    navigator.mediaSession.metadata = new MediaMetadata({
        title: music.title,
        artist: music.artist,
        album: 'Fenda Music',
        artwork: [
            { src: music.cover, sizes: '96x96', type: 'image/jpeg' },
            { src: music.cover, sizes: '128x128', type: 'image/jpeg' },
            { src: music.cover, sizes: '192x192', type: 'image/jpeg' },
            { src: music.cover, sizes: '256x256', type: 'image/jpeg' }
        ]
    });

    navigator.mediaSession.setActionHandler('play', () => togglePlayMusic());
    navigator.mediaSession.setActionHandler('pause', () => togglePlayMusic());
    navigator.mediaSession.setActionHandler('previoustrack', () => handlePrevTrack());
    navigator.mediaSession.setActionHandler('nexttrack', () => handleNextTrack());
    navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (DOM.audio) DOM.audio.currentTime = details.seekTime;
    });
}

function expandLyricsScreen() { if (DOM.lyricsFullScreen) DOM.lyricsFullScreen.classList.add('expanded'); }
function collapseLyricsScreen() { if (DOM.lyricsFullScreen) DOM.lyricsFullScreen.classList.remove('expanded'); }

// Exportações (sem handleNextTrack/handlePrevTrack, pois já vêm do core)
window.initAudioAndLyricsEngine = initAudioAndLyricsEngine; 
window.parseLyrics = parseLyrics; 
window.buildLyricsMarkup = buildLyricsMarkup; 
window.updatePlayerVisibility = updatePlayerVisibility; 
window.updatePlayerUIState = updatePlayerUIState; 
window.expandLyricsScreen = expandLyricsScreen; 
window.collapseLyricsScreen = collapseLyricsScreen; 
window.updateMediaSession = updateMediaSession;