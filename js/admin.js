// ─── ADMIN PAGE ───
import { CONFIG, USERS, attendance, holidays, SUGGESTED_HOLIDAYS, removeAttendance, markAsExcused, saveHoliday, removeHoliday, listenToHolidays, isHoliday, getHoliday, expandHolidayRange, getMonthAttendance, getCurrentMonthKey, calcMonthlySummary, getLeaderboardStats, calcMonthlySummaryWithBonus, getMonthKey, getLateStatus, formatMonthLabel, formatDate, initials, getUser } from './data.js';
import { listenToNotes, markNoteRead, deleteNote, formatNoteTime } from './notes.js';

let adminActiveTab = 'overview';
let adminMonthKey = getCurrentMonthKey();
let adminNotesBadgeUnsubscribe = null;
let adminHolidayUnsubscribe = null;
let adminNotesTabUnsubscribe = null;

function avatarHtml(user, size = 36) {
  const fontSize = Math.round(size * 0.33);
  if (user.photo) {
    return `<div class="avatar ${user.sessionRate > 400 ? 'gold' : ''}" style="width:${size}px;height:${size}px;padding:0;overflow:hidden;">
      <img src="${user.photo}" alt="${user.name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.parentElement.textContent='${initials(user.name)}'" />
    </div>`;
  }
  return `<div class="avatar ${user.sessionRate > 400 ? 'gold' : ''}" style="width:${size}px;height:${size}px;font-size:${fontSize}px;">${initials(user.name)}</div>`;
}

// Get past working days, EXCLUDING holidays
function getPastWorkingDaysInMonth(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const now = new Date();
  const isPast9PM = now.getHours() >= CONFIG.sessionEnd.h;
  const days = [];
  const lastDay = new Date(y, m, 0).getDate();
  for (let day = 1; day <= lastDay; day++) {
    const d = new Date(y, m - 1, day);
    d.setHours(0, 0, 0, 0);
    if (CONFIG.workDays.includes(d.getDay())) {
      if (d < today || (d.getTime() === today.getTime() && isPast9PM)) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;
        // Skip if it's a holiday
        if (!isHoliday(dateStr)) {
          days.push(dateStr);
        }
      }
    }
  }
  return days;
}

// Get ALL working days (including today, excluding holidays) for full log display
function getAllWorkingDaysInMonth(monthKey, includeToday = true) {
  const [y, m] = monthKey.split('-').map(Number);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const now = new Date();
  const isPast9PM = now.getHours() >= CONFIG.sessionEnd.h;
  const days = [];
  const lastDay = new Date(y, m, 0).getDate();
  for (let day = 1; day <= lastDay; day++) {
    const d = new Date(y, m - 1, day);
    d.setHours(0, 0, 0, 0);
    if (CONFIG.workDays.includes(d.getDay())) {
      if (d < today || (includeToday && d.getTime() === today.getTime() && isPast9PM)) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        days.push(`${yyyy}-${mm}-${dd}`);
      }
    }
  }
  return days;
}

function isExcused(record) {
  return record.excused === true || record.checkInTime === 'EXCUSED';
}

function isCoachRestDay(record) {
  return isExcused(record) && (record.restDay === true || record.excusedBy === 'coach' || record.excusedReason === 'Coach rest day');
}

function calcMonthlySummaryWithAbsences(userId, monthKey) {
  const user = getUser(userId);
  const allRecords = getMonthAttendance(userId, monthKey);
  const realRecords = allRecords.filter(r => !isExcused(r));
  const excusedRecords = allRecords.filter(r => isExcused(r));
  const excusedDates = excusedRecords.map(r => r.date);

  // Working days that are NOT holidays
  const pastWorkingDays = getPastWorkingDaysInMonth(monthKey);
  const daysPresent = realRecords.length;
  const baseSalary = user.sessionRate * CONFIG.sessionsPerMonth;
  const lateDeductions = realRecords.reduce((s, r) => s + (r.lateDeduction || r.deduction || 0), 0);
  const earlyLeaveDeductions = realRecords.reduce((s, r) => s + (r.earlyLeaveDeduction || 0), 0);

  const presentDates = realRecords.map(r => r.date);
  const absentDays = pastWorkingDays.filter(d => !presentDates.includes(d) && !excusedDates.includes(d)).length;
  const absenceDeductions = absentDays * user.sessionRate;

  const totalDeductions = lateDeductions + earlyLeaveDeductions + absenceDeductions;
  const netSalary = baseSalary - totalDeductions;
  return { daysPresent, baseSalary, totalDeductions, lateDeductions, earlyLeaveDeductions, absenceDeductions, absentDays, netSalary, records: realRecords, excusedRecords };
}

export function cleanupAdminPage() {
  if (adminNotesBadgeUnsubscribe) {
    adminNotesBadgeUnsubscribe();
    adminNotesBadgeUnsubscribe = null;
  }
  if (adminHolidayUnsubscribe) {
    adminHolidayUnsubscribe();
    adminHolidayUnsubscribe = null;
  }
  if (adminNotesTabUnsubscribe) {
    adminNotesTabUnsubscribe();
    adminNotesTabUnsubscribe = null;
  }
}

export function renderAdminPage() {
  document.getElementById('admin-month-label').textContent = formatMonthLabel(adminMonthKey);
  renderAdminSummary();
  renderAdminTab(adminActiveTab);
  if (!adminNotesBadgeUnsubscribe) {
    adminNotesBadgeUnsubscribe = listenToNotes(renderNotesBadge);
  }
  if (!adminHolidayUnsubscribe) {
    adminHolidayUnsubscribe = listenToHolidays(() => {
      renderAdminSummary();
      if (adminActiveTab === 'log' || adminActiveTab === 'overview' || adminActiveTab === 'holidays') {
        renderAdminTab(adminActiveTab);
      }
    });
  }
}

function renderNotesBadge(notes) {
  const unread = notes.filter(n => !n.read).length;
  const badge = document.getElementById('notes-tab-badge');
  if (badge) badge.textContent = unread > 0 ? ` (${unread})` : '';
}

function renderAdminSummary() {
  const stats = getLeaderboardStats(adminMonthKey);
  let totalPresent = 0, totalSalaryOut = 0, totalDeductions = 0;
  stats.forEach(item => {
    totalPresent += item.s.daysPresent;
    totalSalaryOut += item.netSalaryWithBonus;
    totalDeductions += item.s.totalDeductions;
  });
  document.getElementById('admin-total-sessions').textContent = totalPresent;
  document.getElementById('admin-total-salary').textContent = Math.round(totalSalaryOut).toLocaleString('en-EG');
  document.getElementById('admin-total-deductions').textContent = Math.round(totalDeductions).toLocaleString('en-EG');
}

window.switchAdminTab = function switchAdminTab(tab) {
  adminActiveTab = tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  event.target.classList.add('active');
  renderAdminTab(tab);
}

function renderAdminTab(tab) {
  const content = document.getElementById('admin-tab-content');
  if (tab === 'overview') renderOverviewTab(content);
  else if (tab === 'log') renderLogTab(content);
  else if (tab === 'leaderboard') renderLeaderboardTab(content);
  else if (tab === 'holidays') renderHolidaysTab(content);
  else if (tab === 'notes') renderNotesTab(content);
}

function renderOverviewTab(container) {
  const coaches = USERS.filter(u => !u.isAdmin);
  const leaderboardById = new Map(getLeaderboardStats(adminMonthKey).map(item => [item.u.id, item]));
  const restDays = attendance
    .filter(r => getMonthKey(r.date) === adminMonthKey && isCoachRestDay(r))
    .sort((a, b) => a.date.localeCompare(b.date));
  const restDaysSummary = `
    <div class="coach-row fade-in" style="border-color:rgba(255,225,53,0.2);background:rgba(255,225,53,0.04);">
      <div style="font-size:14px;font-weight:800;color:var(--yellow);margin-bottom:10px;">Rest days this month</div>
      ${restDays.length > 0 ? `
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${restDays.map(r => {
            const u = getUser(r.userId);
            return `<span class="badge" style="background:rgba(255,225,53,0.15);color:var(--yellow);border:1px solid rgba(255,225,53,0.3);">${r.date.slice(5)} · ${u?.name || 'Coach'}</span>`;
          }).join('')}
        </div>` : `<div style="font-size:13px;color:var(--text-muted);">No coach rest days selected yet.</div>`}
    </div>`;
  container.innerHTML = restDaysSummary + coaches.map(u => {
    const leaderboardItem = leaderboardById.get(u.id);
    const s = leaderboardItem?.s || calcMonthlySummaryWithAbsences(u.id, adminMonthKey);
    const leaderboardBonus = leaderboardItem?.leaderboardBonus || 0;
    const netSalary = leaderboardItem?.netSalaryWithBonus ?? s.netSalary;
    const pct = Math.min(100, (s.daysPresent / CONFIG.sessionsPerMonth) * 100);
    return `
      <div class="coach-row fade-in">
        <div class="coach-row-header">
          <div style="display:flex;align-items:center;gap:10px;">
            ${avatarHtml(u, 36)}
            <div>
              <div class="coach-name">${u.name}</div>
              <div class="coach-meta">${u.sessionRate.toFixed(1)} EGP/session · ${u.hourlyRate.toFixed(2)} EGP/h</div>
            </div>
          </div>
          <div>
            <div class="coach-total">${Math.round(netSalary).toLocaleString('en-EG')} EGP</div>
            <div class="coach-total-label">${s.daysPresent}/${CONFIG.sessionsPerMonth} sessions</div>
          </div>
        </div>
        <div class="progress-bar" style="margin-bottom:10px;">
          <div class="progress-fill" style="width:${pct}%"></div>
        </div>
        ${s.totalDeductions > 0 ? `
          <div style="margin-bottom:10px;display:flex;flex-wrap:wrap;gap:6px;">
            ${s.lateDeductions > 0 ? `<span class="deduction-pill">⏰ Late: -${s.lateDeductions.toFixed(1)} EGP</span>` : ''}
            ${s.earlyLeaveDeductions > 0 ? `<span class="deduction-pill">🚪 Early leave: -${s.earlyLeaveDeductions.toFixed(1)} EGP</span>` : ''}
            ${s.absenceDeductions > 0 ? `<span class="deduction-pill">❌ Absent (${s.absentDays}d): -${s.absenceDeductions.toFixed(1)} EGP</span>` : ''}
          </div>` : ''}
        ${leaderboardBonus > 0 ? `
          <div style="margin-bottom:10px;display:flex;flex-wrap:wrap;gap:6px;">
            <span style="background:rgba(255,225,53,0.15);color:var(--yellow);border:1px solid rgba(255,225,53,0.3);padding:3px 8px;border-radius:8px;font-size:11px;font-weight:800;">Leaderboard bonus: +${leaderboardBonus.toLocaleString('en-EG')} EGP</span>
          </div>` : ''}
        ${s.excusedRecords && s.excusedRecords.length > 0 ? `
          <div style="margin-bottom:10px;display:flex;flex-wrap:wrap;gap:6px;">
            ${s.excusedRecords.map(r => `<span style="background:rgba(255,225,53,0.15);color:var(--yellow);border:1px solid rgba(255,225,53,0.3);padding:3px 8px;border-radius:8px;font-size:11px;">${isCoachRestDay(r) ? 'Rest day' : 'Excused'} ${r.date.slice(5)} ${r.excusedReason ? '· ' + r.excusedReason : ''}</span>`).join('')}
          </div>` : ''}
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;">
          ${s.records.sort((a,b) => b.date.localeCompare(a.date)).map(r => {
            const late = r.lateMinutes > 0;
            const earlyLeave = r.earlyLeaveMinutes > 0;
            return `
              <div style="display:flex;align-items:center;gap:4px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:4px 8px;">
                <span style="font-size:12px;color:${late || earlyLeave ? 'var(--orange)' : 'var(--green)'};">${r.date.slice(5)} ${late ? '⚠' : earlyLeave ? '🚪' : '✓'}</span>
                <button class="btn-danger" style="padding:2px 6px;font-size:11px;" onclick="adminRemoveEntry(${u.id},'${r.date}')">×</button>
              </div>`;
          }).join('')}
          ${s.records.length === 0 ? `<span style="font-size:13px;color:var(--text-muted);">No attendance this month</span>` : ''}
        </div>
        <button class="btn btn-outline btn-sm" style="width:auto;" onclick="generateSlip(${u.id})">📄 Generate Salary Slip</button>
      </div>`;
  }).join('');
}

function renderLogTab(container) {
  const coaches = USERS.filter(u => !u.isAdmin);
  const allWorkingDays = getAllWorkingDaysInMonth(adminMonthKey);
  const monthRecords = attendance.filter(a => getMonthKey(a.date) === adminMonthKey);

  if (allWorkingDays.length === 0) {
    container.innerHTML = `<div class="empty-state"><span class="icon">📋</span>No working days have passed this month yet</div>`;
    return;
  }

  const byDate = {};
  allWorkingDays.forEach(date => { byDate[date] = []; });
  monthRecords.forEach(r => {
    if (byDate[r.date] !== undefined) byDate[r.date].push(r);
  });

  const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  container.innerHTML = sortedDates.map(date => {
    const holiday = getHoliday(date);

    // If it's a holiday, render a special holiday card
    if (holiday) {
      return `
        <div style="margin:0 16px 16px;border-radius:var(--radius-sm);overflow:hidden;border:1px solid rgba(255,225,53,0.25);">
          <div style="background:rgba(255,225,53,0.08);padding:14px;display:flex;align-items:center;justify-content:space-between;">
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="font-size:32px;">${holiday.icon || '🕌'}</div>
              <div>
                <div style="font-family:'Bebas Neue',sans-serif;font-size:16px;letter-spacing:1px;color:var(--yellow);">📅 ${new Date(date+'T00:00:00').toLocaleDateString('en-EG', {weekday:'long', day:'numeric', month:'long', year:'numeric'})}</div>
                <div style="font-size:13px;color:var(--white);margin-top:2px;font-weight:700;">${holiday.name}</div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">🌙 Holiday — No work, no deductions</div>
              </div>
            </div>
            <span class="badge" style="background:rgba(255,225,53,0.15);color:var(--yellow);border:1px solid rgba(255,225,53,0.3);">Holiday</span>
          </div>
        </div>`;
    }

    const allRecords = byDate[date];
    const realRecords = allRecords.filter(r => !isExcused(r));
    const excusedRecords = allRecords.filter(r => isExcused(r));
    const excusedIds = excusedRecords.map(r => r.userId);

    const dayDate = new Date(date + 'T00:00:00');
    const dayLabel = dayDate.toLocaleDateString('en-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const totalPresent = realRecords.length;
    const totalDeductions = realRecords.reduce((s, r) => s + (r.lateDeduction || r.deduction || 0) + (r.earlyLeaveDeduction || 0), 0);
    const presentIds = realRecords.map(r => r.userId);
    const absentCoaches = coaches.filter(u => !presentIds.includes(u.id) && !excusedIds.includes(u.id));

    const presentRows = realRecords.map(r => {
      const u = getUser(r.userId);
      const status = getLateStatus(r.lateMinutes);
      const statusBadge = {
        ontime:    `<span class="badge badge-green">On time</span>`,
        late:      `<span class="badge badge-orange">+${r.lateMinutes}m late</span>`,
        superlate: `<span class="badge badge-red">+${r.lateMinutes}m late 💀</span>`
      }[status];
      const lateDed = r.lateDeduction || r.deduction || 0;
      const earlyDed = r.earlyLeaveDeduction || 0;
      return `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.04);">
          <div style="display:flex;align-items:center;gap:10px;">
            ${avatarHtml(u, 32)}
            <div>
              <div style="font-size:14px;font-weight:700;">${u.name}</div>
              <div style="font-size:12px;color:var(--text-muted);">In: ${r.checkInTime}${r.checkOutTime ? ` · Out: ${r.checkOutTime}` : ''}</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end;">
            ${statusBadge}
            ${r.earlyLeaveMinutes > 0 ? `<span class="badge badge-red">🚪 ${r.earlyLeaveMinutes}m early</span>` : ''}
            ${lateDed > 0 ? `<span class="deduction-pill">-${lateDed.toFixed(1)}</span>` : ''}
            ${earlyDed > 0 ? `<span class="deduction-pill">-${earlyDed.toFixed(1)}</span>` : ''}
            <button class="btn-danger" onclick="adminRemoveEntry(${r.userId},'${r.date}')">Remove</button>
          </div>
        </div>`;
    }).join('');

    const excusedRows = excusedRecords.map(r => {
      const u = getUser(r.userId);
      const restDay = isCoachRestDay(r);
      const reason = restDay ? 'Coach monthly rest day' : (r.excusedReason || 'Excused by admin');
      const badgeText = restDay ? 'Rest day' : 'Excused';
      return `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.04);background:rgba(255,225,53,0.04);">
          <div style="display:flex;align-items:center;gap:10px;">
            ${avatarHtml(u, 32)}
            <div>
              <div style="font-size:14px;font-weight:700;">${u.name}</div>
              <div style="font-size:12px;color:var(--text-muted);">${reason} · No deduction</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <span class="badge" style="background:rgba(255,225,53,0.15);color:var(--yellow);border:1px solid rgba(255,225,53,0.3);">${badgeText}</span>
            <button class="btn-danger" onclick="adminRemoveEntry(${r.userId},'${r.date}')">Remove</button>
          </div>
        </div>`;
    }).join('');

    const absentRows = absentCoaches.map(u => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.04);background:rgba(255,77,109,0.04);">
        <div style="display:flex;align-items:center;gap:10px;">
          ${avatarHtml(u, 32)}
          <div>
            <div style="font-size:14px;font-weight:700;">${u.name}</div>
            <div style="font-size:12px;color:var(--text-muted);">Did not check in · -${u.sessionRate.toFixed(1)} EGP</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;">
          <span class="badge badge-red">❌ Absent</span>
          <button class="btn btn-sm" style="width:auto;padding:4px 10px;background:rgba(255,225,53,0.15);color:var(--yellow);border:1px solid rgba(255,225,53,0.3);" onclick="adminMarkExcused(${u.id},'${date}')">🛡️ Excuse</button>
        </div>
      </div>`).join('');

    return `
      <div style="margin:0 16px 16px;border-radius:var(--radius-sm);overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
        <div style="background:rgba(0,200,150,0.08);border-bottom:1px solid rgba(0,200,150,0.15);padding:12px 14px;display:flex;align-items:center;justify-content:space-between;">
          <div>
            <div style="font-family:'Bebas Neue',sans-serif;font-size:16px;letter-spacing:1px;color:var(--green);">📅 ${dayLabel}</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">
              ${totalPresent} present · ${excusedRecords.length} excused · ${absentCoaches.length} absent
              ${totalDeductions > 0 ? ` · ${totalDeductions.toFixed(1)} EGP deducted` : ''}
            </div>
          </div>
          <span class="badge badge-green">${totalPresent} / ${coaches.length}</span>
        </div>
        <div style="background:rgba(255,255,255,0.02);">
          ${presentRows}
          ${excusedRows}
          ${absentRows}
        </div>
      </div>`;
  }).join('');
}

function renderLeaderboardTab(container) {
  const ranked = getLeaderboardStats(adminMonthKey);
  const mostLate = [...ranked].sort((a, b) => b.totalLateMinutes - a.totalLateMinutes)[0];
  const medals = ['🥇', '🥈', '🥉'];
  container.innerHTML = `
    <div style="padding:0 16px 16px;">
      <div style="margin-bottom:16px;">
        ${ranked.map((item, i) => {
          const isTop = i === 0 && item.s.totalDeductions === 0;
          const isMostLate = mostLate && item.u.id === mostLate.u.id && mostLate.totalLateMinutes > 0;
          const bonus = item.leaderboardBonus || 0;
          return `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;margin-bottom:8px;background:${isTop ? 'rgba(0,200,150,0.08)' : 'rgba(255,255,255,0.03)'};border:1px solid ${isTop ? 'rgba(0,200,150,0.2)' : 'rgba(255,255,255,0.07)'};border-radius:var(--radius-sm);">
              <div style="display:flex;align-items:center;gap:12px;">
                <div style="font-size:24px;">${medals[i] || '🏅'}</div>
                ${avatarHtml(item.u, 36)}
                <div>
                  <div style="font-size:14px;font-weight:800;">${item.u.name} ${isMostLate ? '<span style="font-size:11px;background:rgba(255,77,109,0.15);color:var(--red);padding:2px 6px;border-radius:6px;">😴 Most Late</span>' : ''}</div>
                  <div style="font-size:12px;color:var(--text-muted);">${item.ontimeSessions} on-time · ${item.totalLateMinutes}m late · ${item.s.absentDays} absent · ${item.excusedDays} excused</div>
                </div>
              </div>
              <div style="text-align:right;">
                <div style="font-family:'Bebas Neue',sans-serif;font-size:18px;color:var(--green);">${item.s.daysPresent} sessions</div>
                ${bonus > 0 ? `<div style="font-size:12px;color:var(--yellow);font-weight:800;">+${bonus.toLocaleString('en-EG')} EGP bonus</div>` : ''}
                ${item.s.totalDeductions > 0 ? `<div style="font-size:11px;color:var(--red);">-${item.s.totalDeductions.toFixed(1)} EGP</div>` : '<div style="font-size:11px;color:var(--green);">No deductions 🎉</div>'}
              </div>
            </div>`;
        }).join('')}
      </div>
    </div>`;
}

// ─── HOLIDAYS TAB ───
function renderHolidaysTab(container) {
  const [y, m] = adminMonthKey.split('-').map(Number);
  const monthStart = `${y}-${String(m).padStart(2,'0')}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const monthEnd = `${y}-${String(m).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;

  // Get suggested holidays for this month + next month
  const monthAndAfter = SUGGESTED_HOLIDAYS.filter(h => {
    return h.startDate >= monthStart && h.startDate <= getDatePlusMonths(monthStart, 2);
  });

  // Get active holidays (added by admin)
  const activeHolidays = [...holidays].sort((a, b) => a.startDate.localeCompare(b.startDate));

  // Suggested holidays NOT yet added
  const activeStartDates = activeHolidays.map(h => h.startDate);
  const suggestedNotAdded = monthAndAfter.filter(s => !activeStartDates.includes(s.startDate));

  container.innerHTML = `
    <div style="padding:0 16px 16px;">

      <!-- ADD CUSTOM HOLIDAY -->
      <div class="card" style="margin-bottom:16px;">
        <div style="font-size:14px;font-weight:800;color:var(--green);margin-bottom:12px;letter-spacing:1px;">➕ ADD CUSTOM HOLIDAY</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
          <div>
            <label style="font-size:11px;color:var(--text-muted);">Holiday Name</label>
            <input type="text" id="holiday-name" placeholder="e.g. Eid al-Fitr" style="width:100%;padding:8px 10px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:var(--white);font-size:14px;" />
          </div>
          <div>
            <label style="font-size:11px;color:var(--text-muted);">Icon (emoji)</label>
            <input type="text" id="holiday-icon" placeholder="🕌" maxlength="2" style="width:100%;padding:8px 10px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:var(--white);font-size:14px;" />
          </div>
          <div>
            <label style="font-size:11px;color:var(--text-muted);">From</label>
            <input type="date" id="holiday-start" style="width:100%;padding:8px 10px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:var(--white);font-size:14px;" />
          </div>
          <div>
            <label style="font-size:11px;color:var(--text-muted);">To</label>
            <input type="date" id="holiday-end" style="width:100%;padding:8px 10px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:var(--white);font-size:14px;" />
          </div>
        </div>
        <button class="btn btn-green" onclick="addCustomHoliday()">Add Holiday</button>
      </div>

      <!-- SUGGESTED HOLIDAYS -->
      ${suggestedNotAdded.length > 0 ? `
        <div style="margin-bottom:16px;">
          <div style="font-size:13px;font-weight:800;color:var(--yellow);margin-bottom:10px;letter-spacing:1px;">💡 SUGGESTED EGYPTIAN HOLIDAYS</div>
          ${suggestedNotAdded.map(s => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;margin-bottom:8px;background:rgba(255,225,53,0.04);border:1px solid rgba(255,225,53,0.15);border-radius:var(--radius-sm);">
              <div style="display:flex;align-items:center;gap:12px;">
                <div style="font-size:28px;">${s.icon}</div>
                <div>
                  <div style="font-size:14px;font-weight:800;">${s.name}</div>
                  <div style="font-size:12px;color:var(--text-muted);">${formatHolidayRange(s.startDate, s.endDate)} ${s.type === 'lunar' ? '· 🌙 Lunar (may vary)' : ''}</div>
                </div>
              </div>
              <div style="display:flex;gap:6px;">
                <button class="btn btn-green btn-sm" style="width:auto;" onclick="acceptSuggestedHoliday('${s.startDate}','${s.endDate}','${s.name}','${s.icon}')">✅ Give Rest</button>
              </div>
            </div>`).join('')}
        </div>
      ` : ''}

      <!-- ACTIVE HOLIDAYS -->
      ${activeHolidays.length > 0 ? `
        <div>
          <div style="font-size:13px;font-weight:800;color:var(--green);margin-bottom:10px;letter-spacing:1px;">✅ ACTIVE HOLIDAYS (NO DEDUCTIONS)</div>
          ${activeHolidays.map(h => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;margin-bottom:8px;background:rgba(0,200,150,0.06);border:1px solid rgba(0,200,150,0.2);border-radius:var(--radius-sm);">
              <div style="display:flex;align-items:center;gap:12px;">
                <div style="font-size:28px;">${h.icon || '🕌'}</div>
                <div>
                  <div style="font-size:14px;font-weight:800;">${h.name}</div>
                  <div style="font-size:12px;color:var(--text-muted);">${formatHolidayRange(h.startDate, h.endDate)}</div>
                </div>
              </div>
              <button class="btn-danger" onclick="adminRemoveHoliday('${h.id}','${h.name}')">Remove</button>
            </div>`).join('')}
        </div>
      ` : `
        <div class="empty-state" style="margin-top:20px;"><span class="icon">🕌</span>No holidays added yet. Use suggestions above or add a custom one.</div>
      `}
    </div>`;
}

function getDatePlusMonths(dateStr, months) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setMonth(d.getMonth() + months);
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
  return `${s.toLocaleDateString('en-EG', { day: 'numeric', month: 'short' })} – ${e.toLocaleDateString('en-EG', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

window.addCustomHoliday = async function() {
  const name = document.getElementById('holiday-name').value.trim();
  const icon = document.getElementById('holiday-icon').value.trim() || '🕌';
  const startDate = document.getElementById('holiday-start').value;
  const endDate = document.getElementById('holiday-end').value || startDate;
  if (!name) { alert('Please enter a holiday name'); return; }
  if (!startDate) { alert('Please select a start date'); return; }
  if (endDate < startDate) { alert('End date must be after start date'); return; }

  await saveHoliday({ name, icon, startDate, endDate });
  renderAdminTab('holidays');
}

window.acceptSuggestedHoliday = async function(startDate, endDate, name, icon) {
  if (!confirm(`Add "${name}" as a holiday?\nFrom ${startDate} to ${endDate}\n\nCoaches won't be deducted for these days.`)) return;
  await saveHoliday({ name, icon, startDate, endDate });
  renderAdminTab('holidays');
}

window.adminRemoveHoliday = async function(id, name) {
  if (!confirm(`Remove "${name}" from holidays?\nCoaches will be expected to attend on these dates.`)) return;
  await removeHoliday(id);
  renderAdminTab('holidays');
}

function renderNotesTab(container) {
  container.innerHTML = `<div id="admin-notes-list" style="padding:0 16px;"></div>`;
  if (adminNotesTabUnsubscribe) adminNotesTabUnsubscribe();
  adminNotesTabUnsubscribe = listenToNotes((notes) => {
    const list = document.getElementById('admin-notes-list');
    if (!list) return;
    renderNotesBadge(notes);
    if (notes.length === 0) {
      list.innerHTML = `<div class="empty-state"><span class="icon">📭</span>No notes from coaches yet</div>`;
      return;
    }
    list.innerHTML = notes.map(n => {
      const u = USERS.find(u => u.id === n.userId);
      return `
        <div style="background:${n.read ? 'rgba(255,255,255,0.03)' : 'rgba(0,200,150,0.06)'};border:1px solid ${n.read ? 'rgba(255,255,255,0.07)' : 'rgba(0,200,150,0.2)'};border-radius:var(--radius-sm);padding:14px;margin-bottom:10px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <div style="display:flex;align-items:center;gap:8px;">
              ${u ? avatarHtml(u, 30) : `<div class="avatar" style="width:30px;height:30px;font-size:11px;">${n.userName[0]}</div>`}
              <div style="font-size:14px;font-weight:800;">${n.userName}</div>
            </div>
            <span class="badge ${n.read ? 'badge-green' : 'badge-yellow'}" style="${n.read ? '' : 'background:rgba(255,225,53,0.15);color:var(--yellow);'}">
              ${n.read ? '✓ Read' : '🔔 New'}
            </span>
          </div>
          <div style="font-size:14px;color:var(--white);margin-bottom:8px;">${n.message}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:10px;">${formatNoteTime(n.timestamp)}</div>
          <div style="display:flex;gap:8px;">
            ${!n.read ? `<button class="btn btn-outline btn-sm" onclick="adminMarkRead('${n.id}')">✓ Mark as Read</button>` : ''}
            <button class="btn btn-danger btn-sm" onclick="adminDeleteNote('${n.id}')">Delete</button>
          </div>
        </div>`;
    }).join('');
  });
}

// ─── EXCUSE ABSENCE ───
window.adminMarkExcused = async function(userId, date) {
  const u = getUser(userId);
  const reason = prompt(`Why is ${u.name} excused on ${date}?\n(e.g. Tournament, Sick, Family emergency)\n\nLeave blank for "Excused by admin"`);
  if (reason === null) return;
  const finalReason = reason.trim() || 'Excused by admin';
  await markAsExcused(userId, date, finalReason);
  renderAdminPage();
}

// ─── PDF SALARY SLIP ───
function generateSalarySlip(userId) {
  const u = getUser(userId);
  const s = calcMonthlySummaryWithBonus(u.id, adminMonthKey);
  const monthLabel = formatMonthLabel(adminMonthKey);

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const greenRGB = [0, 200, 150];
  const navyRGB = [10, 22, 40];
  const yellowRGB = [255, 225, 53];
  const redRGB = [255, 77, 109];
  const grayRGB = [120, 130, 145];

  pdf.setFillColor(...navyRGB);
  pdf.rect(0, 0, 210, 40, 'F');

  pdf.setTextColor(...greenRGB);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(28);
  pdf.text('SMASHIN', 15, 22);
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(12);
  pdf.text('DISHA HALL · BADMINTON ACADEMY', 15, 30);

  pdf.setTextColor(...yellowRGB);
  pdf.setFontSize(18);
  pdf.text('SALARY SLIP', 195, 22, { align: 'right' });
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(11);
  pdf.text(monthLabel, 195, 30, { align: 'right' });

  let y = 55;
  pdf.setTextColor(...navyRGB);
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text('COACH', 15, y);
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text(u.name, 15, y + 7);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(...grayRGB);
  pdf.text(u.email, 15, y + 13);

  pdf.setTextColor(...navyRGB);
  pdf.setFontSize(9);
  pdf.text('SESSION RATE', 195, y, { align: 'right' });
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text(`${u.sessionRate.toFixed(2)} EGP`, 195, y + 5, { align: 'right' });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text('HOURLY RATE', 195, y + 11, { align: 'right' });
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text(`${u.hourlyRate.toFixed(2)} EGP`, 195, y + 16, { align: 'right' });

  y = 80;
  pdf.setDrawColor(...greenRGB);
  pdf.setLineWidth(0.5);
  pdf.line(15, y, 195, y);

  y = 90;
  pdf.setTextColor(...greenRGB);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.text('ATTENDANCE SUMMARY', 15, y);

  y += 10;
  const totalLateMins = s.records.reduce((sum, r) => sum + (r.lateMinutes || 0), 0);
  const totalEarlyMins = s.records.reduce((sum, r) => sum + (r.earlyLeaveMinutes || 0), 0);
  const excusedCount = (s.excusedRecords || []).length;

  const summaryItems = [
    ['Sessions Attended', `${s.daysPresent} / ${CONFIG.sessionsPerMonth}`],
    ['Days Absent', `${s.absentDays}`],
    ['Days Excused', `${excusedCount}`],
    ['Total Late Minutes', `${totalLateMins} min`],
    ['Total Early Leave Minutes', `${totalEarlyMins} min`],
  ];

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  summaryItems.forEach((item, i) => {
    const yy = y + i * 7;
    pdf.setTextColor(...grayRGB);
    pdf.text(item[0], 15, yy);
    pdf.setTextColor(...navyRGB);
    pdf.setFont('helvetica', 'bold');
    pdf.text(item[1], 195, yy, { align: 'right' });
    pdf.setFont('helvetica', 'normal');
  });

  y = 140;
  pdf.setTextColor(...greenRGB);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.text('SALARY CALCULATION', 15, y);

  y += 10;
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...navyRGB);
  pdf.text('Base Salary', 15, y);
  pdf.text(`+ ${s.baseSalary.toFixed(2)} EGP`, 195, y, { align: 'right' });

  y += 7;
  if (s.leaderboardBonus > 0) {
    pdf.setTextColor(...yellowRGB);
    pdf.text('Leaderboard Bonus', 15, y);
    pdf.text(`+ ${s.leaderboardBonus.toFixed(2)} EGP`, 195, y, { align: 'right' });
    y += 7;
  }
  if (s.lateDeductions > 0) {
    pdf.setTextColor(...redRGB);
    pdf.text('Late Arrival Deductions', 15, y);
    pdf.text(`- ${s.lateDeductions.toFixed(2)} EGP`, 195, y, { align: 'right' });
    y += 7;
  }
  if (s.earlyLeaveDeductions > 0) {
    pdf.setTextColor(...redRGB);
    pdf.text('Early Leave Deductions', 15, y);
    pdf.text(`- ${s.earlyLeaveDeductions.toFixed(2)} EGP`, 195, y, { align: 'right' });
    y += 7;
  }
  if (s.absenceDeductions > 0) {
    pdf.setTextColor(...redRGB);
    pdf.text(`Absence Deductions (${s.absentDays} day${s.absentDays !== 1 ? 's' : ''})`, 15, y);
    pdf.text(`- ${s.absenceDeductions.toFixed(2)} EGP`, 195, y, { align: 'right' });
    y += 7;
  }
  if (s.totalDeductions === 0) {
    pdf.setTextColor(...greenRGB);
    pdf.text('No Deductions This Month! 🎉', 15, y);
    y += 7;
  }

  y += 3;
  pdf.setDrawColor(...grayRGB);
  pdf.setLineWidth(0.3);
  pdf.line(15, y, 195, y);

  y += 12;
  pdf.setFillColor(...greenRGB);
  pdf.roundedRect(15, y - 8, 180, 18, 2, 2, 'F');
  pdf.setTextColor(...navyRGB);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.text('NET SALARY', 20, y + 1);
  pdf.setFontSize(18);
  pdf.text(`${Math.round(s.netSalaryWithBonus).toLocaleString('en-EG')} EGP`, 190, y + 2, { align: 'right' });

  y = 200;
  pdf.setTextColor(...greenRGB);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.text('SESSION LOG', 15, y);

  y += 10;
  pdf.setFontSize(9);
  pdf.setTextColor(...grayRGB);
  pdf.setFont('helvetica', 'bold');
  pdf.text('DATE', 15, y);
  pdf.text('CHECK-IN', 60, y);
  pdf.text('CHECK-OUT', 95, y);
  pdf.text('STATUS', 130, y);
  pdf.text('DEDUCTION', 195, y, { align: 'right' });

  y += 4;
  pdf.setDrawColor(220, 220, 220);
  pdf.line(15, y, 195, y);
  y += 6;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);

  const allRecords = [...s.records, ...(s.excusedRecords || [])].sort((a,b) => a.date.localeCompare(b.date));

  if (allRecords.length === 0) {
    pdf.setTextColor(...grayRGB);
    pdf.text('No sessions attended this month.', 15, y);
  } else {
    allRecords.forEach(r => {
      if (y > 280) { pdf.addPage(); y = 20; }
      pdf.setTextColor(...navyRGB);
      pdf.text(r.date, 15, y);
      if (isExcused(r)) {
        pdf.text('—', 60, y); pdf.text('—', 95, y);
        pdf.setTextColor(255, 180, 0);
        pdf.text(isCoachRestDay(r) ? 'Rest day' : `Excused${r.excusedReason ? ' (' + r.excusedReason + ')' : ''}`, 130, y);
        pdf.text('—', 195, y, { align: 'right' });
      } else {
        pdf.text(r.checkInTime, 60, y);
        pdf.text(r.checkOutTime || '—', 95, y);
        const status = getLateStatus(r.lateMinutes);
        if (status === 'ontime') {
          pdf.setTextColor(...greenRGB);
          pdf.text(r.earlyLeaveMinutes > 0 ? `Left ${r.earlyLeaveMinutes}m early` : 'On time', 130, y);
        } else {
          pdf.setTextColor(...redRGB);
          pdf.text(`+${r.lateMinutes}m late${r.earlyLeaveMinutes > 0 ? ` / -${r.earlyLeaveMinutes}m early` : ''}`, 130, y);
        }
        const totalDed = (r.lateDeduction || r.deduction || 0) + (r.earlyLeaveDeduction || 0);
        pdf.setTextColor(totalDed > 0 ? redRGB[0] : greenRGB[0], totalDed > 0 ? redRGB[1] : greenRGB[1], totalDed > 0 ? redRGB[2] : greenRGB[2]);
        pdf.text(totalDed > 0 ? `-${totalDed.toFixed(1)} EGP` : '—', 195, y, { align: 'right' });
      }
      y += 6;
    });
  }

  const pageCount = pdf.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setTextColor(...grayRGB);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'italic');
    const today = new Date().toLocaleDateString('en-EG', { year: 'numeric', month: 'long', day: 'numeric' });
    pdf.text(`Generated on ${today} · Disha Hall Badminton Academy`, 105, 290, { align: 'center' });
    pdf.text(`Page ${i} of ${pageCount}`, 195, 290, { align: 'right' });
  }

  const filename = `${u.name.replace(/[^a-zA-Z0-9]/g, '_')}_${adminMonthKey}.pdf`;
  pdf.save(filename);
}

window.generateSlip = function(userId) { generateSalarySlip(userId); }
window.generateAllSlips = function() {
  const coaches = USERS.filter(u => !u.isAdmin);
  if (!confirm(`Generate salary slips for all ${coaches.length} coaches?`)) return;
  coaches.forEach((u, i) => {
    setTimeout(() => generateSalarySlip(u.id), i * 500);
  });
}

window.adminMarkRead = async function(noteId) { await markNoteRead(noteId); }
window.adminDeleteNote = async function(noteId) {
  if (!confirm('Delete this note?')) return;
  await deleteNote(noteId);
}
window.adminRemoveEntry = function adminRemoveEntry(userId, date) {
  const u = getUser(userId);
  if (!confirm(`Remove attendance for ${u.name} on ${date}?`)) return;
  removeAttendance(userId, date);
  renderAdminPage();
}
window.changeAdminMonth = function changeAdminMonth(dir) {
  const [y, m] = adminMonthKey.split('-').map(Number);
  const d = new Date(y, m - 1 + dir, 1);
  adminMonthKey = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2,'0');
  document.getElementById('admin-month-label').textContent = formatMonthLabel(adminMonthKey);
  renderAdminSummary();
  renderAdminTab(adminActiveTab);
}
