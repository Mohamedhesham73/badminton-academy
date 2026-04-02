// ─── ADMIN PAGE ───

let adminActiveTab = 'overview';
let adminMonthKey = getCurrentMonthKey();

function renderAdminPage() {
  document.getElementById('admin-month-label').textContent = formatMonthLabel(adminMonthKey);
  renderAdminSummary();
  renderAdminTab(adminActiveTab);
}

function renderAdminSummary() {
  const coaches = USERS.filter(u => !u.isAdmin);
  let totalPresent = 0, totalSalaryOut = 0, totalDeductions = 0;
  coaches.forEach(u => {
    const s = calcMonthlySummary(u.id, adminMonthKey);
    totalPresent += s.daysPresent;
    totalSalaryOut += s.netSalary;
    totalDeductions += s.totalDeductions;
  });
  document.getElementById('admin-total-sessions').textContent = totalPresent;
  document.getElementById('admin-total-salary').textContent = Math.round(totalSalaryOut).toLocaleString('en-EG');
  document.getElementById('admin-total-deductions').textContent = Math.round(totalDeductions).toLocaleString('en-EG');
}

function switchAdminTab(tab) {
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
}

function renderOverviewTab(container) {
  const coaches = USERS.filter(u => !u.isAdmin);
  container.innerHTML = coaches.map(u => {
    const s = calcMonthlySummary(u.id, adminMonthKey);
    const pct = Math.min(100, (s.daysPresent / CONFIG.sessionsPerMonth) * 100);
    const isGold = u.sessionRate > 400;
    return `
      <div class="coach-row fade-in">
        <div class="coach-row-header">
          <div style="display:flex;align-items:center;gap:10px;">
            <div class="avatar ${isGold ? 'gold' : ''}" style="cursor:default;" title="${u.name}">${initials(u.name)}</div>
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
        ${s.totalDeductions > 0 ? `<div style="margin-bottom:10px;"><span class="deduction-pill">⚠ Total deductions: ${s.totalDeductions.toFixed(1)} EGP</span></div>` : ''}
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
  const monthRecords = attendance.filter(a => getMonthKey(a.date) === adminMonthKey);

  if (monthRecords.length === 0) {
    container.innerHTML = `<div class="empty-state"><span class="icon">📋</span>No records for this month</div>`;
    return;
  }

  const byDate = {};
  monthRecords.forEach(r => {
    if (!byDate[r.date]) byDate[r.date] = [];
    byDate[r.date].push(r);
  });

  const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  container.innerHTML = sortedDates.map(date => {
    const records = byDate[date];
    const dayDate = new Date(date + 'T00:00:00');
    const dayLabel = dayDate.toLocaleDateString('en-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const totalPresent = records.length;
    const totalDeductions = records.reduce((s, r) => s + (r.deduction || 0), 0);

    const rows = records.map(r => {
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
            <div class="avatar" style="width:32px;height:32px;font-size:11px;">${initials(u.name)}</div>
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

    return `
      <div style="margin:0 16px 16px;border-radius:var(--radius-sm);overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
        <div style="background:rgba(0,200,150,0.08);border-bottom:1px solid rgba(0,200,150,0.15);padding:12px 14px;display:flex;align-items:center;justify-content:space-between;">
          <div>
            <div style="font-family:'Bebas Neue',sans-serif;font-size:16px;letter-spacing:1px;color:var(--green);">📅 ${dayLabel}</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">${totalPresent} coach${totalPresent !== 1 ? 'es' : ''} checked in${totalDeductions > 0 ? ` · ${totalDeductions.toFixed(1)} EGP deducted` : ''}</div>
          </div>
          <span class="badge badge-green">${totalPresent} / ${USERS.filter(u => !u.isAdmin).length}</span>
        </div>
        <div style="background:rgba(255,255,255,0.02);">${rows}</div>
      </div>`;
  }).join('');
}

function renderLeaderboardTab(container) {
  const coaches = USERS.filter(u => !u.isAdmin);

  const stats = coaches.map(u => {
    const s = calcMonthlySummary(u.id, adminMonthKey);
    const totalLateMinutes = s.records.reduce((sum, r) => sum + (r.lateMinutes || 0), 0);
    const ontimeSessions = s.records.filter(r => r.lateMinutes === 0).length;
    return { u, s, totalLateMinutes, ontimeSessions };
  });

  // Sort by on time sessions desc, then by late minutes asc
  const ranked = [...stats].sort((a, b) => b.ontimeSessions - a.ontimeSessions || a.totalLateMinutes - b.totalLateMinutes);

  // Most late
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
                <div class="avatar ${item.u.sessionRate > 400 ? 'gold' : ''}">${initials(item.u.name)}</div>
                <div>
                  <div style="font-size:14px;font-weight:800;">${item.u.name} ${isMostLate ? '<span style="font-size:11px;background:rgba(255,77,109,0.15);color:var(--red);padding:2px 6px;border-radius:6px;">😴 Most Late</span>' : ''}</div>
                  <div style="font-size:12px;color:var(--text-muted);">${item.ontimeSessions} on-time · ${item.totalLateMinutes}m total late</div>
                </div>
              </div>
              <div style="text-align:right;">
                <div style="font-family:'Bebas Neue',sans-serif;font-size:18px;color:var(--green);">${item.s.daysPresent} sessions</div>
                ${item.s.totalDeductions > 0 ? `<div style="font-size:11px;color:var(--red);">-${item.s.totalDeductions.toFixed(1)} EGP</div>` : '<div style="font-size:11px;color:var(--green);">No deductions 🎉</div>'}
              </div>
            </div>`;
        }).join('')}
      </div>
    </div>
  `;
}

function adminRemoveEntry(userId, date) {
  const u = getUser(userId);
  if (!confirm(`Remove attendance for ${u.name} on ${date}?`)) return;
  removeAttendance(userId, date);
  renderAdminPage();
}

function changeAdminMonth(dir) {
  const [y, m] = adminMonthKey.split('-').map(Number);
  const d = new Date(y, m - 1 + dir, 1);
  adminMonthKey = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2,'0');
  document.getElementById('admin-month-label').textContent = formatMonthLabel(adminMonthKey);
  renderAdminSummary();
  renderAdminTab(adminActiveTab);
}