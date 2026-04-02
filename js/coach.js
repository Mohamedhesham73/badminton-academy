// ─── COACH PAGE ───

let demoTime = null;

function getEffectiveTime() {
  if (demoTime) return new Date(demoTime);
  return new Date();
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

  renderDemoPanel();
  renderCheckinArea();
  updateClock();
  setInterval(updateClock, 1000);
  renderCoachHistory(u.id, monthKey);
}

function renderDemoPanel() {
  const panel = document.getElementById('demo-panel');
  if (!panel) return;
  const simLabel = demoTime
    ? `<div style="margin-top:8px;font-size:12px;color:var(--yellow);">⏰ Simulating: ${String(new Date(demoTime).getHours()).padStart(2,'0')}:${String(new Date(demoTime).getMinutes()).padStart(2,'0')} PM</div>`
    : '';
  panel.innerHTML = `
    <div style="background:rgba(255,225,53,0.08);border:1px dashed rgba(255,225,53,0.3);border-radius:10px;padding:12px 14px;margin-bottom:16px;">
      <div style="font-size:11px;font-weight:800;letter-spacing:1px;color:var(--yellow);margin-bottom:10px;">🧪 DEMO MODE — SIMULATE CHECK-IN TIME</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn btn-sm" style="background:rgba(0,200,150,0.15);color:var(--green);border:1px solid rgba(0,200,150,0.3);width:auto;" onclick="setDemoTime(16,30)">🌙 4:30 PM (Early)</button>
        <button class="btn btn-sm" style="background:rgba(0,200,150,0.15);color:var(--green);border:1px solid rgba(0,200,150,0.3);width:auto;" onclick="setDemoTime(17,0)">✅ 5:00 PM (On time)</button>
        <button class="btn btn-sm" style="background:rgba(255,155,33,0.15);color:var(--orange);border:1px solid rgba(255,155,33,0.3);width:auto;" onclick="setDemoTime(17,20)">⚠️ 5:20 PM (A bit late)</button>
        <button class="btn btn-sm" style="background:rgba(255,77,109,0.15);color:var(--red);border:1px solid rgba(255,77,109,0.3);width:auto;" onclick="setDemoTime(17,30)">💀 5:30 PM (Super late)</button>
        <button class="btn btn-sm" style="background:rgba(255,255,255,0.06);color:var(--text-muted);border:1px solid rgba(255,255,255,0.1);width:auto;" onclick="resetDemo()">🔄 Reset</button>
      </div>
      ${simLabel}
    </div>
  `;
}

function setDemoTime(hour, minute) {
  const dateStr = todayStr();
  attendance = attendance.filter(a => !(a.userId === currentUser.id && a.date === dateStr));
  saveAttendance(attendance);

  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  demoTime = d.getTime();

  renderDemoPanel();
  renderCheckinArea();
  updateClock();

  const monthKey = getCurrentMonthKey();
  const summary = calcMonthlySummary(currentUser.id, monthKey);
  document.getElementById('coach-days').textContent = summary.daysPresent;
  const pct = Math.min(100, (summary.daysPresent / CONFIG.sessionsPerMonth) * 100);
  document.getElementById('coach-progress').style.width = pct + '%';
  renderCoachHistory(currentUser.id, monthKey);
}

function resetDemo() {
  demoTime = null;
  const dateStr = todayStr();
  attendance = attendance.filter(a => !(a.userId === currentUser.id && a.date === dateStr));
  saveAttendance(attendance);
  renderDemoPanel();
  renderCheckinArea();
  updateClock();
  const monthKey = getCurrentMonthKey();
  const summary = calcMonthlySummary(currentUser.id, monthKey);
  document.getElementById('coach-days').textContent = summary.daysPresent;
  const pct = Math.min(100, (summary.daysPresent / CONFIG.sessionsPerMonth) * 100);
  document.getElementById('coach-progress').style.width = pct + '%';
  renderCoachHistory(currentUser.id, monthKey);
}

function updateClock() {
  const now = demoTime ? new Date(demoTime) : new Date();
  const h = String(now.getHours()).padStart(2,'0');
  const m = String(now.getMinutes()).padStart(2,'0');
  const s = demoTime ? '00' : String(now.getSeconds()).padStart(2,'0');
  const el = document.getElementById('live-clock');
  if (el) el.textContent = h + ':' + m + ':' + s;
  const dateEl = document.getElementById('live-date');
  if (dateEl) dateEl.textContent = now.toLocaleDateString('en-EG', { weekday: 'long', day: 'numeric', month: 'long' });
}

function renderCheckinArea() {
  const u = currentUser;
  const now = getEffectiveTime();
  const area = document.getElementById('checkin-area');
  const alreadyIn = hasCheckedInToday(u.id);
  const workDay = demoTime ? true : isWorkDay(now);

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

  if (!demoTime && hour < 16) {
    area.innerHTML = `
      <div class="checkin-time">
        <div id="live-clock" class="checkin-clock">--:--:--</div>
        <div id="live-date" class="checkin-date-str"></div>
      </div>
      <button class="btn btn-disabled" disabled>😴 Check-in opens at 04:00 PM</button>`;
    return;
  }

  if (!demoTime && hour >= CONFIG.sessionEnd.h) {
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
  const lateBy = Math.max(0, nowMins - startMins - 1);

  area.innerHTML = `
    <div class="checkin-time">
      <div id="live-clock" class="checkin-clock">--:--:--</div>
      <div id="live-date" class="checkin-date-str"></div>
    </div>
    ${lateBy > 0 ? `
      <div style="text-align:center;margin-bottom:12px;">
        <span class="${lateBy >= 30 ? 'badge badge-red' : 'badge badge-orange'}">⚠ ${lateBy} min late — ${calcDeduction(lateBy).toFixed(1)} EGP deduction</span>
      </div>` : `
      <div style="text-align:center;margin-bottom:12px;">
        <span class="badge badge-green">🟢 On time — session starts 05:00 PM</span>
      </div>`}
    <button class="btn btn-green" onclick="attemptCheckin()">🏸 Check In Now</button>
    <p style="text-align:center;font-size:12px;color:var(--text-muted);margin-top:10px;">
      ${demoTime ? 'Demo mode — no location check' : 'Location verification required'}
    </p>
    <div id="checkin-status" style="margin-top:12px;"></div>
  `;
}

function renderReaction(container, record, status) {
  const reactions = {
    ontime:    { img: 'imgs/WhatsApp Sticker 1', title: "YOU'RE ON TIME!",  msg: 'Perfect! Full session salary recorded.', cls: 'on-time' },
    late:      { img: 'imgs/WhatsApp Sticker 2', title: 'A BIT LATE...',    msg: `${record.lateMinutes} min late — ${record.deduction.toFixed(1)} EGP deducted`, cls: 'late' },
    superlate: { img: 'imgs/WhatsApp Sticker',   title: 'SUPER LATE! 😂',   msg: `${record.lateMinutes} min late — ${record.deduction.toFixed(1)} EGP deducted. BRO WAKE UP!`, cls: 'super-late' }
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
  if (demoTime) { doCheckin(); return; }

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
      if (statusEl) {
        statusEl.innerHTML = `
          <div style="background:rgba(255,155,33,0.1);border:1px solid rgba(255,155,33,0.25);border-radius:10px;padding:12px;text-align:center;">
            <div style="font-size:13px;color:var(--orange);margin-bottom:10px;">📍 Location access denied — demo mode</div>
            <button class="btn btn-green btn-sm" onclick="doCheckin()">Simulate Check-In (Demo)</button>
          </div>`;
      }
      const btn2 = document.querySelector('#checkin-area .btn-green');
      if (btn2 && btn2.textContent.includes('Getting')) btn2.style.display = 'none';
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
  const now = getEffectiveTime();
  const time = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
  const record = addAttendance(currentUser.id, time);
  const status = getLateStatus(record.lateMinutes);

  const monthKey = getCurrentMonthKey();
  const summary = calcMonthlySummary(currentUser.id, monthKey);
  document.getElementById('coach-days').textContent = summary.daysPresent;
  const pct = Math.min(100, (summary.daysPresent / CONFIG.sessionsPerMonth) * 100);
  document.getElementById('coach-progress').style.width = pct + '%';

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