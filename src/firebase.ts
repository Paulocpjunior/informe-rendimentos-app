import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyA9bPtg6W93nAEMe_13OqMZ1KHwZlPKWA0",
  authDomain: "gen-lang-client-0569062468.firebaseapp.com",
  projectId: "gen-lang-client-0569062468",
  storageBucket: "gen-lang-client-0569062468.firebasestorage.app",
  messagingSenderId: "292090471177",
  appId: "1:292090471177:web:b78c80c6452290851829d8",
  measurementId: "G-P3N0LYJHRV"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
