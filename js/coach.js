// ─── COACH PAGE ───
import { CONFIG, USERS, attendance, currentUser, holidays, listenToHolidays, isHoliday, getHoliday, addAttendance, checkOutCoach, hasCheckedInToday, getMonthAttendance, getCurrentMonthKey, calcMonthlySummary, calcMonthlySummaryWithBonus, calcDeductionForUser, getLateStatus, getCoachStartTime, todayStr, isWorkDay, haversineMeters, formatDate, initials, requestCoachRestDay, removeAttendance, getAvailableRestDays, isRestDayTaken } from './data.js';
import { sendNote, listenToMyNotes, formatNoteTime } from './notes.js';

let coachClockTimer = null;
let coachNotesUnsubscribe = null;
let coachHolidayUnsubscribe = null;

function to12h(hour, minute) {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h = String(hour % 12 || 12).padStart(2,'0');
  const m = String(minute).padStart(2,'0');
  return h + ':' + m + ' ' + ampm;
}

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

function getDailyQuote() { return QUOTES[new Date().getDate() % QUOTES.length]; }

function isExcusedRecord(record) {
  return record.excused === true || record.checkInTime === 'EXCUSED';
}

function isCoachRestDay(record) {
  return isExcusedRecord(record) && (record.restDay === true || record.excusedBy === 'coach' || record.excusedReason === 'Coach rest day');
}

function monthEndForInput(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return `${monthKey}-${String(lastDay).padStart(2, '0')}`;
}

function datePlusDaysStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatHolidayRange(start, end) {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  if (start === end) {
    return s.toLocaleDateString('en-EG', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  return `${s.toLocaleDateString('en-EG', { day: 'numeric', month: 'short' })} - ${e.toLocaleDateString('en-EG', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

function getVisibleHolidays(monthKey) {
  const today = todayStr();
  return [...holidays]
    .filter(h => h.endDate >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(0, 3);
}

function renderHolidayNotice(monthKey) {
  const activeHolidays = getVisibleHolidays(monthKey);
  if (activeHolidays.length === 0) return '';

  return `
    <div class="card" style="margin:0 0 16px;border-color:rgba(0,200,150,0.22);background:rgba(0,200,150,0.06);">
      <div style="font-size:14px;font-weight:800;color:var(--green);margin-bottom:10px;">Academy holiday rest</div>
      ${activeHolidays.map(h => `
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
          <div style="font-size:26px;">${h.icon || '🕌'}</div>
          <div>
            <div style="font-size:14px;font-weight:800;color:var(--white);">${h.name}</div>
            <div style="font-size:12px;color:var(--text-muted);">Rest from ${formatHolidayRange(h.startDate, h.endDate)} · No deduction</div>
          </div>
        </div>
      `).join('')}
    </div>`;
}

function renderCoachHolidayBanner(monthKey) {
  const container = document.getElementById('coach-holidays');
  if (!container) return;
  container.innerHTML = renderHolidayNotice(monthKey);
}

function launchConfetti() {
  const colors = ['#00C896', '#FFE135', '#ff4d6d', '#ffffff', '#00a8ff'];
  for (let i = 0; i < 80; i++) {
    setTimeout(() => {
      const el = document.createElement('div');
      el.style.cssText = `position:fixed;top:-10px;left:${Math.random()*100}vw;width:${6+Math.random()*8}px;height:${6+Math.random()*8}px;background:${colors[Math.floor(Math.random()*colors.length)]};border-radius:${Math.random()>0.5?'50%':'2px'};z-index:9999;pointer-events:none;animation:confettiFall ${1.5+Math.random()*2}s ease-in forwards;transform:rotate(${Math.random()*360}deg);`;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 4000);
    }, i * 30);
  }
}

function playSound(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (type === 'ontime') {
      [523, 659, 784, 1047].forEach((freq, i) => {
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
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(330, ctx.currentTime + 0.3);
      g.gain.setValueAtTime(0.2, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.5);
    } else if (type === 'superlate') {
      [0, 0.25, 0.5].forEach(t => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.type = 'square';
        osc.frequency.value = 180;
        g.gain.setValueAtTime(0.25, ctx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
        osc.start(ctx.currentTime + t); osc.stop(ctx.currentTime + t + 0.2);
      });
    } else if (type === 'checkout') {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(440, ctx.currentTime + 0.3);
      g.gain.setValueAtTime(0.2, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.4);
    }
  } catch(e) {}
}

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

function showRestrictions() {
  const existing = document.getElementById('restrictions-modal');
  if (existing) { existing.remove(); return; }
  const modal = document.createElement('div');
  modal.id = 'restrictions-modal';
  modal.style.cssText = `position:fixed;inset:0;z-index:9998;background:rgba(10,22,40,0.97);overflow-y:auto;padding:24px 16px;animation:fadeIn 0.25s ease;`;
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
        { icon: '📅', title: 'Attendance & Absence', rules: [
          'Coaches must check in via the app upon arrival at the academy.',
          'Coaches must check out via the app when leaving the academy.',
          'Absence without prior notice (before 2:00 PM on the working day) will be counted as TWO absent sessions, not one.',
          'To report an absence or lateness, send a note to the admin before 2:00 PM on the working day.',
        ]},
        { icon: '⏰', title: 'Session Timing', rules: [
          'Sessions run from 5:00 PM to 9:00 PM (Saturday, Monday, Wednesday).',
          'Check-in opens at 4:00 PM. Arriving before 5:00 PM is recorded as on time.',
          'Late arrival deductions are calculated by the minute at the coach\'s hourly rate.',
          'Leaving early before 9:00 PM results in deductions calculated by the minute at the coach\'s hourly rate.',
          'Coaches are entitled to one break of 15–30 minutes between 7:30 PM and 8:00 PM only.',
        ]},
        { icon: '🚫', title: 'Code of Conduct', rules: [
          'Coaches must remain on the court or designated coaching areas during sessions.',
          'Sitting or resting in the restrooms during sessions is strictly prohibited.',
          'Sitting or gathering in the (koshk) area during sessions is not permitted.',
          'Professional conduct must be maintained at all times with players, staff, and management.',
        ]},
        { icon: '💰', title: 'Salary & Deductions', rules: [
          'Monthly salary is based on 12 fixed sessions regardless of calendar variations.',
          'Late arrival, early leave, and absence deductions are calculated automatically by the system.',
          'Deductions are visible to the admin and reflected in the monthly net salary.',
        ]},
      ].map(section => `
        <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:var(--radius-sm);padding:16px;margin-bottom:12px;">
          <div style="font-size:15px;font-weight:800;color:var(--green);margin-bottom:10px;">${section.icon} ${section.title}</div>
          ${section.rules.map((r, i) => `
            <div style="display:flex;gap:10px;margin-bottom:8px;font-size:13px;color:var(--gray-mid);line-height:1.5;">
              <span style="color:var(--green);font-weight:700;flex-shrink:0;">${i+1}.</span>
              <span>${r}</span>
            </div>`).join('')}
        </div>`).join('')}
      <div style="text-align:center;font-size:12px;color:var(--text-muted);margin-top:16px;">These rules are set by Disha Hall Academy management.<br/>More rules may be added in the future.</div>
    </div>`;
  document.body.appendChild(modal);
}

window.showRestrictions = showRestrictions;

export function cleanupCoachPage() {
  if (coachClockTimer) {
    clearInterval(coachClockTimer);
    coachClockTimer = null;
  }
  if (coachNotesUnsubscribe) {
    coachNotesUnsubscribe();
    coachNotesUnsubscribe = null;
  }
  if (coachHolidayUnsubscribe) {
    coachHolidayUnsubscribe();
    coachHolidayUnsubscribe = null;
  }
}

export function renderCoachPage() {
  const u = currentUser;
  const monthKey = getCurrentMonthKey();
  const summary = calcMonthlySummaryWithBonus(u.id, monthKey);

  const avatarEl = document.getElementById('coach-avatar');
  avatarEl.style.cursor = 'pointer';
  avatarEl.onclick = showRestrictions;
  if (u.photo) {
    avatarEl.innerHTML = `<img src="${u.photo}" alt="${u.name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;pointer-events:none;" onerror="this.parentElement.textContent='${initials(u.name)}'" />`;
  } else {
    avatarEl.textContent = initials(u.name);
  }

  document.getElementById('coach-name-header').textContent = u.name;
  document.getElementById('coach-days').textContent = summary.daysPresent;
  document.getElementById('coach-sessions').textContent = CONFIG.sessionsPerMonth;
  const baseSalaryEl = document.getElementById('coach-salary');
baseSalaryEl.innerHTML = `
  ${Math.round(summary.baseSalary).toLocaleString('en-EG')} EGP
  <div style="font-size:11px;font-weight:600;color:${summary.totalDeductions > 0 ? 'var(--orange)' : 'var(--green)'};margin-top:4px;letter-spacing:0.5px;">
    Net: ${Math.round(summary.netSalaryWithBonus).toLocaleString('en-EG')} EGP
    ${summary.leaderboardBonus > 0 ? `<div style="font-size:10px;color:var(--yellow);margin-top:2px;">+${summary.leaderboardBonus.toLocaleString('en-EG')} leaderboard bonus</div>` : ''}
    ${summary.totalDeductions > 0 ? `<div style="font-size:10px;color:var(--red);margin-top:2px;">-${Math.round(summary.totalDeductions).toLocaleString('en-EG')} deducted</div>` : ''}
  </div>
`;

  const pct = Math.min(100, (summary.daysPresent / CONFIG.sessionsPerMonth) * 100);
  document.getElementById('coach-progress').style.width = pct + '%';

  const quoteEl = document.getElementById('daily-quote');
  if (quoteEl) quoteEl.textContent = getDailyQuote();
  renderCoachHolidayBanner(monthKey);

  const streakEl = document.getElementById('coach-streak');
  if (streakEl) streakEl.textContent = getStreak(u.id);

  renderCheckinArea();
  updateClock();
  if (!coachClockTimer) coachClockTimer = setInterval(updateClock, 1000);
  renderCoachHistory(u.id, monthKey);
  renderRestDaySection(u, monthKey);
  renderNotesSection(u);
  if (!coachHolidayUnsubscribe) coachHolidayUnsubscribe = listenToHolidays(renderCoachPage);
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
  const todayRecord = hasCheckedInToday(u.id);
  const workDay = isWorkDay(now);

  // If checked in already
  if (todayRecord) {
    if (isCoachRestDay(todayRecord)) {
      renderRestDayToday(area, todayRecord);
      return;
    }
    renderReaction(area, todayRecord, getLateStatus(todayRecord.lateMinutes));
    return;
  }

  if (isHoliday(todayStr())) {
    const holiday = getHoliday(todayStr());
    area.innerHTML = `
      <div class="checkin-time"><div id="live-clock" class="checkin-clock">--:--:--</div><div id="live-date" class="checkin-date-str"></div></div>
      <div class="reaction-box on-time">
        <div style="font-size:32px;margin-bottom:8px;">${holiday?.icon || '🕌'}</div>
        <div class="reaction-title">HOLIDAY REST</div>
        <div class="reaction-msg">${holiday?.name || 'Academy holiday'} · ${formatHolidayRange(holiday?.startDate || todayStr(), holiday?.endDate || todayStr())}</div>
        <div style="margin-top:10px;font-size:13px;color:var(--green);font-weight:800;">No check-in needed and no deduction today</div>
      </div>`;
    return;
  }

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
  const rawLateBy = Math.max(0, nowMins - startMins);
  const lateBy = rawLateBy > CONFIG.lateGraceMinutes ? rawLateBy : 0;
  const countdown = getCountdownText(now, startTime);
  const shakeClass = (startMins - nowMins <= 5 && startMins - nowMins > 0) ? 'shake-btn' : '';
  const graceEnd = new Date(now);
  graceEnd.setHours(startTime.h, startTime.m + CONFIG.lateGraceMinutes, 0, 0);
  const graceLabel = to12h(graceEnd.getHours(), graceEnd.getMinutes());

  area.innerHTML = `
    <div class="checkin-time"><div id="live-clock" class="checkin-clock">--:--:--</div><div id="live-date" class="checkin-date-str"></div></div>
    ${countdown ? `<div style="text-align:center;margin-bottom:10px;"><span class="badge badge-yellow" style="background:rgba(255,225,53,0.15);color:var(--yellow);">${countdown}</span></div>` : ''}
    ${lateBy > 0 ? `
      <div style="text-align:center;margin-bottom:12px;">
        <span class="${lateBy >= 30 ? 'badge badge-red' : 'badge badge-orange'}">⚠ ${lateBy} min late — ${calcDeductionForUser(lateBy, u.id).toFixed(1)} EGP deduction</span>
      </div>` : `
      <div style="text-align:center;margin-bottom:12px;">
        <span class="badge badge-green">🟢 On time — grace until ${graceLabel}</span>
      </div>`}
    <button class="btn btn-green ${shakeClass}" onclick="attemptCheckin()">🏸 Check In Now</button>
    <p style="text-align:center;font-size:12px;color:var(--text-muted);margin-top:10px;">Location verification required</p>
    <div id="checkin-status" style="margin-top:12px;"></div>
  `;
}

function renderRestDayToday(container, record) {
  container.innerHTML = `
    <div class="checkin-time"><div id="live-clock" class="checkin-clock">--:--:--</div><div id="live-date" class="checkin-date-str"></div></div>
    <div class="reaction-box on-time">
      <div class="reaction-title">REST DAY</div>
      <div class="reaction-msg">${formatDate(record.date)} is saved as your monthly rest day.</div>
      <div style="margin-top:10px;font-size:13px;color:var(--green);font-weight:800;">No deduction for today</div>
    </div>
  `;
}

function renderReaction(container, record, status) {
  const u = currentUser;
  const reactions = {
    ontime:    { img: 'imgs/WhatsApp Sticker 1', title: "YOU'RE ON TIME!", msg: 'Perfect! Full session salary recorded.', cls: 'on-time' },
    late:      { img: 'imgs/WhatsApp Sticker 2', title: 'A BIT LATE...',   msg: `${record.lateMinutes} min late — ${(record.lateDeduction || record.deduction || 0).toFixed(1)} EGP deducted`, cls: 'late' },
    superlate: { img: 'imgs/WhatsApp Sticker',   title: 'SUPER LATE! 😂',  msg: `${record.lateMinutes} min late — ${(record.lateDeduction || record.deduction || 0).toFixed(1)} EGP deducted. BRO WAKE UP!`, cls: 'super-late' }
  };
  const r = reactions[status];
  const now = new Date();
  const hour = now.getHours();
  const isWorkingDay = CONFIG.workDays.includes(now.getDay());
  const sessionEndH = CONFIG.sessionEnd.h;

  // Show checkout button only on working day during session hours (5 PM – 9 PM)
  const canCheckOut = !record.checkOutTime && isWorkingDay && hour >= 17 && hour < sessionEndH;

  let checkoutHtml = '';
  if (record.checkOutTime) {
    const out = record.checkOutTime;
    const earlyMins = record.earlyLeaveMinutes || 0;
    const earlyDed = record.earlyLeaveDeduction || 0;
    if (earlyMins > 0) {
      checkoutHtml = `
        <div style="margin-top:14px;padding:12px;background:rgba(255,77,109,0.08);border:1px solid rgba(255,77,109,0.2);border-radius:10px;text-align:center;">
          <div style="font-size:13px;font-weight:800;color:var(--red);margin-bottom:4px;">🚪 Checked out at ${out}</div>
          <div style="font-size:12px;color:var(--text-muted);">Left ${earlyMins} min early — ${earlyDed.toFixed(1)} EGP deducted</div>
        </div>`;
    } else {
      checkoutHtml = `
        <div style="margin-top:14px;padding:12px;background:rgba(0,200,150,0.08);border:1px solid rgba(0,200,150,0.2);border-radius:10px;text-align:center;">
          <div style="font-size:13px;font-weight:800;color:var(--green);">✅ Checked out at ${out} — Full session!</div>
        </div>`;
    }
  } else if (canCheckOut) {
    checkoutHtml = `
      <button class="btn btn-outline" style="margin-top:14px;border-color:var(--orange);color:var(--orange);" onclick="attemptCheckout()">🚪 Check Out</button>
      <p style="text-align:center;font-size:11px;color:var(--text-muted);margin-top:6px;">Use only if leaving before 09:00 PM</p>
      <div id="checkout-status" style="margin-top:8px;"></div>`;
  } else if (!record.checkOutTime && isWorkingDay && hour >= sessionEndH) {
    checkoutHtml = `
      <div style="margin-top:14px;padding:10px;background:rgba(0,200,150,0.06);border:1px solid rgba(0,200,150,0.15);border-radius:10px;text-align:center;font-size:12px;color:var(--green);">
        ✅ Session complete — assumed full session attended
      </div>`;
  }

  container.innerHTML = `
    <div class="checkin-time"><div id="live-clock" class="checkin-clock">--:--:--</div><div id="live-date" class="checkin-date-str"></div></div>
    <div class="reaction-box ${r.cls}">
      <img src="${r.img}" alt="reaction" style="width:120px;height:120px;object-fit:contain;margin-bottom:10px;animation:bounce 0.6s ease infinite alternate;" onerror="this.style.display='none'" />
      <div class="reaction-title">${r.title}</div>
      <div class="reaction-msg">${r.msg}</div>
      <div style="margin-top:10px;font-size:13px;color:var(--text-muted);">Checked in at ${record.checkInTime}</div>
      ${checkoutHtml}
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

window.attemptCheckout = function() {
  const btn = document.querySelector('.reaction-box .btn-outline');
  if (btn) { btn.textContent = '📡 Getting location...'; btn.disabled = true; }
  if (!navigator.geolocation) { showCheckoutError('Geolocation not supported.'); return; }
  navigator.geolocation.getCurrentPosition(
    pos => {
      const dist = haversineMeters(pos.coords.latitude, pos.coords.longitude, CONFIG.academyLat, CONFIG.academyLng);
      if (dist <= CONFIG.geofenceMeters) {
        showCheckoutConfirm();
      } else {
        showCheckoutError(`You are ${Math.round(dist)}m from the academy. Must be within ${CONFIG.geofenceMeters}m.`);
      }
    },
    err => showCheckoutError('Location access denied. Please enable location and try again.'),
    { timeout: 8000 }
  );
}

function showCheckoutConfirm() {
  const status = document.getElementById('checkout-status');
  if (!status) return;
  const btn = document.querySelector('.reaction-box .btn-outline');
  if (btn) btn.style.display = 'none';
  status.innerHTML = `
    <div style="background:rgba(255,77,109,0.08);border:1px solid rgba(255,77,109,0.25);border-radius:10px;padding:12px;text-align:center;">
      <div style="font-size:13px;color:var(--red);margin-bottom:10px;font-weight:700;">⚠ Are you sure you want to leave early?</div>
      <div style="display:flex;gap:8px;justify-content:center;">
        <button class="btn btn-danger" style="width:auto;" onclick="confirmCheckout()">Yes, check out</button>
        <button class="btn btn-outline btn-sm" style="width:auto;" onclick="cancelCheckout()">Cancel</button>
      </div>
    </div>`;
}

window.cancelCheckout = function() {
  const status = document.getElementById('checkout-status');
  if (status) status.innerHTML = '';
  const btn = document.querySelector('.reaction-box .btn-outline');
  if (btn) { btn.style.display = ''; btn.textContent = '🚪 Check Out'; btn.disabled = false; }
}

window.confirmCheckout = async function() {
  const now = new Date();
  const time = to12h(now.getHours(), now.getMinutes());
  const updated = await checkOutCoach(currentUser.id, time);
  if (updated) {
    playSound('checkout');
    renderCheckinArea();
  }
}

function showCheckoutError(msg) {
  const btn = document.querySelector('.reaction-box .btn-outline');
  if (btn) { btn.textContent = '🚪 Check Out'; btn.disabled = false; }
  const status = document.getElementById('checkout-status');
  if (status) status.innerHTML = `<div style="background:rgba(255,77,109,0.1);border:1px solid rgba(255,77,109,0.25);border-radius:10px;padding:12px;font-size:13px;color:var(--red);">❌ ${msg}</div>`;
}

function showCheckinError(msg) {
  const btn = document.querySelector('#checkin-area .btn-green');
  if (btn) { btn.textContent = '🏸 Check In Now'; btn.disabled = false; }
  const statusEl = document.getElementById('checkin-status');
  if (statusEl) statusEl.innerHTML = `<div style="background:rgba(255,77,109,0.1);border:1px solid rgba(255,77,109,0.25);border-radius:10px;padding:12px;font-size:13px;color:var(--red);">❌ ${msg}</div>`;
}

window.doCheckin = async function() {
  const now = new Date();
  const u = currentUser;
  const startTime = getCoachStartTime(u);
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const startMins = startTime.h * 60 + startTime.m;
  const isEarly = nowMins <= startMins;
  const time = isEarly ? to12h(startTime.h, startTime.m) : to12h(now.getHours(), now.getMinutes());
  const record = await addAttendance(u.id, time);
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

function doCheckin() { return window.doCheckin(); }

function renderCoachHistory(userId, monthKey) {
  const container = document.getElementById('coach-history');
  const summary = calcMonthlySummary(userId, monthKey);
  const user = USERS.find(u => u.id === userId);
  const records = getMonthAttendance(userId, monthKey).sort((a,b) => b.date.localeCompare(a.date));
  const absentRows = (summary.absentDates || []).map(date => ({ date, absent: true }));
  const rows = [...records, ...absentRows].sort((a,b) => b.date.localeCompare(a.date));
  if (rows.length === 0) {
    container.innerHTML = `<div class="empty-state"><span class="icon">📋</span>No attendance this month yet</div>`;
    return;
  }
  container.innerHTML = rows.map(r => {
    if (r.absent) {
      return `
      <div class="attendance-row fade-in">
        <div>
          <div class="att-date">${formatDate(r.date)}</div>
          <div class="att-time">Absent session</div>
        </div>
        <div class="att-right">
          <span class="badge badge-red">Absent</span>
          <div style="margin-top:4px;"><span class="deduction-pill">-${(user?.sessionRate || 0).toFixed(1)} EGP</span></div>
        </div>
      </div>`;
    }
    if (isCoachRestDay(r)) {
      return `
      <div class="attendance-row fade-in">
        <div>
          <div class="att-date">${formatDate(r.date)}</div>
          <div class="att-time">Monthly rest day · No deduction</div>
        </div>
        <div class="att-right">
          <span class="badge badge-yellow">Rest day</span>
        </div>
      </div>`;
    }
    if (isExcusedRecord(r)) {
      return `
      <div class="attendance-row fade-in">
        <div>
          <div class="att-date">${formatDate(r.date)}</div>
          <div class="att-time">${r.excusedReason || 'Excused'} · No deduction</div>
        </div>
        <div class="att-right">
          <span class="badge badge-yellow">Excused</span>
        </div>
      </div>`;
    }
    const status = getLateStatus(r.lateMinutes);
    const badges = {
      ontime:    `<span class="badge badge-green">On time</span>`,
      late:      `<span class="badge badge-orange">+${r.lateMinutes}m late</span>`,
      superlate: `<span class="badge badge-red">+${r.lateMinutes}m late 💀</span>`
    };
    const lateDed = r.lateDeduction || r.deduction || 0;
    const earlyDed = r.earlyLeaveDeduction || 0;
    const totalDed = lateDed + earlyDed;
    return `
      <div class="attendance-row fade-in">
        <div>
          <div class="att-date">${formatDate(r.date)}</div>
          <div class="att-time">In: ${r.checkInTime}${r.checkOutTime ? ` · Out: ${r.checkOutTime}` : ''}</div>
        </div>
        <div class="att-right">
          ${badges[status]}
          ${r.earlyLeaveMinutes > 0 ? `<div style="margin-top:4px;"><span class="badge badge-red">-${r.earlyLeaveMinutes}m early</span></div>` : ''}
          ${totalDed > 0 ? `<div style="margin-top:4px;"><span class="deduction-pill">-${totalDed.toFixed(1)} EGP</span></div>` : ''}
        </div>
      </div>`;
  }).join('');
}

// ─── NOTES SECTION ───
function renderRestDaySection(u, monthKey) {
  const container = document.getElementById('coach-rest-day');
  if (!container) return;

  const today = todayStr();
  const earliestRestDate = datePlusDaysStr(today, 1);
  const monthStart = `${monthKey}-01`;
  const minDate = earliestRestDate > monthStart ? earliestRestDate : monthStart;
  const maxDate = monthEndForInput(monthKey);
  const records = getMonthAttendance(u.id, monthKey);
  const restDay = records.find(isCoachRestDay);
  const currentMonth = monthKey === getCurrentMonthKey();
  if (!currentMonth) {
    container.innerHTML = `
      <div class="card" style="margin:0 16px 16px;">
        <div style="font-size:13px;color:var(--text-muted);">Rest days can only be chosen for the current month.</div>
      </div>`;
    return;
  }

  if (minDate > maxDate) {
    container.innerHTML = `
      <div class="card" style="margin:0 16px 16px;">
        <div style="font-size:14px;font-weight:800;color:var(--orange);margin-bottom:4px;">No rest days available</div>
        <div style="font-size:13px;color:var(--text-muted);">Rest days must be chosen at least one day before the date.</div>
      </div>`;
    return;
  }

  if (restDay) {
    const canCancel = restDay.date >= today;
    container.innerHTML = `
      <div class="card" style="margin:0 16px 16px;border-color:rgba(255,225,53,0.22);background:rgba(255,225,53,0.05);">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
          <div>
            <div style="font-size:14px;font-weight:800;color:var(--yellow);margin-bottom:4px;">Rest day saved</div>
            <div style="font-size:13px;color:var(--white);">${formatDate(restDay.date)}</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:3px;">No absence deduction will be counted for this day.</div>
          </div>
          ${canCancel ? `<button class="btn-danger" onclick="cancelCoachRestDay('${restDay.date}')">Cancel</button>` : ''}
        </div>
      </div>`;
    return;
  }

  const days = getAvailableRestDays(monthKey, u.id);
  const dayButtons = days.map(day => {
    const takenUser = day.takenBy ? USERS.find(coach => coach.id === day.takenBy) : null;
    return `
      <button class="btn ${day.available ? 'btn-outline' : 'btn-disabled'} btn-sm" style="width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;text-align:left;" ${day.available ? `onclick="submitRestDay('${day.date}')"` : 'disabled'}>
        <span>${formatDate(day.date)}</span>
        <span style="font-size:11px;color:${day.available ? 'var(--green)' : 'var(--text-muted)'};">${day.available ? 'Available' : `Taken${takenUser ? ' by ' + takenUser.name : ''}`}</span>
      </button>`;
  }).join('');

  container.innerHTML = `
    <div class="card" style="margin:0 16px 16px;">
      <div style="font-size:14px;font-weight:800;color:var(--green);margin-bottom:8px;">Choose your monthly rest day</div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">Choose one future working day. It must be saved at least one day before, and only one coach can rest on the same day.</div>
      ${dayButtons || `<div style="font-size:13px;color:var(--text-muted);">No future working days left this month.</div>`}
      <div id="rest-day-status" style="margin-top:8px;font-size:13px;"></div>
    </div>`;
}

window.submitRestDay = async function(selectedDate = null) {
  const status = document.getElementById('rest-day-status');
  const date = selectedDate;
  const monthKey = getCurrentMonthKey();
  const records = getMonthAttendance(currentUser.id, monthKey);

  if (!status) return;
  if (!date) { status.textContent = 'Please choose a date first.'; status.style.color = 'var(--orange)'; return; }
  if (date.slice(0, 7) !== monthKey) { status.textContent = 'Choose a day in the current month.'; status.style.color = 'var(--orange)'; return; }
  if (date <= todayStr()) { status.textContent = 'Choose a future day at least one day before the rest day.'; status.style.color = 'var(--orange)'; return; }
  if (!isWorkDay(new Date(date + 'T00:00:00'))) { status.textContent = 'Rest day must be Saturday, Monday, or Wednesday.'; status.style.color = 'var(--orange)'; return; }
  if (isHoliday(date)) { status.textContent = 'This is already an academy holiday rest day. Choose another day.'; status.style.color = 'var(--orange)'; return; }
  if (records.some(isCoachRestDay)) { status.textContent = 'You already chose your rest day this month.'; status.style.color = 'var(--orange)'; return; }
  if (isRestDayTaken(date, currentUser.id)) {
    status.textContent = 'This day is already chosen, so you can\'t rest on the same day. Choose another day.';
    status.style.color = 'var(--orange)';
    return;
  }
  if (records.some(r => r.date === date && !isCoachRestDay(r))) { status.textContent = 'There is already an attendance/excuse record for this day.'; status.style.color = 'var(--orange)'; return; }

  status.textContent = 'Saving...';
  status.style.color = 'var(--text-muted)';
  try {
    await requestCoachRestDay(currentUser.id, date);
    renderCoachPage();
  } catch (e) {
    if (e.message === 'REST_DAY_TAKEN') {
      status.textContent = 'This day is already chosen, so you can\'t rest on the same day. Choose another day.';
    } else if (e.message === 'REST_DAY_HAS_RECORD') {
      status.textContent = 'There is already an attendance/excuse record for this day.';
    } else {
      status.textContent = 'Failed to save rest day. Try again.';
    }
    status.style.color = 'var(--red)';
  }
}

window.cancelCoachRestDay = async function(date) {
  if (!confirm(`Cancel your rest day on ${date}?`)) return;
  await removeAttendance(currentUser.id, date);
  renderCoachPage();
}

function isNotesAllowed() {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  const isWorkingDay = CONFIG.workDays.includes(day);
  if (!isWorkingDay) return true;
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
  const blockedMsg = isWorkingDay ? '🔒 Notes are closed from 2:00 PM to 9:00 PM on working days.' : '';
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
  if (coachNotesUnsubscribe) coachNotesUnsubscribe();
  coachNotesUnsubscribe = listenToMyNotes(u.id, (notes) => {
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
