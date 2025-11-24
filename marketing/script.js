// Marketing Calendar Logic - "Gemini 3 Pro Level"

// --- Configuration & Data Generators ---

const CHANNELS = [
    { id: 'instagram', name: 'Instagram', icon: '📸', color: '#e1306c' },
    { id: 'twitter', name: 'Twitter / X', icon: '🐦', color: '#1da1f2' },
    { id: 'tiktok', name: 'TikTok', icon: '🎵', color: '#00f2ea' },
    { id: 'email', name: 'Email', icon: '📧', color: '#fbbf24' }
];

const PHASES = {
    1: { name: 'Awareness', focus: 'Discovery & Hype', keywords: ['Nuevo', 'Secreto', 'Pronto', 'Exclusivo'] },
    2: { name: 'Consideration', focus: 'Features & Value', keywords: ['Gana', 'Estrategia', 'Comunidad', 'Pro'] },
    3: { name: 'Conversion', focus: 'Action & FOMO', keywords: ['Únete', 'Torneo', 'Hoy', 'Última oportunidad'] }
};

const CONTENT_TYPES = [
    { type: 'Feature Showcase', template: '¿Sabías que puedes {feature}? 🔥 Descúbrelo ahora.' },
    { type: 'Social Proof', template: 'Más de {number} jugadores ya están ganando. 🏆 ¿Y tú?' },
    { type: 'Engagement', template: 'Etiqueta a tu amigo que siempre pierde en {game}. 👇' },
    { type: 'Meme/Fun', template: 'Cuando ganas 100 Fuegos y te sientes así... 😎' },
    { type: 'Educational', template: 'Tip Pro: Usa {item} para duplicar tus ganancias.' }
];

const FEATURES = ['personalizar tu avatar', 'crear salas privadas', 'ganar Fuegos diarios', 'chatear en el lobby'];
const GAMES = ['Bingo', 'Pool', 'Truco'];

// --- State Management ---

let state = {
    currentMonth: 1,
    calendarData: [], // Will hold 90 days of generated content
    filters: ['instagram', 'twitter', 'tiktok', 'email'],
    currentDayId: null // Track which day is being edited
};

// --- Content Generation Engine ---

function generateCampaign() {
    const days = [];

    for (let i = 1; i <= 90; i++) {
        const month = Math.ceil(i / 30);
        const phase = PHASES[month];
        const channel = CHANNELS[(i - 1) % CHANNELS.length];
        const contentType = CONTENT_TYPES[Math.floor(Math.random() * CONTENT_TYPES.length)];

        let copy = contentType.template;
        copy = copy.replace('{feature}', FEATURES[Math.floor(Math.random() * FEATURES.length)]);
        copy = copy.replace('{number}', Math.floor(Math.random() * 10) + ',000');
        copy = copy.replace('{game}', GAMES[Math.floor(Math.random() * GAMES.length)]);
        copy = copy.replace('{item}', 'el bono diario');

        const keyword = phase.keywords[Math.floor(Math.random() * phase.keywords.length)];
        copy += ` #${keyword}`;

        days.push({
            id: `day-${i}`, // Unique ID for persistence
            day: i,
            month: month,
            channel: channel.id,
            channelName: channel.name,
            channelIcon: channel.icon,
            type: contentType.type,
            objective: phase.focus,
            copy: copy,
            visual: `Imagen estilo ${contentType.type} mostrando ${phase.focus}.`,
            hashtags: `#MundoXYZ #${keyword} #Gaming`,
            status: i < 5 ? 'posted' : (i < 15 ? 'scheduled' : 'draft'),
            image: null // Store image DataURL here
        });
    }

    return days;
}

// --- Persistence (LocalStorage) ---

function loadState() {
    const savedData = localStorage.getItem('mundoXYZ_calendar_data');
    if (savedData) {
        state.calendarData = JSON.parse(savedData);
    } else {
        state.calendarData = generateCampaign();
        saveState();
    }
}

function saveState() {
    localStorage.setItem('mundoXYZ_calendar_data', JSON.stringify(state.calendarData));
}

// --- UI Rendering ---

function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';

    const filteredDays = state.calendarData.filter(day =>
        day.month === state.currentMonth &&
        state.filters.includes(day.channel)
    );

    filteredDays.forEach(day => {
        const card = document.createElement('div');
        card.className = 'day-card';
        card.onclick = () => openModal(day);

        // Show image thumbnail if exists
        let imageThumb = '';
        if (day.image) {
            imageThumb = `<div style="height:4px; background:var(--primary); width:100%; border-radius:2px; margin-bottom:8px;"></div>`;
        }

        card.innerHTML = `
            <div class="day-header" style="display:flex;justify-content:space-between;">
                <span class="day-number">Día ${day.day}</span>
                <span class="channel-icon">${day.channelIcon}</span>
            </div>
            <div class="day-content">
                ${imageThumb}
                <strong>${day.type}</strong><br>
                ${day.copy}
            </div>
            <div class="day-footer">
                <span style="font-size:10px;color:#64748b;">${day.channelName}</span>
                <div class="status-dot ${day.status}"></div>
            </div>
        `;

        grid.appendChild(card);
    });
}

function updateProgress() {
    const posted = state.calendarData.filter(d => d.status === 'posted').length;
    const total = state.calendarData.length;
    const percent = Math.round((posted / total) * 100);

    document.getElementById('progress-text').innerText = `${percent}%`;
    document.getElementById('progress-fill').style.width = `${percent}%`;
}

// --- Modal Logic ---

function openModal(day) {
    const modal = document.getElementById('brief-modal');
    state.currentDayId = day.id;

    document.getElementById('modal-day').innerText = `Día ${day.day} - ${PHASES[day.month].name}`;
    document.getElementById('modal-channel').innerText = day.channelName;

    // Fill Inputs
    document.getElementById('modal-objective').value = day.objective;
    document.getElementById('modal-copy').value = day.copy;
    document.getElementById('modal-visual-text').innerText = day.visual;
    document.getElementById('modal-tags').value = day.hashtags;
    document.getElementById('modal-status').value = day.status;

    // Handle Image Preview
    const previewContainer = document.getElementById('image-preview');
    previewContainer.innerHTML = '';
    if (day.image) {
        const img = document.createElement('img');
        img.src = day.image;
        previewContainer.appendChild(img);
    }

    modal.classList.add('active');
}

function saveModalChanges() {
    if (!state.currentDayId) return;

    const dayIndex = state.calendarData.findIndex(d => d.id === state.currentDayId);
    if (dayIndex === -1) return;

    // Update Data
    state.calendarData[dayIndex].objective = document.getElementById('modal-objective').value;
    state.calendarData[dayIndex].copy = document.getElementById('modal-copy').value;
    state.calendarData[dayIndex].hashtags = document.getElementById('modal-tags').value;
    state.calendarData[dayIndex].status = document.getElementById('modal-status').value;

    // Image is handled separately by the change event, but we save state here
    saveState();
    renderCalendar();
    updateProgress();
    closeModal();
}

function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (event) {
        const dataUrl = event.target.result;

        // Update Preview
        const previewContainer = document.getElementById('image-preview');
        previewContainer.innerHTML = '';
        const img = document.createElement('img');
        img.src = dataUrl;
        previewContainer.appendChild(img);

        // Update State
        const dayIndex = state.calendarData.findIndex(d => d.id === state.currentDayId);
        if (dayIndex !== -1) {
            state.calendarData[dayIndex].image = dataUrl;
        }
    };
    reader.readAsDataURL(file);
}

function closeModal() {
    document.getElementById('brief-modal').classList.remove('active');
    state.currentDayId = null;
}

// --- Event Listeners ---

document.addEventListener('DOMContentLoaded', () => {
    loadState();
    renderCalendar();
    updateProgress();

    // Month Navigation
    document.querySelectorAll('.month-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.month-btn').forEach(b => b.classList.remove('active'));
            const target = e.target.closest('.month-btn');
            target.classList.add('active');
            state.currentMonth = parseInt(target.dataset.month);
            renderCalendar();
        });
    });

    // Filters
    document.querySelectorAll('.filter-checkbox input').forEach(input => {
        input.addEventListener('change', (e) => {
            if (e.target.checked) {
                state.filters.push(e.target.value);
            } else {
                state.filters = state.filters.filter(f => f !== e.target.value);
            }
            renderCalendar();
        });
    });

    // Modal Actions
    document.querySelector('.close-modal').addEventListener('click', closeModal);
    document.querySelector('.modal-overlay').addEventListener('click', (e) => {
        if (e.target === document.querySelector('.modal-overlay')) closeModal();
    });

    document.getElementById('save-modal').addEventListener('click', saveModalChanges);
    document.getElementById('image-upload').addEventListener('change', handleImageUpload);
});

// Utility
window.copyToClipboard = function () {
    const text = document.getElementById('modal-copy').value;
    navigator.clipboard.writeText(text).then(() => {
        alert('Copy copiado al portapapeles!');
    });
};
