// ─── FIREBASE IMPORTS ───
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, doc, setDoc, getDocs, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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
  geofenceMeters: 50000,
  workDays: [1, 3, 6],
  sessionStart: { h: 0, m: 0 },
  checkinOpen: { h: 0 , m: 1 },
  sessionEnd: { h: 23, m: 59 },
  lateDeductionPerHour: 100,
  sessionsPerMonth: 12,
  currency: 'EGP',
};

// ─── USERS ───
const USERS = [
  { id: 1, email: 'tomhesham2009@gmail.com',     password: 'car3boy2009',      name: 'Mohamed Hesham (H)',      sessionRate: 383.3, isAdmin: false },
  { id: 2, email: 'ezzat@academy.com',           password: '1234',             name: 'Omar Ezzat',              sessionRate: 383.3, isAdmin: false },
  { id: 3, email: 'mahmoud@academy.com',         password: '1234',             name: 'Mahmoud Mohamed Hassan',  sessionRate: 383.3, isAdmin: false },
  { id: 4, email: 'Omarabdalkader1104@gmail.com',password: 'Zikoo1029&',       name: 'Omar Zakrie',             sessionRate: 383.3, isAdmin: false },
  { id: 5, email: 'sorormohamedibrahim@gmail.com',password: 'cU@AtQSAn86GDAE', name: 'Mohamed Ibrahem (Dan)',   sessionRate: 383.3, isAdmin: false },
  { id: 6, email: 'aboal7amd@academy.com',       password: '1234',             name: 'Abo AL7amd',              sessionRate: 550,   isAdmin: false },
  { id: 7, email: 'admin@academy.com',           password: 'admin123',         name: 'Mohamed Mostafa (Mido)',  sessionRate: 0,     isAdmin: true  },
];

// ─── ATTENDANCE (synced with Firestore) ───
let attendance = [];

async function loadAttendance() {
  try {
    const snapshot = await getDocs(collection(db, 'attendance'));
    attendance = [];
    snapshot.forEach(d => attendance.push(d.data()));
  } catch(e) {
    console.error('Error loading:', e);
  }
}

async function saveAttendance(record) {
  try {
    const id = `${record.userId}_${record.date}`;
    await setDoc(doc(db, 'attendance', id), record);
  } catch(e) {
    console.error('Error saving:', e);
  }
}

async function removeAttendance(userId, date) {
  try {
    const id = `${userId}_${date}`;
    await deleteDoc(doc(db, 'attendance', id));
    attendance = attendance.filter(a => !(a.userId === userId && a.date === date));
  } catch(e) {
    console.error('Error removing:', e);
  }
}

function listenToAttendance(callback) {
  onSnapshot(collection(db, 'attendance'), (snapshot) => {
    attendance = [];
    snapshot.forEach(d => attendance.push(d.data()));
    callback();
  });
}

// ─── HELPERS ───
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

async function addAttendance(userId, checkInTime) {
  const lateMinutes = calcLateMinutes(checkInTime);
  const deduction = calcDeduction(lateMinutes);
  const record = { userId, date: todayStr(), checkInTime, lateMinutes, deduction };
  attendance.push(record);
  await saveAttendance(record);
  return record;
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

export {
  CONFIG, USERS, attendance, currentUser,
  loadAttendance, saveAttendance, removeAttendance, listenToAttendance, addAttendance,
  getUser, getUserByEmail, todayStr, isWorkDay,
  calcLateMinutes, calcDeduction, getLateStatus,
  getMonthKey, getMonthAttendance, getCurrentMonthKey, calcMonthlySummary,
  hasCheckedInToday, formatDate, formatMonthLabel, initials, haversineMeters,
  login, logout, restoreSession
};