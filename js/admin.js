// ─── ADMIN PAGE ───
import { CONFIG, USERS, attendance, removeAttendance, getMonthAttendance, getCurrentMonthKey, calcMonthlySummary, getMonthKey, getLateStatus, formatMonthLabel, formatDate, initials, getUser } from './data.js';
import { listenToNotes, markNoteRead, deleteNote, formatNoteTime } from './notes.js';

let adminActiveTab = 'overview';
let adminMonthKey = getCurrentMonthKey();

// ─── AVATAR HELPER ───
function avatarHtml(user, size = 36) {
  const fontSize = Math.round(size * 0.33);
  if (user.photo) {
    return `<div class="avatar ${user.sessionRate > 400 ? 'gold' : ''}" style="width:${size}px;height:${size}px;padding:0;overflow:hidden;">
      <img src="${user.photo}" alt="${user.name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.parentElement.textContent='${initials(user.name)}'" />
    </div>`;
  }
  return `<div class="avatar ${user.sessionRate > 400 ? 'gold' : ''}" style="width:${size}px;height:${size}px;font-size:${fontSize}px;">${initials(user.name)}</div>`;
}

// ─── GET PAST WORKING DAYS IN MONTH (Sat/Mon/Wed ONLY) ───
function getPastWorkingDaysInMonth(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = [];
  const lastDay = new Date(y, m, 0).getDate();
  for (let day = 1; day <= lastDay; day++) {
    const d = new Date(y, m - 1, day);
    d.setHours(0, 0, 0, 0);
    if (CONFIG.workDays.includes(d.getDay()) && d < today) {
      // Build date string manually to avoid timezone issues
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      days.push(`${yyyy}-${mm}-${dd}`);
    }
  }
  return days;
}

// ─── CALC MONTHLY SUMMARY WITH ABSENCES ───
function calcMonthlySummaryWithAbsences(userId, monthKey) {
  const user = getUser(userId);
  const records = getMonthAttendance(userId, monthKey);
  const pastWorkingDays = getPastWorkingDaysInMonth(monthKey);
  const daysPresent = records.length;
  const baseSalary = user.sessionRate * CONFIG.sessionsPerMonth;
  const lateDeductions = records.reduce((s, r) => s + (r.deduction || 0), 0);
  const presentDates = records.map(r => r.date);
  const absentDays = pastWorkingDays.filter(d => !presentDates.includes(d)).length;
  const absenceDeductions = absentDays * user.sessionRate;
  const totalDeductions = lateDeductions + absenceDeductions;
  const netSalary = baseSalary - totalDeductions;
  return { daysPresent, baseSalary, totalDeductions, lateDeductions, absenceDeductions, absentDays, netSalary, records };
}

export function renderAdminPage() {
  document.getElementById('admin-month-label').textContent = formatMonthLabel(adminMonthKey);
  renderAdminSummary();
  renderAdminTab(adminActiveTab);
  listenToNotes(renderNotesBadge);
}

function renderNotesBadge(notes) {
  const unread = notes.filter(n => !n.read).length;
  const badge = document.getElementById('notes-tab-badge');
  if (badge) badge.textContent = unread > 0 ? ` (${unread})` : '';
}

function renderAdminSummary() {
  const coaches = USERS.filter(u => !u.isAdmin);
  let totalPresent = 0, totalSalaryOut = 0, totalDeductions = 0;
  coaches.forEach(u => {
    const s = calcMonthlySummaryWithAbsences(u.id, adminMonthKey);
    totalPresent += s.daysPresent;
    totalSalaryOut += s.netSalary;
    totalDeductions += s.totalDeductions;
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
  else if (tab === 'notes') renderNotesTab(content);
}

function renderOverviewTab(container) {
  const coaches = USERS.filter(u => !u.isAdmin);
  container.innerHTML = coaches.map(u => {
    const s = calcMonthlySummaryWithAbsences(u.id, adminMonthKey);
    const pct = Math.min(100, (s.daysPresent / CONFIG.sessionsPerMonth) * 100);
    return `
      <div class="coach-row fade-in">
        <div class="coach-row-header">
          <div style="display:flex;align-items:center;gap:10px;">
            ${avatarHtml(u, 36)}
            <div>
              <div class="coach-name">${u.name}</div>
              <div class="coach-meta">${u.sessionRate.toFixed(1)} EGP/session · ${u.email}</div>
            </div>
          </div>
          <div>
            <div class="coach-total">${Math.round(s.netSalary).toLocaleString('en-EG')} EGP</div>
            <div class="coach-total-label">${s.daysPresent}/${CONFIG.sessionsPerMonth} sessions</div>
          </div>
        </div>
        <div class="progress-bar" style="margin-bottom:10px;">
          <div class="progress-fill" style="width:${pct}%"></div>
        </div>
        ${s.totalDeductions > 0 ? `
          <div style="margin-bottom:10px;display:flex;flex-wrap:wrap;gap:6px;">
            ${s.lateDeductions > 0 ? `<span class="deduction-pill">⏰ Late: -${s.lateDeductions.toFixed(1)} EGP</span>` : ''}
            ${s.absenceDeductions > 0 ? `<span class="deduction-pill">❌ Absent (${s.absentDays}d): -${s.absenceDeductions.toFixed(1)} EGP</span>` : ''}
          </div>` : ''}
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${s.records.sort((a,b) => b.date.localeCompare(a.date)).map(r => {
            const late = r.lateMinutes > 0;
            return `
              <div style="display:flex;align-items:center;gap:4px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:4px 8px;">
                <span style="font-size:12px;color:${late ? 'var(--orange)' : 'var(--green)'};">${r.date.slice(5)} ${late ? '⚠' : '✓'}</span>
                <button class="btn-danger" style="padding:2px 6px;font-size:11px;" onclick="adminRemoveEntry(${u.id},'${r.date}')">×</button>
              </div>`;
          }).join('')}
          ${s.records.length === 0 ? `<span style="font-size:13px;color:var(--text-muted);">No attendance this month</span>` : ''}
        </div>
      </div>`;
  }).join('');
}

function renderLogTab(container) {
  const coaches = USERS.filter(u => !u.isAdmin);
  const pastWorkingDays = getPastWorkingDaysInMonth(adminMonthKey);
  const monthRecords = attendance.filter(a => getMonthKey(a.date) === adminMonthKey);

  if (pastWorkingDays.length === 0) {
    container.innerHTML = `<div class="empty-state"><span class="icon">📋</span>No working days have passed this month yet</div>`;
    return;
  }

  // Start with only working days
  const byDate = {};
  pastWorkingDays.forEach(date => {
    byDate[date] = [];
  });

  // Add attendance records only for working days
  monthRecords.forEach(r => {
    if (byDate[r.date] !== undefined) {
      byDate[r.date].push(r);
    }
  });

  const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  container.innerHTML = sortedDates.map(date => {
    const records = byDate[date];
    const dayDate = new Date(date + 'T00:00:00');
    const dayLabel = dayDate.toLocaleDateString('en-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const totalPresent = records.length;
    const totalDeductions = records.reduce((s, r) => s + (r.deduction || 0), 0);
    const presentIds = records.map(r => r.userId);
    const absentCoaches = coaches.filter(u => !presentIds.includes(u.id));

    const presentRows = records.map(r => {
      const u = getUser(r.userId);
      const status = getLateStatus(r.lateMinutes);
      const statusBadge = {
        ontime:    `<span class="badge badge-green">On time</span>`,
        late:      `<span class="badge badge-orange">+${r.lateMinutes}m late</span>`,
        superlate: `<span class="badge badge-red">+${r.lateMinutes}m late 💀</span>`
      }[status];
      return `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.04);">
          <div style="display:flex;align-items:center;gap:10px;">
            ${avatarHtml(u, 32)}
            <div>
              <div style="font-size:14px;font-weight:700;">${u.name}</div>
              <div style="font-size:12px;color:var(--text-muted);">Check-in: ${r.checkInTime}</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            ${statusBadge}
            ${r.deduction > 0 ? `<span class="deduction-pill">-${r.deduction.toFixed(1)} EGP</span>` : ''}
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
        <span class="badge badge-red">❌ Absent</span>
      </div>`).join('');

    return `
      <div style="margin:0 16px 16px;border-radius:var(--radius-sm);overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
        <div style="background:rgba(0,200,150,0.08);border-bottom:1px solid rgba(0,200,150,0.15);padding:12px 14px;display:flex;align-items:center;justify-content:space-between;">
          <div>
            <div style="font-family:'Bebas Neue',sans-serif;font-size:16px;letter-spacing:1px;color:var(--green);">📅 ${dayLabel}</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">
              ${totalPresent} present · ${absentCoaches.length} absent
              ${totalDeductions > 0 ? ` · ${totalDeductions.toFixed(1)} EGP deducted` : ''}
            </div>
          </div>
          <span class="badge badge-green">${totalPresent} / ${coaches.length}</span>
        </div>
        <div style="background:rgba(255,255,255,0.02);">
          ${presentRows}
          ${absentRows}
        </div>
      </div>`;
  }).join('');
}

function renderLeaderboardTab(container) {
  const coaches = USERS.filter(u => !u.isAdmin);
  const stats = coaches.map(u => {
    const s = calcMonthlySummaryWithAbsences(u.id, adminMonthKey);
    const totalLateMinutes = s.records.reduce((sum, r) => sum + (r.lateMinutes || 0), 0);
    const ontimeSessions = s.records.filter(r => r.lateMinutes === 0).length;
    return { u, s, totalLateMinutes, ontimeSessions };
  });
  const ranked = [...stats].sort((a, b) => 
  b.ontimeSessions - a.ontimeSessions ||      // Most on-time first
  a.s.absentDays - b.s.absentDays ||          // Fewer absences first
  a.totalLateMinutes - b.totalLateMinutes      // Less late time first
);
  const mostLate = [...stats].sort((a, b) => b.totalLateMinutes - a.totalLateMinutes)[0];
  const medals = ['🥇', '🥈', '🥉'];
  container.innerHTML = `
    <div style="padding:0 16px 16px;">
      <div style="margin-bottom:16px;">
        ${ranked.map((item, i) => {
          const isTop = i === 0 && item.ontimeSessions > 0;
          const isMostLate = mostLate && item.u.id === mostLate.u.id && mostLate.totalLateMinutes > 0;
          return `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;margin-bottom:8px;background:${isTop ? 'rgba(0,200,150,0.08)' : 'rgba(255,255,255,0.03)'};border:1px solid ${isTop ? 'rgba(0,200,150,0.2)' : 'rgba(255,255,255,0.07)'};border-radius:var(--radius-sm);">
              <div style="display:flex;align-items:center;gap:12px;">
                <div style="font-size:24px;">${medals[i] || '🏅'}</div>
                ${avatarHtml(item.u, 36)}
                <div>
                  <div style="font-size:14px;font-weight:800;">${item.u.name} ${isMostLate ? '<span style="font-size:11px;background:rgba(255,77,109,0.15);color:var(--red);padding:2px 6px;border-radius:6px;">😴 Most Late</span>' : ''}</div>
                  <div style="font-size:12px;color:var(--text-muted);">${item.ontimeSessions} on-time · ${item.totalLateMinutes}m total late · ${item.s.absentDays} absent</div>
                </div>
              </div>
              <div style="text-align:right;">
                <div style="font-family:'Bebas Neue',sans-serif;font-size:18px;color:var(--green);">${item.s.daysPresent} sessions</div>
                ${item.s.totalDeductions > 0 ? `<div style="font-size:11px;color:var(--red);">-${item.s.totalDeductions.toFixed(1)} EGP</div>` : '<div style="font-size:11px;color:var(--green);">No deductions 🎉</div>'}
              </div>
            </div>`;
        }).join('')}
      </div>
    </div>`;
}

function renderNotesTab(container) {
  container.innerHTML = `<div id="admin-notes-list" style="padding:0 16px;"></div>`;
  listenToNotes((notes) => {
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