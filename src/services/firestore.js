import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore, collection, doc,
  getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  addDoc, query, orderBy, where, limit, serverTimestamp
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey:            process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain:        process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.REACT_APP_FIREBASE_APP_ID,
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const db   = getFirestore(app);
export const auth = getAuth(app);

// ─── URL DA API CLOUD RUN ────────────────────────────────────────────────────
const API_URL = process.env.REACT_APP_API_URL || '';

async function authHeader() {
  const token = await auth.currentUser?.getIdToken();
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

// ─── CÓDIGOS DOS FUNCIONÁRIOS (Firestore) ────────────────────────────────────
export async function loadCodigosFirestore() {
  const snap = await getDocs(collection(db, 'employees'));
  const map  = {};
  snap.forEach(d => { map[d.id] = d.data().codigo || ''; });
  return map;
}

export async function saveCodigoFirestore(cpf, codigo, nome) {
  await setDoc(doc(db, 'employees', cpf), {
    cpf, codigo, nome,
    updatedAt: new Date().toISOString(),
    updatedBy: auth.currentUser?.email || '',
  }, { merge: true });
}

export async function bulkSaveCodigosFirestore(employees) {
  const promises = employees
    .filter(e => e.codigo)
    .map(e => setDoc(doc(db, 'employees', e.cpf), {
      cpf: e.cpf, codigo: e.codigo, nome: e.nome,
      updatedAt: new Date().toISOString(),
      updatedBy: auth.currentUser?.email || '',
    }, { merge: true }));
  await Promise.all(promises);
}

// ─── LOGS DE PROCESSAMENTO ───────────────────────────────────────────────────
export async function saveProcessLog(data) {
  const headers = await authHeader();
  await fetch(`${API_URL}/api/logs`, {
    method: 'POST', headers, body: JSON.stringify(data),
  });
}

export async function getLogs(onlyMine = false) {
  const headers = await authHeader();
  const res = await fetch(`${API_URL}/api/logs`, { headers });
  return res.json();
}

// ─── GESTÃO DE USUÁRIOS (via Cloud Run — Admin SDK) ──────────────────────────
export async function getUsers() {
  const headers = await authHeader();
  const res = await fetch(`${API_URL}/api/users`, { headers });
  return res.json();
}

export async function createUser(data) {
  const headers = await authHeader();
  const res = await fetch(`${API_URL}/api/users`, {
    method: 'POST', headers, body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateUser(uid, data) {
  const headers = await authHeader();
  const res = await fetch(`${API_URL}/api/users/${uid}`, {
    method: 'PATCH', headers, body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteUser(uid) {
  const headers = await authHeader();
  const res = await fetch(`${API_URL}/api/users/${uid}`, {
    method: 'DELETE', headers,
  });
  return res.json();
}

export async function sendInvite(data) {
  const headers = await authHeader();
  const res = await fetch(`${API_URL}/api/users/invite`, {
    method: 'POST', headers, body: JSON.stringify(data),
  });
  return res.json();
}

// ─── PERFIL DO USUÁRIO ATUAL ─────────────────────────────────────────────────
export async function getCurrentUserProfile() {
  const uid = auth.currentUser?.uid;
  if (!uid) return null;
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? { uid, ...snap.data() } : null;
}

export async function ensureUserProfile(user) {
  const ref  = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const isFirstUser = (await getDocs(collection(db, 'users'))).empty;
    await setDoc(ref, {
      email: user.email,
      nome:  user.displayName || user.email.split('@')[0],
      role:  isFirstUser ? 'admin' : 'operator',
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      active: true,
    });
  } else {
    await updateDoc(ref, { lastLogin: new Date().toISOString() });
  }
  return (await getDoc(ref)).data();
}
