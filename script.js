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

// EXPORT PNG / XLSX (compatible iPad)

async function downloadPNG() {
    const container = document.getElementById('weekend-admin-view');
    if (!container) return;

    const buttons = container.querySelectorAll('.btn-edit, .btn-delete');
    buttons.forEach(btn => (btn.style.display = 'none'));

    const sortByDateTime = (a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`);
    const homeMatches = state.matches.filter(m => m.isHome).sort(sortByDateTime);
    const awayMatches = state.matches.filter(m => !m.isHome).sort(sortByDateTime);

    const s = new Date(state.weekendDates.saturday);
    const d = new Date(state.weekendDates.sunday);
    const weekendLabel = `${s.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} – ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`;

    const wrapper = document.createElement('div');
    wrapper.style.background = '#0c1e3d';
    wrapper.style.color = 'white';
    wrapper.style.fontFamily = 'Segoe UI, sans-serif';
    wrapper.style.padding = '40px';
    wrapper.style.width = '1600px';
    wrapper.style.minHeight = '900px';
    wrapper.style.borderRadius = '15px';
    wrapper.style.textAlign = 'center';
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.alignItems = 'center';

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.justifyContent = 'center';
    header.style.gap = '20px';
    header.style.marginBottom = '25px';

    const logo = document.createElement('img');
    logo.src = 'assets/logo.png';
    logo.alt = 'Logo CSV70 Handball';
    logo.style.width = '85px';
    logo.style.height = 'auto';
    logo.style.objectFit = 'contain';

    const titleBlock = document.createElement('div');
    const title = document.createElement('h2');
    title.textContent = 'CSV70 Handball';
    title.style.color = '#facc15';
    title.style.fontSize = '36px';
    title.style.margin = '0';

    const subtitle = document.createElement('p');
    subtitle.textContent = `Planning du week-end ${weekendLabel}`;
    subtitle.style.fontSize = '20px';
    subtitle.style.color = '#cfe0ff';
    subtitle.style.margin = '5px 0 0 0';

    titleBlock.appendChild(title);
    titleBlock.appendChild(subtitle);
    header.appendChild(logo);
    header.appendChild(titleBlock);
    wrapper.appendChild(header);

    const labelRow = document.createElement('div');
    labelRow.style.display = 'flex';
    labelRow.style.width = '90%';
    labelRow.style.justifyContent = 'space-between';
    labelRow.style.marginBottom = '10px';

    const labelHome = document.createElement('h3');
    labelHome.textContent = '🏠 Domicile';
    labelHome.style.color = '#facc15';
    const labelAway = document.createElement('h3');
    labelAway.textContent = '🚌 Extérieur';
    labelAway.style.color = '#1e90ff';

    labelRow.appendChild(labelHome);
    labelRow.appendChild(labelAway);
    wrapper.appendChild(labelRow);

    const matchesRow = document.createElement('div');
    matchesRow.style.display = 'grid';
    matchesRow.style.gridTemplateColumns = '1fr 1fr';
    matchesRow.style.gap = '40px';
    matchesRow.style.width = '90%';

    const createMatchGrid = (matches, color) => {
        const grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = 'repeat(2, 1fr)';
        grid.style.gap = '15px';
        grid.style.width = '100%';

        matches.forEach(m => {
            const card = document.createElement('div');
            card.style.background = 'rgba(255,255,255,0.1)';
            card.style.borderLeft = `5px solid ${color}`;
            card.style.borderRadius = '8px';
            card.style.padding = '12px';
            card.style.textAlign = 'left';
            card.innerHTML = `
                <strong>${m.category}</strong><br>
                📅 ${new Date(m.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}<br>
                🕒 ${m.time}<br>
                📍 ${m.location}<br>
                ⚔️ vs ${m.opponent}
            `;
            grid.appendChild(card);
        });
        return grid;
    };

    matchesRow.appendChild(createMatchGrid(homeMatches, '#facc15'));
    matchesRow.appendChild(createMatchGrid(awayMatches, '#1e90ff'));
    wrapper.appendChild(matchesRow);

    document.body.appendChild(wrapper);
    const canvas = await html2canvas(wrapper, { backgroundColor: '#0c1e3d', scale: 3, useCORS: true });
    const link = document.createElement('a');
    link.download = `Planning_Weekend_${s.getDate()}-${d.getDate()}_${s.getMonth()+1}_${s.getFullYear()}.png`;
    link.href = canvas.toDataURL('image/png', 1.0);

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    document.body.removeChild(wrapper);
    buttons.forEach(btn => (btn.style.display = ''));
}

function downloadXLS() {
    const s = new Date(state.weekendDates.saturday);
    const d = new Date(state.weekendDates.sunday);
    const weekendLabel = `${s.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} – ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    const rows = [
        [`CSV70 Handball - Planning du week-end ${weekendLabel}`],
        [],
        ['Catégorie', 'Date', 'Heure', 'Adversaire', 'Lieu', 'Type']
    ];

    state.matches.forEach(m => {
        rows.push([
            m.category,
            new Date(m.date).toLocaleDateString('fr-FR'),
            m.time,
            m.opponent,
            m.location,
            m.isHome ? 'Domicile' : 'Extérieur'
        ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Planning');
    const filename = `Planning_Weekend_${s.getDate()}-${d.getDate()}_${s.getMonth()+1}_${s.getFullYear()}.xlsx`;

    const blob = XLSX.write(wb, { bookType: 'xlsx', type: 'blob' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
