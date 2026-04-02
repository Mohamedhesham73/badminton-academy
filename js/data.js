// ─── ACADEMY CONFIG ───
const CONFIG = {
  // TODO: Replace with your actual academy coordinates
  academyLat: 30.0626,
  academyLng: 31.2497,
  geofenceMeters: 150,
  workDays: [1, 3, 6], // Mon=1, Wed=3, Sat=6
  sessionStart: { h: 17, m: 0 },
  checkinOpen: { h: 16, m: 0 },
  sessionEnd: { h: 21, m: 0 },
  lateDeductionPerHour: 100, // EGP per hour
  sessionsPerMonth: 12,
  currency: 'EGP',
};

// ─── USERS ───
const USERS = [
  { id: 1, email: 'tomhesham2009@gmail.com', password: 'car3boy2009', name: 'Mohamed Hesham (H)', sessionRate: 383.3, isAdmin: false },
  { id: 2, email: 'mohamed@academy.com', password: '1234', name: 'Omar Ezzat',   sessionRate: 383.3, isAdmin: false },
  { id: 3, email: 'khaled@academy.com',  password: '1234', name: 'Mahmoud Mohamed Hassan', sessionRate: 383.3, isAdmin: false },
  { id: 4, email: 'omar@academy.com',    password: '1234', name: 'Omar Zakrie',    sessionRate: 383.3, isAdmin: false },
  { id: 5, email: 'youssef@academy.com', password: '1234', name: 'Mohamed Ibrahem (Dan)', sessionRate: 383.3, isAdmin: false },
  { id: 6, email: 'kareem@academy.com',  password: '1234', name: 'Abo AL7amd', sessionRate: 550,   isAdmin: false },
  { id: 7, email: 'admin@academy.com',   password: 'admin123', name: 'MOhamed Mostafa (Mido)',     sessionRate: 0,     isAdmin: true  },
];

// ─── ATTENDANCE (persisted in localStorage) ───
// Each record: { userId, date: 'YYYY-MM-DD', checkInTime: 'HH:MM', lateMinutes: 0, deduction: 0 }
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
    { userId: 1, date: '2026-03-28', checkInTime: '05:00', lateMinutes: 0, deduction: 0 },
    { userId: 1, date: '2026-03-30', checkInTime: '05:22', lateMinutes: 22, deduction: 36.7 },
    { userId: 2, date: '2026-03-28', checkInTime: '05:00', lateMinutes: 0, deduction: 0 },
    { userId: 3, date: '2026-03-28', checkInTime: '06:15', lateMinutes: 75, deduction: 125 },
    { userId: 3, date: '2026-03-30', checkInTime: '05:05', lateMinutes: 5, deduction: 8.3 },
    { userId: 4, date: '2026-03-28', checkInTime: '05:00', lateMinutes: 0, deduction: 0 },
    { userId: 5, date: '2026-03-28', checkInTime: '05:00', lateMinutes: 0, deduction: 0 },
    { userId: 6, date: '2026-03-28', checkInTime: '05:00', lateMinutes: 0, deduction: 0 },
    { userId: 6, date: '2026-03-30', checkInTime: '05:45', lateMinutes: 45, deduction: 75 },
  ];
}

let attendance = loadAttendance();

// ─── HELPERS ───
function getUser(id) { return USERS.find(u => u.id === id); }
function getUserByEmail(email) { return USERS.find(u => u.email === email.toLowerCase().trim()); }

function todayStr() { return new Date().toISOString().split('T')[0]; }
function nowStr() {
  const n = new Date();
  return String(n.getHours()).padStart(2,'0') + ':' + String(n.getMinutes()).padStart(2,'0');
}

function isWorkDay(date = new Date()) {
  return CONFIG.workDays.includes(date.getDay());
}

function calcLateMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  const totalMins = h * 60 + m;
  const startMins = CONFIG.sessionStart.h * 60 + CONFIG.sessionStart.m;
  // Late starts at 05:01 (1 minute after start)
  const lateAfter = startMins + 1;
  return Math.max(0, totalMins - lateAfter + 1);
}

function calcDeduction(lateMinutes) {
  return Math.round((lateMinutes / 60) * CONFIG.lateDeductionPerHour * 10) / 10;
}

function getLateStatus(lateMinutes) {
  if (lateMinutes === 0) return 'ontime';
  if (lateMinutes <= 30) return 'late';
  return 'superlate';
}

function getMonthKey(dateStr) { return dateStr.slice(0, 7); } // 'YYYY-MM'

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

// ─── AUTH ───
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
