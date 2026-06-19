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

    menu.innerHTML = `
        <div class="ctx-header">
            <img class="ctx-cover" src="${music.cover || ''}" onerror="this.style.display='none'">
            <div class="ctx-header-info">
                <span class="ctx-title">${escapeHtml(music.title)}</span>
                <span class="ctx-artist">${escapeHtml(music.artist)}</span>
            </div>
        </div>
        <div class="ctx-divider"></div>
        <div class="ctx-options">
            <button id="menuAddToQueue" class="ctx-btn">
                <div class="ctx-icon ctx-icon-purple"><span class="material-symbols-rounded">add_to_queue</span></div>
                <span>Adicionar à fila</span>
            </button>
            <button id="menuAddToPlaylist" class="ctx-btn">
                <div class="ctx-icon ctx-icon-blue"><span class="material-symbols-rounded">playlist_add</span></div>
                <span>Adicionar à playlist</span>
            </button>
            <button id="menuFavoriteTrack" class="ctx-btn">
                <div class="ctx-icon ctx-icon-pink"><span class="material-symbols-rounded">${isFav ? 'favorite' : 'favorite_border'}</span></div>
                <span>${isFav ? 'Desfavoritar' : 'Favoritar'}</span>
            </button>
            <button id="menuDownloadTrack" class="ctx-btn">
                <div class="ctx-icon ctx-icon-green"><span class="material-symbols-rounded">download</span></div>
                <span>Baixar música</span>
            </button>
            ${inPlaylist ? `
            <button id="menuRemoveFromPlaylist" class="ctx-btn ctx-btn-danger">
                <div class="ctx-icon ctx-icon-red"><span class="material-symbols-rounded">remove_circle</span></div>
                <span>Remover desta playlist</span>
            </button>` : ''}
        </div>
    `;

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
            <div class="ctx-header">
                <div class="ctx-icon ctx-icon-purple" style="width:48px;height:48px;border-radius:12px;flex-shrink:0;">
                    <span class="material-symbols-rounded" style="font-size:26px;">queue_music</span>
                </div>
                <div class="ctx-header-info">
                    <span class="ctx-title">${escapeHtml(playlist.name)}</span>
                    <span class="ctx-artist">${(playlist.musics?.length || 0)} músicas</span>
                </div>
            </div>
            <div class="ctx-divider"></div>
            <div class="ctx-options">
                <button id="menuRenamePlaylist" class="ctx-btn">
                    <div class="ctx-icon ctx-icon-blue">
                        <span class="material-symbols-rounded">edit</span>
                    </div>
                    <span>Renomear playlist</span>
                </button>
                <button id="menuDeletePlaylist" class="ctx-btn ctx-btn-danger">
                    <div class="ctx-icon ctx-icon-red">
                        <span class="material-symbols-rounded">delete</span>
                    </div>
                    <span>Excluir playlist</span>
                </button>
            </div>
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
// Suporta tanto .ctx-btn (novo) quanto .menu-option-btn (compat)
document.addEventListener('click', (e) => {
    const button = e.target.closest('.ctx-btn, .menu-option-btn');
    if (!button) return;

    const music = AppState.selectedTrackForMenu;
    const action = button.id;
    if (!action) return;

    e.stopPropagation();

    switch (action) {
        case 'menuAddToQueue':
            if (music) {
                if (!AppState.queue) AppState.queue = [];
                AppState.queue.push(music);
                showToast(`"${music.title}" adicionada à fila`, 'success');
                if (typeof window.renderQueuePanel === 'function') window.renderQueuePanel();
            }
            closeContextMenu();
            break;

        case 'menuAddToPlaylist':
            if (music && typeof window.openAddToPlaylistModal === 'function') {
                window.openAddToPlaylistModal(music);
            }
            closeContextMenu();
            break;

        case 'menuFavoriteTrack':
            if (music && typeof window.toggleFavoriteTrack === 'function') {
                window.toggleFavoriteTrack(music.id);
                showToast(AppState.favorites?.has(music.id) ? 'Removido dos favoritos' : 'Adicionado aos favoritos', 'success');
            }
            closeContextMenu();
            break;

        case 'menuDownloadTrack':
            if (music && typeof window.toggleOfflineMusic === 'function') {
                window.toggleOfflineMusic(music);
            } else if (music && typeof window.cacheAudio === 'function') {
                window.cacheAudio(music);
            }
            closeContextMenu();
            break;

        case 'menuRemoveFromPlaylist':
            if (music) removeTrackFromCurrentPlaylist(music.id);
            closeContextMenu();
            break;

        case 'menuDeleteMusic':
            if (music && confirm('Excluir esta música permanentemente?')) {
                if (typeof deleteMusicPermanently === 'function') deleteMusicPermanently(music);
            }
            closeContextMenu();
            break;

        case 'menuRenamePlaylist':
            triggerRenamePlaylistForm();
            break;

        case 'menuDeletePlaylist':
            deletePlaylist();
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

// ========== PAINEL DE FILA ==========
function openQueuePanel() {
    const panel = document.getElementById('queuePanel');
    if (!panel) return;
    renderQueuePanel();
    panel.classList.add('active');
}

function closeQueuePanel() {
    const panel = document.getElementById('queuePanel');
    if (panel) panel.classList.remove('active');
}

function renderQueuePanel() {
    const list = document.getElementById('queuePanelList');
    if (!list) return;

    const manualQueue = AppState.queue || [];
    const autoQueue = AppState.autoQueue || [];
    const hasAnything = manualQueue.length > 0 || autoQueue.length > 0;

    if (!hasAnything) {
        list.innerHTML = `
            <div class="queue-empty-state">
                <span class="material-symbols-rounded">queue_music</span>
                <p>Fila vazia</p>
                <span>Toque em uma música para começar</span>
            </div>`;
        return;
    }

    list.innerHTML = '';

    function makeItem(music, idx, isManual) {
        const item = document.createElement('div');
        item.className = 'queue-panel-item';
        item.innerHTML = `
            <img src="${music.cover || 'https://via.placeholder.com/48'}" class="queue-panel-cover">
            <div class="queue-panel-info">
                <p class="queue-panel-title">${escapeHtml(music.title)}</p>
                <p class="queue-panel-artist">${escapeHtml(music.artist)}</p>
            </div>
            ${isManual ? `<button class="queue-panel-remove"><span class="material-symbols-rounded">close</span></button>` : ''}
        `;
        if (isManual) {
            item.querySelector('.queue-panel-remove').addEventListener('click', (e) => {
                e.stopPropagation();
                AppState.queue.splice(idx, 1);
                renderQueuePanel();
            });
        }
        item.addEventListener('click', (e) => {
            if (e.target.closest('.queue-panel-remove')) return;
            if (isManual) AppState.queue = AppState.queue.slice(idx);
            else AppState.autoQueue = AppState.autoQueue.slice(idx);
            playMusicTrack(music);
            closeQueuePanel();
        });
        return item;
    }

    // Seção fila manual
    if (manualQueue.length > 0) {
        const label = document.createElement('p');
        label.className = 'queue-section-label';
        label.textContent = 'Na fila';
        list.appendChild(label);
        manualQueue.forEach((music, idx) => list.appendChild(makeItem(music, idx, true)));
    }

    // Seção fila automática
    if (autoQueue.length > 0) {
        const label = document.createElement('p');
        label.className = 'queue-section-label';
        label.textContent = AppState.isShuffle ? 'Próximas (aleatório)' : 'Próximas';
        list.appendChild(label);
        autoQueue.slice(0, 20).forEach((music, idx) => list.appendChild(makeItem(music, idx, false)));
    }
}

// Exposição global
window.initMenusAndSearch = initMenusAndSearch;
window.openContextMenu = openContextMenu;
window.openPlaylistContextMenu = openPlaylistContextMenu;
window.closeContextMenu = closeContextMenu;
window.addTrackToPlaylist = addTrackToPlaylist;
window.removeTrackFromCurrentPlaylist = removeTrackFromCurrentPlaylist;
window.triggerRenamePlaylistForm = triggerRenamePlaylistForm;
window.openQueuePanel = openQueuePanel;
window.closeQueuePanel = closeQueuePanel;
window.renderQueuePanel = renderQueuePanel;