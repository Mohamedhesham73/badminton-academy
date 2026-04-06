// ─── COACH PAGE ───

function to12h(hour, minute) {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h = String(hour % 12 || 12).padStart(2,'0');
  const m = String(minute).padStart(2,'0');
  return h + ':' + m + ' ' + ampm;
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
        position:fixed;
        top:-10px;
        left:${Math.random() * 100}vw;
        width:${6 + Math.random() * 8}px;
        height:${6 + Math.random() * 8}px;
        background:${colors[Math.floor(Math.random() * colors.length)]};
        border-radius:${Math.random() > 0.5 ? '50%' : '2px'};
        z-index:9999;
        pointer-events:none;
        animation:confettiFall ${1.5 + Math.random() * 2}s ease-in forwards;
        transform:rotate(${Math.random() * 360}deg);
      `;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 4000);
    }, i * 30);
  }
}

// ─── SOUNDS ───
function playSound(type) {
  const sounds = {
    ontime:    'imgs/برافو عليك - مدحت شلبي.mp3',
    late:      'imgs/يحيى عزام - عايز حل للعلوقية.mp3',
    superlate: 'imgs/شوبير ليه إيه المبرر.mp3'
  };
  try {
    const audio = new Audio(sounds[type]);
    audio.play();
  } catch(e) {}
}

// ─── STREAK ───
function getStreak(userId) {
  const records = attendance
    .filter(a => a.userId === userId)
    .sort((a,b) => b.date.localeCompare(a.date));
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

function renderCoachPage() {
  const u = currentUser;
  const monthKey = getCurrentMonthKey();
  const summary = calcMonthlySummary(u.id, monthKey);

  document.getElementById('coach-avatar').textContent = initials(u.name);
  document.getElementById('coach-name-header').textContent = u.name;
  document.getElementById('coach-days').textContent = summary.daysPresent;
  document.getElementById('coach-sessions').textContent = CONFIG.sessionsPerMonth;
  document.getElementById('coach-salary').textContent =
    Math.round(summary.baseSalary).toLocaleString('en-EG') + ' EGP';

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
}

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
  if (el) {
    el.textContent = h + ':' + m + ':' + s + ' ' + ampm;
    el.style.color = getClockColor(now);
  }
  const dateEl = document.getElementById('live-date');
  if (dateEl) dateEl.textContent = now.toLocaleDateString('en-EG', { weekday: 'long', day: 'numeric', month: 'long' });
}

function getCountdownText(now) {
  const totalMins = now.getHours() * 60 + now.getMinutes();
  const startMins = CONFIG.sessionStart.h * 60 + CONFIG.sessionStart.m;
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

  if (alreadyIn) {
    renderReaction(area, alreadyIn, getLateStatus(alreadyIn.lateMinutes));
    return;
  }

  if (!workDay) {
    area.innerHTML = `
      <div class="checkin-time">
        <div id="live-clock" class="checkin-clock">--:--:--</div>
        <div id="live-date" class="checkin-date-str"></div>
      </div>
      <button class="btn btn-disabled" disabled>🏸 Not a working day</button>
      <p style="text-align:center;font-size:12px;color:var(--text-muted);margin-top:10px;">
        Working days: Saturday · Monday · Wednesday
      </p>`;
    return;
  }

  const hour = now.getHours();

  if (hour < 16) {
    area.innerHTML = `
      <div class="checkin-time">
        <div id="live-clock" class="checkin-clock">--:--:--</div>
        <div id="live-date" class="checkin-date-str"></div>
      </div>
      <button class="btn btn-disabled" disabled>😴 Check-in opens at 04:00 PM</button>`;
    return;
  }

  if (hour >= CONFIG.sessionEnd.h) {
    area.innerHTML = `
      <div class="checkin-time">
        <div id="live-clock" class="checkin-clock">--:--:--</div>
        <div id="live-date" class="checkin-date-str"></div>
      </div>
      <button class="btn btn-disabled" disabled>⏰ Session has ended</button>
      <p style="text-align:center;font-size:12px;color:var(--text-muted);margin-top:10px;">
        Check-in closed after 09:00 PM
      </p>`;
    return;
  }

  const nowMins = now.getHours() * 60 + now.getMinutes();
  const startMins = CONFIG.sessionStart.h * 60 + CONFIG.sessionStart.m;
  const lateBy = Math.max(0, nowMins - startMins);
  const countdown = getCountdownText(now);
  const shakeClass = (startMins - nowMins <= 5 && startMins - nowMins > 0) ? 'shake-btn' : '';

  area.innerHTML = `
    <div class="checkin-time">
      <div id="live-clock" class="checkin-clock">--:--:--</div>
      <div id="live-date" class="checkin-date-str"></div>
    </div>
    ${countdown ? `<div style="text-align:center;margin-bottom:10px;"><span class="badge badge-yellow" style="background:rgba(255,225,53,0.15);color:var(--yellow);">${countdown}</span></div>` : ''}
    ${lateBy > 0 ? `
      <div style="text-align:center;margin-bottom:12px;">
        <span class="${lateBy >= 30 ? 'badge badge-red' : 'badge badge-orange'}">⚠ ${lateBy} min late — ${calcDeduction(lateBy).toFixed(1)} EGP deduction</span>
      </div>` : `
      <div style="text-align:center;margin-bottom:12px;">
        <span class="badge badge-green">🟢 On time — session starts 05:00 PM</span>
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
    <div class="checkin-time">
      <div id="live-clock" class="checkin-clock">--:--:--</div>
      <div id="live-date" class="checkin-date-str"></div>
    </div>
    <div class="reaction-box ${r.cls}">
      <img src="${r.img}" alt="reaction" style="width:120px;height:120px;object-fit:contain;margin-bottom:10px;animation:bounce 0.6s ease infinite alternate;" onerror="this.style.display='none'" />
      <div class="reaction-title">${r.title}</div>
      <div class="reaction-msg">${r.msg}</div>
      <div style="margin-top:10px;font-size:13px;color:var(--text-muted);">Checked in at ${record.checkInTime}</div>
    </div>
  `;
}

function attemptCheckin() {
  const statusEl = document.getElementById('checkin-status');
  const btn = document.querySelector('#checkin-area .btn-green');
  if (btn) { btn.textContent = '📡 Getting location...'; btn.disabled = true; }
  if (!navigator.geolocation) { showCheckinError('Geolocation not supported on this device.'); return; }
  navigator.geolocation.getCurrentPosition(
    pos => {
      const dist = haversineMeters(pos.coords.latitude, pos.coords.longitude, CONFIG.academyLat, CONFIG.academyLng);
      if (dist <= CONFIG.geofenceMeters) {
        doCheckin();
      } else {
        showCheckinError(`You are ${Math.round(dist)}m from the academy. Must be within ${CONFIG.geofenceMeters}m.`);
      }
    },
    err => {
      showCheckinError('Location access denied. Please enable location and try again.');
    },
    { timeout: 8000 }
  );
}

function showCheckinError(msg) {
  const btn = document.querySelector('#checkin-area .btn-green');
  if (btn) { btn.textContent = '🏸 Check In Now'; btn.disabled = false; }
  const statusEl = document.getElementById('checkin-status');
  if (statusEl) {
    statusEl.innerHTML = `<div style="background:rgba(255,77,109,0.1);border:1px solid rgba(255,77,109,0.25);border-radius:10px;padding:12px;font-size:13px;color:var(--red);">❌ ${msg}</div>`;
  }
}

function doCheckin() {
  const now = new Date();
  const startH = CONFIG.sessionStart.h;
  const startM = CONFIG.sessionStart.m;
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const startMins = startH * 60 + startM;
  const isEarly = nowMins <= startMins;
  const time = isEarly ? to12h(startH, startM) : to12h(now.getHours(), now.getMinutes());
  const record = addAttendance(currentUser.id, time);
  const status = getLateStatus(record.lateMinutes);

  const monthKey = getCurrentMonthKey();
  const summary = calcMonthlySummary(currentUser.id, monthKey);
  document.getElementById('coach-days').textContent = summary.daysPresent;
  const pct = Math.min(100, (summary.daysPresent / CONFIG.sessionsPerMonth) * 100);
  document.getElementById('coach-progress').style.width = pct + '%';

  const streakEl = document.getElementById('coach-streak');
  if (streakEl) streakEl.textContent = getStreak(currentUser.id);

  playSound(status);
  if (status === 'ontime') launchConfetti();

  renderReaction(document.getElementById('checkin-area'), record, status);
  updateClock();
  renderCoachHistory(currentUser.id, monthKey);
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
        <div>
          <div class="att-date">${formatDate(r.date)}</div>
          <div class="att-time">Check-in: ${r.checkInTime}</div>
        </div>
        <div class="att-right">
          ${badges[status]}
          ${r.deduction > 0 ? `<div style="margin-top:4px;"><span class="deduction-pill">-${r.deduction.toFixed(1)} EGP</span></div>` : ''}
        </div>
      </div>`;
  }).join('');
}