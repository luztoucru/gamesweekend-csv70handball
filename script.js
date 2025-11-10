const client = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);

let state = {
    isAdmin: false,
    matches: [],
    weekendDates: { saturday: '', sunday: '' },
    editingMatch: null
};

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await loadData();
        renderView();
    } catch (error) {
        console.error("Erreur d'initialisation :", error);
        alert("Impossible de charger les données.");
    }
});

async function loadData() {
    try {
        const { data: matches, error: matchesError } = await client
            .from('matches')
            .select('*')
            .order('date', { ascending: true });
        if (matchesError) throw matchesError;

        state.matches = matches.map(m => ({
            id: m.id,
            category: m.category,
            date: m.date,
            time: m.time,
            opponent: m.opponent,
            location: m.location,
            isHome: m.is_home
        }));

        const { data: dates, error: datesError } = await client
            .from('weekend_dates')
            .select('*')
            .eq('id', 1)
            .single();
        if (datesError) throw datesError;

        state.weekendDates = {
            saturday: dates.saturday || '',
            sunday: dates.sunday || ''
        };
    } catch (error) {
        console.error('Erreur de chargement :', error);
    }
}

async function saveWeekendDates(dates) {
    try {
        const { error } = await client
            .from('weekend_dates')
            .update({
                saturday: dates.saturday || null,
                sunday: dates.sunday || null,
                updated_at: new Date().toISOString()
            })
            .eq('id', 1);
        if (error) throw error;
        await loadData();
        renderView();
    } catch (error) {
        console.error('Erreur sauvegarde dates :', error);
    }
}

async function saveMatch(matchData) {
    try {
        const dbMatch = {
            category: matchData.category,
            date: matchData.date,
            time: matchData.time,
            opponent: matchData.opponent,
            location: matchData.location,
            is_home: matchData.isHome
        };
        if (matchData.id) {
            const { error } = await client.from('matches').update(dbMatch).eq('id', matchData.id);
            if (error) throw error;
        } else {
            const { error } = await client.from('matches').insert([dbMatch]);
            if (error) throw error;
        }
        await loadData();
        renderView();
    } catch (error) {
        console.error('Erreur sauvegarde match :', error);
        alert("Erreur lors de l'enregistrement du match.");
    }
}

async function deleteMatch(id) {
    if (!confirm("Supprimer ce match ?")) return;
    try {
        const { error } = await client.from('matches').delete().eq('id', id);
        if (error) throw error;
        await loadData();
        renderView();
    } catch (error) {
        console.error('Erreur suppression match :', error);
    }
}

function renderView() {
    const app = document.getElementById('app');
    app.innerHTML = '';
    if (state.isAdmin) renderAdminView(app);
    else renderPublicView(app);
}

function renderPublicView(container) {
    const template = document.getElementById('public-view');
    const clone = template.content.cloneNode(true);

    const weekendDates = clone.getElementById('weekend-dates');
    if (state.weekendDates.saturday && state.weekendDates.sunday) {
        const s = new Date(state.weekendDates.saturday);
        const d = new Date(state.weekendDates.sunday);
        weekendDates.textContent = `${s.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} – ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    }

    renderPublicMatches(clone);
    clone.getElementById('admin-btn').addEventListener('click', handleAdminAccess);
    container.appendChild(clone);
}

function renderPublicMatches(clone) {
    const homeContainer = clone.getElementById('home-matches');
    const awayContainer = clone.getElementById('away-matches');
    const homeMatches = state.matches.filter(m => m.isHome);
    const awayMatches = state.matches.filter(m => !m.isHome);

    homeContainer.innerHTML = homeMatches.length ? '' : '<p class="no-matches">Aucun match</p>';
    awayContainer.innerHTML = awayMatches.length ? '' : '<p class="no-matches">Aucun match</p>';

    homeMatches.forEach(m => homeContainer.appendChild(createPublicMatchCard(m)));
    awayMatches.forEach(m => awayContainer.appendChild(createPublicMatchCard(m)));
}

function createPublicMatchCard(match) {
    const card = document.createElement('div');
    card.className = 'match-card';
    const date = new Date(match.date);
    const dateStr = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

    card.innerHTML = `
        <div class="match-badge ${match.isHome ? 'home' : 'away'}">${match.isHome ? 'DOMICILE' : 'EXTÉRIEUR'}</div>
        <div class="match-info">
            <div><strong>${match.category}</strong></div>
            <div>📅 ${dateStr}</div>
            <div>🕒 ${match.time}</div>
            <div>📍 ${match.location}</div>
            <div>⚔️ vs ${match.opponent}</div>
        </div>
    `;
    return card;
}

function renderAdminView(container) {
    const template = document.getElementById('admin-view');
    const clone = template.content.cloneNode(true);

    clone.getElementById('logout-btn').addEventListener('click', handleLogout);
    clone.getElementById('config-dates-btn').addEventListener('click', () => toggleForm('dates-form'));
    clone.getElementById('add-match-btn').addEventListener('click', () => toggleForm('match-form'));
    clone.getElementById('save-dates-btn').addEventListener('click', saveWeekendFromForm);
    clone.getElementById('submit-match-btn').addEventListener('click', handleSubmitMatch);
    clone.getElementById('cancel-match-btn').addEventListener('click', resetMatchForm);

    container.appendChild(clone);
    setTimeout(() => renderAdminMatches(), 0);
}

function renderAdminMatches() {
    const homeContainer = document.getElementById('admin-home-matches');
    const awayContainer = document.getElementById('admin-away-matches');
    homeContainer.innerHTML = '';
    awayContainer.innerHTML = '';
    const homeMatches = state.matches.filter(m => m.isHome);
    const awayMatches = state.matches.filter(m => !m.isHome);

    homeMatches.forEach(m => homeContainer.appendChild(createAdminMatchCard(m)));
    awayMatches.forEach(m => awayContainer.appendChild(createAdminMatchCard(m)));

    document.getElementById('download-png').addEventListener('click', downloadPNG);
    document.getElementById('download-xls').addEventListener('click', downloadXLS);
}

function createAdminMatchCard(match) {
    const card = document.createElement('div');
    card.className = 'match-card';
    const date = new Date(match.date);
    const dateStr = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

    card.innerHTML = `
        <div class="match-badge ${match.isHome ? 'home' : 'away'}">${match.isHome ? 'DOMICILE' : 'EXTÉRIEUR'}</div>
        <div>${match.category} – ${dateStr} ${match.time}</div>
        <div>${match.location}</div>
        <div>vs ${match.opponent}</div>
        <div style="margin-top:0.5rem;">
            <button class="btn-edit" onclick="editMatch(${match.id})">✏️</button>
            <button class="btn-delete" onclick="deleteMatch(${match.id})">🗑️</button>
        </div>
    `;
    return card;
}

function toggleForm(id) {
    document.getElementById('match-form').classList.add('hidden');
    document.getElementById('dates-form').classList.add('hidden');
    document.getElementById(id).classList.toggle('hidden');
}

async function saveWeekendFromForm() {
    const saturday = document.getElementById('date-saturday').value;
    const sunday = document.getElementById('date-sunday').value;
    if (!saturday || !sunday) return alert("Remplis les deux dates du weekend.");
    await saveWeekendDates({ saturday, sunday });
}

async function handleSubmitMatch() {
    const category = document.getElementById('match-category').value.trim();
    const date = document.getElementById('match-date').value;
    const time = document.getElementById('match-time').value;
    const opponent = document.getElementById('match-opponent').value.trim();
    const location = document.getElementById('match-location').value.trim();
    const type = document.getElementById('match-type').value;

    if (!category || !date || !time || !opponent || !location) return alert('Tous les champs doivent être remplis.');

    await saveMatch({
        id: state.editingMatch ? state.editingMatch.id : null,
        category,
        date,
        time,
        opponent,
        location,
        isHome: type === 'home'
    });

    resetMatchForm();
}

function resetMatchForm() {
    state.editingMatch = null;
    document.getElementById('match-form').classList.add('hidden');
}

function editMatch(id) {
    const m = state.matches.find(x => x.id === id);
    if (!m) return;
    state.editingMatch = m;
    toggleForm('match-form');
    document.getElementById('match-category').value = m.category;
    document.getElementById('match-date').value = m.date;
    document.getElementById('match-time').value = m.time;
    document.getElementById('match-opponent').value = m.opponent;
    document.getElementById('match-location').value = m.location;
    document.getElementById('match-type').value = m.isHome ? 'home' : 'away';
}

function handleAdminAccess() {
    const pwd = prompt("Mot de passe administrateur :");
    if (pwd === ADMIN_PASSWORD) {
        state.isAdmin = true;
        renderView();
    } else if (pwd) alert("Mot de passe incorrect.");
}

function handleLogout() {
    state.isAdmin = false;
    renderView();
}
