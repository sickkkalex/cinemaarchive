/**
 * CINÈMA ARCHIVE - Application Logic
 * Refactored for Black/Yellow Filmlane Aesthetics
 */

const CONFIG = {
    OMDB_KEY: 'b9bd48a6',
    OMDB_URL: 'https://www.omdbapi.com/',
    JIKAN_URL: 'https://api.jikan.moe/v4'
};

const State = {
    mode: 'movie', // movie, series, anime
    query: '',
    results: [],
    trending: [],
    currentDetail: null
};

// --- DOM HELPERS ---
const $ = (id) => document.getElementById(id);
const qS = (sel) => document.querySelector(sel);
const qSA = (sel) => document.querySelectorAll(sel);

// --- API FETCHING ---
async function fetchData(url) {
    try {
        const response = await fetch(url);
        return await response.json();
    } catch (err) {
        console.error("Fetch Error:", err);
        return null;
    }
}

// --- SEARCH HANDLER ---
let debounceTimeout;
$('search-input').addEventListener('input', (e) => {
    clearTimeout(debounceTimeout);
    const query = e.target.value.trim();
    if (query.length < 3) return;

    debounceTimeout = setTimeout(() => {
        performSearch(query);
    }, 600);
});

async function performSearch(query) {
    if (!query) return;
    State.query = query;
    $('search-loader').style.display = 'block';

    let url;
    if (State.mode === 'anime') {
        url = `${CONFIG.JIKAN_URL}/anime?q=${encodeURIComponent(query)}&limit=20`;
    } else {
        const type = State.mode === 'movie' ? 'movie' : 'series';
        url = `${CONFIG.OMDB_URL}?apikey=${CONFIG.OMDB_KEY}&s=${encodeURIComponent(query)}&type=${type}`;
    }

    const data = await fetchData(url);
    $('search-loader').style.display = 'none';

    if (data) {
        processResults(data);
    }
}

function processResults(data) {
    if (State.mode === 'anime') {
        State.results = data.data.map(item => ({
            id: item.mal_id,
            title: item.title,
            year: item.aired.from ? new Date(item.aired.from).getFullYear() : 'N/A',
            poster: item.images.jpg.image_url,
            type: 'anime'
        }));
    } else {
        if (data.Search) {
            State.results = data.Search.map(item => ({
                id: item.imdbID,
                title: item.Title,
                year: item.Year,
                poster: item.Poster !== 'N/A' ? item.Poster : 'https://via.placeholder.com/300x450?text=No+Poster',
                type: State.mode
            }));
        } else {
            State.results = [];
        }
    }
    renderGrid(State.results, 'Search Results');
}

// --- RENDERING ---
function renderGrid(items, title = 'Trending This Week') {
    const grid = $('trending-grid');
    qS('.grid-title h2').textContent = title;
    grid.innerHTML = '';

    if (items.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align:center; padding: 40px; color:var(--muted)">No results found. Try another search!</p>';
        return;
    }

    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'grid-card';
        card.innerHTML = `
            <div class="grid-thumb">
                <img src="${item.poster}" alt="${item.title}" loading="lazy">
            </div>
            <div class="grid-info">
                <p title="${item.title}">${item.title}</p>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
                    <span style="color:var(--accent); font-size:12px; font-weight:700;">${item.year}</span>
                    <span style="font-size:12px; color:var(--muted);">${item.type.toUpperCase()}</span>
                </div>
            </div>
        `;
        card.onclick = () => loadDetail(item.id, item.type);
        grid.appendChild(card);
    });

    $('home').style.display = 'block';
    $('detail').style.display = 'none';
}

// --- DETAIL VIEW ---
async function loadDetail(id, type) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    $('search-loader').style.display = 'block';

    let url;
    if (type === 'anime') {
        url = `${CONFIG.JIKAN_URL}/anime/${id}/full`;
    } else {
        url = `${CONFIG.OMDB_URL}?apikey=${CONFIG.OMDB_KEY}&i=${id}&plot=full`;
    }

    const data = await fetchData(url);
    $('search-loader').style.display = 'none';

    if (data) {
        renderDetail(data, type);
    }
}

function renderDetail(data, type) {
    const container = $('detail');
    const home = $('home');
    const searchSection = $('search-section');

    home.style.display = 'none';
    searchSection.style.display = 'none';
    container.style.display = 'block';

    let detailObj;
    if (type === 'anime') {
        const anime = data.data;
        detailObj = {
            title: anime.title,
            year: anime.aired.from ? new Date(anime.aired.from).getFullYear() : 'N/A',
            poster: anime.images.jpg.large_image_url,
            plot: anime.synopsis || 'Technical summary not available.',
            meta: [anime.rating, anime.duration, anime.genres.map(g => g.name).join(', ')],
            rating: anime.score || 'N/A',
            backdrop: anime.images.jpg.large_image_url
        };
    } else {
        detailObj = {
            title: data.Title,
            year: data.Year,
            poster: data.Poster !== 'N/A' ? data.Poster : 'https://via.placeholder.com/600x900?text=No+Poster',
            plot: data.Plot,
            meta: [data.Rated, data.Runtime, data.Genre],
            rating: data.imdbRating,
            backdrop: data.Poster
        };
    }

    container.innerHTML = `
        <div class="hero-overlay" style="background-image: url('${detailObj.poster}')">
            <div class="hero-content">
                <div class="detail-poster">
                    <img src="${detailObj.poster}" alt="${detailObj.title}">
                </div>
                <div class="detail-main">
                    <span class="badge-new">NEW EPISODES</span>
                    <h1 class="detail-title">${detailObj.title.split(' ').slice(0, -1).join(' ')} <span>${detailObj.title.split(' ').pop()}</span></h1>
                    
                    <div class="detail-meta-row">
                        <span class="meta-box">${detailObj.meta[0]}</span>
                        <span class="meta-box">HD</span>
                        <span style="color:var(--muted); font-size:14px; margin-left:10px;">${detailObj.meta[2]}</span>
                        <span style="color:var(--accent); font-weight:700; margin-left:auto;"><i class="fas fa-calendar-alt"></i> ${detailObj.year}</span>
                        <span style="color:var(--accent); font-weight:700;"><i class="fas fa-clock"></i> ${detailObj.meta[1]}</span>
                    </div>

                    <p class="synopsis" style="font-family:'Inter', sans-serif; color:var(--cream); line-height:1.8; margin-bottom:30px; border-left: 3px solid var(--accent); padding-left: 20px;">
                        ${detailObj.plot}
                    </p>

                    <div class="hero-actions">
                        <button class="share-btn">
                            <i class="fas fa-share-alt"></i>
                            <span>Share</span>
                        </button>
                        <div style="width:1px; height:40px; background:var(--border);"></div>
                        <div style="text-align:left;">
                            <p style="font-weight:700; font-size:16px;">Streaming Now</p>
                            <p style="font-size:13px; color:var(--muted);">Available on Prime Video</p>
                        </div>
                        <a href="#" class="watch-btn"><i class="fas fa-play"></i> WATCH NOW</a>
                    </div>
                </div>
            </div>
            <button id="back-btn" style="position:absolute; top:40px; left:40px; background:rgba(0,0,0,0.5); border:none; color:white; padding:15px; border-radius:50%; cursor:pointer; z-index:10;"><i class="fas fa-arrow-left"></i></button>
        </div>
    `;

    $('back-btn').onclick = () => {
        container.style.display = 'none';
        home.style.display = 'block';
        searchSection.style.display = 'block';
    };
}

// --- TABS & NAVIGATION ---
qSA('#mode-tabs button').forEach(btn => {
    btn.onclick = () => {
        qSA('#mode-tabs button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        State.mode = btn.getAttribute('data-mode');
        $('search-input').placeholder = `Search for your favorite ${State.mode === 'movie' ? 'movies' : State.mode === 'series' ? 'TV shows' : 'anime'}...`;
        if (State.query) performSearch(State.query);
    };
});

// --- INITIAL LOAD ---
async function loadTrending() {
    const data = await fetchData(`${CONFIG.JIKAN_URL}/top/anime?limit=12`);
    if (data && data.data) {
        State.trending = data.data.map(item => ({
            id: item.mal_id,
            title: item.title,
            year: item.aired.from ? new Date(item.aired.from).getFullYear() : 'N/A',
            poster: item.images.jpg.image_url,
            type: 'anime'
        }));
        renderGrid(State.trending);
    }
}

// Brand click handler
$('home-link').onclick = (e) => {
    e.preventDefault();
    $('detail').style.display = 'none';
    $('home').style.display = 'block';
    $('search-section').style.display = 'block';
    renderGrid(State.trending);
};

loadTrending();
