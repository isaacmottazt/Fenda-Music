// ===== MENU DE CONTEXTO (completo e funcional) =====

let pendingMusicForPlaylist = null;

function initMenusAndSearch() {
    // Configuração da busca (se existir)
    if (DOM.searchInput) {
        // Evita duplicação de listeners
        const searchInputEl = document.getElementById('searchInput');
        if (searchInputEl && searchInputEl !== DOM.searchInput) {
            DOM.searchInput = searchInputEl;
        }
        
        DOM.searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase().trim();
            const cards = document.querySelectorAll('#musicList .music-card');
            cards.forEach(card => {
                const title = card.querySelector('.music-card-details h3')?.textContent.toLowerCase() || '';
                const artist = card.querySelector('.music-card-details p')?.textContent.toLowerCase() || '';
                if (title.includes(term) || artist.includes(term)) {
                    card.style.setProperty('display', 'flex', 'important');
                } else {
                    card.style.setProperty('display', 'none', 'important');
                }
            });
        });

        DOM.searchInput.addEventListener('focus', () => {
            const navBar = document.querySelector('.nav-bar');
            if (navBar) navBar.style.setProperty('display', 'none', 'important');
            if (DOM.playerBottomBar) DOM.playerBottomBar.style.setProperty('display', 'none', 'important');
        });

        DOM.searchInput.addEventListener('blur', () => {
            setTimeout(() => {
                const navBar = document.querySelector('.nav-bar');
                if (navBar) navBar.style.setProperty('display', 'flex', 'important');
                if (DOM.playerBottomBar && AppState.currentMusicId) {
                    DOM.playerBottomBar.style.setProperty('display', 'flex', 'important');
                }
            }, 180);
        });
    }

    // Configuração do backdrop para fechar o menu
    const backdrop = document.getElementById('contextMenuBackdrop');
    if (backdrop) {
        backdrop.removeEventListener('click', closeContextMenu);
        backdrop.addEventListener('click', closeContextMenu);
    }

    setupAddToPlaylistModalSpotify();
}

// ========== MODAL ADICIONAR À PLAYLIST ==========
function setupAddToPlaylistModalSpotify() {
    const modal = document.getElementById('addToPlaylistModal');
    const subModal = document.getElementById('createPlaylistSubModal');
    const searchInput = document.getElementById('playlistSearchInput');
    const listContainer = document.getElementById('playlistSelectList');
    const openCreateBtn = document.getElementById('openCreatePlaylistFromAddBtn');
    const subNameInput = document.getElementById('subNewPlaylistName');
    const cancelSubBtn = document.getElementById('cancelSubModalBtn');
    const confirmSubBtn = document.getElementById('confirmSubModalBtn');

    if (!modal) return;

    function renderPlaylistList(filterText = '') {
        if (!listContainer) return;
        const filtered = AppState.userPlaylists.filter(p => 
            p.name.toLowerCase().includes(filterText.toLowerCase())
        );
        
        if (filtered.length === 0) {
            listContainer.innerHTML = `<div style="padding:24px; text-align:center; color:rgba(255,255,255,0.4);">Nenhuma playlist encontrada</div>`;
            return;
        }

        listContainer.innerHTML = '';
        filtered.forEach(playlist => {
            const count = playlist.musics ? playlist.musics.length : 0;
            const item = document.createElement('div');
            item.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding:12px; border-radius:12px; cursor:pointer; transition:0.1s; margin-bottom:4px;';
            item.innerHTML = `
                <div style="display:flex; align-items:center; gap:12px;">
                    <div style="width:44px; height:44px; background:rgba(146,76,255,0.2); border-radius:12px; display:flex; align-items:center; justify-content:center;">
                        <span class="material-symbols-rounded" style="color:#b07fff;">playlist_play</span>
                    </div>
                    <div>
                        <div style="font-weight:600;">${escapeHtml(playlist.name)}</div>
                        <div style="font-size:12px; color:rgba(255,255,255,0.5);">${count} ${count === 1 ? 'música' : 'músicas'}</div>
                    </div>
                </div>
                <span class="material-symbols-rounded" style="color:rgba(255,255,255,0.3);">add_circle</span>
            `;
            item.addEventListener('click', () => {
                if (pendingMusicForPlaylist) {
                    addTrackToPlaylist(pendingMusicForPlaylist, playlist.id);
                    modal.classList.remove('active');
                    pendingMusicForPlaylist = null;
                    if (searchInput) searchInput.value = '';
                }
            });
            listContainer.appendChild(item);
        });
    }

    function openAddToPlaylistModal(music) {
        pendingMusicForPlaylist = music;
        renderPlaylistList('');
        if (searchInput) searchInput.value = '';
        modal.classList.add('active');
    }

    function closeAddToPlaylistModal() {
        modal.classList.remove('active');
        pendingMusicForPlaylist = null;
        if (searchInput) searchInput.value = '';
    }

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            renderPlaylistList(e.target.value);
        });
    }

    if (openCreateBtn) {
        openCreateBtn.addEventListener('click', () => {
            if (subModal) subModal.classList.add('active');
        });
    }

    if (confirmSubBtn && subNameInput && subModal) {
        confirmSubBtn.addEventListener('click', () => {
            const name = subNameInput.value.trim();
            if (!name) return;
            
            const newPlaylist = { id: Date.now(), name: name, musics: [] };
            if (!AppState.userPlaylists) AppState.userPlaylists = [];
            AppState.userPlaylists.push(newPlaylist);
            savePlaylists(AppState.userPlaylists);
            
            if (pendingMusicForPlaylist) {
                addTrackToPlaylist(pendingMusicForPlaylist, newPlaylist.id);
                closeAddToPlaylistModal();
            } else {
                renderPlaylistList('');
                showToast(`Playlist "${name}" criada!`, "success");
            }
            
            subNameInput.value = '';
            subModal.classList.remove('active');
            renderPlaylists();
        });
    }

    if (cancelSubBtn && subModal) {
        cancelSubBtn.addEventListener('click', () => {
            subModal.classList.remove('active');
            if (subNameInput) subNameInput.value = '';
        });
        subModal.addEventListener('click', (e) => {
            if (e.target === subModal) {
                subModal.classList.remove('active');
                if (subNameInput) subNameInput.value = '';
            }
        });
    }

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeAddToPlaylistModal();
    });

    window.openAddToPlaylistModal = openAddToPlaylistModal;
}

// ========== ABRIR MENU (TRÊS PONTINHOS) ==========
function openContextMenu(music) {
    if (!music) return;
    AppState.selectedTrackForMenu = music;
    const menu = document.getElementById('contextMenuModal');
    const backdrop = document.getElementById('contextMenuBackdrop');
    if (!menu || !backdrop) return;

    const inPlaylist = AppState.currentPlaylistFilter && AppState.currentPlaylistFilter !== 'favorites';
    const isFav = AppState.favorites && AppState.favorites.has(music.id);
    const favIcon = isFav ? 'favorite' : 'favorite_border';
    const favText = isFav ? 'Desfavoritar' : 'Favoritar';

    let menuHTML = '';
    
    // Adicionar à playlist (sempre visível)
    menuHTML += `
        <button id="menuAddToPlaylist" class="menu-option-btn">
            <span class="material-symbols-rounded">playlist_add</span> Adicionar à playlist
        </button>
    `;
    
    // Favoritar/Desfavoritar
    menuHTML += `
        <button id="menuFavoriteTrack" class="menu-option-btn">
            <span class="material-symbols-rounded">${favIcon}</span> ${favText}
        </button>
    `;
    
    // Baixar música
    menuHTML += `
        <button id="menuDownloadTrack" class="menu-option-btn">
            <span class="material-symbols-rounded">download</span> Baixar música
        </button>
    `;
    
    // Remover desta playlist (apenas se estiver dentro de uma playlist específica)
    if (inPlaylist) {
        menuHTML += `
            <button id="menuRemoveFromPlaylist" class="menu-option-btn danger">
                <span class="material-symbols-rounded">remove_circle</span> Remover desta playlist
            </button>
        `;
    }

    menu.innerHTML = menuHTML;
    menu.classList.add('active');
    backdrop.classList.add('active');
}

function closeContextMenu() {
    const menu = document.getElementById('contextMenuModal');
    const backdrop = document.getElementById('contextMenuBackdrop');
    if (menu) menu.classList.remove('active');
    if (backdrop) backdrop.classList.remove('active');
    AppState.selectedTrackForMenu = null;
}

// ========== AÇÕES DO MENU ==========
function addTrackToPlaylist(music, playlistId) {
    const playlist = AppState.userPlaylists.find(p => p.id === playlistId);
    if (playlist && !playlist.musics.includes(music.id)) {
        playlist.musics.push(music.id);
        savePlaylists(AppState.userPlaylists);
        renderPlaylists();
        showToast(`Adicionado à playlist "${playlist.name}"`, "success");
    } else if (playlist) {
        showToast("Música já está na playlist", "danger");
    }
}

function removeTrackFromCurrentPlaylist(musicId) {
    if (!AppState.currentPlaylistFilter || AppState.currentPlaylistFilter === 'favorites') return;
    const playlist = AppState.userPlaylists.find(p => p.id === AppState.currentPlaylistFilter);
    if (playlist) {
        playlist.musics = playlist.musics.filter(id => id !== musicId);
        savePlaylists(AppState.userPlaylists);
        openPlaylistDetail(playlist);
        showToast("Música removida da playlist", "danger");
    }
}

function openPlaylistContextMenu(playlist) {
    AppState.selectedPlaylistForMenu = playlist;
    const menu = document.getElementById('contextMenuModal');
    const backdrop = document.getElementById('contextMenuBackdrop');
    if (menu && backdrop) {
        menu.innerHTML = `
            <button id="menuRenamePlaylist" class="menu-option-btn">
                <span class="material-symbols-rounded">edit</span> Renomear playlist
            </button>
            <button id="menuDeletePlaylist" class="menu-option-btn danger">
                <span class="material-symbols-rounded">delete</span> Excluir playlist
            </button>
        `;
        menu.classList.add('active');
        backdrop.classList.add('active');
        
        const renameBtn = document.getElementById('menuRenamePlaylist');
        const deleteBtn = document.getElementById('menuDeletePlaylist');
        
        if (renameBtn) {
            renameBtn.addEventListener('click', () => { 
                triggerRenamePlaylistForm(); 
                closeContextMenu(); 
            });
        }
        
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => { 
                // Usa o modal estilizado em vez de confirm nativo
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
                closeContextMenu(); // Fecha o menu de contexto antes do modal
            });
        }
    }
}

function triggerRenamePlaylistForm() {
    if (!AppState.selectedPlaylistForMenu) return;
    AppState.playlistModalMode = 'rename';
    const modalTitle = document.getElementById('modalPlaylistTitle');
    if (modalTitle) modalTitle.textContent = "Renomear Playlist";
    const nameInput = document.getElementById('newPlaylistName');
    if (nameInput) nameInput.value = AppState.selectedPlaylistForMenu.name;
    const modal = document.getElementById('playlistModal');
    if (modal) modal.classList.add('active');
    closeContextMenu();
}

function deletePlaylist() {
    if (!AppState.selectedPlaylistForMenu) return;
    if (confirm(`Tem certeza que deseja excluir a playlist "${AppState.selectedPlaylistForMenu.name}"?`)) {
        AppState.userPlaylists = AppState.userPlaylists.filter(p => p.id !== AppState.selectedPlaylistForMenu.id);
        savePlaylists(AppState.userPlaylists);
        renderPlaylists();
        showToast("Playlist excluída", "danger");
        if (AppState.currentPlaylistFilter === AppState.selectedPlaylistForMenu.id) closePlaylistDetail();
    }
    closeContextMenu();
}

// Evento global para capturar cliques nos botões do menu
document.addEventListener('click', (e) => {
    const button = e.target.closest('.menu-option-btn');
    if (!button) return;

    const music = AppState.selectedTrackForMenu;
    if (!music) return;

    const action = button.id;
    e.stopPropagation(); // Evita fechar o menu antes da ação

    switch (action) {
        case 'menuAddToQueue':
            if (typeof window.addToQueue === 'function') {
                window.addToQueue(music, false);
            } else {
                console.warn('addToQueue não encontrada');
            }
            closeContextMenu();
            break;
        case 'menuAddToPlaylist':
            if (typeof window.openAddToPlaylistModal === 'function') {
                window.openAddToPlaylistModal(music);
            }
            closeContextMenu();
            break;
        case 'menuRemoveFromPlaylist':
            removeTrackFromCurrentPlaylist(music.id);
            closeContextMenu();
            break;
        case 'menuDeleteMusic':
            if (confirm("Tem certeza que deseja excluir esta música permanentemente?")) {
                deleteMusicPermanently(music);
            }
            closeContextMenu();
            break;
        case 'menuFavoriteTrack':
            if (typeof window.toggleFavoriteTrack === 'function') {
                window.toggleFavoriteTrack(music.id);
            }
            closeContextMenu();
            break;
        case 'menuDownloadTrack':
            if (typeof window.cacheAudio === 'function') {
                window.cacheAudio(music.src, music.id);
            }
            closeContextMenu();
            break;
        default:
            break;
    }
});

// Fechar com tecla ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeContextMenu();
    }
});

// Exposição global
window.initMenusAndSearch = initMenusAndSearch;
window.openContextMenu = openContextMenu;
window.openPlaylistContextMenu = openPlaylistContextMenu;
window.closeContextMenu = closeContextMenu;
window.addTrackToPlaylist = addTrackToPlaylist;
window.removeTrackFromCurrentPlaylist = removeTrackFromCurrentPlaylist;
window.triggerRenamePlaylistForm = triggerRenamePlaylistForm;