// ─── APP ROUTER ───

function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pg = document.getElementById(id);
  if (pg) pg.classList.add('active');
}

function doLogin() {
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

  if (user.isAdmin) {
    showPage('page-admin');
    renderAdminPage();
  } else {
    showPage('page-coach');
    renderCoachPage();
  }
}

function doLogout() {
  logout();
  showPage('page-login');
  document.getElementById('login-email').value = '';
  document.getElementById('login-password').value = '';
}

// Allow Enter key on login
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('login-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });
  document.getElementById('login-email').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('login-password').focus();
  });

  // Restore session
  const user = restoreSession();
  if (user) {
    if (user.isAdmin) {
      showPage('page-admin');
      renderAdminPage();
    } else {
      showPage('page-coach');
      renderCoachPage();
    }
  } else {
    showPage('page-login');
  }
});
