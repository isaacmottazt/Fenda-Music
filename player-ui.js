// ===== INTERFACE DAS NOVAS ABAS (player-ui.js completo) =====

function renderHome() {
    const featuredMusic = AppState.musics.length > 0 ? AppState.musics[Math.floor(Math.random() * AppState.musics.length)] : null;
    if (featuredMusic) {
        document.getElementById('featuredTitle').innerText = featuredMusic.title;
        document.getElementById('featuredArtist').innerText = featuredMusic.artist;
        const featuredBtn = document.getElementById('featuredPlayBtn');
        const newBtn = featuredBtn.cloneNode(true);
        featuredBtn.parentNode.replaceChild(newBtn, featuredBtn);
        newBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            playMusicTrack(featuredMusic);
        });
        const banner = document.getElementById('featuredBanner');
        banner.addEventListener('click', () => playMusicTrack(featuredMusic));
    }

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
                if (music) playMusicTrack(music);
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
        // 10 últimas músicas adicionadas (ordenadas por created_at ou id decrescente)
        const newest = [...AppState.musics]
            .sort((a, b) => {
                if (a.created_at && b.created_at)
                    return new Date(b.created_at) - new Date(a.created_at);
                return (b.id || 0) - (a.id || 0);
            })
            .slice(0, 10);

        popPlaylistsContainer.innerHTML = newest.map(music => `
            <div class="music-card-horizontal newest-card" data-id="${music.id}">
                <img src="${music.cover || 'https://via.placeholder.com/150'}" loading="lazy">
                <h4>${escapeHtml(music.title)}</h4>
                <p>${escapeHtml(music.artist)}</p>
            </div>
        `).join('');

        popPlaylistsContainer.querySelectorAll('.newest-card').forEach(card => {
            card.addEventListener('click', () => {
                const id = parseInt(card.dataset.id);
                const music = AppState.musics.find(m => m.id === id);
                if (music) playMusicTrack(music);
            });
        });
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
    const container = document.getElementById('artistsGrid');
    if (!container) return;
    
    // Se ainda não tiver artistas no estado, busca agora
    if (!AppState.artists || AppState.artists.length === 0) {
        if (typeof window.loadAllArtists === 'function') {
            AppState.artists = await window.loadAllArtists();
        }
    }
    
    const artists = AppState.artists || [];
    if (artists.length === 0) {
        container.innerHTML = `<div class="empty-state"><span class="material-symbols-rounded">person</span><p>Nenhum artista encontrado</p></div>`;
        return;
    }
    
    container.innerHTML = artists.map(artist => `
        <div class="artist-card" data-artist-id="${artist.id}" data-artist-name="${escapeHtml(artist.name)}">
            <div class="artist-avatar">
                ${artist.image_url ? `<img src="${artist.image_url}" style="width:80px; height:80px; border-radius:50%; object-fit:cover;">` : `<span class="material-symbols-rounded">person</span>`}
            </div>
            <p>${escapeHtml(artist.name)}</p>
            ${artist.bio ? `<small style="font-size:10px; color:rgba(255,255,255,0.5);">${escapeHtml(artist.bio.substring(0, 40))}${artist.bio.length > 40 ? '...' : ''}</small>` : ''}
        </div>
    `).join('');
    
    // Adiciona evento de clique para tocar música do artista
    document.querySelectorAll('#artistsGrid .artist-card').forEach(card => {
        card.addEventListener('click', () => {
            const artistName = card.dataset.artistName;
            const firstMusic = AppState.musics.find(m => m.artist === artistName);
            if (firstMusic) playMusicTrack(firstMusic);
            else showToast(`Nenhuma música de ${artistName} encontrada`, "danger");
        });
    });
}

function renderLibrary() {
    const downloadsCount = 12;
    const recentCount = AppState.history.length;
    const podcastsCount = 5;
    const favoritesCount = AppState.favorites.size;

    document.getElementById('downloadsCount').innerText = downloadsCount;
    document.getElementById('recentCount').innerText = recentCount;
    document.getElementById('podcastsCount').innerText = podcastsCount;

    // ========== PLAYLISTS ==========
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
        likedItem.querySelector('.playlist-left').addEventListener('click', () => openLikedMusicsDetail());
        playlistsGrid.appendChild(likedItem);

        const userPlaylists = AppState.userPlaylists || [];
        userPlaylists.forEach(playlist => {
            const count = playlist.musics ? playlist.musics.length : 0;
            const item = document.createElement('div');
            item.className = 'playlist-item-modern';
            item.innerHTML = `
                <div class="playlist-left">
                    <div class="playlist-icon">
                        ${playlist.cover ? `<img src="${playlist.cover}" style="width:48px;height:48px;border-radius:12px;object-fit:cover;">` : '<span class="material-symbols-rounded">queue_music</span>'}
                    </div>
                    <div class="playlist-info">
                        <h4>${escapeHtml(playlist.name)}</h4>
                        <p>${count} ${count === 1 ? 'música' : 'músicas'}</p>
                    </div>
                </div>
                <div class="playlist-more"><span class="material-symbols-rounded">more_vert</span></div>
            `;
            item.querySelector('.playlist-left').addEventListener('click', () => openPlaylistDetail(playlist));
            item.querySelector('.playlist-more').addEventListener('click', (e) => {
                e.stopPropagation();
                openPlaylistContextMenu(playlist);
            });
            playlistsGrid.appendChild(item);
        });

        const createItem = document.createElement('div');
        createItem.className = 'playlist-item-modern create-playlist-item';
        createItem.innerHTML = `
            <div class="playlist-left">
                <div class="playlist-icon"><span class="material-symbols-rounded">add</span></div>
                <div class="playlist-info">
                    <h4>Criar playlist</h4>
                    <p>Nova playlist</p>
                </div>
            </div>
        `;
        createItem.addEventListener('click', () => {
            if (typeof window.openCreatePlaylistModal === 'function') window.openCreatePlaylistModal();
            else showToast('Erro ao abrir o modal de criação', 'danger');
        });
        playlistsGrid.appendChild(createItem);
    }

    // ========== ÁLBUNS ==========
    const albumsGrid = document.getElementById('albumsGrid');
    if (albumsGrid) {
        const albumsData = [
            { name: "Djavan Ao Vivo", artist: "Djavan" },
            { name: "O Tempo Não Para", artist: "Cazuza" },
            { name: "Mais Marisa Monte", artist: "Marisa Monte" },
            { name: "The Highlights", artist: "The Weeknd" },
            { name: "After Hours", artist: "The Weeknd" },
            { name: "Preciso Dizer Que Te Amo", artist: "Cazuza" }
        ];
        albumsGrid.innerHTML = '';
        albumsData.forEach(album => {
            const card = document.createElement('div');
            card.className = 'album-card';
            card.innerHTML = `
                <div class="album-cover"><span class="material-symbols-rounded">album</span></div>
                <h4>${escapeHtml(album.name)}</h4>
                <p>${escapeHtml(album.artist)}</p>
            `;
            card.addEventListener('click', () => {
                const music = AppState.musics.find(m => m.artist === album.artist);
                if (music) playMusicTrack(music);
                else showToast(`Nenhuma música de ${album.artist}`, "danger");
            });
            albumsGrid.appendChild(card);
        });
    }

    // ========== BOTÃO "VER TODOS" DOS ÁLBUNS ==========
    const seeAllBtn = document.getElementById('seeAllAlbumsBtn');
    if (seeAllBtn) {
        const newBtn = seeAllBtn.cloneNode(true);
        seeAllBtn.parentNode.replaceChild(newBtn, seeAllBtn);
        newBtn.addEventListener('click', () => {
            const albumsTab = document.querySelector('.lib-main-tab[data-filter="albums"]');
            if (albumsTab) albumsTab.click();
        });
        window.__seeAllAlbumsBtn = newBtn;
    }

    // ========== SEÇÃO DE HISTÓRICO (criada dinamicamente) ==========
    const existingHistorySection = document.querySelector('.history-section');
    if (existingHistorySection) existingHistorySection.remove();

    const historySection = document.createElement('div');
    historySection.className = 'history-section';
    historySection.style.display = 'none';
    historySection.innerHTML = `<div class="section-header"><h2><span class="material-symbols-rounded">history</span> Ouvidas recentemente</h2></div>`;
    
    const historyGrid = document.createElement('div');
    historyGrid.className = 'history-grid';
    
    if (AppState.history.length === 0) {
        historyGrid.innerHTML = `<div class="history-empty"><span class="material-symbols-rounded">history</span><p>Nenhuma música ouvida ainda</p></div>`;
    } else {
        const lastListened = AppState.history.slice(0, 10);
        lastListened.forEach(item => {
            const music = AppState.musics.find(m => m.id === item.id);
            if (music) {
                const card = document.createElement('div');
                card.className = 'history-card';
                card.innerHTML = `
                    <img src="${music.cover || 'https://via.placeholder.com/150'}" loading="lazy">
                    <h4>${escapeHtml(music.title)}</h4>
                    <p>${escapeHtml(music.artist)}</p>
                `;
                card.addEventListener('click', () => playMusicTrack(music));
                historyGrid.appendChild(card);
            }
        });
    }
    historySection.appendChild(historyGrid);
    
    const albumsSection = document.getElementById('albumsSection');
    if (albumsSection) {
        albumsSection.insertAdjacentElement('afterend', historySection);
    } else {
        document.getElementById('playlistsRootView')?.appendChild(historySection);
    }

    // ========== CONTROLE DE ABAS ==========
    const mainTabs = document.querySelectorAll('.lib-main-tab');
    const summaryCards = document.getElementById('summaryCards');
    const playlistsSectionElem = document.getElementById('playlistsSection');
    const albumsSectionElem = document.getElementById('albumsSection');
    const artistsSectionElem = document.getElementById('artistsSection');

    function resetActiveTabs() {
        mainTabs.forEach(tab => tab.classList.remove('active'));
    }

    function filterLibrary(filter) {
        if (summaryCards) summaryCards.style.display = 'none';
        if (playlistsSectionElem) playlistsSectionElem.style.display = 'none';
        if (albumsSectionElem) albumsSectionElem.style.display = 'none';
        if (historySection) historySection.style.display = 'none';
        if (artistsSectionElem) artistsSectionElem.style.display = 'none';

        if (filter === 'all') {
            if (summaryCards) summaryCards.style.display = 'grid';
            if (playlistsSectionElem) playlistsSectionElem.style.display = 'block';
            if (albumsSectionElem) albumsSectionElem.style.display = 'block';
        } else if (filter === 'playlists') {
            if (playlistsSectionElem) playlistsSectionElem.style.display = 'block';
        } else if (filter === 'albums') {
            if (albumsSectionElem) albumsSectionElem.style.display = 'block';
        } else if (filter === 'history') {
            if (historySection) historySection.style.display = 'block';
        } else if (filter === 'artists') {
            if (artistsSectionElem) {
                artistsSectionElem.style.display = 'block';
                renderArtistsGrid(); // carrega os artistas
            }
        } else if (filter === 'podcasts') {
            showToast("Em breve: Podcasts", "info");
        }

        const seeAllAlbumsBtn = window.__seeAllAlbumsBtn || document.getElementById('seeAllAlbumsBtn');
        if (seeAllAlbumsBtn) seeAllAlbumsBtn.style.display = (filter === 'all' || filter === 'albums') ? 'inline-flex' : 'none';
    }

    // Força remoção de todos os listeners e reseta as classes
    const containerTabs = document.querySelector('.library-main-tabs');
    if (containerTabs) {
        const originalHTML = containerTabs.innerHTML;
        containerTabs.innerHTML = originalHTML;
    }

    const freshTabs = document.querySelectorAll('.lib-main-tab');
    freshTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            const filter = tab.getAttribute('data-filter');
            if (!filter) return;

            freshTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            filterLibrary(filter);
        });
    });

    // Define a aba ativa inicial
    const defaultTab = document.querySelector('.lib-main-tab[data-filter="all"]');
    if (defaultTab && !document.querySelector('.lib-main-tab.active')) {
        freshTabs.forEach(t => t.classList.remove('active'));
        defaultTab.classList.add('active');
        filterLibrary('all');
    }

    const alreadyActive = document.querySelector('.lib-main-tab.active');
    if (!alreadyActive) {
        const defaultTab = document.querySelector('.lib-main-tab[data-filter="all"]');
        if (defaultTab) {
            resetActiveTabs();
            defaultTab.classList.add('active');
            filterLibrary('all');
        }
    } else {
        const activeFilter = alreadyActive.getAttribute('data-filter');
        filterLibrary(activeFilter);
    }
}

async function renderProfile() {
    try {
        const profile = AppState.userProfile;
        const userName = profile.full_name || 'Usuário';
        const userEmail = localStorage.getItem('user_email') || '';
        const userBio = profile.bio || 'Apaixonado por música. Vivendo uma música de cada vez.';
        // Usa URL local cacheada se offline, remota se online
        const remoteAvatarUrl = profile.avatar_url;
        const avatarUrl = window.UserCacheDB && AppState.userId
            ? await window.UserCacheDB.getAvatarUrl(AppState.userId, remoteAvatarUrl)
            : remoteAvatarUrl;

        document.getElementById('profileName').innerText = userName;
        document.getElementById('profileUsername').innerText = `@${userEmail.split('@')[0]}`;
        const bioEl = document.getElementById('profileBio');
        if (bioEl) bioEl.innerText = userBio;
        
        const avatarImg = document.getElementById('profileAvatarImg');
        const avatarIcon = document.getElementById('profileAvatarIcon');
        if (avatarUrl && avatarImg) {
            avatarImg.src = avatarUrl;
            avatarImg.style.display = 'block';
            if (avatarIcon) avatarIcon.style.display = 'none';
        } else {
            if (avatarImg) avatarImg.style.display = 'none';
            if (avatarIcon) avatarIcon.style.display = 'block';
        }

        const totalPlaylists = AppState.userPlaylists.length;
        const totalFavorites = AppState.favorites.size;
        const totalMinutes = calculateTotalMinutesListened();
        const timeDisplay = totalMinutes >= 60 ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}min` : `${totalMinutes} min`;

        document.getElementById('totalPlaylists').innerText = totalPlaylists;
        document.getElementById('totalFavorites').innerText = totalFavorites;
        document.getElementById('totalTimeStat').innerText = timeDisplay;

        // Botão editar perfil
        const editBtn = document.getElementById('editProfileBtn');
        if (editBtn) {
            const newBtn = editBtn.cloneNode(true);
            editBtn.parentNode.replaceChild(newBtn, editBtn);
            newBtn.addEventListener('click', openEditProfileModal);
        }

        function setupButton(id, onClick) {
            const btn = document.getElementById(id);
            if (!btn) return;
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            newBtn.addEventListener('click', onClick);
        }

        setupButton('likedSongsNavBtn', () => {
            const bibliotecaNavBtn = document.querySelector('.nav-btn[data-tab="biblioteca"]');
            if (bibliotecaNavBtn) {
                bibliotecaNavBtn.click();
                setTimeout(() => {
                    openLikedMusicsDetail();
                }, 200);
            } else {
                showToast("Aba 'Biblioteca' não encontrada", "danger");
            }
        });

        setupButton('recentNavBtn', () => {
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

        setupButton('downloadsNavBtn', () => showToast('Seus downloads aparecerão aqui', 'info'));
        setupButton('settingsNavBtn', () => showToast('Configurações em desenvolvimento', 'info'));

        const logout = document.getElementById('logoutBtn');
        if (logout) {
            const newLogout = logout.cloneNode(true);
            logout.parentNode.replaceChild(newLogout, logout);
            newLogout.addEventListener('click', () => {
                showConfirmDialog('Sair da conta', 'Deseja realmente sair da conta?', async () => {
                    try {
                        await supabaseClient.auth.signOut();
                        await supabaseClient.auth.setSession(null);
                        localStorage.clear();
                        sessionStorage.clear();
                        document.cookie.split(";").forEach(c => {
                            document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
                        });
                        window.location.replace('index.html');
                    } catch (err) {
                        console.error(err);
                        window.location.replace('index.html');
                    }
                });
            });
        }

        setupButton('managePremiumBtn', () => showToast('Área premium em breve', 'info'));
    } catch (err) {
        console.error('Erro no renderProfile:', err);
        showToast('Erro ao carregar perfil', 'danger');
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
    const isFav = AppState.favorites.has(music.id);
    // Verifica se já está salva offline
    const isCached = typeof window.isMusicCached === 'function'
        ? await window.isMusicCached(music.id)
        : false;
    card.innerHTML = `
        <div class="music-card-left-wrapper">
            <button class="inline-play-btn ${isCurrent ? 'active-inline' : ''}" data-id="${music.id}">
                <span class="material-symbols-rounded">${inlineIcon}</span>
            </button>
            <img src="${music.cover || 'https://via.placeholder.com/150'}" class="music-card-cover">
            <div class="music-card-details">
                <h3>${escapeHtml(music.title)}</h3>
                <p>${escapeHtml(music.artist)}</p>
            </div>
        </div>
        <div class="music-card-actions">
            <button class="download-btn" data-download-id="${music.id}" data-cached="${isCached ? '1' : '0'}" title="${isCached ? 'Remover download' : 'Baixar para ouvir offline'}">
                <span class="material-symbols-rounded">${isCached ? 'download_done' : 'download'}</span>
            </button>
            <button class="favorite-btn ${isFav ? 'active' : ''}" data-id="${music.id}">
                <span class="material-symbols-rounded">${isFav ? 'favorite' : 'favorite_border'}</span>
            </button>
            <button class="more-btn"><span class="material-symbols-rounded">more_vert</span></button>
        </div>
    `;
    card.querySelector('.music-card-left-wrapper').addEventListener('click', () => togglePlayMusic(music));
    card.querySelector('.download-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        if (typeof window.toggleOfflineMusic === 'function') {
            await window.toggleOfflineMusic(music);
        }
    });
    card.querySelector('.favorite-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFavoriteTrack(music.id);
        const btn = e.currentTarget;
        const isNowFav = AppState.favorites.has(music.id);
        btn.classList.toggle('active', isNowFav);
        btn.querySelector('span').innerText = isNowFav ? 'favorite' : 'favorite_border';
    });
    card.querySelector('.more-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        openContextMenu(music);
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