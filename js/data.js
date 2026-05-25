// ─── FIREBASE IMPORTS ───
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, doc, setDoc, getDocs, deleteDoc, onSnapshot, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD_3yHweVEDdQGLXkj5uLm6LdZAGezAU44",
  authDomain: "disha-hall-attendance.firebaseapp.com",
  projectId: "disha-hall-attendance",
  storageBucket: "disha-hall-attendance.firebasestorage.app",
  messagingSenderId: "471478048950",
  appId: "1:471478048950:web:d4a89394d4b11ae1c4ae17"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ─── ACADEMY CONFIG ───
const CONFIG = {
  academyLat: 30.0658149,
  academyLng: 31.3640282,
  geofenceMeters: 100,
  workDays: [1, 3, 6],
  sessionStart: { h: 17, m: 0 },
  checkinOpen: { h: 16, m: 0 },
  sessionEnd: { h: 21, m: 0 },
  sessionsPerMonth: 12,
  currency: 'EGP',
};

// ─── USERS ───
const USERS = [
  { id: 1, email: 'tomhesham2009@gmail.com',      password: 'car3boy2009',       name: 'Mohamed Hesham (H)',      sessionRate: 383.3,  hourlyRate: 95.83,  isAdmin: false, photo: 'imgs/H.jpeg' },
  { id: 2, email: 'ezzat@academy.com',            password: '1234',              name: 'Omar Ezzat',              sessionRate: 383.3,  hourlyRate: 95.83,  isAdmin: false, photo: 'imgs/Ezzat.jpeg' },
  { id: 3, email: 'mahmoud72500@gmail.com',       password: '7250',              name: 'Mahmoud Mohamed Hassan',  sessionRate: 383.3,  hourlyRate: 95.83,  isAdmin: false, photo: 'imgs/Mahmoud.jpeg' },
  { id: 4, email: 'omarabdalkader1104@gmail.com', password: 'Zikoo1029&',        name: 'Omar Zakrie',             sessionRate: 383.3,  hourlyRate: 95.83,  isAdmin: false, photo: 'imgs/Omar.jpeg' },
  { id: 5, email: 'sorormohamedibrahim@gmail.com',password: 'cU@AtQSAn86GDAE',   name: 'Mohamed Ibrahem (Dan)',   sessionRate: 383.3,  hourlyRate: 95.83,  isAdmin: false, photo: 'imgs/Dan.jpeg' },
  { id: 6, email: 'aboal7amd@academy.com',        password: '1234',              name: 'Abo AL7amd',              sessionRate: 541.67, hourlyRate: 135.42, isAdmin: false, customStart: { 1: { h: 18, m: 0 }, 3: { h: 18, m: 0 }, 6: { h: 17, m: 0 } } },
  { id: 7, email: 'admin@academy.com',            password: 'admin123',          name: 'Mohamed Mostafa (Mido)',  sessionRate: 0,      hourlyRate: 0,      isAdmin: true,  photo: 'imgs/Mido.jpeg' },
];

// ─── EGYPTIAN HOLIDAYS (suggested by app) ───
// Format: { name, icon, startDate, endDate, type }
// Lunar holidays (Eid, Islamic New Year, Prophet's Birthday) approximate dates - admin should confirm
const SUGGESTED_HOLIDAYS = [
  // 2026
  { name: 'Coptic Christmas', icon: '✝️', startDate: '2026-01-07', endDate: '2026-01-07', type: 'fixed' },
  { name: 'Revolution Day (Jan 25)', icon: '🇪🇬', startDate: '2026-01-25', endDate: '2026-01-25', type: 'fixed' },
  { name: 'Sinai Liberation Day', icon: '🇪🇬', startDate: '2026-04-25', endDate: '2026-04-25', type: 'fixed' },
  { name: 'Sham El-Nessim', icon: '🐣', startDate: '2026-04-13', endDate: '2026-04-13', type: 'fixed' },
  { name: 'Labor Day', icon: '🛠️', startDate: '2026-05-01', endDate: '2026-05-01', type: 'fixed' },
  { name: 'Eid al-Fitr', icon: '🕌', startDate: '2026-03-20', endDate: '2026-03-22', type: 'lunar' },
  { name: 'Eid al-Adha', icon: '🕌', startDate: '2026-05-27', endDate: '2026-05-30', type: 'lunar' },
  { name: 'Islamic New Year', icon: '🌙', startDate: '2026-06-17', endDate: '2026-06-17', type: 'lunar' },
  { name: 'June 30 Revolution', icon: '🇪🇬', startDate: '2026-06-30', endDate: '2026-06-30', type: 'fixed' },
  { name: '23 July Revolution', icon: '🇪🇬', startDate: '2026-07-23', endDate: '2026-07-23', type: 'fixed' },
  { name: 'Prophet\'s Birthday', icon: '🕌', startDate: '2026-08-26', endDate: '2026-08-26', type: 'lunar' },
  { name: 'Armed Forces Day', icon: '🇪🇬', startDate: '2026-10-06', endDate: '2026-10-06', type: 'fixed' },
  // 2027
  { name: 'Coptic Christmas', icon: '✝️', startDate: '2027-01-07', endDate: '2027-01-07', type: 'fixed' },
  { name: 'Revolution Day (Jan 25)', icon: '🇪🇬', startDate: '2027-01-25', endDate: '2027-01-25', type: 'fixed' },
  { name: 'Eid al-Fitr', icon: '🕌', startDate: '2027-03-09', endDate: '2027-03-11', type: 'lunar' },
  { name: 'Sham El-Nessim', icon: '🐣', startDate: '2027-05-03', endDate: '2027-05-03', type: 'fixed' },
  { name: 'Labor Day', icon: '🛠️', startDate: '2027-05-01', endDate: '2027-05-01', type: 'fixed' },
  { name: 'Eid al-Adha', icon: '🕌', startDate: '2027-05-17', endDate: '2027-05-20', type: 'lunar' },
  { name: 'June 30 Revolution', icon: '🇪🇬', startDate: '2027-06-30', endDate: '2027-06-30', type: 'fixed' },
  { name: 'Armed Forces Day', icon: '🇪🇬', startDate: '2027-10-06', endDate: '2027-10-06', type: 'fixed' },
];

// ─── ATTENDANCE (synced with Firestore) ───
let attendance = [];

async function loadAttendance() {
  try {
    const snapshot = await getDocs(collection(db, 'attendance'));
    attendance = [];
    snapshot.forEach(d => attendance.push(d.data()));
  } catch(e) { console.error('Error loading:', e); }
}

async function saveAttendance(record) {
  try {
    const id = `${record.userId}_${record.date}`;
    await setDoc(doc(db, 'attendance', id), record);
  } catch(e) { console.error('Error saving:', e); }
}

async function updateAttendanceRecord(record) {
  try {
    const id = `${record.userId}_${record.date}`;
    await setDoc(doc(db, 'attendance', id), record);
    const idx = attendance.findIndex(a => a.userId === record.userId && a.date === record.date);
    if (idx >= 0) attendance[idx] = record;
    else attendance.push(record);
  } catch(e) { console.error('Error updating:', e); }
}

async function removeAttendance(userId, date) {
  try {
    const existing = attendance.find(a => a.userId === userId && a.date === date);
    const id = `${userId}_${date}`;
    await deleteDoc(doc(db, 'attendance', id));
    if (existing?.restDay === true || existing?.excusedBy === 'coach' || existing?.excusedReason === 'Coach rest day') {
      await deleteDoc(doc(db, 'restDays', date));
    }
    attendance = attendance.filter(a => !(a.userId === userId && a.date === date));
  } catch(e) { console.error('Error removing:', e); }
}

function buildExcusedRecord(userId, date, reason = 'Excused by admin', meta = {}) {
  return {
    userId,
    date,
    checkInTime: 'EXCUSED',
    checkOutTime: 'EXCUSED',
    lateMinutes: 0,
    lateDeduction: 0,
    deduction: 0,
    earlyLeaveMinutes: 0,
    earlyLeaveDeduction: 0,
    excused: true,
    excusedReason: reason,
    ...meta
  };
}

async function markAsExcused(userId, date, reason = 'Excused by admin', meta = {}) {
  const record = buildExcusedRecord(userId, date, reason, meta);
  await saveAttendance(record);
  const idx = attendance.findIndex(a => a.userId === userId && a.date === date);
  if (idx >= 0) attendance[idx] = record;
  else attendance.push(record);
  return record;
}

async function requestCoachRestDay(userId, date) {
  const user = getUser(userId);
  const record = buildExcusedRecord(userId, date, 'Coach rest day', {
    restDay: true,
    excusedBy: 'coach'
  });

  try {
    await runTransaction(db, async (transaction) => {
      const restRef = doc(db, 'restDays', date);
      const attendanceRef = doc(db, 'attendance', `${userId}_${date}`);
      const restSnap = await transaction.get(restRef);
      const attendanceSnap = await transaction.get(attendanceRef);
      if (restSnap.exists() && restSnap.data().userId !== userId) {
        throw new Error('REST_DAY_TAKEN');
      }
      if (attendanceSnap.exists() && !isCoachRestDay(attendanceSnap.data())) {
        throw new Error('REST_DAY_HAS_RECORD');
      }
      transaction.set(restRef, {
        date,
        userId,
        userName: user?.name || 'Coach',
        createdAt: new Date().toISOString()
      });
      transaction.set(attendanceRef, record);
    });
  } catch (e) {
    if (e.message === 'REST_DAY_TAKEN' || e.message === 'REST_DAY_HAS_RECORD') throw e;
    console.error('Error saving rest day:', e);
    throw e;
  }

  const idx = attendance.findIndex(a => a.userId === userId && a.date === date);
  if (idx >= 0) attendance[idx] = record;
  else attendance.push(record);
  return record;
}

function isExcusedRecord(record) {
  return record.excused === true || record.checkInTime === 'EXCUSED';
}

function isCoachRestDay(record) {
  return isExcusedRecord(record) && (record.restDay === true || record.excusedBy === 'coach' || record.excusedReason === 'Coach rest day');
}

function getCoachRestDays(monthKey = getCurrentMonthKey()) {
  return attendance.filter(a => isCoachRestDay(a) && getMonthKey(a.date) === monthKey);
}

function isRestDayTaken(date, exceptUserId = null) {
  return attendance.some(a => isCoachRestDay(a) && a.date === date && a.userId !== exceptUserId);
}

function getAvailableRestDays(monthKey = getCurrentMonthKey(), exceptUserId = null) {
  const [y, m] = monthKey.split('-').map(Number);
  const today = todayStr();
  const days = [];
  const lastDay = new Date(y, m, 0).getDate();
  for (let day = 1; day <= lastDay; day++) {
    const d = new Date(y, m - 1, day);
    const date = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (date <= today) continue;
    if (!isWorkDay(d)) continue;
    if (isHoliday(date)) continue;
    days.push({
      date,
      available: !isRestDayTaken(date, exceptUserId),
      takenBy: attendance.find(a => isCoachRestDay(a) && a.date === date && a.userId !== exceptUserId)?.userId || null
    });
  }
  return days;
}

function listenToAttendance(callback) {
  return onSnapshot(collection(db, 'attendance'), (snapshot) => {
    attendance = [];
    snapshot.forEach(d => attendance.push(d.data()));
    callback();
  });
}

// ─── HOLIDAYS (synced with Firestore) ───
let holidays = [];

async function loadHolidays() {
  try {
    const snapshot = await getDocs(collection(db, 'holidays'));
    holidays = [];
    snapshot.forEach(d => holidays.push({ ...d.data(), id: d.id }));
  } catch(e) { console.error('Error loading holidays:', e); }
}

async function saveHoliday(holiday) {
  try {
    const id = holiday.id || `${holiday.startDate}_${holiday.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
    await setDoc(doc(db, 'holidays', id), { ...holiday, id });
    const idx = holidays.findIndex(h => h.id === id);
    if (idx >= 0) holidays[idx] = { ...holiday, id };
    else holidays.push({ ...holiday, id });
    return id;
  } catch(e) { console.error('Error saving holiday:', e); return null; }
}

async function removeHoliday(id) {
  try {
    await deleteDoc(doc(db, 'holidays', id));
    holidays = holidays.filter(h => h.id !== id);
  } catch(e) { console.error('Error removing holiday:', e); }
}

function listenToHolidays(callback) {
  return onSnapshot(collection(db, 'holidays'), (snapshot) => {
    holidays = [];
    snapshot.forEach(d => holidays.push({ ...d.data(), id: d.id }));
    if (callback) callback();
  });
}

// Generate list of dates between start and end (inclusive)
function expandHolidayRange(startDate, endDate) {
  const dates = [];
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  const cur = new Date(start);
  while (cur <= end) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

// Check if a date is a holiday
function isHoliday(dateStr) {
  return holidays.some(h => {
    const dates = expandHolidayRange(h.startDate, h.endDate);
    return dates.includes(dateStr);
  });
}

// Get holiday info for a date
function getHoliday(dateStr) {
  return holidays.find(h => {
    const dates = expandHolidayRange(h.startDate, h.endDate);
    return dates.includes(dateStr);
  });
}

// ─── HELPERS ───
function getUser(id) { return USERS.find(u => u.id === id); }
function getUserByEmail(email) { return USERS.find(u => u.email === email.toLowerCase().trim()); }
function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isWorkDay(date = new Date()) {
  return CONFIG.workDays.includes(date.getDay());
}

function getCoachStartTime(user) {
  const todayDay = new Date().getDay();
  const custom = user?.customStart?.[todayDay];
  return custom || CONFIG.sessionStart;
}

function calcLateMinutes(timeStr, userId) {
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
  const user = getUser(userId);
  const startTime = getCoachStartTime(user);
  const startMins = startTime.h * 60 + startTime.m;
  return Math.max(0, totalMins - startMins);
}

function calcDeductionForUser(minutes, userId) {
  const user = getUser(userId);
  const rate = user?.hourlyRate || 95.83;
  return Math.round((minutes / 60) * rate * 10) / 10;
}

function calcDeduction(minutes) {
  return Math.round((minutes / 60) * 95.83 * 10) / 10;
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

function getPastWorkingDaysInMonth(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const now = new Date();
  const isPastSessionEnd = now.getHours() >= CONFIG.sessionEnd.h;
  const days = [];
  const lastDay = new Date(y, m, 0).getDate();

  for (let day = 1; day <= lastDay; day++) {
    const d = new Date(y, m - 1, day);
    d.setHours(0, 0, 0, 0);
    if (!CONFIG.workDays.includes(d.getDay())) continue;
    if (d > today || (d.getTime() === today.getTime() && !isPastSessionEnd)) continue;

    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    if (!isHoliday(dateStr)) days.push(dateStr);
  }

  return days;
}

function calcMonthlySummary(userId, monthKey) {
  const user = getUser(userId);
  const allRecords = getMonthAttendance(userId, monthKey);
  const records = allRecords.filter(r => !isExcusedRecord(r));
  const excusedRecords = allRecords.filter(r => isExcusedRecord(r));
  const presentDates = records.map(r => r.date);
  const excusedDates = excusedRecords.map(r => r.date);
  const absentDates = getPastWorkingDaysInMonth(monthKey).filter(d => !presentDates.includes(d) && !excusedDates.includes(d));
  const daysPresent = records.length;
  const baseSalary = user.sessionRate * CONFIG.sessionsPerMonth;
  const lateDeductions = records.reduce((s, r) => s + (r.lateDeduction || r.deduction || 0), 0);
  const earlyLeaveDeductions = records.reduce((s, r) => s + (r.earlyLeaveDeduction || 0), 0);
  const absentDays = absentDates.length;
  const absenceDeductions = absentDays * user.sessionRate;
  const totalDeductions = lateDeductions + earlyLeaveDeductions + absenceDeductions;
  const netSalary = baseSalary - totalDeductions;
  return { daysPresent, baseSalary, totalDeductions, lateDeductions, earlyLeaveDeductions, absenceDeductions, absentDays, absentDates, netSalary, records, excusedRecords };
}

function hasCheckedInToday(userId) {
  return attendance.find(a => a.userId === userId && a.date === todayStr());
}

async function addAttendance(userId, checkInTime) {
  const lateMinutes = calcLateMinutes(checkInTime, userId);
  const lateDeduction = calcDeductionForUser(lateMinutes, userId);
  const record = {
    userId,
    date: todayStr(),
    checkInTime,
    lateMinutes,
    lateDeduction,
    deduction: lateDeduction,
    checkOutTime: null,
    earlyLeaveMinutes: 0,
    earlyLeaveDeduction: 0
  };
  attendance.push(record);
  await saveAttendance(record);
  return record;
}

async function checkOutCoach(userId, checkOutTime) {
  const todayRecord = attendance.find(a => a.userId === userId && a.date === todayStr());
  if (!todayRecord) return null;
  const parts = checkOutTime.split(' ');
  const ampm = parts[1];
  let [h, m] = parts[0].split(':').map(Number);
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  const checkoutMins = h * 60 + m;
  const sessionEndMins = CONFIG.sessionEnd.h * 60 + CONFIG.sessionEnd.m;
  const earlyLeaveMinutes = Math.max(0, sessionEndMins - checkoutMins);
  const earlyLeaveDeduction = calcDeductionForUser(earlyLeaveMinutes, userId);
  const updated = {
    ...todayRecord,
    checkOutTime,
    earlyLeaveMinutes,
    earlyLeaveDeduction
  };
  await updateAttendanceRecord(updated);
  return updated;
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
  localStorage.setItem('academy_user', user.id);
  return user;
}

function logout() {
  currentUser = null;
  localStorage.removeItem('academy_user');
}

function restoreSession() {
  const id = localStorage.getItem('academy_user');
  if (id) currentUser = USERS.find(u => u.id === parseInt(id)) || null;
  return currentUser;
}

export {
  db, CONFIG, USERS, attendance, currentUser, holidays, SUGGESTED_HOLIDAYS,
  loadAttendance, saveAttendance, removeAttendance, listenToAttendance, addAttendance, checkOutCoach, markAsExcused, requestCoachRestDay,
  loadHolidays, saveHoliday, removeHoliday, listenToHolidays, isHoliday, getHoliday, expandHolidayRange,
  getUser, getUserByEmail, todayStr, isWorkDay, getCoachStartTime,
  isExcusedRecord, isCoachRestDay, getCoachRestDays, isRestDayTaken, getAvailableRestDays,
  calcLateMinutes, calcDeduction, calcDeductionForUser, getLateStatus,
  getMonthKey, getMonthAttendance, getCurrentMonthKey, calcMonthlySummary,
  hasCheckedInToday, formatDate, formatMonthLabel, initials, haversineMeters,
  login, logout, restoreSession
};
