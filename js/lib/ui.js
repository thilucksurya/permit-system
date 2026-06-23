const Toast = {
    _el: null,
    _init() {
        if (this._el) return;
        this._el = document.createElement('div');
        this._el.className = 'toast-wrap';
        document.body.appendChild(this._el);
    },
    show(msg, type = 'success', duration = 4000) {
        this._init();
        const icons = {
            success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
            error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
        };
        const t = document.createElement('div');
        t.className = `toast ${type}`;
        t.innerHTML = `${icons[type] || ''}<span class="toast-msg">${msg}</span><button class="toast-close" onclick="this.parentElement.remove()" aria-label="Close"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>`;
        this._el.appendChild(t);
        requestAnimationFrame(() => t.classList.add('show'));
        setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, duration);
    },
    success(m) { this.show(m, 'success'); },
    error(m) { this.show(m, 'error'); }
};

function validateEmail(e) { return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(e); }

function showErr(id) { const e = document.getElementById(id); if (e) e.classList.add('visible'); const i = document.getElementById(id.replace('-error', '')); if (i) i.classList.add('error'); }
function hideErr(id) { const e = document.getElementById(id); if (e) e.classList.remove('visible'); const i = document.getElementById(id.replace('-error', '')); if (i) i.classList.remove('error'); }

function pwStrength(pw) {
    let s = 0;
    if (pw.length >= 6) s++;
    if (pw.length >= 8) s++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    if (s <= 1) return { score: 1, label: 'Weak', cls: 'weak' };
    if (s === 2) return { score: 2, label: 'Fair', cls: 'fair' };
    if (s <= 4) return { score: 3, label: 'Good', cls: 'good' };
    return { score: 4, label: 'Strong', cls: 'strong' };
}

function updateStrength(pw) {
    const bars = document.querySelectorAll('.pw-strength-bar');
    const label = document.getElementById('pw-strength-label');
    if (!bars.length) return;
    if (!pw) { bars.forEach(b => { b.className = 'pw-strength-bar'; }); if (label) label.textContent = ''; return; }
    const s = pwStrength(pw);
    bars.forEach((b, i) => { b.className = 'pw-strength-bar' + (i < s.score ? ` active ${s.cls}` : ''); });
    if (label) { label.textContent = s.label; label.style.color = s.cls === 'weak' ? 'var(--danger)' : s.cls === 'fair' ? 'var(--warning)' : s.cls === 'good' ? '#0891b2' : 'var(--success)'; }
}

function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
function fmtDate(d) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function statusBadge(status) {
    const s = (status || 'booking').toLowerCase();
    const label = s.charAt(0).toUpperCase() + s.slice(1);
    return `<span class="badge ${s}"><span class="badge-dot"></span>${escapeHtml(label)}</span>`;
}

function fmtSize(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let size = bytes;
    while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
    return size.toFixed(i === 0 ? 0 : 1) + ' ' + units[i];
}

function debounce(fn, ms) {
    let t;
    return function() {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, arguments), ms);
    };
}
