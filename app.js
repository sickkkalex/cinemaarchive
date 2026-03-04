/**
 * Cinéma Archive - Application Logic
 * Refactored & Enhanced
 */

// --- CONFIG ---
const CONFIG = {
    OMDB_KEY: 'b9bd48a6',
    JIKAN: 'https://api.jikan.moe/v4',
    BASE_OMDB: 'https://www.omdbapi.com/',
    DEBOUNCE_DELAY: 420
};

// --- STATE MANAGEMENT ---
const State = {
    mode: 'all',
    timer: null,
    lastResults: [],
    trending: []
};

// --- UI HELPERS ---
const $ = (id) => document.getElementById(id);
const qS = (selector) => document.querySelector(selector);
const qSA = (selector) => document.querySelectorAll(selector);

/**
 * Creates film strip holes dynamically
 */
const initFilmStrips = () => {
    const strips = qSA('.strip');
    strips.forEach(strip => {
        if (strip.children.length === 0) {
            for (let i = 0; i < 70; i++) {
                const hole = document.createElement('div');
                hole.className = 'hole';
                strip.appendChild(hole);
            }
        }
    });
};

/**
 * Generates star rating HTML
 */
const getStarsHTML = (rating, max = 10) => {
    const normalized = Math.round((rating / max) * 5);
    const stars = '★'.repeat(normalized) + '☆'.repeat(5 - normalized);
    return `<span class="stars">${stars}<span>${Number(rating).toFixed(1)}/10</span></span>`;
};

/**
 * Generates badge/pill HTML
 */
const getPillHTML = (label, type = 'g') => {
    return `<span class="pill pill-${type}">${label}</span>`;
};

/**
 * Generates platforms HTML based on title and type
 */
const getPlatformsHTML = (title, type) => {
    const encoded = encodeURIComponent(title);
    const platforms = type === 'anime'
        ? [
            ['🟠', 'Crunchyroll', `https://www.crunchyroll.com/search?q=${encoded}`],
            ['🔴', 'Netflix', `https://www.netflix.com/search?q=${encoded}`],
            ['🔵', 'Amazon Prime', `https://www.amazon.it/s?k=${encoded}`],
            ['🟣', 'HIDIVE', `https://www.hidive.com/search#${encoded}`]
        ]
        : [
            ['🔴', 'Netflix', `https://www.netflix.com/search?q=${encoded}`],
            ['🔵', 'Amazon Prime', `https://www.amazon.it/s?k=${encoded}`],
            ['🟦', 'Disney+', `https://www.disneyplus.com/search/${encoded}`],
            ['⬜', 'Apple TV+', `https://tv.apple.com/search?term=${encoded}`],
            ['🟤', 'Mubi', `https://mubi.com/search?query=${encoded}`],
            ['🟥', 'Rakuten TV', `https://www.rakuten.tv/it/search?q=${encoded}`]
        ];

    return platforms.map(([emoji, name, url]) => `
        <a href="${url}" target="_blank" class="platform-link">
            <span>${emoji} ${name}</span>
            <span style="color:var(--gold-lo); font-size:12px">↗</span>
        </a>
    `).join('');
};

// --- API FETCHERS ---

/**
 * Fetch search results from APIs based on current mode
 */
const fetchSearchResults = async (query) => {
    const results = [];
    const encodedQuery = encodeURIComponent(query);
    
    try {
        const promises = [];

        // Jikan (Anime)
        if (State.mode === 'anime' || State.mode === 'all') {
            const limit = State.mode === 'anime' ? 10 : 5;
            promises.push(
                fetch(`${CONFIG.JIKAN}/anime?q=${encodedQuery}&limit=${limit}&sfw=true`)
                    .then(res => res.json())
                    .then(d => {
                        (d.data || []).forEach(a => {
                            results.push({
                                id: `anime_${a.mal_id}`,
                                mal_id: a.mal_id,
                                source: 'jikan',
                                type: 'anime',
                                title: a.title,
                                year: a.aired?.prop?.from?.year || '',
                                poster: a.images?.jpg?.image_url || '',
                                rating: a.score || 0
                            });
                        });
                    })
                    .catch(e => console.error('Jikan Search Error:', e))
            );
        }

        // OMDB (Movies/Series)
        if (State.mode !== 'anime') {
            const typeParam = State.mode === 'series' ? '&type=series' : State.mode === 'movie' ? '&type=movie' : '';
            promises.push(
                fetch(`${CONFIG.BASE_OMDB}?apikey=${CONFIG.OMDB_KEY}&s=${encodedQuery}${typeParam}`)
                    .then(res => res.json())
                    .then(d => {
                        if (d.Response === 'True') {
                            (d.Search || []).forEach(x => {
                                results.push({
                                    id: `omdb_${x.imdbID}`,
                                    imdbID: x.imdbID,
                                    source: 'omdb',
                                    type: x.Type === 'series' ? 'series' : 'movie',
                                    title: x.Title,
                                    year: x.Year,
                                    poster: x.Poster !== 'N/A' ? x.Poster : '',
                                    rating: 0
                                });
                            });
                        }
                    })
                    .catch(e => console.error('OMDB Search Error:', e))
            );
        }

        await Promise.all(promises);
    } catch (err) {
        console.error('General Search Error:', err);
    }

    return results.slice(0, 10);
};

// --- DATA RENDERING ---

/**
 * Renders the search dropdown
 */
const renderDropdown = (results) => {
    const dd = $('dropdown');
    const typeLabel = { movie: 'FILM', series: 'SERIE TV', anime: 'ANIME' };
    
    dd.innerHTML = results.map((item, i) => `
        <div class="drop-item fade-up" data-idx="${i}" style="animation-delay: ${i * 0.05}s">
            <div class="drop-thumb">
                ${item.poster ? `<img src="${item.poster}" alt="" loading="lazy"/>` : '🎞'}
            </div>
            <div style="flex:1; min-width:0">
                <div class="drop-title">${item.title}</div>
                <div class="drop-meta">
                    ${getPillHTML(typeLabel[item.type] || item.type.toUpperCase(), item.type === 'anime' ? 'r' : 'g')}
                    ${item.year ? `<span style="color:var(--muted); font-size:12px">${item.year}</span>` : ''}
                    ${item.rating > 0 ? `<span style="color:var(--gold); font-size:12px">★ ${item.rating}</span>` : ''}
                </div>
            </div>
            <span class="drop-chevron">›</span>
        </div>
    `).join('');

    dd.querySelectorAll('.drop-item').forEach(el => {
        el.addEventListener('mousedown', () => {
            const item = results[el.dataset.idx];
            $('search-input').value = item.title;
            closeDropdown();
            showDetail(item);
        });
    });
    
    dd.classList.add('open');
};

const closeDropdown = () => {
    $('dropdown').classList.remove('open');
};

/**
 * Renders the trending/popular grid
 */
const renderGrid = (items) => {
    const grid = $('trending-grid');
    grid.innerHTML = items.map((item, i) => `
        <div class="grid-card fade-up" data-idx="${i}" style="animation-delay: ${i * 0.05}s">
            <div class="grid-thumb">
                ${item.poster
                    ? `<img src="${item.poster}" alt="${item.title}" loading="lazy"/>`
                    : '<div class="grid-thumb-placeholder">🎞</div>'}
                <div class="grid-overlay"></div>
                <div class="grid-badge">${getPillHTML('ANIME', 'r')}</div>
                ${item.rating > 0 ? `<div class="grid-rating">★ ${item.rating}</div>` : ''}
            </div>
            <div class="grid-info">
                <p>${item.title}</p>
                ${item.year ? `<small>${item.year}</small>` : ''}
            </div>
        </div>
    `).join('');

    grid.querySelectorAll('.grid-card').forEach((el, i) => {
        el.addEventListener('click', () => showDetail(items[i]));
    });
};

// --- DETAIL PAGE LOGIC ---

/**
 * Switches view between home and detail
 */
const showDetail = async (item) => {
    $('home').style.display = 'none';
    $('detail').style.display = 'block';
    $('detail-content').innerHTML = `
        <div class="loading-center">
            <div class="spinner spin"></div>
            <p style="color:var(--muted); font-style:italic; font-family:'Playfair Display',serif; margin-top: 15px">Recupero archivi in corso...</p>
        </div>
    `;
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
        if (item.source === 'jikan') {
            await loadAnimeDetail(item);
        } else {
            await loadOmdbDetail(item);
        }
    } catch (err) {
        console.error(err);
        $('detail-content').innerHTML = `
            <div style="text-align:center; padding: 40px;">
                <p style="color:var(--muted)">Spiacenti, non è stato possibile caricare i dettagli.</p>
                <button class="back-btn" style="margin-top:20px" onclick="location.reload()">RICARICA</button>
            </div>
        `;
    }
};

/**
 * Fetches and renders detailed anime info
 */
const loadAnimeDetail = async (item) => {
    const [detR, epR, revR] = await Promise.all([
        fetch(`${CONFIG.JIKAN}/anime/${item.mal_id}/full`),
        fetch(`${CONFIG.JIKAN}/anime/${item.mal_id}/episodes`),
        fetch(`${CONFIG.JIKAN}/anime/${item.mal_id}/reviews`),
    ]);
    
    const det = (await detR.json()).data || {};
    const eps = (await epR.json()).data || [];
    const revs = (await revR.json()).data || [];

    renderDetailView({
        title: det.title || item.title,
        titleEn: det.title_english,
        poster: det.images?.jpg?.large_image_url || det.images?.jpg?.image_url || '',
        rating: det.score || 0,
        year: det.aired?.prop?.from?.year || '',
        status: det.status || '',
        episodeCount: det.episodes || '',
        duration: det.duration || '',
        synopsis: det.synopsis || 'Nessuna trama disponibile.',
        genres: (det.genres || []).map(g => g.name),
        studios: (det.studios || []).map(s => s.name),
        type: 'anime',
        trailer: det.trailer?.url || '',
        ratings: [],
        director: '',
        cast: [],
        awards: '',
        episodes: eps.map(e => ({ num: e.mal_id, name: e.title || '', synopsis: e.synopsis || '', rating: '' })),
        reviews: revs.slice(0, 8).map(r => ({ author: r.user?.username || 'Anonimo', content: r.review || '', rating: r.score || '', date: r.date || '' })),
    });
};

/**
 * Fetches and renders detailed movie/series info
 */
const loadOmdbDetail = async (item) => {
    const res = await fetch(`${CONFIG.BASE_OMDB}?apikey=${CONFIG.OMDB_KEY}&i=${item.imdbID}&plot=full`);
    const det = await res.json();
    if (det.Response === 'False') throw new Error(det.Error);

    let eps = [];
    if (det.Type === 'series') {
        try {
            const sr = await fetch(`${CONFIG.BASE_OMDB}?apikey=${CONFIG.OMDB_KEY}&i=${item.imdbID}&Season=1`);
            const sd = await sr.json();
            if (sd.Response === 'True') {
                eps = (sd.Episodes || []).map(e => ({
                    num: e.Episode,
                    name: e.Title || '',
                    synopsis: '',
                    rating: e.imdbRating !== 'N/A' ? e.imdbRating : ''
                }));
            }
        } catch (e) {
            console.error('Season fetch error:', e);
        }
    }

    renderDetailView({
        title: det.Title,
        titleEn: '',
        poster: det.Poster !== 'N/A' ? det.Poster : '',
        rating: parseFloat(det.imdbRating) || 0,
        year: det.Year || '',
        status: '',
        episodeCount: '',
        duration: det.Runtime !== 'N/A' ? det.Runtime : '',
        synopsis: det.Plot !== 'N/A' ? det.Plot : 'Nessuna trama disponibile.',
        genres: det.Genre ? det.Genre.split(', ') : [],
        studios: [],
        type: det.Type === 'series' ? 'series' : 'movie',
        trailer: '',
        ratings: det.Ratings || [],
        director: det.Director !== 'N/A' ? det.Director : '',
        cast: det.Actors !== 'N/A' ? det.Actors.split(', ') : [],
        awards: det.Awards !== 'N/A' ? det.Awards : '',
        episodes: eps,
        reviews: (det.Ratings || []).map(rt => ({
            author: rt.Source,
            content: `Valutazione da ${rt.Source}: ${rt.Value}`,
            rating: '',
            date: ''
        })),
    });
};

/**
 * Final detail view rendering
 */
const renderDetailView = (data) => {
    const isEpisodic = data.type === 'series' || data.type === 'anime';
    const typeLabel = { movie: 'FILM', series: 'SERIE TV', anime: 'ANIME' };
    const typeClass = data.type === 'anime' ? 'r' : 'g';

    // Tabs logic
    const showEpsTab = isEpisodic && data.episodes.length > 0;
    
    const episodesHTML = showEpsTab ? `
        <div id="tab-episodi" class="tab-panel">
            <div class="sh"><h3>🎞 Episodi</h3></div>
            <div class="ep-list" id="ep-list">
                ${renderEpisodesSubset(data.episodes, 0, 5)}
            </div>
            ${data.episodes.length > 5 ? `
                <button class="show-more-btn" id="show-more-btn" data-expanded="0" data-total="${data.episodes.length}">
                    MOSTRA TUTTI (${data.episodes.length}) ▼
                </button>` : ''}
        </div>
    ` : '';

    const reviewsHTML = data.reviews.length
        ? data.reviews.map(r => `
            <div class="rev-card">
                <div class="rev-header">
                    <span class="rev-author">${r.author}${r.rating ? `<span class="rev-score">★ ${r.rating}/10</span>` : ''}</span>
                    ${r.date ? `<span class="rev-date">${new Date(r.date).toLocaleDateString('it-IT')}</span>` : ''}
                </div>
                <p class="rev-text">${r.content.length > 400 ? r.content.slice(0, 400) + '...' : r.content}</p>
            </div>`).join('')
        : '<p style="color:var(--muted); font-style:italic">Nessuna recensione disponibile nell\'archivio.</p>';

    const html = `
        <div class="detail-hero fade-up">
            <div class="detail-poster">
                ${data.poster ? `<img src="${data.poster}" alt="${data.title}"/>` : `<div class="detail-poster-placeholder">🎞</div>`}
            </div>
            <div class="detail-meta">
                <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px">
                    ${getPillHTML(typeLabel[data.type] || data.type.toUpperCase(), typeClass)}
                    ${data.genres.slice(0, 4).map(g => getPillHTML(g, 'g')).join('')}
                </div>
                <h2 class="detail-title flicker">${data.title}</h2>
                ${data.titleEn && data.titleEn !== data.title ? `<p class="detail-subtitle">${data.titleEn}</p>` : ''}
                <div class="detail-stats">
                    ${data.rating > 0 ? getStarsHTML(data.rating) : ''}
                    ${data.year ? `<span>${data.year}</span>` : ''}
                    ${data.duration ? `<span>${data.duration}</span>` : ''}
                    ${data.status ? `${getPillHTML(data.status, 'g')}` : ''}
                    ${data.episodeCount ? `<span>${data.episodeCount} ep.</span>` : ''}
                </div>
                ${data.director ? `<p class="meta-row"><b>Regia:</b> ${data.director}</p>` : ''}
                ${data.studios.length ? `<p class="meta-row"><b>Studio:</b> ${data.studios.join(', ')}</p>` : ''}
                ${data.cast.length ? `<p class="meta-row"><b>Cast:</b> ${data.cast.join(', ')}</p>` : ''}
                ${data.awards ? `<p class="awards">🏆 ${data.awards}</p>` : ''}
            </div>
        </div>

        <div class="tabs">
            <button class="tab-btn active" data-tab="overview">PANORAMICA</button>
            <button class="tab-btn" data-tab="watch">DOVE GUARDARE</button>
            ${showEpsTab ? '<button class="tab-btn" data-tab="episodi">EPISODI</button>' : ''}
            <button class="tab-btn" data-tab="reviews">RECENSIONI</button>
        </div>

        <div id="tab-overview" class="tab-panel active">
            <div class="sh"><h3>📜 Trama</h3></div>
            <p class="synopsis">${data.synopsis}</p>
            ${data.ratings.length ? `
                <div style="margin-top:35px">
                    <div class="sh"><h3>🏅 Valutazioni</h3></div>
                    <div class="ratings-grid">
                        ${data.ratings.map(rt => `<div class="rating-box"><div class="rating-box-source">${rt.Source}</div><div class="rating-box-value">${rt.Value}</div></div>`).join('')}
                    </div>
                </div>` : ''}
            ${data.trailer ? `
                <div style="margin-top:35px">
                    <div class="sh"><h3>🎥 Trailer</h3></div>
                    <a href="${data.trailer}" target="_blank" class="trailer-btn">▶ GUARDA IL TRAILER</a>
                </div>` : ''}
        </div>

        <div id="tab-watch" class="tab-panel">
            <div class="sh"><h3>📺 Dove Guardare</h3></div>
            <div class="platforms">${getPlatformsHTML(data.title, data.type)}</div>
            <p class="watch-note">* La disponibilità dei servizi può variare in base alla regione geografica.</p>
        </div>

        ${episodesHTML}

        <div id="tab-reviews" class="tab-panel">
            <div class="sh"><h3>✍️ Recensioni</h3></div>
            <div class="rev-list">${reviewsHTML}</div>
        </div>
    `;

    $('detail-content').innerHTML = html;
    initTabListeners(data);
};

const renderEpisodesSubset = (episodes, start, end) => {
    return episodes.slice(start, end).map(ep => `
        <div class="ep-row fade-up">
            <div class="ep-num">${ep.num}</div>
            <div class="ep-body">
                <div class="ep-title">${ep.name || 'Episodio ' + ep.num}</div>
                ${ep.synopsis ? `<div class="ep-synopsis">${ep.synopsis.length > 110 ? ep.synopsis.slice(0, 110) + '...' : ep.synopsis}</div>` : ''}
            </div>
            ${ep.rating ? `<div class="ep-rating">★ ${ep.rating}</div>` : ''}
        </div>`).join('');
};

const initTabListeners = (data) => {
    const detailContent = $('detail-content');
    
    detailContent.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            detailContent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            detailContent.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            
            btn.classList.add('active');
            const panel = $(`tab-${btn.dataset.tab}`);
            if (panel) {
                panel.classList.add('active');
            }
        });
    });

    const smb = $('show-more-btn');
    if (smb) {
        smb.addEventListener('click', () => {
            const isExpanded = smb.dataset.expanded === '1';
            const epList = $('ep-list');
            
            if (isExpanded) {
                epList.innerHTML = renderEpisodesSubset(data.episodes, 0, 5);
                smb.textContent = `MOSTRA TUTTI (${smb.dataset.total}) ▼`;
                smb.dataset.expanded = '0';
            } else {
                epList.innerHTML = renderEpisodesSubset(data.episodes, 0, data.episodes.length);
                smb.textContent = 'MOSTRA MENO ▲';
                smb.dataset.expanded = '1';
            }
        });
    }
};

// --- CORE HANDLERS ---

const handleSearch = async (query) => {
    if (query.trim().length < 2) {
        closeDropdown();
        return;
    }

    $('search-spinner').style.display = 'block';
    const results = await fetchSearchResults(query);
    $('search-spinner').style.display = 'none';
    
    State.lastResults = results;
    if (results.length > 0) {
        renderDropdown(results);
    } else {
        closeDropdown();
    }
};

const loadTrending = async () => {
    try {
        const res = await fetch(`${CONFIG.JIKAN}/top/anime?limit=12&filter=bypopularity`);
        const d = await res.json();
        const items = (d.data || []).map(a => ({
            id: `anime_${a.mal_id}`,
            mal_id: a.mal_id,
            source: 'jikan',
            type: 'anime',
            title: a.title,
            year: a.aired?.prop?.from?.year || '',
            poster: a.images?.jpg?.image_url || '',
            rating: a.score || 0
        }));
        State.trending = items;
        renderGrid(items);
    } catch (e) {
        console.error('Trending fetch error:', e);
        $('trending-grid').innerHTML = '<p style="color:var(--muted); font-style:italic; padding:40px; text-align:center">Nessuna proiezione programmata al momento. Prova a cercare un titolo.</p>';
    }
};

// --- INITIALIZATION ---

document.addEventListener('DOMContentLoaded', () => {
    initFilmStrips();
    loadTrending();

    // Search input handlers
    $('search-input').addEventListener('input', (e) => {
        clearTimeout(State.timer);
        const query = e.target.value;
        State.timer = setTimeout(() => handleSearch(query), CONFIG.DEBOUNCE_DELAY);
    });

    $('search-input').addEventListener('blur', () => {
        setTimeout(closeDropdown, 300);
    });

    $('search-input').addEventListener('focus', () => {
        if (State.lastResults.length > 0) renderDropdown(State.lastResults);
    });

    // Mode tabs
    $('mode-tabs').addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        
        qSA('#mode-tabs button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        State.mode = btn.dataset.mode;
        
        const query = $('search-input').value;
        if (query.trim().length >= 2) handleSearch(query);
    });

    // Back button
    $('back-btn').addEventListener('click', () => {
        $('detail').style.display = 'none';
        $('home').style.display = 'block';
        $('search-input').value = '';
        State.lastResults = [];
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
});
