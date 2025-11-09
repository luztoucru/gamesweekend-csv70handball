// =====================================
// INITIALISATION SUPABASE
// =====================================
const client = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);

// =====================================
// ÉTAT DE L’APPLICATION
// =====================================
let state = {
    isAdmin: false,
    matches: [],
    weekendDates: { saturday: '', sunday: '' },
    editingMatch: null
};

// =====================================
// CHARGEMENT INITIAL
// =====================================
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await loadData();
        renderView();
    } catch (error) {
        console.error("Erreur d'initialisation :", error);
        alert("Impossible de charger les données.");
    }
});

// =====================================
// CHARGEMENT DES DONNÉES
// =====================================
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

// =====================================
// SAUVEGARDE DES DATES
// =====================================
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

// =====================================
// AJOUT / MODIF / SUPPRESSION MATCH
// =====================================
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
            const { error } = await client
                .from('matches')
                .update(dbMatch)
                .eq('id', matchData.id);
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

// =====================================
// AFFICHAGE PRINCIPAL
// =====================================
function renderView() {
    const app = document.getElementById('app');
    app.innerHTML = '';
    if (state.isAdmin) renderAdminView(app);
    else renderPublicView(app);
}

// =====================================
// VUE PUBLIQUE
// =====================================
function renderPublicView(container) {
    const template = document.getElementById('public-view');
    const clone = template.content.cloneNode(true);

    // Mise à jour du titre et dates
    const weekendTitle = clone.getElementById('weekend-title');
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

    homeMatches.forEach(m => homeContainer.appendChild(createMatchCard(m)));
    awayMatches.forEach(m => awayContainer.appendChild(createMatchCard(m)));
}

function createMatchCard(match) {
    const card = document.createElement('div');
    card.className = 'match-card';
    const date = new Date(match.date);
    const dateStr = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    card.innerHTML = `
        <div class="match-badge ${match.isHome ? 'home' : 'away'}">${match.isHome ? 'DOMICILE' : 'EXTÉRIEUR'}</div>
        <div class="match-info">
            <div>${match.category}</div>
            <div>${dateStr}</div>
            <div>${match.time}</div>
            <div>${match.location}</div>
            <div class="match-opponent">vs ${match.opponent}</div>
        </div>
    `;
    return card;
}

// =====================================
// VUE ADMIN
// =====================================
function renderAdminView(container) {
    const template = document.getElementById('admin-view');
    const clone = template.content.cloneNode(true);

    // Boutons principaux
    clone.getElementById('logout-btn').addEventListener('click', handleLogout);
    clone.getElementById('config-dates-btn').addEventListener('click', () => toggleForm('dates-form'));
    clone.getElementById('add-match-btn').addEventListener('click', () => toggleForm('match-form'));
    clone.getElementById('save-dates-btn').addEventListener('click', saveWeekendFromForm);
    clone.getElementById('submit-match-btn').addEventListener('click', handleSubmitMatch);
    clone.getElementById('cancel-match-btn').addEventListener('click', resetMatchForm);

    // Rendu initial
    container.appendChild(clone);
    setTimeout(() => renderAdminMatches(), 0);
}

// =====================================
// RENDU MATCHS ADMIN
// =====================================
function renderAdminMatches() {
    const homeContainer = document.getElementById('admin-home-matches');
    const awayContainer = document.getElementById('admin-away-matches');

    homeContainer.innerHTML = '';
    awayContainer.innerHTML = '';

    const homeMatches = state.matches.filter(m => m.isHome);
    const awayMatches = state.matches.filter(m => !m.isHome);

    homeMatches.forEach(m => homeContainer.appendChild(createAdminMatchCard(m)));
    awayMatches.forEach(m => awayContainer.appendChild(createAdminMatchCard(m)));

    // Ajout des boutons d'export
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
        <div class="match-opponent">vs ${match.opponent}</div>
        <div style="margin-top:0.5rem;">
            <button class="btn-edit" onclick="editMatch(${match.id})">✏️</button>
            <button class="btn-delete" onclick="deleteMatch(${match.id})">🗑️</button>
        </div>
    `;
    return card;
}

// =====================================
// FORMULAIRES ADMIN
// =====================================
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

    if (!category || !date || !time || !opponent || !location) {
        alert('Tous les champs doivent être remplis.');
        return;
    }

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

// =====================================
// ACCÈS ADMIN
// =====================================
function handleAdminAccess() {
    const pwd = prompt("Mot de passe administrateur :");
    if (pwd === ADMIN_PASSWORD) {
        state.isAdmin = true;
        renderView();
    } else if (pwd) {
        alert("Mot de passe incorrect.");
    }
}

function handleLogout() {
    state.isAdmin = false;
    renderView();
}


// EXPORTS PNG & XLSX

async function downloadPNG() {
    const container = document.getElementById('weekend-admin-view');
    if (!container) return;

    // 1️⃣ Masquer temporairement les boutons d’édition et suppression
    const buttons = container.querySelectorAll('.btn-edit, .btn-delete');
    buttons.forEach(btn => (btn.style.display = 'none'));

    // 2️⃣ Trier les matchs
    const sortByDateTime = (a, b) => {
        const da = new Date(`${a.date}T${a.time}`);
        const db = new Date(`${b.date}T${b.time}`);
        return da - db;
    };
    const homeMatches = state.matches.filter(m => m.isHome).sort(sortByDateTime);
    const awayMatches = state.matches.filter(m => !m.isHome).sort(sortByDateTime);

    // 3️⃣ Préparer les infos du weekend
    const s = new Date(state.weekendDates.saturday);
    const d = new Date(state.weekendDates.sunday);
    const weekendLabel = `${s.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} – ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`;

    // 4️⃣ Wrapper principal
    const wrapper = document.createElement('div');
    wrapper.style.background = '#0c1e3d';
    wrapper.style.color = 'white';
    wrapper.style.fontFamily = 'Segoe UI, Roboto, sans-serif';
    wrapper.style.padding = '40px';
    wrapper.style.width = '1600px';
    wrapper.style.minHeight = '900px';
    wrapper.style.borderRadius = '15px';
    wrapper.style.margin = '0 auto';
    wrapper.style.textAlign = 'center';
    wrapper.style.boxSizing = 'border-box';
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.alignItems = 'center';
    wrapper.style.justifyContent = 'flex-start';
    wrapper.style.position = 'relative';

    // 5️⃣ En-tête identique à la page d’accueil
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.justifyContent = 'center';
    header.style.width = '100%';
    header.style.marginBottom = '30px';
    header.style.gap = '20px';
    header.style.flexWrap = 'wrap';

    const logo = document.createElement('img');
    logo.src = 'assets/logo.png';
    logo.alt = 'Logo CSV70 Handball';
    logo.style.width = '85px';
    logo.style.height = 'auto';
    logo.style.objectFit = 'contain';
    logo.style.borderRadius = '8px';
    logo.style.boxShadow = '0 0 12px rgba(250,204,21,0.4)';

    const titleBlock = document.createElement('div');
    titleBlock.style.display = 'flex';
    titleBlock.style.flexDirection = 'column';
    titleBlock.style.alignItems = 'center';
    titleBlock.style.textAlign = 'center';

    const title = document.createElement('h2');
    title.textContent = 'CSV70 Handball';
    title.style.color = '#facc15';
    title.style.fontSize = '38px';
    title.style.fontWeight = '700';
    title.style.margin = '0';

    const subtitle = document.createElement('p');
    subtitle.textContent = `Planning du week-end ${weekendLabel}`;
    subtitle.style.color = '#cfe0ff';
    subtitle.style.fontSize = '20px';
    subtitle.style.margin = '5px 0 0 0';

    titleBlock.appendChild(title);
    titleBlock.appendChild(subtitle);
    header.appendChild(logo);
    header.appendChild(titleBlock);
    wrapper.appendChild(header);

    // 6️⃣ Titres colonnes
    const labelRow = document.createElement('div');
    labelRow.style.display = 'flex';
    labelRow.style.width = '90%';
    labelRow.style.justifyContent = 'space-between';
    labelRow.style.marginBottom = '10px';

    const labelHome = document.createElement('h3');
    labelHome.textContent = '🏠 Domicile';
    labelHome.style.color = '#facc15';
    labelHome.style.margin = '0';
    const labelAway = document.createElement('h3');
    labelAway.textContent = '🚌 Extérieur';
    labelAway.style.color = '#1e90ff';
    labelAway.style.margin = '0';

    labelRow.appendChild(labelHome);
    labelRow.appendChild(labelAway);
    wrapper.appendChild(labelRow);

    // 7️⃣ Grille principale (2 colonnes)
    const matchesRow = document.createElement('div');
    matchesRow.style.display = 'grid';
    matchesRow.style.gridTemplateColumns = '1fr 1fr';
    matchesRow.style.gap = '40px';
    matchesRow.style.width = '90%';

    // 8️⃣ Fonction de rendu des matchs (2 côte à côte par colonne)
    const createMatchGrid = (matches, color) => {
        const grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = 'repeat(2, 1fr)';
        grid.style.gap = '15px';
        grid.style.width = '100%';
        grid.style.alignItems = 'start';

        if (matches.length === 0) {
            const msg = document.createElement('p');
            msg.textContent = 'Aucun match';
            msg.style.color = '#cfe0ff';
            grid.appendChild(msg);
            return grid;
        }

        matches.forEach(m => {
            const card = document.createElement('div');
            card.style.background = 'rgba(255,255,255,0.1)';
            card.style.borderLeft = `5px solid ${color}`;
            card.style.borderRadius = '8px';
            card.style.padding = '12px';
            card.style.textAlign = 'left';
            card.style.fontSize = '15px';
            card.style.minHeight = '120px';
            card.innerHTML = `
                <strong>${m.category}</strong><br>
                📅 ${new Date(m.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}<br>
                🕒 ${m.time}<br>
                📍 <em>${m.location}</em><br>
                ⚔️ <span style="opacity:0.9">vs ${m.opponent}</span>
            `;
            grid.appendChild(card);
        });

        return grid;
    };

    const colHome = createMatchGrid(homeMatches, '#facc15');
    const colAway = createMatchGrid(awayMatches, '#1e90ff');
    matchesRow.appendChild(colHome);
    matchesRow.appendChild(colAway);
    wrapper.appendChild(matchesRow);

    // 9️⃣ Capture HD
    document.body.appendChild(wrapper);
    const canvas = await html2canvas(wrapper, {
        backgroundColor: '#0c1e3d',
        scale: 3, // Haute résolution
        width: 1600,
        windowWidth: 1600,
        useCORS: true
    });

    // 🔟 Téléchargement
    const link = document.createElement('a');
    link.download = `Planning_Weekend_${s.getDate()}-${d.getDate()}_${s.getMonth()+1}_${s.getFullYear()}.png`;
    link.href = canvas.toDataURL('image/png', 1.0);
    link.click();

    // ♻️ Nettoyage
    document.body.removeChild(wrapper);
    buttons.forEach(btn => (btn.style.display = ''));
}




function downloadXLS() {
    const s = new Date(state.weekendDates.saturday);
    const d = new Date(state.weekendDates.sunday);
    const weekendLabel = `${s.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} – ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`;

    // Données avec titre du weekend
    const rows = [
        [`CSV70 Handball - Planning du week-end ${weekendLabel}`],
        [],
        ['Catégorie', 'Date', 'Heure', 'Adversaire', 'Lieu', 'Type']
    ];

    // Ajout des matchs
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

    // Création du fichier Excel
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Planning');

    const filename = `Planning_Weekend_${s.getDate()}-${d.getDate()}_${s.getMonth()+1}_${s.getFullYear()}.xlsx`;
    XLSX.writeFile(wb, filename);
}

