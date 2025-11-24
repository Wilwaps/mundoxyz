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
    filters: ['instagram', 'twitter', 'tiktok', 'email']
};

// --- Content Generation Engine ---

function generateCampaign() {
    const days = [];

    for (let i = 1; i <= 90; i++) {
        const month = Math.ceil(i / 30);
        const phase = PHASES[month];

        // Rotate channels to ensure variety
        const channel = CHANNELS[(i - 1) % CHANNELS.length];

        // Pick random content type
        const contentType = CONTENT_TYPES[Math.floor(Math.random() * CONTENT_TYPES.length)];

        // Generate Copy
        let copy = contentType.template;
        copy = copy.replace('{feature}', FEATURES[Math.floor(Math.random() * FEATURES.length)]);
        copy = copy.replace('{number}', Math.floor(Math.random() * 10) + ',000');
        copy = copy.replace('{game}', GAMES[Math.floor(Math.random() * GAMES.length)]);
        copy = copy.replace('{item}', 'el bono diario');

        // Add Phase Keywords
        const keyword = phase.keywords[Math.floor(Math.random() * phase.keywords.length)];
        copy += ` #${keyword}`;

        days.push({
            day: i,
            month: month,
            channel: channel.id,
            channelName: channel.name,
            channelIcon: channel.icon,
            type: contentType.type,
            objective: phase.focus,
            copy: copy,
            visual: `Imagen estilo ${contentType.type} mostrando ${phase.focus}. Usar paleta ${month === 1 ? 'Dark/Neon' : 'Bright/Glass'}.`,
            hashtags: `#MundoXYZ #${keyword} #Gaming`,
            status: i < 5 ? 'posted' : (i < 15 ? 'scheduled' : 'draft') // Simulate some progress
        });
    }

    return days;
}

// --- UI Rendering ---

function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';

    // Filter data by month and channel
    const filteredDays = state.calendarData.filter(day =>
        day.month === state.currentMonth &&
        state.filters.includes(day.channel)
    );

    filteredDays.forEach(day => {
        const card = document.createElement('div');
        card.className = 'day-card';
        card.onclick = () => openModal(day);

        card.innerHTML = `
            <div class="day-header" style="display:flex;justify-content:space-between;">
                <span class="day-number">Día ${day.day}</span>
                <span class="channel-icon">${day.channelIcon}</span>
            </div>
            <div class="day-content">
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

    document.getElementById('modal-day').innerText = `Día ${day.day} - ${PHASES[day.month].name}`;
    document.getElementById('modal-channel').innerText = day.channelName;
    document.getElementById('modal-objective').innerText = day.objective;
    document.getElementById('modal-copy').innerText = day.copy;
    document.getElementById('modal-visual').innerText = day.visual;
    document.getElementById('modal-tags').innerText = day.hashtags;
    document.getElementById('modal-status').value = day.status;

    modal.classList.add('active');
}

function closeModal() {
    document.getElementById('brief-modal').classList.remove('active');
}

// --- Event Listeners ---

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Data
    state.calendarData = generateCampaign();
    renderCalendar();
    updateProgress();

    // Month Navigation
    document.querySelectorAll('.month-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Remove active class from all
            document.querySelectorAll('.month-btn').forEach(b => b.classList.remove('active'));
            // Add to clicked (traverse up in case span clicked)
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

    // Modal Close
    document.querySelector('.close-modal').addEventListener('click', closeModal);
    document.querySelector('.modal-overlay').addEventListener('click', (e) => {
        if (e.target === document.querySelector('.modal-overlay')) closeModal();
    });
});

// Utility
window.copyToClipboard = function () {
    const text = document.getElementById('modal-copy').innerText;
    navigator.clipboard.writeText(text).then(() => {
        alert('Copy copiado al portapapeles!');
    });
};
