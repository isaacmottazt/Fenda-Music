// ===== INTERFACE DAS NOVAS ABAS (player-ui.js completo) =====

function updateFeaturedMusic() {
    if (!AppState.musics.length) return;
    const music = AppState.musics[Math.floor(Math.random() * AppState.musics.length)];

    const titleEl = document.getElementById('featuredTitle');
    const artistEl = document.getElementById('featuredArtist');
    const bg = document.getElementById('featuredBg');
    const banner = document.getElementById('featuredBanner');

    if (titleEl) titleEl.innerText = music.title;
    if (artistEl) artistEl.innerText = music.artist;

    // Fundo com capa da música
    if (bg && music.cover) {
        bg.style.backgroundImage = `url(${music.cover})`;
        bg.style.backgroundSize = 'cover';
        bg.style.backgroundPosition = 'center';
    }

    // Botão play
    const featuredBtn = document.getElementById('featuredPlayBtn');
    if (featuredBtn) {
        const newBtn = featuredBtn.cloneNode(true);
        featuredBtn.parentNode.replaceChild(newBtn, featuredBtn);
        newBtn.addEventListener('click', (e) => { e.stopPropagation(); playMusicTrack(music); });
    }

    // Clique no banner
    if (banner) {
        banner._featuredMusic = music;
        if (!banner._listenerAdded) {
            banner._listenerAdded = true;
            banner.addEventListener('click', () => {
                if (banner._featuredMusic) playMusicTrack(banner._featuredMusic);
            });
        }
    }
}

function renderHome() {
    // Recomendação do dia — atualiza a cada 10 minutos
    if (!window._featuredTimer) {
        window._featuredTimer = setInterval(() => updateFeaturedMusic(), 10 * 60 * 1000);
    }
    updateFeaturedMusic();

    const recentContainer = document.getElementById('recentlyPlayedList');
    if (recentContainer) {
        const recentMusics = AppState.history.slice(0, 6).map(item => AppState.musics.find(m => m.id === item.id)).filter(m => m);
        recentContainer.innerHTML = recentMusics.map(music => `
            <div class="music-card-horizontal" data-id="${music.id}">
                <img src="${music.cover || 'https://via.placeholder.com/150'}" loading="lazy">
                <h4>${escapeHtml(music.title)}</h4>
                <p>${escapeHtml(music.artist)}</p>
            </div>
        `).join('');
        document.querySelectorAll('#recentlyPlayedList .music-card-horizontal').forEach(card => {
            card.addEventListener('click', () => {
                const id = parseInt(card.dataset.id);
                const music = AppState.musics.find(m => m.id === id);
                if (music) {
                    if (typeof window.setPlayContext === 'function')
                        window.setPlayContext('history', recentMusics);
                    playMusicTrack(music);
                }
            });
        });
    }

    const favArtistsContainer = document.getElementById('favoriteArtistsList');
    if (favArtistsContainer) {
        const favMusics = AppState.musics.filter(m => AppState.favorites.has(m.id));
        const artistCount = new Map();
        favMusics.forEach(m => artistCount.set(m.artist, (artistCount.get(m.artist) || 0) + 1));
        const topArtists = Array.from(artistCount.entries()).sort((a,b) => b[1] - a[1]).slice(0, 6).map(([artist]) => artist);
        favArtistsContainer.innerHTML = topArtists.map(artist => `
            <div class="artist-card" data-artist="${escapeHtml(artist)}">
                <div class="artist-avatar"><span class="material-symbols-rounded">person</span></div>
                <p>${escapeHtml(artist)}</p>
            </div>
        `).join('');
        document.querySelectorAll('.artist-card').forEach(card => {
            card.addEventListener('click', () => {
                const artist = card.dataset.artist;
                const artistMusics = AppState.musics.filter(m => m.artist === artist);
                if (artistMusics.length) playMusicTrack(artistMusics[0]);
            });
        });
    }

    const popPlaylistsContainer = document.getElementById('popularPlaylistsList');
    if (popPlaylistsContainer) {
        // 10 últimas músicas adicionadas
        const newest = [...AppState.musics]
            .sort((a, b) => {
                if (a.created_at && b.created_at)
                    return new Date(b.created_at) - new Date(a.created_at);
                return (b.id || 0) - (a.id || 0);
            })
            .slice(0, 10);

        // Estrutura de carrossel
        popPlaylistsContainer.className = 'carousel-container';
        popPlaylistsContainer.innerHTML = `
            <div class="carousel-track" id="newestCarouselTrack">
                ${newest.map(music => `
                    <div class="music-card-horizontal newest-card" data-id="${music.id}">
                        <img src="${music.cover || 'https://via.placeholder.com/150'}" loading="lazy">
                        <h4>${escapeHtml(music.title)}</h4>
                        <p>${escapeHtml(music.artist)}</p>
                    </div>
                `).join('')}
            </div>
        `;

        // Clique nos cards
        popPlaylistsContainer.querySelectorAll('.newest-card').forEach(card => {
            card.addEventListener('click', () => {
                const id = parseInt(card.dataset.id);
                const music = AppState.musics.find(m => m.id === id);
                if (music) playMusicTrack(music);
            });
        });

        // Arrastar com mouse (desktop)
        const track = document.getElementById('newestCarouselTrack');
        if (track) {
            let isDown = false, startX = 0, scrollLeft = 0;
            track.addEventListener('mousedown', e => {
                isDown = true;
                startX = e.pageX - track.offsetLeft;
                scrollLeft = track.scrollLeft;
            });
            track.addEventListener('mouseleave', () => isDown = false);
            track.addEventListener('mouseup', () => isDown = false);
            track.addEventListener('mousemove', e => {
                if (!isDown) return;
                e.preventDefault();
                const x = e.pageX - track.offsetLeft;
                track.scrollLeft = scrollLeft - (x - startX);
            });
        }
    }

    // ========== BOTÕES "VER TUDO/VER TODOS" ==========
    const seeAllRecent = document.getElementById('seeAllRecent');
    if (seeAllRecent) {
        seeAllRecent.addEventListener('click', () => {
            const bibliotecaNavBtn = document.querySelector('.nav-btn[data-tab="biblioteca"]');
            if (bibliotecaNavBtn) {
                bibliotecaNavBtn.click();
                setTimeout(() => {
                    const historyTab = document.querySelector('.lib-main-tab[data-filter="history"]');
                    if (historyTab) historyTab.click();
                    else showToast("Aba 'Histórico' não encontrada", "info");
                }, 200);
            } else {
                showToast("Aba 'Biblioteca' não encontrada", "danger");
            }
        });
    }

    const seeAllArtists = document.getElementById('seeAllArtists');
    if (seeAllArtists) {
        seeAllArtists.addEventListener('click', () => {
            const bibliotecaNavBtn = document.querySelector('.nav-btn[data-tab="biblioteca"]');
            if (bibliotecaNavBtn) {
                bibliotecaNavBtn.click();
                setTimeout(() => {
                    const artistsTab = document.querySelector('.lib-main-tab[data-filter="artists"]');
                    if (artistsTab) artistsTab.click();
                    else showToast("Aba 'Artistas' não encontrada", "info");
                }, 200);
            } else {
                showToast("Aba 'Biblioteca' não encontrada", "danger");
            }
        });
    }

    const seeAllNewest = document.getElementById('seeAllNewest');
    if (seeAllNewest) {
        seeAllNewest.addEventListener('click', () => {
            const bibliotecaNavBtn = document.querySelector('.nav-btn[data-tab="biblioteca"]');
            if (bibliotecaNavBtn) {
                bibliotecaNavBtn.click();
                setTimeout(() => {
                    const playlistsTab = document.querySelector('.lib-main-tab[data-filter="playlists"]');
                    if (playlistsTab) playlistsTab.click();
                    else showToast("Aba 'Playlists' não encontrada", "info");
                }, 200);
            } else {
                showToast("Aba 'Biblioteca' não encontrada", "danger");
            }
        });
    }
}

// ========== RENDERIZA GRID DE ARTISTAS (BANCO DE DADOS) ==========
async function renderArtistsGrid() {
    const grid = document.getElementById('artistsGrid');
    if (!grid) return;

    let artists = AppState.artists || [];
    if (!artists.length) {
        const artistMap = new Map();
        AppState.musics.forEach(m => {
            if (!artistMap.has(m.artist)) artistMap.set(m.artist, m.cover || '');
        });
        artists = [...artistMap.entries()].map(([name, cover]) => ({ name, image_url: cover }));
    }

    if (!artists.length) {
        grid.innerHTML = `<div class="empty-state"><span class="material-symbols-rounded">person</span><p>Nenhum artista</p></div>`;
        return;
    }

    grid.innerHTML = '';
    artists.forEach(a => {
        const card = document.createElement('div');
        card.className = 'artist-card-lib';
        const cover = a.image_url || AppState.musics.find(m => m.artist === a.name)?.cover || '';
        card.innerHTML = `
            <div class="artist-avatar-lib">
                ${cover ? `<img src="${cover}" onerror="this.style.display='none'">` : ''}
                <span class="material-symbols-rounded artist-avatar-fallback">person</span>
            </div>
            <span class="artist-name-lib">${escapeHtml(a.name)}</span>
        `;
        card.addEventListener('click', () => openArtistDetail(a.name));
        grid.appendChild(card);
    });
}

function openArtistDetail(artistName) {
    const artistMusics = AppState.musics.filter(m => m.artist === artistName);
    if (!artistMusics.length) { showToast('Nenhuma música encontrada', 'danger'); return; }

    let overlay = document.getElementById('artistDetailOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'artistDetailOverlay';
        overlay.className = 'artist-detail-overlay';
        document.querySelector('.app-container').appendChild(overlay);
    }

    const cover = artistMusics[0]?.cover || '';
    overlay.innerHTML = `
        <div class="artist-detail-top">
            <button class="artist-detail-back"><span class="material-symbols-rounded">arrow_back</span></button>
            <div class="artist-detail-cover-bg" style="${cover ? `background-image:url(${cover})` : ''}"></div>
            <div class="artist-detail-cover-overlay"></div>
            <div class="artist-detail-info">
                <div class="artist-detail-avatar">
                    ${cover ? `<img src="${cover}">` : '<span class="material-symbols-rounded">person</span>'}
                </div>
                <h2>${escapeHtml(artistName)}</h2>
                <p>${artistMusics.length} músicas</p>
            </div>
            <div class="artist-detail-actions">
                <button class="playlist-shuffle-btn" id="artistShuffle">
                    <span class="material-symbols-rounded">shuffle</span>
                </button>
                <button class="playlist-play-all-btn" id="artistPlayAll">
                    <span class="material-symbols-rounded">play_arrow</span> Tocar tudo
                </button>
            </div>
        </div>
        <div class="artist-detail-list" id="artistMusicList"></div>
    `;
    overlay.classList.add('active');

    overlay.querySelector('.artist-detail-back').addEventListener('click', () => overlay.classList.remove('active'));
    overlay.querySelector('#artistPlayAll').addEventListener('click', () => {
        if (typeof window.setPlayContext === 'function') window.setPlayContext('search', artistMusics);
        playMusicTrack(artistMusics[0]); overlay.classList.remove('active');
    });
    overlay.querySelector('#artistShuffle').addEventListener('click', () => {
        AppState.isShuffle = true;
        if (typeof window.setPlayContext === 'function') window.setPlayContext('search', artistMusics);
        playMusicTrack(artistMusics[Math.floor(Math.random() * artistMusics.length)]);
        overlay.classList.remove('active');
    });

    const list = overlay.querySelector('#artistMusicList');
    artistMusics.forEach(music => {
        const item = document.createElement('div');
        item.className = 'artist-music-item';
        item.innerHTML = `
            <img src="${music.cover || ''}" onerror="this.style.opacity='0'">
            <div class="artist-music-info">
                <span class="artist-music-title">${escapeHtml(music.title)}</span>
                <span class="artist-music-sub">${escapeHtml(music.artist)}</span>
            </div>
            <button class="artist-music-more"><span class="material-symbols-rounded">more_vert</span></button>
        `;
        item.addEventListener('click', (e) => {
            if (e.target.closest('.artist-music-more')) return;
            if (typeof window.setPlayContext === 'function') window.setPlayContext('search', artistMusics);
            playMusicTrack(music);
        });
        item.querySelector('.artist-music-more').addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof window.openContextMenu === 'function') window.openContextMenu(music);
        });
        list.appendChild(item);
    });
}
window.openArtistDetail = openArtistDetail;


function renderLibrary() {
    const favoritesCount = AppState.favorites.size;
    const recentCount = AppState.history.length;

    const rcEl = document.getElementById('recentCount');
    if (rcEl) rcEl.innerText = recentCount;
    if (window.getAllCachedMusics) {
        window.getAllCachedMusics().then(list => {
            const el = document.getElementById('downloadsCount');
            if (el) el.innerText = list.length;
        });
    }

    function rebind(id, fn) {
        const el = document.getElementById(id);
        if (!el) return;
        const clone = el.cloneNode(true);
        el.parentNode.replaceChild(clone, el);
        clone.addEventListener('click', fn);
    }

    rebind('libSearchBtn', () => {
        document.querySelector('.nav-btn[data-tab="buscar"]')?.click();
    });
    // libAddBtn removido (fix 5)

    // Summary cards
    const dlCard = document.querySelector('.summary-card[data-type="downloads"]');
    if (dlCard) {
        const c = dlCard.cloneNode(true);
        dlCard.parentNode.replaceChild(c, dlCard);
        c.addEventListener('click', () => document.querySelector('.lib-main-tab[data-filter="downloads"]')?.click());
    }
    const rcCard = document.querySelector('.summary-card[data-type="recent"]');
    if (rcCard) {
        const c = rcCard.cloneNode(true);
        rcCard.parentNode.replaceChild(c, rcCard);
        c.addEventListener('click', () => document.querySelector('.lib-main-tab[data-filter="history"]')?.click());
    }

    // Playlists
    const playlistsGrid = document.getElementById('playlistsGrid');
    if (playlistsGrid) {
        playlistsGrid.innerHTML = '';
        const likedItem = document.createElement('div');
        likedItem.className = 'playlist-item-modern';
        likedItem.innerHTML = `
            <div class="playlist-left">
                <div class="playlist-icon"><span class="material-symbols-rounded">favorite</span></div>
                <div class="playlist-info">
                    <h4>Curtidas</h4>
                    <p>${favoritesCount} ${favoritesCount === 1 ? 'música' : 'músicas'}</p>
                </div>
            </div>
        `;
        likedItem.addEventListener('click', () => { if (typeof window.openLikedMusicsDetail === 'function') window.openLikedMusicsDetail(); });
        playlistsGrid.appendChild(likedItem);

        (AppState.userPlaylists || []).forEach(playlist => {
            const count = playlist.musics ? playlist.musics.length : 0;
            const item = document.createElement('div');
            item.className = 'playlist-item-modern';
            item.innerHTML = `
                <div class="playlist-left">
                    <div class="playlist-icon">
                        ${playlist.cover ? `<img src="${playlist.cover}">` : '<span class="material-symbols-rounded">queue_music</span>'}
                    </div>
                    <div class="playlist-info">
                        <h4>${escapeHtml(playlist.name)}</h4>
                        <p>${count} ${count === 1 ? 'música' : 'músicas'}</p>
                    </div>
                </div>
                <div class="playlist-more"><span class="material-symbols-rounded">more_vert</span></div>
            `;
            // Clique em qualquer parte do item (exceto o ⋮) abre a playlist
            item.addEventListener('click', (e) => {
                if (e.target.closest('.playlist-more')) return;
                if (typeof window.openPlaylistDetail === 'function') {
                    window.openPlaylistDetail(playlist);
                } else if (typeof openPlaylistDetail === 'function') {
                    openPlaylistDetail(playlist);
                }
            });
            item.querySelector('.playlist-more').addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof window.openPlaylistContextMenu === 'function') window.openPlaylistContextMenu(playlist);
            });
            playlistsGrid.appendChild(item);
        });
    }

    // Álbuns
    const albumsGrid = document.getElementById('albumsGrid');
    if (albumsGrid) {
        const albumsData = [
            { name: "Djavan Ao Vivo", artist: "Djavan" },
            { name: "O Tempo Não Para", artist: "Cazuza" },
            { name: "Mais Marisa Monte", artist: "Marisa Monte" },
            { name: "The Highlights", artist: "The Weeknd" },
            { name: "After Hours", artist: "The Weeknd" },
        ];
        albumsGrid.innerHTML = '';
        albumsData.forEach(album => {
            const card = document.createElement('div');
            card.className = 'album-card';
            card.innerHTML = `<div class="album-cover"><span class="material-symbols-rounded">album</span></div><h4>${escapeHtml(album.name)}</h4><p>${escapeHtml(album.artist)}</p>`;
            card.addEventListener('click', () => {
                const music = AppState.musics.find(m => m.artist === album.artist);
                if (music) playMusicTrack(music);
                else showToast('Nenhuma música de ' + album.artist, 'danger');
            });
            albumsGrid.appendChild(card);
        });
    }

    // Histórico (dinâmico)
    let histSection = document.getElementById('libHistorySection');
    if (histSection) histSection.remove();
    histSection = document.createElement('div');
    histSection.id = 'libHistorySection';
    histSection.className = 'library-section';
    histSection.style.display = 'none';
    histSection.innerHTML = '<div class="section-header"><h2>Ouvidas recentemente</h2></div>';
    const hGrid = document.createElement('div');
    hGrid.className = 'history-grid';
    if (AppState.history.length === 0) {
        hGrid.innerHTML = `<div class="history-empty"><span class="material-symbols-rounded">history</span><p>Nenhuma música ouvida ainda</p></div>`;
    } else {
        AppState.history.slice(0, 12).forEach(item => {
            const music = AppState.musics.find(m => m.id === item.id);
            if (!music) return;
            const card = document.createElement('div');
            card.className = 'history-card';
            card.innerHTML = `<img src="${music.cover || ''}" loading="lazy"><h4>${escapeHtml(music.title)}</h4><p>${escapeHtml(music.artist)}</p>`;
            card.addEventListener('click', () => playMusicTrack(music));
            hGrid.appendChild(card);
        });
    }
    histSection.appendChild(hGrid);
    document.getElementById('artistsSection')?.insertAdjacentElement('afterend', histSection);

    // Downloads (dinâmico)
    let dlSection = document.getElementById('libDownloadsSection');
    if (dlSection) dlSection.remove();
    dlSection = document.createElement('div');
    dlSection.id = 'libDownloadsSection';
    dlSection.className = 'library-section';
    dlSection.style.display = 'none';
    dlSection.innerHTML = '<div class="section-header"><h2>Downloads</h2></div>';
    const dlList = document.createElement('div');
    dlList.className = 'playlist-tracks-list';
    dlSection.appendChild(dlList);
    histSection.insertAdjacentElement('afterend', dlSection);

    // Controle de abas
    const summaryCards = document.getElementById('summaryCards');
    const playlistsSEl = document.getElementById('playlistsSection');
    const albumsSEl = document.getElementById('albumsSection');
    const artistsSEl = document.getElementById('artistsSection');

    function showOnly(...show) {
        [summaryCards, playlistsSEl, albumsSEl, artistsSEl, histSection, dlSection].forEach(el => {
            if (el) el.style.display = 'none';
        });
        show.forEach(el => {
            if (el) el.style.display = el === summaryCards ? 'grid' : 'block';
        });
    }

    function filterLibrary(filter) {
        switch (filter) {
            case 'all':      showOnly(summaryCards, playlistsSEl, albumsSEl); break;
            case 'playlists': showOnly(playlistsSEl); break;
            case 'albums':   showOnly(albumsSEl); break;
            case 'artists':  showOnly(artistsSEl); renderArtistsGrid(); break;
            case 'history':  showOnly(histSection); break;
            case 'downloads':
                showOnly(dlSection);
                if (dlList.children.length === 0 && window.getAllCachedMusics) {
                    dlList.innerHTML = '<p style="text-align:center;padding:24px;color:rgba(255,255,255,0.3)">Carregando...</p>';
                    window.getAllCachedMusics().then(async metas => {
                        dlList.innerHTML = '';
                        if (!metas.length) {
                            dlList.innerHTML = '<div class="empty-state"><span class="material-symbols-rounded">download</span><p>Nenhuma música baixada</p></div>';
                            return;
                        }
                        for (const meta of metas) {
                            const music = AppState.musics.find(m => m.id === meta.musicId) || {
                                id: meta.musicId, title: meta.title, artist: meta.artist, cover: meta.cover, src: meta.url
                            };
                            if (typeof window.createMusicCardElement === 'function')
                                dlList.appendChild(await window.createMusicCardElement(music));
                        }
                    });
                }
                break;
        }
    }

    // Abas — remove listeners duplicados clonando os elementos
    const tabsContainer = document.querySelector('.library-main-tabs');
    if (tabsContainer) {
        const newTabs = tabsContainer.cloneNode(true);
        tabsContainer.parentNode.replaceChild(newTabs, tabsContainer);
        newTabs.querySelectorAll('.lib-main-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                newTabs.querySelectorAll('.lib-main-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                filterLibrary(tab.dataset.filter);
            });
        });
    }

    const activeTab = document.querySelector('.lib-main-tab.active');
    filterLibrary(activeTab ? activeTab.dataset.filter : 'all');
    if (!activeTab) document.querySelector('.lib-main-tab[data-filter="all"]')?.classList.add('active');
}


async function renderProfile() {
    try {
        const profile = AppState.userProfile;
        const userName = profile.full_name || 'Usuário';
        const userEmail = localStorage.getItem('user_email') || '';
        const userBio = profile.bio || 'Apaixonado por música. Vivendo uma música de cada vez.';

        const nameEl = document.getElementById('profileName');
        if (nameEl) nameEl.innerText = userName;
        const userEl = document.getElementById('profileUsername');
        if (userEl) userEl.innerText = '@' + (userEmail.split('@')[0] || 'usuario');
        const bioEl = document.getElementById('profileBio');
        if (bioEl) bioEl.innerText = userBio;

        // Avatar
        const avatarImg = document.getElementById('profileAvatarImg');
        const avatarIcon = document.getElementById('profileAvatarIcon');
        const avatarUrl = window.UserCacheDB && AppState.userId
            ? await window.UserCacheDB.getAvatarUrl(AppState.userId, profile.avatar_url)
            : profile.avatar_url;
        if (avatarUrl && avatarImg) {
            avatarImg.src = avatarUrl;
            avatarImg.style.cssText = 'display:block;width:88px;height:88px;border-radius:50%;object-fit:cover;border:3px solid #0c0916;';
            if (avatarIcon) avatarIcon.style.display = 'none';
        } else {
            if (avatarImg) avatarImg.style.display = 'none';
            if (avatarIcon) avatarIcon.style.display = 'block';
        }

        // Stats
        const totalPlaylists = AppState.userPlaylists.length;
        const totalFavorites = AppState.favorites.size;
        const totalMinutes = calculateTotalMinutesListened();
        const timeDisplay = totalMinutes >= 60
            ? Math.floor(totalMinutes / 60) + 'h ' + (totalMinutes % 60) + 'min'
            : totalMinutes + ' min';
        const plEl = document.getElementById('totalPlaylists');
        if (plEl) plEl.innerText = totalPlaylists;
        const favEl = document.getElementById('totalFavorites');
        if (favEl) favEl.innerText = totalFavorites;
        const timeEl = document.getElementById('totalTimeStat');
        if (timeEl) timeEl.innerText = timeDisplay;

        function rebind(id, fn) {
            const el = document.getElementById(id);
            if (!el) return;
            const clone = el.cloneNode(true);
            el.parentNode.replaceChild(clone, el);
            clone.addEventListener('click', fn);
        }

        rebind('editProfileBtn', openEditProfileModal);
        rebind('likedSongsNavBtn', () => {
            document.querySelector('.nav-btn[data-tab="biblioteca"]')?.click();
            setTimeout(() => openLikedMusicsDetail(), 200);
        });
        rebind('recentNavBtn', () => {
            document.querySelector('.nav-btn[data-tab="biblioteca"]')?.click();
            setTimeout(() => document.querySelector('.lib-main-tab[data-filter="history"]')?.click(), 200);
        });
        rebind('downloadsNavBtn', () => {
            document.querySelector('.nav-btn[data-tab="biblioteca"]')?.click();
            setTimeout(() => document.querySelector('.lib-main-tab[data-filter="downloads"]')?.click(), 200);
        });
        rebind('settingsNavBtn', () => showToast('Configurações em breve', 'info'));
        rebind('logoutBtn', () => {
            showConfirmDialog('Sair da conta', 'Deseja realmente sair da conta?', async () => {
                try {
                    if (window.CacheDB) await window.CacheDB.clear();
                    await supabaseClient.auth.signOut();
                    localStorage.clear();
                    window.location.replace('index.html');
                } catch (err) { window.location.replace('index.html'); }
            });
        });

    } catch (err) {
        console.error('Erro no renderProfile:', err);
    }
}


function openEditProfileModal() {
    const modal = document.getElementById('editProfileModal');
    if (!modal) return;
    document.getElementById('editName').value = AppState.userProfile.full_name || '';
    document.getElementById('editEmail').value = localStorage.getItem('user_email') || '';
    document.getElementById('editBio').value = AppState.userProfile.bio || '';
    modal.classList.add('active');
}

async function saveProfileChanges() {
    const newName = document.getElementById('editName').value.trim();
    const newEmail = document.getElementById('editEmail').value.trim();
    const newBio = document.getElementById('editBio').value.trim();
    const avatarFile = document.getElementById('editAvatar').files[0];

    if (!newName || !newEmail) {
        showToast('Nome e e-mail são obrigatórios', 'danger');
        return;
    }

    let avatarUrl = AppState.userProfile.avatar_url;
    if (avatarFile) {
        const uploaded = await window.uploadFileToSupabase(avatarFile, `avatars/${AppState.userId}`);
        if (uploaded) avatarUrl = uploaded;
    }

    const success = await window.updateUserProfile(AppState.userId, {
        full_name: newName,
        bio: newBio,
        avatar_url: avatarUrl
    });
    if (success) {
        AppState.userProfile.full_name = newName;
        AppState.userProfile.bio = newBio;
        AppState.userProfile.avatar_url = avatarUrl;
        localStorage.setItem('user_name', newName);
        localStorage.setItem('user_email', newEmail);
        showToast('Perfil atualizado!', 'success');
        document.getElementById('editProfileModal').classList.remove('active');
        renderProfile();
    } else {
        showToast('Erro ao atualizar perfil', 'danger');
    }
}

function initEditProfileModal() {
    const cancelBtn = document.getElementById('cancelEditBtn');
    if (cancelBtn) {
        const newCancel = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
        newCancel.addEventListener('click', () => {
            document.getElementById('editProfileModal').classList.remove('active');
        });
    }
    const saveBtn = document.getElementById('saveEditBtn');
    if (saveBtn) {
        const newSave = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSave, saveBtn);
        newSave.addEventListener('click', saveProfileChanges);
    }
    const avatarLabel = document.getElementById('avatarLabel');
    const avatarInput = document.getElementById('editAvatar');
    if (avatarLabel && avatarInput) {
        avatarLabel.addEventListener('click', () => avatarInput.click());
        avatarInput.addEventListener('change', () => {
            const fileNameSpan = document.getElementById('avatarFileName');
            if (fileNameSpan && avatarInput.files.length) {
                fileNameSpan.textContent = avatarInput.files[0].name;
            }
        });
    }
}

async function createMusicCardElement(music) {
    const card = document.createElement('div');
    card.className = 'music-card';
    const isCurrent = AppState.currentMusicId === music.id;
    const inlineIcon = (isCurrent && AppState.playing) ? 'pause' : 'play_arrow';
    card.innerHTML = `
        <div class="music-card-left-wrapper">
            <button class="inline-play-btn ${isCurrent ? 'active-inline' : ''}" data-id="${music.id}">
                <span class="material-symbols-rounded">${inlineIcon}</span>
            </button>
            <img src="${music.cover || ''}" class="music-card-cover" onerror="this.style.opacity='0'">
            <div class="music-card-details">
                <h3>${escapeHtml(music.title)}</h3>
                <p>${escapeHtml(music.artist)}</p>
            </div>
        </div>
        <div class="music-card-actions">
            <button class="more-btn"><span class="material-symbols-rounded">more_vert</span></button>
        </div>
    `;
    card.querySelector('.music-card-left-wrapper').addEventListener('click', () => {
        if (typeof window.setPlayContext === 'function') {
            const source = AppState.currentPlaylistFilter ? 'playlist' : 'library';
            const trackList = AppState.currentPlaylistFilter
                ? AppState.musics.filter(m => {
                    const pl = AppState.userPlaylists.find(p => p.id === AppState.currentPlaylistFilter);
                    return pl && pl.musics && pl.musics.includes(m.id);
                })
                : [...AppState.musics];
            window.setPlayContext(source, trackList, AppState.currentPlaylistFilter || null);
        }
        togglePlayMusic(music);
    });
    card.querySelector('.more-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof window.openContextMenu === 'function') window.openContextMenu(music);
        else openContextMenu(music);
    });
    return card;
}

function renderQueue() {
    const container = document.getElementById('queueList');
    if (!container) return;
    if (!AppState.queue.length) {
        container.innerHTML = `<div class="queue-empty"><span class="material-symbols-rounded">queue_music</span><span>Fila vazia</span><span style="font-size: 11px;">Adicione músicas para tocar em seguida</span></div>`;
        return;
    }
    container.innerHTML = '';
    AppState.queue.forEach((music, idx) => {
        const isCurrent = AppState.currentMusicId === music.id && AppState.playing;
        const item = document.createElement('div');
        item.className = `queue-item ${isCurrent ? 'current' : ''}`;
        item.innerHTML = `
            <div class="queue-item-info">
                <div class="queue-item-title">${escapeHtml(music.title)}</div>
                <div class="queue-item-artist">${escapeHtml(music.artist)}</div>
            </div>
            <button class="queue-item-remove" data-index="${idx}"><span class="material-symbols-rounded">close</span></button>
        `;
        item.addEventListener('click', (e) => {
            if (e.target.closest('.queue-item-remove')) return;
            const remaining = AppState.queue.slice(idx);
            AppState.queue = remaining;
            renderQueue();
            playMusicTrack(music);
        });
        item.querySelector('.queue-item-remove').addEventListener('click', (e) => {
            e.stopPropagation();
            removeFromQueue(idx);
        });
        container.appendChild(item);
    });
}

async function toggleFavoriteTrack(musicId) {
    if (!AppState.userId) {
        showToast("Usuário não identificado", "danger");
        return;
    }

    const isCurrentlyFav = AppState.favorites.has(musicId);
    const added = await window.toggleFavorite(AppState.userId, musicId);
    
    if (added === null) {
        showToast("Erro ao atualizar favorito", "danger");
        return;
    }

    if (added) {
        AppState.favorites.add(musicId);
        showToast("Adicionada aos favoritos!", "success");
    } else {
        AppState.favorites.delete(musicId);
        showToast("Removida dos favoritos", "danger");
    }

    localStorage.setItem('supabase_player_favorites', JSON.stringify(Array.from(AppState.favorites)));

    if (typeof window.renderLibrary === 'function') window.renderLibrary();
    if (typeof window.renderHome === 'function') window.renderHome();
    
    const favButtons = document.querySelectorAll(`.favorite-btn[data-id="${musicId}"]`);
    favButtons.forEach(btn => {
        const isFav = AppState.favorites.has(musicId);
        btn.classList.toggle('active', isFav);
        btn.querySelector('span').innerText = isFav ? 'favorite' : 'favorite_border';
    });
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initEditProfileModal();
});

// Exportações globais
window.renderHome = renderHome;
window.renderLibrary = renderLibrary;
window.renderProfile = renderProfile;
window.renderQueue = renderQueue;
window.renderArtistsGrid = renderArtistsGrid;  // nova exportação
window.createMusicCardElement = createMusicCardElement;
window.toggleFavoriteTrack = toggleFavoriteTrack;
window.initEditProfileModal = initEditProfileModal;