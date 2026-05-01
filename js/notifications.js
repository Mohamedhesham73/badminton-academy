// ─── NOTIFICATIONS ───
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js";

const VAPID_KEY = 'BBalmQhzeOU1uCdiTQjpazesx4Wsz7iNg4wZY8J7HHDUklcHFmSvAlKlBaAm_9-E3Vm-Vc1ljTYe4XtK1d6S6Ag';

const firebaseConfig = {
  apiKey: "AIzaSyD_3yHweVEDdQGLXkj5uLm6LdZAGezAU44",
  authDomain: "disha-hall-attendance.firebaseapp.com",
  projectId: "disha-hall-attendance",
  storageBucket: "disha-hall-attendance.firebasestorage.app",
  messagingSenderId: "471478048950",
  appId: "1:471478048950:web:d4a89394d4b11ae1c4ae17"
};

let messaging = null;

async function initNotifications() {
  try {
    if (!('Notification' in window)) return;
    if (!('serviceWorker' in navigator)) return;

    const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    messaging = getMessaging(app);

    // Register service worker
    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

    // Request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    // Get FCM token
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
    console.log('FCM Token:', token);

    // Listen for foreground messages
    onMessage(messaging, (payload) => {
      const { title, body } = payload.notification;
      new Notification(title, { body, icon: '🏸' });
    });

    // Schedule local notification for 4:45 PM on working days
    scheduleSessionReminder();

  } catch(e) {
    console.log('Notifications not available:', e);
  }
}

function scheduleSessionReminder() {
  const WORK_DAYS = [1, 3, 6]; // Mon, Wed, Sat
  const now = new Date();
  const day = now.getDay();

  if (!WORK_DAYS.includes(day)) return;

  const target = new Date();
  target.setHours(16, 45, 0, 0); // 4:45 PM

  const msUntil = target.getTime() - now.getTime();

  if (msUntil <= 0) return; // Already past 4:45 PM

  setTimeout(() => {
    new Notification('🏸 Disha Hall', {
      body: 'Session starts in 15 minutes! Time to head to the academy!',
      icon: '/imgs/ontime.mp3',
      vibrate: [200, 100, 200],
      tag: 'session-reminder'
    });
  }, msUntil);

  console.log(`Reminder scheduled in ${Math.round(msUntil/60000)} minutes`);
}

export { initNotifications };