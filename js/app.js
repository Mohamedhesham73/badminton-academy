import { login, logout, restoreSession, loadAttendance, loadHolidays, listenToAttendance } from './data.js';
import { renderCoachPage, cleanupCoachPage } from './coach.js';
import { renderAdminPage, cleanupAdminPage } from './admin.js';
import { initNotifications } from './notifications.js';

let attendanceUnsubscribe = null;

// ─── APP ROUTER ───
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pg = document.getElementById(id);
  if (pg) pg.classList.add('active');
}

function launchShuttle() {
  const el = document.createElement('div');
  el.className = 'shuttle-fly';
  el.textContent = '🏸';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2000);
}

window.doLogin = async function() {
  const email = document.getElementById('login-email').value.trim();
  const pw = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');

  const user = login(email, pw);
  if (!user) {
    errEl.textContent = 'Incorrect email or password. Try again.';
    errEl.style.display = 'block';
    document.getElementById('login-password').value = '';
    return;
  }

  errEl.style.display = 'none';
  errEl.textContent = '';

  const btn = document.querySelector('#page-login .btn-green');
  if (btn) { btn.textContent = 'Loading...'; btn.disabled = true; }

  try {
    await Promise.race([
      Promise.all([loadAttendance(), loadHolidays()]),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
    ]);
  } catch(e) {}

  if (btn) { btn.textContent = 'Sign In →'; btn.disabled = false; }
  launchShuttle();

  if (user.isAdmin) {
    showPage('page-admin');
    renderAdminPage();
  } else {
    showPage('page-coach');
    renderCoachPage();
    // Init notifications for coaches only
    initNotifications();
  }

  if (attendanceUnsubscribe) attendanceUnsubscribe();
  attendanceUnsubscribe = listenToAttendance(() => {
    if (user.isAdmin) renderAdminPage();
    else renderCoachPage();
  });
}

window.doLogout = function() {
  if (attendanceUnsubscribe) {
    attendanceUnsubscribe();
    attendanceUnsubscribe = null;
  }
  cleanupCoachPage();
  cleanupAdminPage();
  logout();
  showPage('page-login');
  document.getElementById('login-email').value = '';
  document.getElementById('login-password').value = '';
}

document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('login-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });
  document.getElementById('login-email').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('login-password').focus();
  });

  const user = restoreSession();
  if (user) {
    await Promise.race([
      Promise.all([loadAttendance(), loadHolidays()]),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
    ]).catch(() => {});

    if (user.isAdmin) {
      showPage('page-admin');
      renderAdminPage();
    } else {
      showPage('page-coach');
      renderCoachPage();
      initNotifications();
    }

    if (attendanceUnsubscribe) attendanceUnsubscribe();
    attendanceUnsubscribe = listenToAttendance(() => {
      if (user.isAdmin) renderAdminPage();
      else renderCoachPage();
    });
  } else {
    showPage('page-login');
  }
});
