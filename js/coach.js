// ─── COACH PAGE ───
import { CONFIG, USERS, attendance, currentUser, addAttendance, hasCheckedInToday, getMonthAttendance, getCurrentMonthKey, calcMonthlySummary, calcDeduction, getLateStatus, todayStr, isWorkDay, haversineMeters, formatDate, initials } from './data.js';
import { sendNote, listenToMyNotes, formatNoteTime } from './notes.js';

function to12h(hour, minute) {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h = String(hour % 12 || 12).padStart(2,'0');
  const m = String(minute).padStart(2,'0');
  return h + ':' + m + ' ' + ampm;
}

function getCoachStartTime(user) {
  const todayDay = new Date().getDay();
  const custom = user?.customStart?.[todayDay];
  return custom || CONFIG.sessionStart;
}

// ─── QUOTES ───
const QUOTES = [
  "You're here. That's already half the battle. 💪",
  "Champions train, losers complain. 🏆",
  "Another day, another session. Let's get it! 🔥",
  "The court doesn't care about excuses. 🏸",
  "Show up. Every. Single. Time. 👊",
  "Legends never miss a session. 👑",
  "Early bird gets the shuttlecock. 🐦",
  "Your future self will thank you. ✨",
  "Pain is temporary, glory is forever. 😤",
  "You came. You're already winning. 🎉",
];

function getDailyQuote() {
  const idx = new Date().getDate() % QUOTES.length;
  return QUOTES[idx];
}

// ─── CONFETTI ───
function launchConfetti() {
  const colors = ['#00C896', '#FFE135', '#ff4d6d', '#ffffff', '#00a8ff'];
  for (let i = 0; i < 80; i++) {
    setTimeout(() => {
      const el = document.createElement('div');
      el.style.cssText = `
        position:fixed;top:-10px;
        left:${Math.random() * 100}vw;
        width:${6 + Math.random() * 8}px;height:${6 + Math.random() * 8}px;
        background:${colors[Math.floor(Math.random() * colors.length)]};
        border-radius:${Math.random() > 0.5 ? '50%' : '2px'};
        z-index:9999;pointer-events:none;
        animation:confettiFall ${1.5 + Math.random() * 2}s ease-in forwards;
        transform:rotate(${Math.random() * 360}deg);
      `;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 4000);
    }, i * 30);
  }
}

// ─── SOUNDS (code-generated, no files needed) ───
function playSound(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);

    if (type === 'ontime') {
      // Happy victory fanfare
      const notes = [523, 659, 784, 1047];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        g.gain.setValueAtTime(0, ctx.currentTime + i * 0.12);
        g.gain.linearRampToValueAtTime(0.3, ctx.currentTime + i * 0.12 + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.3);
        osc.start(ctx.currentTime + i * 0.12);
        osc.stop(ctx.currentTime + i * 0.12 + 0.3);
      });
    } else if (type === 'late') {
      // Warning tone
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(330, ctx.currentTime + 0.3);
      g.gain.setValueAtTime(0.2, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } else if (type === 'superlate') {
      // Alarm/buzzer sound
      [0, 0.25, 0.5].forEach(t => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.type = 'square';
        osc.frequency.value = 180;
        g.gain.setValueAtTime(0.25, ctx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
        osc.start(ctx.currentTime + t);
        osc.stop(ctx.currentTime + t + 0.2);
      });
    }
  } catch(e) {}
}

// ─── STREAK ───
function getStreak(userId) {
  const records = attendance.filter(a => a.userId === userId).sort((a,b) => b.date.localeCompare(a.date));
  if (records.length === 0) return 0;
  let streak = 1;
  for (let i = 1; i < records.length; i++) {
    const prev = new Date(records[i-1].date + 'T00:00:00');
    const curr = new Date(records[i].date + 'T00:00:00');
    const diff = (prev - curr) / (1000 * 60 * 60 * 24);
    if (diff <= 7) streak++;
    else break;
  }
  return streak;
}

// ─── RESTRICTIONS MODAL ───
function showRestrictions() {
  const existing = document.getElementById('restrictions-modal');
  if (existing) { existing.remove(); return; }

  const modal = document.createElement('div');
  modal.id = 'restrictions-modal';
  modal.style.cssText = `
    position:fixed;inset:0;z-index:9998;
    background:rgba(10,22,40,0.97);
    overflow-y:auto;padding:24px 16px;
    animation:fadeIn 0.25s ease;
  `;
  modal.innerHTML = `
    <div style="max-width:480px;margin:0 auto;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;">
        <div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:26px;letter-spacing:2px;color:var(--green);">📋 ACADEMY RULES</div>
          <div style="font-size:12px;color:var(--text-muted);">Disha Hall Badminton Academy</div>
        </div>
        <button onclick="document.getElementById('restrictions-modal').remove()" style="background:rgba(255,255,255,0.08);border:none;color:var(--white);font-size:20px;width:36px;height:36px;border-radius:50%;cursor:pointer;">×</button>
      </div>

      ${[
        {
          icon: '📅',
          title: 'Attendance & Absence',
          rules: [
            'Coaches must check in via the app upon arrival at the academy.',
            'Absence without prior notice (before 2:00 PM on the working day) will be counted as TWO absent sessions, not one.',
            'To report an absence or lateness, send a note to the admin before 2:00 PM on the working day.',
          ]
        },
        {
          icon: '⏰',
          title: 'Session Timing',
          rules: [
            'Sessions run from 5:00 PM to 9:00 PM (Saturday, Monday, Wednesday).',
            'Check-in opens at 4:00 PM. Arriving before 5:00 PM is recorded as on time.',
            'Late arrival deductions: 100 EGP per hour, calculated by the minute starting from 5:01 PM.',
            'Coaches are entitled to one break of 15–30 minutes between 7:30 PM and 8:00 PM only.',
          ]
        },
        {
          icon: '🚫',
          title: 'Code of Conduct',
          rules: [
            'Coaches must remain on the court or designated coaching areas during sessions.',
            'Sitting or resting in the restrooms during sessions is strictly prohibited.',
            'Sitting or gathering in the (koshk) area during sessions is not permitted.',
            'Professional conduct must be maintained at all times with players, staff, and management.',
          ]
        },
        {
          icon: '💰',
          title: 'Salary & Deductions',
          rules: [
            'Monthly salary is based on 12 fixed sessions regardless of calendar variations.',
            'Late arrival and absence deductions are calculated automatically by the system.',
            'Deductions are visible to the admin and reflected in the monthly net salary.',
          ]
        },
      ].map(section => `
        <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:var(--radius-sm);padding:16px;margin-bottom:12px;">
          <div style="font-size:15px;font-weight:800;color:var(--green);margin-bottom:10px;">${section.icon} ${section.title}</div>
          ${section.rules.map((r, i) => `
            <div style="display:flex;gap:10px;margin-bottom:8px;font-size:13px;color:var(--gray-mid);line-height:1.5;">
              <span style="color:var(--green);font-weight:700;flex-shrink:0;">${i+1}.</span>
              <span>${r}</span>
            </div>`).join('')}
        </div>`).join('')}

      <div style="text-align:center;font-size:12px;color:var(--text-muted);margin-top:16px;">
        These rules are set by Disha Hall Academy management.<br/>More rules may be added in the future.
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

export function renderCoachPage() {
  const u = currentUser;
  const monthKey = getCurrentMonthKey();
  const summary = calcMonthlySummary(u.id, monthKey);

  const avatarEl = document.getElementById('coach-avatar');
  if (u.photo) {
    avatarEl.innerHTML = `<img src="${u.photo}" alt="${u.name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;cursor:pointer;" onclick="showRestrictions()" onerror="this.parentElement.textContent='${initials(u.name)}'" />`;
  } else {
    avatarEl.textContent = initials(u.name);
    avatarEl.style.cursor = 'pointer';
    avatarEl.onclick = showRestrictions;
  }

  document.getElementById('coach-name-header').textContent = u.name;
  document.getElementById('coach-days').textContent = summary.daysPresent;
  document.getElementById('coach-sessions').textContent = CONFIG.sessionsPerMonth;
  document.getElementById('coach-salary').textContent = Math.round(summary.baseSalary).toLocaleString('en-EG') + ' EGP';

  const pct = Math.min(100, (summary.daysPresent / CONFIG.sessionsPerMonth) * 100);
  document.getElementById('coach-progress').style.width = pct + '%';

  const quoteEl = document.getElementById('daily-quote');
  if (quoteEl) quoteEl.textContent = getDailyQuote();

  const streakEl = document.getElementById('coach-streak');
  if (streakEl) streakEl.textContent = getStreak(u.id);

  renderCheckinArea();
  updateClock();
  setInterval(updateClock, 1000);
  renderCoachHistory(u.id, monthKey);
  renderNotesSection(u);
}

window.showRestrictions = showRestrictions;

function getClockColor(now) {
  const totalMins = now.getHours() * 60 + now.getMinutes();
  const openMins = 16 * 60;
  const startMins = 17 * 60;
  if (totalMins < openMins) return 'var(--text-muted)';
  if (totalMins < startMins - 15) return 'var(--green)';
  if (totalMins < startMins) return 'var(--yellow)';
  if (totalMins < startMins + 30) return 'var(--orange)';
  return 'var(--red)';
}

function updateClock() {
  const now = new Date();
  const raw = now.getHours();
  const h = String(raw % 12 || 12).padStart(2,'0');
  const m = String(now.getMinutes()).padStart(2,'0');
  const s = String(now.getSeconds()).padStart(2,'0');
  const ampm = raw >= 12 ? 'PM' : 'AM';
  const el = document.getElementById('live-clock');
  if (el) { el.textContent = h + ':' + m + ':' + s + ' ' + ampm; el.style.color = getClockColor(now); }
  const dateEl = document.getElementById('live-date');
  if (dateEl) dateEl.textContent = now.toLocaleDateString('en-EG', { weekday: 'long', day: 'numeric', month: 'long' });
}

function getCountdownText(now, startTime) {
  const totalMins = now.getHours() * 60 + now.getMinutes();
  const startMins = startTime.h * 60 + startTime.m;
  const diff = startMins - totalMins;
  if (diff <= 0) return null;
  if (diff >= 60) return `Session starts in ${Math.floor(diff/60)}h ${diff%60}m ⏳`;
  if (diff === 1) return `Session starts in 1 minute! 😱`;
  return `Session starts in ${diff} minutes ⏳`;
}

function renderCheckinArea() {
  const u = currentUser;
  const now = new Date();
  const area = document.getElementById('checkin-area');
  const alreadyIn = hasCheckedInToday(u.id);
  const workDay = isWorkDay(now);

  if (alreadyIn) { renderReaction(area, alreadyIn, getLateStatus(alreadyIn.lateMinutes)); return; }

  if (!workDay) {
    area.innerHTML = `
      <div class="checkin-time"><div id="live-clock" class="checkin-clock">--:--:--</div><div id="live-date" class="checkin-date-str"></div></div>
      <button class="btn btn-disabled" disabled>🏸 Not a working day</button>
      <p style="text-align:center;font-size:12px;color:var(--text-muted);margin-top:10px;">Working days: Saturday · Monday · Wednesday</p>`;
    return;
  }

  const hour = now.getHours();

  if (hour < CONFIG.checkinOpen.h) {
    area.innerHTML = `
      <div class="checkin-time"><div id="live-clock" class="checkin-clock">--:--:--</div><div id="live-date" class="checkin-date-str"></div></div>
      <button class="btn btn-disabled" disabled>😴 Check-in opens at 04:00 PM</button>`;
    return;
  }

  if (hour >= CONFIG.sessionEnd.h) {
    area.innerHTML = `
      <div class="checkin-time"><div id="live-clock" class="checkin-clock">--:--:--</div><div id="live-date" class="checkin-date-str"></div></div>
      <button class="btn btn-disabled" disabled>⏰ Session has ended</button>
      <p style="text-align:center;font-size:12px;color:var(--text-muted);margin-top:10px;">Check-in closed after 09:00 PM</p>`;
    return;
  }

  const startTime = getCoachStartTime(u);
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const startMins = startTime.h * 60 + startTime.m;
  const lateBy = Math.max(0, nowMins - startMins);
  const countdown = getCountdownText(now, startTime);
  const shakeClass = (startMins - nowMins <= 5 && startMins - nowMins > 0) ? 'shake-btn' : '';
  const startLabel = to12h(startTime.h, startTime.m);

  area.innerHTML = `
    <div class="checkin-time"><div id="live-clock" class="checkin-clock">--:--:--</div><div id="live-date" class="checkin-date-str"></div></div>
    ${countdown ? `<div style="text-align:center;margin-bottom:10px;"><span class="badge badge-yellow" style="background:rgba(255,225,53,0.15);color:var(--yellow);">${countdown}</span></div>` : ''}
    ${lateBy > 0 ? `
      <div style="text-align:center;margin-bottom:12px;">
        <span class="${lateBy >= 30 ? 'badge badge-red' : 'badge badge-orange'}">⚠ ${lateBy} min late — ${calcDeduction(lateBy).toFixed(1)} EGP deduction</span>
      </div>` : `
      <div style="text-align:center;margin-bottom:12px;">
        <span class="badge badge-green">🟢 On time — session starts ${startLabel}</span>
      </div>`}
    <button class="btn btn-green ${shakeClass}" onclick="attemptCheckin()">🏸 Check In Now</button>
    <p style="text-align:center;font-size:12px;color:var(--text-muted);margin-top:10px;">Location verification required</p>
    <div id="checkin-status" style="margin-top:12px;"></div>
  `;
}

function renderReaction(container, record, status) {
  const reactions = {
    ontime:    { img: 'imgs/WhatsApp Sticker 1', title: "YOU'RE ON TIME!", msg: 'Perfect! Full session salary recorded.', cls: 'on-time' },
    late:      { img: 'imgs/WhatsApp Sticker 2', title: 'A BIT LATE...',   msg: `${record.lateMinutes} min late — ${record.deduction.toFixed(1)} EGP deducted`, cls: 'late' },
    superlate: { img: 'imgs/WhatsApp Sticker',   title: 'SUPER LATE! 😂',  msg: `${record.lateMinutes} min late — ${record.deduction.toFixed(1)} EGP deducted. BRO WAKE UP!`, cls: 'super-late' }
  };
  const r = reactions[status];
  container.innerHTML = `
    <div class="checkin-time"><div id="live-clock" class="checkin-clock">--:--:--</div><div id="live-date" class="checkin-date-str"></div></div>
    <div class="reaction-box ${r.cls}">
      <img src="${r.img}" alt="reaction" style="width:120px;height:120px;object-fit:contain;margin-bottom:10px;animation:bounce 0.6s ease infinite alternate;" onerror="this.style.display='none'" />
      <div class="reaction-title">${r.title}</div>
      <div class="reaction-msg">${r.msg}</div>
      <div style="margin-top:10px;font-size:13px;color:var(--text-muted);">Checked in at ${record.checkInTime}</div>
    </div>
  `;
}

window.attemptCheckin = function() {
  const btn = document.querySelector('#checkin-area .btn-green');
  if (btn) { btn.textContent = '📡 Getting location...'; btn.disabled = true; }
  if (!navigator.geolocation) { showCheckinError('Geolocation not supported on this device.'); return; }
  navigator.geolocation.getCurrentPosition(
    pos => {
      const dist = haversineMeters(pos.coords.latitude, pos.coords.longitude, CONFIG.academyLat, CONFIG.academyLng);
      if (dist <= CONFIG.geofenceMeters) doCheckin();
      else showCheckinError(`You are ${Math.round(dist)}m from the academy. Must be within ${CONFIG.geofenceMeters}m.`);
    },
    err => showCheckinError('Location access denied. Please enable location and try again.'),
    { timeout: 8000 }
  );
}

function showCheckinError(msg) {
  const btn = document.querySelector('#checkin-area .btn-green');
  if (btn) { btn.textContent = '🏸 Check In Now'; btn.disabled = false; }
  const statusEl = document.getElementById('checkin-status');
  if (statusEl) statusEl.innerHTML = `<div style="background:rgba(255,77,109,0.1);border:1px solid rgba(255,77,109,0.25);border-radius:10px;padding:12px;font-size:13px;color:var(--red);">❌ ${msg}</div>`;
}

window.doCheckin = function() {
  const now = new Date();
  const u = currentUser;
  const startTime = getCoachStartTime(u);
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const startMins = startTime.h * 60 + startTime.m;
  const isEarly = nowMins <= startMins;
  const time = isEarly ? to12h(startTime.h, startTime.m) : to12h(now.getHours(), now.getMinutes());
  const record = addAttendance(u.id, time);
  const status = getLateStatus(record.lateMinutes);
  const monthKey = getCurrentMonthKey();
  const summary = calcMonthlySummary(u.id, monthKey);
  document.getElementById('coach-days').textContent = summary.daysPresent;
  const pct = Math.min(100, (summary.daysPresent / CONFIG.sessionsPerMonth) * 100);
  document.getElementById('coach-progress').style.width = pct + '%';
  const streakEl = document.getElementById('coach-streak');
  if (streakEl) streakEl.textContent = getStreak(u.id);
  playSound(status);
  if (status === 'ontime') launchConfetti();
  renderReaction(document.getElementById('checkin-area'), record, status);
  updateClock();
  renderCoachHistory(u.id, monthKey);
}

function renderCoachHistory(userId, monthKey) {
  const container = document.getElementById('coach-history');
  const records = getMonthAttendance(userId, monthKey).sort((a,b) => b.date.localeCompare(a.date));
  if (records.length === 0) {
    container.innerHTML = `<div class="empty-state"><span class="icon">📋</span>No attendance this month yet</div>`;
    return;
  }
  container.innerHTML = records.map(r => {
    const status = getLateStatus(r.lateMinutes);
    const badges = {
      ontime:    `<span class="badge badge-green">On time</span>`,
      late:      `<span class="badge badge-orange">+${r.lateMinutes}m late</span>`,
      superlate: `<span class="badge badge-red">+${r.lateMinutes}m late 💀</span>`
    };
    return `
      <div class="attendance-row fade-in">
        <div><div class="att-date">${formatDate(r.date)}</div><div class="att-time">Check-in: ${r.checkInTime}</div></div>
        <div class="att-right">
          ${badges[status]}
          ${r.deduction > 0 ? `<div style="margin-top:4px;"><span class="deduction-pill">-${r.deduction.toFixed(1)} EGP</span></div>` : ''}
        </div>
      </div>`;
  }).join('');
}

// ─── NOTES SECTION ───
function isNotesAllowed() {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  const isWorkingDay = CONFIG.workDays.includes(day);
  if (!isWorkingDay) return true; // All non-working days allowed
  // Working day: allowed before 14:00 and after 21:00
  if (hour < 14) return true;
  if (hour >= 21) return true;
  return false;
}

function renderNotesSection(u) {
  const container = document.getElementById('coach-notes');
  if (!container) return;

  const allowed = isNotesAllowed();
  const now = new Date();
  const isWorkingDay = CONFIG.workDays.includes(now.getDay());
  const blockedMsg = isWorkingDay
    ? '🔒 Notes are closed from 2:00 PM to 9:00 PM on working days.'
    : '';

  container.innerHTML = `
    <div class="card" style="margin:0 16px 16px;">
      <div style="font-size:13px;font-weight:800;color:var(--green);margin-bottom:12px;letter-spacing:1px;">📝 SEND A NOTE TO ADMIN</div>
      ${!allowed ? `<div style="background:rgba(255,155,33,0.1);border:1px solid rgba(255,155,33,0.25);border-radius:8px;padding:10px;font-size:13px;color:var(--orange);margin-bottom:10px;">${blockedMsg}</div>` : ''}
      <textarea id="note-input" placeholder="e.g. I'll be 15 mins late on Saturday..." ${!allowed ? 'disabled' : ''} style="width:100%;padding:10px 12px;background:rgba(255,255,255,${allowed ? '0.07' : '0.03'});border:1px solid rgba(255,255,255,0.12);border-radius:var(--radius-sm);color:var(--white);font-family:'Nunito',sans-serif;font-size:14px;resize:none;height:80px;${!allowed ? 'cursor:not-allowed;opacity:0.5;' : ''}"></textarea>
      <button class="btn ${allowed ? 'btn-green' : 'btn-disabled'}" style="margin-top:10px;" ${!allowed ? 'disabled' : ''} onclick="submitNote()">Send Note ✉️</button>
      <div id="note-status" style="margin-top:8px;font-size:13px;"></div>
    </div>
    <div id="my-notes-list" style="margin:0 16px;"></div>
  `;

  listenToMyNotes(u.id, (notes) => {
    const list = document.getElementById('my-notes-list');
    if (!list) return;
    if (notes.length === 0) {
      list.innerHTML = `<div class="empty-state"><span class="icon">📭</span>No notes sent yet</div>`;
      return;
    }
    list.innerHTML = notes.map(n => `
      <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:var(--radius-sm);padding:12px 14px;margin-bottom:8px;">
        <div style="font-size:14px;color:var(--white);margin-bottom:6px;">${n.message}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div style="font-size:11px;color:var(--text-muted);">${formatNoteTime(n.timestamp)}</div>
          <span class="badge ${n.read ? 'badge-green' : 'badge-yellow'}" style="${n.read ? '' : 'background:rgba(255,225,53,0.15);color:var(--yellow);'}">
            ${n.read ? '✓ Seen' : '⏳ Pending'}
          </span>
        </div>
      </div>`).join('');
  });
}

window.submitNote = async function() {
  if (!isNotesAllowed()) return;
  const input = document.getElementById('note-input');
  const status = document.getElementById('note-status');
  const msg = input.value.trim();
  if (!msg) { status.textContent = '⚠ Please write a message first!'; status.style.color = 'var(--orange)'; return; }
  status.textContent = 'Sending...'; status.style.color = 'var(--text-muted)';
  const success = await sendNote(currentUser.id, currentUser.name, msg);
  if (success) {
    input.value = '';
    status.textContent = '✅ Note sent to admin!'; status.style.color = 'var(--green)';
    setTimeout(() => { status.textContent = ''; }, 3000);
  } else {
    status.textContent = '❌ Failed to send. Try again.'; status.style.color = 'var(--red)';
  }
}