import { loadHistory } from '../storage/history.js';

const data = loadHistory();

// ── Rating card ──────────────────────────────────────────────────────
document.getElementById('history-rating').textContent = data.rating;
document.getElementById('history-wins').textContent   = `${data.wins}W`;
document.getElementById('history-losses').textContent = `${data.losses}L`;

// ── Overall stats ────────────────────────────────────────────────────
document.getElementById('stat-total-matches').textContent = data.totalMatches;
document.getElementById('stat-kapothis-for').textContent  = data.kapothisFor;

if (data.totalMatches > 0) {
    const winRate = Math.round((data.wins / data.totalMatches) * 100);
    document.getElementById('stat-win-rate').textContent = `${winRate}%`;

    const totalMs = data.history.reduce((sum, m) => sum + (m.durationMs ?? 0), 0);
    const avgMin  = Math.max(1, Math.round(totalMs / data.totalMatches / 60000));
    document.getElementById('stat-avg-duration').textContent = `${avgMin} min`;
} else {
    document.getElementById('stat-win-rate').textContent    = '—';
    document.getElementById('stat-avg-duration').textContent = '—';
}

// ── Rating sparkline (inline SVG) ────────────────────────────────────
const sparklineEl  = document.getElementById('rating-sparkline');
const captionEl    = document.getElementById('sparkline-caption');
const sparkEntries = data.history.slice(0, 10).reverse(); // oldest → newest

if (sparkEntries.length >= 2) {
    const ratings = [sparkEntries[0].ratingBefore, ...sparkEntries.map(e => e.ratingAfter)];
    const min     = Math.min(...ratings);
    const max     = Math.max(...ratings);
    const range   = Math.max(max - min, 20); // avoid flat line for tiny deltas
    const W = 200;
    const H = 48;
    const pad = 4;

    const points = ratings.map((r, i) => {
        const x = pad + (i / (ratings.length - 1)) * (W - 2 * pad);
        const y = H - pad - ((r - min) / range) * (H - 2 * pad);
        return `${x},${y}`;
    }).join(' ');

    const lastDelta = sparkEntries[sparkEntries.length - 1].ratingDelta;
    const color = lastDelta >= 0 ? '#5dd685' : '#e87272';

    sparklineEl.innerHTML = `
        <polyline points="${points}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="${200 - pad}" cy="${H - pad - ((ratings[ratings.length - 1] - min) / range) * (H - 2 * pad)}" r="3" fill="${color}"/>
    `;

    const recentDelta = data.history[0].ratingDelta;
    const sign = recentDelta >= 0 ? '+' : '';
    captionEl.textContent = `Last match: ${sign}${recentDelta}`;
    captionEl.style.color = recentDelta >= 0 ? '#5dd685' : '#e87272';
}

// ── Match history list ───────────────────────────────────────────────
const listEl   = document.getElementById('history-list');
const emptyEl  = document.getElementById('history-empty');

if (data.history.length === 0) {
    emptyEl.hidden = false;
} else {
    emptyEl.hidden = true;

    data.history.forEach(entry => {
        const isWin      = entry.outcome === 'win';
        const date       = new Date(entry.playedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        const duration   = `${Math.max(1, Math.round((entry.durationMs ?? 0) / 60000))} min`;
        const sign       = entry.ratingDelta >= 0 ? '+' : '';
        const deltaClass = entry.ratingDelta >= 0 ? 'delta--win' : 'delta--loss';

        const row = document.createElement('div');
        row.className = `history-row ${isWin ? 'history-row--win' : 'history-row--loss'}`;
        row.innerHTML = `
            <span class="history-outcome-chip ${isWin ? 'chip--win' : 'chip--loss'}">${isWin ? 'W' : 'L'}</span>
            <div class="history-row-main">
                <span class="history-row-date">${date}</span>
                <span class="history-row-score">${entry.finalScore[0]} – ${entry.finalScore[1]} tokens</span>
            </div>
            <div class="history-row-meta">
                <span class="history-row-hands">${entry.handsPlayed} hands · ${duration}</span>
                <span class="history-row-delta ${deltaClass}">${sign}${entry.ratingDelta}</span>
            </div>
        `;
        listEl.appendChild(row);
    });
}

// ── Add rating badge CSS class to rating card if no history ─────────
if (data.totalMatches === 0) {
    document.getElementById('history-rating').textContent = data.rating;
}
