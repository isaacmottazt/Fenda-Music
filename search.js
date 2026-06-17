// ===== ABA BUSCAR (COM HISTÓRICO NO SUPABASE E ARTISTAS DA TABELA) =====

let searchInput = null;
let searchIconSpan = null;
let recentSearches = [];

function initSearch() {
    searchInput = document.getElementById('globalSearchInput');
    if (!searchInput) return;

    searchIconSpan = document.querySelector('.search-bar span:first-child');
    
    searchInput.addEventListener('input', debounce(handleSearch, 300));
    searchInput.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const query = searchInput.value.trim().toLowerCase();
            if (query.length > 0 && AppState.userId) {
                await window.addToSearchHistory(AppState.userId, query);
                recentSearches = await window.loadSearchHistory(AppState.userId, 5);
                renderRecentSearches();
            }
        }
    });
    searchInput.addEventListener('focus', updateSearchIcon);
    searchInput.addEventListener('blur', () => {
        setTimeout(() => {
            if (searchInput && !searchInput.value.trim()) updateSearchIcon();
        }, 150);
    });
    if (searchIconSpan) {
        searchIconSpan.style.cursor = 'pointer';
        searchIconSpan.addEventListener('click', () => {
            if (searchInput.value.trim()) clearSearchAndReset();
        });
    }

    if (AppState.userId) {
        window.loadSearchHistory(AppState.userId, 5).then(terms => {
            recentSearches = terms;
            renderRecentSearches();
        });
    }
    renderCategories();
    const clearBtn = document.getElementById('clearRecentSearchesBtn');
    if (clearBtn) clearBtn.addEventListener('click', clearAllRecentSearches);
}

function updateSearchIcon() {
    if (!searchIconSpan) return;
    const hasValue = searchInput.value.trim().length > 0;
    const isFocused = document.activeElement === searchInput;
    if (hasValue || isFocused) {
        searchIconSpan.innerHTML = '<span class="material-symbols-rounded">arrow_back</span>';
    } else {
        searchIconSpan.innerHTML = '<span class="material-symbols-rounded">search</span>';
    }
}

function clearSearchAndReset() {
    if (!searchInput) return;
    searchInput.value = '';
    updateSearchIcon();
    document.getElementById('searchResults').style.display = 'none';
    document.getElementById('searchDefaultView').style.display = 'block';
    const searchHeader = document.querySelector('.search-header');
    if (searchHeader) searchHeader.classList.remove('hide-title');
    renderRecentSearches();
}

async function handleSearch() {
    const query = searchInput.value.trim().toLowerCase();
    const searchHeader = document.querySelector('.search-header');
    updateSearchIcon();
    if (query.length === 0) {
        document.getElementById('searchResults').style.display = 'none';
        document.getElementById('searchDefaultView').style.display = 'block';
        if (searchHeader) searchHeader.classList.remove('hide-title');
        return;
    }
    if (searchHeader) searchHeader.classList.add('hide-title');
    
    // Buscar músicas
    const musicResults = AppState.musics.filter(m => 
        m.title.toLowerCase().includes(query) || 
        m.artist.toLowerCase().includes(query)
    );
    
    // Buscar artistas da tabela artists
    let tableArtists = [];
    if (typeof window.searchArtists === 'function') {
        tableArtists = await window.searchArtists(query);
    }
    
    // Artistas derivados das músicas (para complementar)
    const artistSet = new Set();
    musicResults.forEach(m => artistSet.add(m.artist));
    const musicArtists = Array.from(artistSet).map(artist => ({ type: 'artist', name: artist }));
    
    // Combinar artistas da tabela com os das músicas, evitando duplicatas
    const allArtists = [...tableArtists];
    musicArtists.forEach(ma => {
        if (!allArtists.some(a => a.name === ma.name)) {
            allArtists.push({ id: null, name: ma.name, image_url: null, bio: null, type: 'music-derived' });
        }
    });
    
    // Montar HTML dos resultados
    let resultsHtml = '';
    
    // Seção de artistas (tabela + derivados)
    if (allArtists.length) {
        resultsHtml += `
        <div class="search-results-section">
            <h3>ARTISTAS</h3>
            ${allArtists.map(artist => {
                const isDbArtist = artist.id !== null && artist.id !== undefined;
                const artistName = artist.name;
                const artistImage = artist.image_url;
                const artistBio = artist.bio;
                return `
                <div class="search-result-item" data-type="artist" data-artist-name="${escapeHtml(artistName)}" data-artist-id="${artist.id || ''}">
                    <div class="result-icon">
                        ${artistImage ? `<img src="${artistImage}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;">` : '<span class="material-symbols-rounded">person</span>'}
                    </div>
                    <div class="result-info">
                        <div class="result-title">${escapeHtml(artistName)}</div>
                        <div class="result-subtitle">Artista${artistBio ? ` • ${escapeHtml(artistBio.substring(0, 40))}` : ''}</div>
                    </div>
                    <button class="result-action follow-btn" data-artist="${escapeHtml(artistName)}">Seguir</button>
                </div>
                `;
            }).join('')}
        </div>
        `;
    }
    
    // Seção de músicas
    if (musicResults.length) {
        resultsHtml += `
        <div class="search-results-section">
            <h3>MÚSICAS</h3>
            ${musicResults.map(music => `
                <div class="search-result-item" data-type="music" data-id="${music.id}">
                    <div class="result-icon">
                        <img src="${music.cover || 'https://via.placeholder.com/150'}" onerror="this.src='https://via.placeholder.com/48'">
                    </div>
                    <div class="result-info">
                        <div class="result-title">${escapeHtml(music.title)}</div>
                        <div class="result-subtitle">Música • ${escapeHtml(music.artist)}</div>
                    </div>
                    <button class="result-more-btn" data-id="${music.id}"><span class="material-symbols-rounded">more_vert</span></button>
                </div>
            `).join('')}
        </div>
        `;
    }
    
    if (!resultsHtml) {
        resultsHtml = `<div class="empty-state"><span class="material-symbols-rounded">search_off</span><p>Nenhum resultado encontrado para "${escapeHtml(query)}"</p></div>`;
    }
    
    document.getElementById('searchResults').innerHTML = resultsHtml;
    document.getElementById('searchResults').style.display = 'block';
    document.getElementById('searchDefaultView').style.display = 'none';
    
    // Eventos para músicas
    document.querySelectorAll('.search-result-item[data-type="music"]').forEach(el => {
        const id = parseInt(el.dataset.id);
        const music = AppState.musics.find(m => m.id === id);
        if (music) {
            el.addEventListener('click', (e) => {
                if (e.target.closest('.result-more-btn')) return;
                playMusicTrack(music);
            });
            const moreBtn = el.querySelector('.result-more-btn');
            if (moreBtn) moreBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof window.openContextMenu === 'function') window.openContextMenu(music);
            });
        }
    });
    
    // Eventos para artistas
    document.querySelectorAll('.search-result-item[data-type="artist"]').forEach(el => {
        const artistName = el.dataset.artistName;
        el.addEventListener('click', (e) => {
            if (e.target.closest('.follow-btn')) return;
            const firstMusic = AppState.musics.find(m => m.artist === artistName);
            if (firstMusic) playMusicTrack(firstMusic);
            else showToast(`Nenhuma música de ${artistName} encontrada`, "danger");
        });
        const followBtn = el.querySelector('.follow-btn');
        if (followBtn) {
            followBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                showToast(`Você começou a seguir ${artistName}`, "success");
                followBtn.textContent = "Seguindo";
                followBtn.disabled = true;
            });
        }
    });
}

function renderRecentSearches() {
    const container = document.getElementById('recentSearchesList');
    if (!container) return;
    if (recentSearches.length === 0) {
        container.innerHTML = '<div style="color: rgba(255,255,255,0.4); padding: 12px;">Nenhuma busca recente</div>';
        return;
    }
    container.innerHTML = recentSearches.map(term => `
        <div class="recent-item" data-term="${escapeHtml(term)}">
            <span class="material-symbols-rounded">history</span>
            <div class="recent-info">
                <span class="recent-text">${escapeHtml(term)}</span>
                <span class="recent-sub">Busca recente</span>
            </div>
            <button class="remove-search" data-term="${escapeHtml(term)}"><span class="material-symbols-rounded">close</span></button>
        </div>
    `).join('');
    container.querySelectorAll('.recent-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.closest('.remove-search')) return;
            const term = item.dataset.term;
            searchInput.value = term;
            handleSearch();
        });
        const removeBtn = item.querySelector('.remove-search');
        removeBtn?.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (AppState.userId) {
                recentSearches = await window.loadSearchHistory(AppState.userId, 5);
                renderRecentSearches();
            }
        });
    });
}

async function clearAllRecentSearches() {
    if (AppState.userId) await window.clearSearchHistory(AppState.userId);
    recentSearches = [];
    renderRecentSearches();
}

function renderCategories() {
    const categories = ['MPB', 'Rock', 'Pop', 'Sertanejo', 'Funk', 'Eletrônica'];
    const container = document.getElementById('categoriesList');
    if (!container) return;
    container.innerHTML = categories.map(cat => `<div class="category-card" data-category="${cat}">${cat}</div>`).join('');
    container.querySelectorAll('.category-card').forEach(card => {
        card.addEventListener('click', () => {
            searchInput.value = card.dataset.category;
            handleSearch();
        });
    });
}

function debounce(fn, delay) {
    let timer;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
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

window.initSearch = initSearch;
window.renderRecentSearches = renderRecentSearches;