import { initializeApp, getApps } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// ⚠️ CONFIGURAÇÃO FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyA9bPtg6W93nAEMe_13OqMZ1KHwZlPKWA0",
  authDomain: "gen-lang-client-0569062468.firebaseapp.com",
  projectId: "gen-lang-client-0569062468",
  storageBucket: "gen-lang-client-0569062468.firebasestorage.app",
  messagingSenderId: "292090471177",
  appId: "1:292090471177:web:b78c80c6452290851829d8",
  measurementId: "G-P3N0LYJHRV"
};

let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(console.error);

const db = getFirestore(app);

export { app, auth, db };
