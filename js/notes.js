// ─── NOTES MODULE ───
import { db } from './data.js';
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let notesListener = null;

async function sendNote(userId, userName, message) {
  try {
    await addDoc(collection(db, 'notes'), {
      userId,
      userName,
      message,
      timestamp: new Date().toISOString(),
      read: false
    });
    return true;
  } catch(e) {
    console.error('Error sending note:', e);
    return false;
  }
}

async function markNoteRead(noteId) {
  try {
    await updateDoc(doc(db, 'notes', noteId), { read: true });
  } catch(e) {
    console.error('Error marking note:', e);
  }
}

async function deleteNote(noteId) {
  try {
    await deleteDoc(doc(db, 'notes', noteId));
  } catch(e) {
    console.error('Error deleting note:', e);
  }
}

function listenToNotes(callback) {
  const q = query(collection(db, 'notes'), orderBy('timestamp', 'desc'));
  notesListener = onSnapshot(q, (snapshot) => {
    const notes = [];
    snapshot.forEach(d => notes.push({ id: d.id, ...d.data() }));
    callback(notes);
  });
}

function listenToMyNotes(userId, callback) {
  const q = query(collection(db, 'notes'), orderBy('timestamp', 'desc'));
  onSnapshot(q, (snapshot) => {
    const notes = [];
    snapshot.forEach(d => {
      const data = d.data();
      if (data.userId === userId) notes.push({ id: d.id, ...data });
    });
    callback(notes);
  });
}

function formatNoteTime(isoStr) {
  const d = new Date(isoStr);
  return d.toLocaleDateString('en-EG', { weekday: 'short', day: 'numeric', month: 'short' }) +
    ' · ' + d.toLocaleTimeString('en-EG', { hour: '2-digit', minute: '2-digit' });
}

export { sendNote, markNoteRead, deleteNote, listenToNotes, listenToMyNotes, formatNoteTime };