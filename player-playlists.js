// ===== GERENCIADOR DE PLAYLISTS E FAVORITOS (com Supabase) =====

function renderPlaylists() {
    const likedCountTxt = document.getElementById('likedMusicsCountTxt');
    if (likedCountTxt) {
        const favSize = AppState.favorites ? AppState.favorites.size : 0;
        likedCountTxt.textContent = `${favSize} ${favSize === 1 ? 'música' : 'músicas'}`;
    }

    if (!DOM.playlistsContainer) return;
    DOM.playlistsContainer.innerHTML = '';

    if (!AppState.userPlaylists || AppState.userPlaylists.length === 0) {
        DOM.playlistsContainer.innerHTML = `<div class="empty-state-box"><span class="material-symbols-rounded">folder_open</span><p>Nenhuma playlist criada ainda.</p></div>`;
        return;
    }

    AppState.userPlaylists.forEach(playlist => {
        const item = document.createElement('div');
        item.className = 'playlist-row-item';
        const count = playlist.musics ? playlist.musics.length : 0;

        const coverHtml = playlist.cover 
            ? `<img src="${playlist.cover}" style="width:44px;height:44px;object-fit:cover;border-radius:8px;">`
            : `<span class="material-symbols-rounded">queue_music</span>`;

        item.innerHTML = `
            <div class="playlist-item-left">
                <div class="playlist-icon-box">
                    ${coverHtml}
                </div>
                <div class="playlist-item-info">
                    <h3>${escapeHtml(playlist.name)}</h3>
                    <p>${count} ${count === 1 ? 'música' : 'músicas'}</p>
                </div>
            </div>
            <button class="playlist-more-btn">
                <span class="material-symbols-rounded">more_vert</span>
            </button>
        `;

        item.querySelector('.playlist-item-left').addEventListener('click', () => { openPlaylistDetail(playlist); });
        item.querySelector('.playlist-more-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof window.openPlaylistContextMenu === 'function') window.openPlaylistContextMenu(playlist);
        });

        DOM.playlistsContainer.appendChild(item);
    });
}

async function openPlaylistDetail(playlist) {
    AppState.currentPlaylistFilter = playlist.id;
    if (DOM.playlistsRootView) DOM.playlistsRootView.style.display = 'none';
    if (DOM.playlistDetailView) DOM.playlistDetailView.style.display = 'block';

    const titleEl = document.getElementById('playlistDetailName');
    const countEl = document.getElementById('playlistDetailCount');
    const tracksContainer = document.getElementById('playlistTracksList');
    if (titleEl) titleEl.textContent = playlist.name;
    if (!tracksContainer) return;
    tracksContainer.innerHTML = '';

    if (!playlist.musics) playlist.musics = [];
    const playlistMusics = AppState.musics.filter(m => playlist.musics.includes(m.id));
    if (countEl) countEl.textContent = `${playlistMusics.length} ${playlistMusics.length === 1 ? 'música' : 'músicas'}`;

    if (playlistMusics.length === 0) {
        tracksContainer.innerHTML = `<div class="empty-state"><span class="material-symbols-rounded">music_note</span><p>Playlist vazia.</p></div>`;
        return;
    }

    for (const music of playlistMusics) {
        if (typeof window.createMusicCardElement === 'function') {
            tracksContainer.appendChild(await window.createMusicCardElement(music));
        }
    }
}

async function openLikedMusicsDetail() {
    AppState.currentPlaylistFilter = 'favorites';

    if (DOM.playlistsRootView) DOM.playlistsRootView.style.display = 'none';
    if (DOM.playlistDetailView) DOM.playlistDetailView.style.display = 'block';

    const titleEl = document.getElementById('playlistDetailName');
    if (titleEl) titleEl.textContent = "Músicas Curtidas";

    const tracksContainer = document.getElementById('playlistTracksList');
    if (!tracksContainer) return;
    tracksContainer.innerHTML = '';

    const likedMusics = AppState.musics.filter(m => AppState.favorites && AppState.favorites.has(m.id));

    const countEl = document.getElementById('playlistDetailCount');
    if (countEl) countEl.textContent = `${likedMusics.length} ${likedMusics.length === 1 ? 'música' : 'músicas'}`;

    if (likedMusics.length === 0) {
        tracksContainer.innerHTML = `<div class="empty-state"><span class="material-symbols-rounded">favorite</span><p>Nenhum favorito.</p></div>`;
        return;
    }

    for (const music of likedMusics) {
        if (typeof window.createMusicCardElement === 'function') {
            tracksContainer.appendChild(await window.createMusicCardElement(music));
        }
    }
}

function closePlaylistDetail() {
    AppState.currentPlaylistFilter = null;
    if (DOM.playlistsRootView) DOM.playlistsRootView.style.display = 'block';
    if (DOM.playlistDetailView) DOM.playlistDetailView.style.display = 'none';
    
    renderPlaylists();
    if (typeof window.renderLibrary === 'function') window.renderLibrary();
}

// ========== MODAL DE CRIAÇÃO/RENOMEAR PLAYLIST (com Supabase) ==========
function openCreatePlaylistModal() {
    AppState.playlistModalMode = 'create';
    const modalTitle = document.getElementById('modalPlaylistTitle');
    if (modalTitle) modalTitle.textContent = "Criar Nova Playlist";
    if (DOM.newPlaylistName) DOM.newPlaylistName.value = '';
    if (DOM.playlistModal) DOM.playlistModal.classList.add('active');
    
    // Limpa o campo de capa e o nome do arquivo
    const coverInput = document.getElementById('playlistCoverFile');
    if (coverInput) coverInput.value = '';
    const coverFileNameSpan = document.getElementById('coverFileName');
    if (coverFileNameSpan) coverFileNameSpan.textContent = 'Nenhum arquivo escolhido';
}
window.openCreatePlaylistModal = openCreatePlaylistModal;

function setupPlaylistModal() {
    const modal = DOM.playlistModal;
    const nameInput = DOM.newPlaylistName;
    const confirmBtn = DOM.confirmModalBtn;
    const cancelBtn = DOM.cancelModalBtn;

    if (!modal || !nameInput || !confirmBtn || !cancelBtn) {
        console.warn('Elementos do modal de playlist não encontrados');
        return;
    }

    // Remove listeners antigos (clona para evitar duplicação)
    const newConfirm = confirmBtn.cloneNode(true);
    const newCancel = cancelBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
    cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
    DOM.confirmModalBtn = newConfirm;
    DOM.cancelModalBtn = newCancel;

    newCancel.addEventListener('click', () => {
        modal.classList.remove('active');
    });

    newConfirm.addEventListener('click', async () => {
        const name = nameInput.value.trim();
        if (!name) {
            showToast("Digite um nome para a playlist", "danger");
            return;
        }

        let coverUrl = null;
        const coverFile = document.getElementById('playlistCoverFile').files[0];
        if (coverFile && typeof window.uploadFileToSupabase === 'function') {
            try {
                coverUrl = await window.uploadFileToSupabase(coverFile, `playlist-covers/${AppState.userId || 'anonymous'}`);
            } catch(e) { console.warn(e); }
        }

        if (AppState.playlistModalMode === 'create') {
            const newPlaylist = { 
                id: Date.now(), 
                name: name, 
                musics: [], 
                cover: coverUrl,
                user_id: AppState.userId 
            };
            if (!AppState.userPlaylists) AppState.userPlaylists = [];
            AppState.userPlaylists.push(newPlaylist);
            
            // Salvar no Supabase
            if (AppState.userId && typeof window.saveUserPlaylist === 'function') {
                const saved = await window.saveUserPlaylist({
                    id: newPlaylist.id,
                    user_id: AppState.userId,
                    name: name,
                    cover: coverUrl,
                    musics: []
                });
                if (!saved) {
                    showToast("Erro ao salvar playlist no servidor", "danger");
                    AppState.userPlaylists.pop(); // remove local se falhou
                    modal.classList.remove('active');
                    return;
                }
            }
            showToast(`Playlist "${name}" criada!`, "success");
        } 
        else if (AppState.playlistModalMode === 'rename' && AppState.selectedPlaylistForMenu) {
            const oldPlaylist = AppState.selectedPlaylistForMenu;
            oldPlaylist.name = name;
            if (coverUrl) oldPlaylist.cover = coverUrl;
            
            if (AppState.userId && typeof window.saveUserPlaylist === 'function') {
                await window.saveUserPlaylist({
                    id: oldPlaylist.id,
                    user_id: AppState.userId,
                    name: name,
                    cover: coverUrl || oldPlaylist.cover,
                    musics: oldPlaylist.musics || []
                });
            }
            showToast("Playlist atualizada!", "success");
        }

        // Fallback localStorage
        await savePlaylists(AppState.userPlaylists);
        
        // Atualiza interface
        if (typeof window.renderLibrary === 'function') window.renderLibrary();
        if (typeof window.renderPlaylists === 'function') window.renderPlaylists();
        
        modal.classList.remove('active');
        document.getElementById('playlistCoverFile').value = '';
        document.getElementById('coverFileName').textContent = 'Nenhum arquivo escolhido';
    });

    // Configura o label de upload de capa
    const coverInput = document.getElementById('playlistCoverFile');
    const coverLabel = document.getElementById('playlistCoverLabel');
    const coverFileNameSpan = document.getElementById('coverFileName');
    if (coverInput && coverLabel) {
        coverLabel.addEventListener('click', () => coverInput.click());
        coverInput.addEventListener('change', () => {
            if (coverInput.files.length > 0) {
                coverFileNameSpan.textContent = coverInput.files[0].name;
            } else {
                coverFileNameSpan.textContent = 'Nenhum arquivo escolhido';
            }
        });
    }

    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
    });
}

function setupPlaylistDetailEvents() {
    const backBtn = document.getElementById('backToPlaylistsBtn');
    if (backBtn) {
        backBtn.addEventListener('click', closePlaylistDetail);
    }
}

// Salvar playlists localmente e no Supabase (usado como fallback)
async function savePlaylists(playlists) {
    localStorage.setItem('supabase_player_playlists', JSON.stringify(playlists));
    if (AppState.userId && typeof window.saveUserPlaylist === 'function') {
        // Não podemos salvar todas de uma vez sem loop, mas vamos apenas garantir que cada playlist exista
        for (const pl of playlists) {
            await window.saveUserPlaylist({
                id: pl.id,
                user_id: AppState.userId,
                name: pl.name,
                cover: pl.cover || null,
                musics: pl.musics || []
            });
        }
    }
}

function saveFavorites(favs) {
    localStorage.setItem('supabase_player_favorites', JSON.stringify(favs));
    // Supabase já lida com favoritos via toggleFavorite, não precisa salvar aqui
}

// Sobrescrever a exclusão de playlist para usar Supabase
async function deletePlaylist() {
    if (!AppState.selectedPlaylistForMenu) return;
    
    const playlistName = AppState.selectedPlaylistForMenu.name;
    
    showConfirmDialog('Excluir playlist', `Tem certeza que deseja excluir a playlist "${playlistName}"?`, async () => {
        if (AppState.userId && typeof window.deleteUserPlaylist === 'function') {
            const success = await window.deleteUserPlaylist(AppState.selectedPlaylistForMenu.id, AppState.userId);
            if (success) {
                AppState.userPlaylists = AppState.userPlaylists.filter(p => p.id !== AppState.selectedPlaylistForMenu.id);
                renderPlaylists();
                showToast("Playlist excluída", "danger");
                if (AppState.currentPlaylistFilter === AppState.selectedPlaylistForMenu.id) closePlaylistDetail();
            } else {
                showToast("Erro ao excluir playlist", "danger");
            }
        } else {
            // Fallback local
            AppState.userPlaylists = AppState.userPlaylists.filter(p => p.id !== AppState.selectedPlaylistForMenu.id);
            savePlaylists(AppState.userPlaylists);
            renderPlaylists();
            showToast("Playlist excluída", "danger");
            if (AppState.currentPlaylistFilter === AppState.selectedPlaylistForMenu.id) closePlaylistDetail();
        }
        closeContextMenu();
    });
}

// Redirecionar a exclusão antiga para a nova
window.deletePlaylist = deletePlaylist;

// Remover a função antiga se existir
if (typeof window.oldDeletePlaylist !== 'undefined') {
    window.oldDeletePlaylist = deletePlaylist;
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

// Exportações globais
window.renderPlaylists = renderPlaylists;
window.openPlaylistDetail = openPlaylistDetail;
window.openLikedMusicsDetail = openLikedMusicsDetail;
window.closePlaylistDetail = closePlaylistDetail;
window.setupPlaylistModal = setupPlaylistModal;
window.setupPlaylistDetailEvents = setupPlaylistDetailEvents;
window.savePlaylists = savePlaylists;
window.saveFavorites = saveFavorites;
window.openCreatePlaylistModal = openCreatePlaylistModal;