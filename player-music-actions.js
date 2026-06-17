// ===== AÇÕES DE MÚSICA (EXCLUSÃO) =====

async function deleteMusicPermanently(music) {
    try {
        if (typeof window.deleteMusicFromSupabase === 'function') {
            const ok = await window.deleteMusicFromSupabase(music.id);
            if (!ok) throw new Error("Falha na exclusão do Supabase");
        }
        AppState.musics = AppState.musics.filter(m => m.id !== music.id);
        localStorage.setItem('supabase_player_fallback', JSON.stringify(AppState.musics));
        AppState.favorites.delete(music.id);
        saveFavorites(Array.from(AppState.favorites));
        AppState.userPlaylists.forEach(pl => {
            pl.musics = pl.musics.filter(id => id !== music.id);
        });
        savePlaylists(AppState.userPlaylists);
        renderMusicList();
        renderPlaylists();
        showToast("Música excluída com sucesso", "success");
        if (AppState.currentMusicId === music.id) {
            DOM.audio.pause();
            AppState.currentMusicId = null;
            AppState.playing = false;
            DOM.playerBottomBar.style.display = 'none';
        }
    } catch (err) {
        showToast("Erro ao excluir: " + err.message, "danger");
    }
}

window.deleteMusicPermanently = deleteMusicPermanently;