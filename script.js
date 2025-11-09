// Initialisation du client Supabase
const supabase = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);

// État de l'application
let state = {
    isAdmin: false,
    matches: [],
    weekendDates: { weekend1: '', weekend2: '' },
    editingMatch: null
};

// Initialisation
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    renderView();
});

// Chargement des données depuis Supabase
async function loadData() {
    try {
        // Charger les matchs
        const { data: matches, error: matchesError } = await supabase
            .from('matches')
            .select('*')
            .order('date', { ascending: true });
        
        if (matchesError) throw matchesError;
        
        // Convertir is_home en isHome et formater les données
        state.matches = matches.map(m => ({
            id: m.id,
            weekend: m.weekend,
            category: m.category,
            date: m.date,
            time: m.time,
            opponent: m.opponent,
            location: m.location,
            isHome: m.is_home
        }));
        
        // Charger les dates des weekends
        const { data: dates, error: datesError } = await supabase
            .from('weekend_dates')
            .select('*')
            .eq('id', 1)
            .single();
        
        if (datesError) throw datesError;
        
        state.weekendDates = {
            weekend1: dates.weekend1 || '',
            weekend2: dates.weekend2 || ''
        };
        
    } catch (error) {
        console.error('Erreur de chargement:', error);
        alert('Erreur lors du chargement des données. Vérifiez votre connexion.');
    }
}

// Sauvegarde d'un match
async function saveMatch(matchData) {
    try {
        // Convertir isHome en is_home pour Supabase
        const dbMatch = {
            weekend: matchData.weekend,
            category: matchData.category,
            date: matchData.date,
            time: matchData.time,
            opponent: matchData.opponent,
            location: matchData.location,
            is_home: matchData.isHome
        };
        
        if (matchData.id) {
            // Mise à jour
            const { error } = await supabase
                .from('matches')
                .update(dbMatch)
                .eq('id', matchData.id);
            
            if (error) throw error;
        } else {
            // Insertion
            const { error } = await supabase
                .from('matches')
                .insert([dbMatch]);
            
            if (error) throw error;
        }
        
        await loadData();
        return true;
    } catch (error) {
        console.error('Erreur de sauvegarde:', error);
        alert('Erreur lors de la sauvegarde du match');
        return false;
    }
}

// Suppression d'un match
async function deleteMatch(id) {
    try {
        const { error } = await supabase
            .from('matches')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        await loadData();
        return true;
    } catch (error) {
        console.error('Erreur de suppression:', error);
        alert('Erreur lors de la suppression du match');
        return false;
    }
}

// Sauvegarde des dates des weekends
async function saveWeekendDates(dates) {
    try {
        const { error } = await supabase
            .from('weekend_dates')
            .update({
                weekend1: dates.weekend1 || null,
                weekend2: dates.weekend2 || null,
                updated_at: new Date().toISOString()
            })
            .eq('id', 1);
        
        if (error) throw error;
        
        await loadData();
        return true;
    } catch (error) {
        console.error('Erreur de sauvegarde des dates:', error);
        alert('Erreur lors de la sauvegarde des dates');
        return false;
    }
}

// Rendu de la vue
function renderView() {
    const app = document.getElementById('app');
    app.innerHTML = '';
    
    if (state.isAdmin) {
        renderAdminView(app);
    } else {
        renderPublicView(app);
    }
}

// Vue publique
function renderPublicView(container) {
    const template = document.getElementById('public-view');
    const clone = template.content.cloneNode(true);
    
    // Mise à jour des titres des weekends
    updateWeekendTitle(clone, 'weekend1-title', '1');
    updateWeekendTitle(clone, 'weekend2-title', '2');
    
    // Affichage des matchs
    renderPublicMatches(clone, 'weekend1-matches', '1');
    renderPublicMatches(clone, 'weekend2-matches', '2');
    
    // Gestion du bouton admin
    clone.getElementById('admin-btn').addEventListener('click', handleAdminAccess);
    
    container.appendChild(clone);
}

// Vue admin
function renderAdminView(container) {
    const template = document.getElementById('admin-view');
    const clone = template.content.cloneNode(true);
    
    // Boutons principaux
    clone.getElementById('logout-btn').addEventListener('click', handleLogout);
    clone.getElementById('add-match-btn').addEventListener('click', () => toggleForm('match-form'));
    clone.getElementById('config-dates-btn').addEventListener('click', () => toggleForm('dates-form'));
    
    // Formulaire des dates
    const dateWeekend1 = clone.getElementById('date-weekend1');
    const dateWeekend2 = clone.getElementById('date-weekend2');
    dateWeekend1.value = state.weekendDates.weekend1;
    dateWeekend2.value = state.weekendDates.weekend2;
    
    clone.getElementById('save-dates-btn').addEventListener('click', async () => {
        const dates = {
            weekend1: dateWeekend1.value,
            weekend2: dateWeekend2.value
        };
        
        const success = await saveWeekendDates(dates);
        if (success) {
            renderView();
        }
    });
    
    // Formulaire de match
    clone.getElementById('submit-match-btn').addEventListener('click', handleSubmitMatch);
    clone.getElementById('cancel-match-btn').addEventListener('click', handleCancelEdit);
    
    // Mise à jour des titres des weekends
    updateAdminWeekendTitle(clone, 'admin-weekend1-title', '1');
    updateAdminWeekendTitle(clone, 'admin-weekend2-title', '2');
    
    // Affichage des matchs admin
    container.appendChild(clone);
    
    // Rendu après ajout au DOM pour avoir accès aux éléments
    setTimeout(() => {
        renderAdminMatches('admin-weekend1-matches', '1');
        renderAdminMatches('admin-weekend2-matches', '2');
    }, 0);
}

// Mise à jour du titre du weekend (vue publique)
function updateWeekendTitle(container, elementId, weekend) {
    const titleElement = container.getElementById(elementId);
    const dateStr = weekend === '1' ? state.weekendDates.weekend1 : state.weekendDates.weekend2;
    
    if (dateStr) {
        const date = new Date(dateStr);
        const formatted = date.toLocaleDateString('fr-FR', { 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric' 
        });
        titleElement.textContent = `Weekend du ${formatted}`;
    } else {
        titleElement.textContent = `Weekend ${weekend}`;
    }
}

// Mise à jour du titre du weekend (vue admin)
function updateAdminWeekendTitle(container, elementId, weekend) {
    const titleElement = container.getElementById(elementId);
    const dateStr = weekend === '1' ? state.weekendDates.weekend1 : state.weekendDates.weekend2;
    
    if (dateStr) {
        const date = new Date(dateStr);
        const formatted = date.toLocaleDateString('fr-FR', { 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric' 
        });
        titleElement.textContent = `Weekend du ${formatted}`;
    } else {
        titleElement.textContent = `Weekend ${weekend}`;
    }
}

// Rendu des matchs (vue publique)
function renderPublicMatches(container, elementId, weekend) {
    const matchesContainer = container.getElementById(elementId);
    const matches = state.matches.filter(m => m.weekend === weekend);
    
    if (matches.length === 0) {
        matchesContainer.innerHTML = '<p class="no-matches">Aucun match programmé</p>';
        return;
    }
    
    matchesContainer.innerHTML = '';
    matches.forEach(match => {
        const matchCard = createPublicMatchCard(match);
        matchesContainer.appendChild(matchCard);
    });
}

// Création d'une carte de match (vue publique)
function createPublicMatchCard(match) {
    const card = document.createElement('div');
    card.className = 'match-card';
    
    const date = new Date(match.date);
    const formattedDate = date.toLocaleDateString('fr-FR', { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long' 
    });
    
    card.innerHTML = `
        <div class="match-badge ${match.isHome ? 'home' : 'away'}">
            ${match.isHome ? 'DOMICILE' : 'EXTÉRIEUR'}
        </div>
        <div class="match-info">
            <div class="info-row">
                <span class="info-icon">👥</span>
                <span class="info-label">${match.category}</span>
            </div>
            <div class="info-row">
                <span class="info-icon">📅</span>
                <span class="info-value">${formattedDate}</span>
            </div>
            <div class="info-row">
                <span class="info-icon">🕐</span>
                <span class="info-value">${match.time}</span>
            </div>
            <div class="info-row">
                <span class="info-icon">📍</span>
                <span class="info-value">${match.location}</span>
            </div>
            <div class="match-opponent">
                VS ${match.opponent}
            </div>
        </div>
    `;
    
    return card;
}

// Rendu des matchs (vue admin)
function renderAdminMatches(elementId, weekend) {
    const container = document.getElementById(elementId);
    const matches = state.matches.filter(m => m.weekend === weekend);
    
    if (matches.length === 0) {
        container.innerHTML = '<p class="no-matches">Aucun match programmé</p>';
        return;
    }
    
    container.innerHTML = '';
    matches.forEach(match => {
        const matchCard = createAdminMatchCard(match);
        container.appendChild(matchCard);
    });
}

// Création d'une carte de match (vue admin)
function createAdminMatchCard(match) {
    const card = document.createElement('div');
    card.className = 'admin-match-card';
    
    const date = new Date(match.date);
    const formattedDate = date.toLocaleDateString('fr-FR', { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long' 
    });
    
    card.innerHTML = `
        <div class="admin-match-header">
            <span class="match-badge ${match.isHome ? 'home' : 'away'}">
                ${match.isHome ? 'DOMICILE' : 'EXTÉRIEUR'}
            </span>
            <div class="admin-match-actions">
                <button class="btn-edit" data-id="${match.id}">✏️</button>
                <button class="btn-delete" data-id="${match.id}">🗑️</button>
            </div>
        </div>
        <div class="admin-match-info">
            <div class="admin-info-row">
                <span class="info-icon">👥</span>
                <span>${match.category}</span>
            </div>
            <div class="admin-info-row">
                <span class="info-icon">📅</span>
                <span>${formattedDate}</span>
            </div>
            <div class="admin-info-row">
                <span class="info-icon">🕐</span>
                <span>${match.time}</span>
            </div>
            <div class="admin-info-row">
                <span class="info-icon">📍</span>
                <span>${match.location}</span>
            </div>
            <div class="admin-match-opponent">
                VS ${match.opponent}
            </div>
        </div>
    `;
    
    // Gestion des boutons
    card.querySelector('.btn-edit').addEventListener('click', () => handleEditMatch(match.id));
    card.querySelector('.btn-delete').addEventListener('click', () => handleDeleteMatch(match.id));
    
    return card;
}

// Gestion de l'accès admin
function handleAdminAccess() {
    const password = prompt('Mot de passe administrateur :');
    if (password === ADMIN_PASSWORD) {
        state.isAdmin = true;
        renderView();
    } else if (password) {
        alert('Mot de passe incorrect');
    }
}

// Déconnexion
function handleLogout() {
    state.isAdmin = false;
    state.editingMatch = null;
    renderView();
}

// Basculer l'affichage d'un formulaire
function toggleForm(formId) {
    const matchForm = document.getElementById('match-form');
    const datesForm = document.getElementById('dates-form');
    
    if (formId === 'match-form') {
        matchForm.classList.toggle('hidden');
        datesForm.classList.add('hidden');
    } else {
        datesForm.classList.toggle('hidden');
        matchForm.classList.add('hidden');
    }
}

// Soumission du formulaire de match
async function handleSubmitMatch() {
    const weekend = document.getElementById('match-weekend').value;
    const category = document.getElementById('match-category').value.trim();
    const date = document.getElementById('match-date').value;
    const time = document.getElementById('match-time').value;
    const opponent = document.getElementById('match-opponent').value.trim();
    const location = document.getElementById('match-location').value.trim();
    const isHome = document.querySelector('input[name="match-type"]:checked').value === 'home';
    
    if (!category || !date || !time || !opponent || !location) {
        alert('Veuillez remplir tous les champs');
        return;
    }
    
    const matchData = {
        id: state.editingMatch ? state.editingMatch.id : null,
        weekend,
        category,
        date,
        time,
        opponent,
        location,
        isHome
    };
    
    const success = await saveMatch(matchData);
    if (success) {
        resetMatchForm();
        renderView();
    }
}

// Annulation de l'édition
function handleCancelEdit() {
    resetMatchForm();
}

// Réinitialisation du formulaire de match
function resetMatchForm() {
    state.editingMatch = null;
    document.getElementById('match-form').classList.add('hidden');
    document.getElementById('form-title').textContent = 'Nouveau match';
    document.getElementById('match-weekend').value = '1';
    document.getElementById('match-category').value = '';
    document.getElementById('match-date').value = '';
    document.getElementById('match-time').value = '';
    document.getElementById('match-opponent').value = '';
    document.getElementById('match-location').value = '';
    document.querySelector('input[name="match-type"][value="home"]').checked = true;
    document.getElementById('cancel-match-btn').classList.add('hidden');
    document.getElementById('submit-match-btn').textContent = 'Ajouter';
}

// Édition d'un match
function handleEditMatch(id) {
    const match = state.matches.find(m => m.id === id);
    if (!match) return;
    
    state.editingMatch = match;
    
    document.getElementById('match-form').classList.remove('hidden');
    document.getElementById('dates-form').classList.add('hidden');
    document.getElementById('form-title').textContent = 'Modifier le match';
    document.getElementById('match-weekend').value = match.weekend;
    document.getElementById('match-category').value = match.category;
    document.getElementById('match-date').value = match.date;
    document.getElementById('match-time').value = match.time;
    document.getElementById('match-opponent').value = match.opponent;
    document.getElementById('match-location').value = match.location;
    document.querySelector(`input[name="match-type"][value="${match.isHome ? 'home' : 'away'}"]`).checked = true;
    document.getElementById('cancel-match-btn').classList.remove('hidden');
    document.getElementById('submit-match-btn').textContent = 'Modifier';
    
    // Scroll vers le formulaire
    document.getElementById('match-form').scrollIntoView({ behavior: 'smooth' });
}

// Suppression d'un match
async function handleDeleteMatch(id) {
    if (confirm('Supprimer ce match ?')) {
        const success = await deleteMatch(id);
        if (success) {
            renderView();
        }
    }
}