importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyD_3yHweVEDdQGLXkj5uLm6LdZAGezAU44",
  authDomain: "disha-hall-attendance.firebaseapp.com",
  projectId: "disha-hall-attendance",
  storageBucket: "disha-hall-attendance.firebasestorage.app",
  messagingSenderId: "471478048950",
  appId: "1:471478048950:web:d4a89394d4b11ae1c4ae17"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification;
  self.registration.showNotification(title, {
    body,
    icon: '/imgs/ontime.mp3',
    badge: '/imgs/ontime.mp3',
    vibrate: [200, 100, 200],
  });
});