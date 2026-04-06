// ─── ACADEMY CONFIG ───
const CONFIG = {
  academyLat: 30.0658149,
academyLng: 31.3640282,
  geofenceMeters: 150,
  workDays: [1, 3, 6], // Mon=1, Wed=3, Sat=6
  sessionStart: { h: 17, m: 0 },
  checkinOpen: { h: 16, m: 0 },
  sessionEnd: { h: 21, m: 0 },
  lateDeductionPerHour: 100,
  sessionsPerMonth: 12,
  currency: 'EGP',
};

// ─── USERS ───
const USERS = [
  { id: 1, email: 'tomhesham2009@gmail.com', password: 'car3boy2009', name: 'Mohamed Hesham (H)',      sessionRate: 383.3, isAdmin: false },
  { id: 2, email: 'ezzat@academy.com',     password: '1234',        name: 'Omar Ezzat',              sessionRate: 383.3, isAdmin: false },
  { id: 3, email: 'mahmoud@academy.com',      password: '1234',        name: 'Mahmoud Mohamed Hassan',  sessionRate: 383.3, isAdmin: false },
  { id: 4, email: 'omar@academy.com',        password: '1234',        name: 'Omar Zakrie',             sessionRate: 383.3, isAdmin: false },
  { id: 5, email: 'mohamed@academy.com',     password: '1234',        name: 'Mohamed Ibrahem (Dan)',   sessionRate: 383.3, isAdmin: false },
  { id: 6, email: 'abo al 7amd@academy.com',      password: '1234',        name: 'Abo AL7amd',              sessionRate: 550,   isAdmin: false },
  { id: 7, email: 'admin@academy.com',       password: 'admin123',    name: 'Mohamed Mostafa (Mido)',  sessionRate: 0,     isAdmin: true  },
];

function loadAttendance() {
  try {
    const raw = localStorage.getItem('academy_attendance');
    return raw ? JSON.parse(raw) : getSeedData();
  } catch { return getSeedData(); }
}

function saveAttendance(data) {
  localStorage.setItem('academy_attendance', JSON.stringify(data));
}

function getSeedData() {
  return [
    { userId: 1, date: '2026-03-28', checkInTime: '05:00 PM', lateMinutes: 0,  deduction: 0 },
    { userId: 1, date: '2026-03-30', checkInTime: '05:22 PM', lateMinutes: 22, deduction: 36.7 },
    { userId: 2, date: '2026-03-28', checkInTime: '05:00 PM', lateMinutes: 0,  deduction: 0 },
    { userId: 3, date: '2026-03-28', checkInTime: '06:15 PM', lateMinutes: 75, deduction: 125 },
    { userId: 3, date: '2026-03-30', checkInTime: '05:05 PM', lateMinutes: 5,  deduction: 8.3 },
    { userId: 4, date: '2026-03-28', checkInTime: '05:00 PM', lateMinutes: 0,  deduction: 0 },
    { userId: 5, date: '2026-03-28', checkInTime: '05:00 PM', lateMinutes: 0,  deduction: 0 },
    { userId: 6, date: '2026-03-28', checkInTime: '05:00 PM', lateMinutes: 0,  deduction: 0 },
    { userId: 6, date: '2026-03-30', checkInTime: '05:45 PM', lateMinutes: 45, deduction: 75 },
  ];
}

let attendance = loadAttendance();

function getUser(id) { return USERS.find(u => u.id === id); }
function getUserByEmail(email) { return USERS.find(u => u.email === email.toLowerCase().trim()); }

function todayStr() { return new Date().toISOString().split('T')[0]; }

function isWorkDay(date = new Date()) {
  return CONFIG.workDays.includes(date.getDay());
}

function calcLateMinutes(timeStr) {
  let h, m;
  if (timeStr.includes('PM') || timeStr.includes('AM')) {
    const parts = timeStr.split(' ');
    const ampm = parts[1];
    [h, m] = parts[0].split(':').map(Number);
    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
  } else {
    [h, m] = timeStr.split(':').map(Number);
  }
  const totalMins = h * 60 + m;
  const startMins = CONFIG.sessionStart.h * 60 + CONFIG.sessionStart.m;
  return Math.max(0, totalMins - startMins);
}

function calcDeduction(lateMinutes) {
  return Math.round((lateMinutes / 60) * CONFIG.lateDeductionPerHour * 10) / 10;
}

function getLateStatus(lateMinutes) {
  if (lateMinutes === 0) return 'ontime';
  if (lateMinutes < 30) return 'late';
  return 'superlate';
}

function getMonthKey(dateStr) { return dateStr.slice(0, 7); }

function getMonthAttendance(userId, monthKey) {
  return attendance.filter(a => a.userId === userId && getMonthKey(a.date) === monthKey);
}

function getCurrentMonthKey() { return todayStr().slice(0, 7); }

function calcMonthlySummary(userId, monthKey) {
  const user = getUser(userId);
  const records = getMonthAttendance(userId, monthKey);
  const daysPresent = records.length;
  const baseSalary = user.sessionRate * CONFIG.sessionsPerMonth;
  const totalDeductions = records.reduce((s, r) => s + (r.deduction || 0), 0);
  const netSalary = baseSalary - totalDeductions;
  return { daysPresent, baseSalary, totalDeductions, netSalary, records };
}

function hasCheckedInToday(userId) {
  return attendance.find(a => a.userId === userId && a.date === todayStr());
}

function addAttendance(userId, checkInTime) {
  const lateMinutes = calcLateMinutes(checkInTime);
  const deduction = calcDeduction(lateMinutes);
  const record = { userId, date: todayStr(), checkInTime, lateMinutes, deduction };
  attendance.push(record);
  saveAttendance(attendance);
  return record;
}

function removeAttendance(userId, date) {
  attendance = attendance.filter(a => !(a.userId === userId && a.date === date));
  saveAttendance(attendance);
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-EG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function formatMonthLabel(monthKey) {
  const [y, m] = monthKey.split('-');
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString('en-EG', { month: 'long', year: 'numeric' });
}

function initials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

let currentUser = null;

function login(email, password) {
  const user = getUserByEmail(email);
  if (!user || user.password !== password) return null;
  currentUser = user;
  sessionStorage.setItem('academy_user', user.id);
  return user;
}

function logout() {
  currentUser = null;
  sessionStorage.removeItem('academy_user');
}

function restoreSession() {
  const id = sessionStorage.getItem('academy_user');
  if (id) currentUser = USERS.find(u => u.id === parseInt(id)) || null;
  return currentUser;
}