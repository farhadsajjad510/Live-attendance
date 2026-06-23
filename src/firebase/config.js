// ─── Firebase Configuration ───────────────────────────────────────────────────
// Project: live-attendance-d60ca (FarhadAIStudio)
//
// IMPORTANT: firebase/analytics is intentionally excluded.
// getAnalytics() requires a browser environment check and the firebase/analytics
// package — calling it unconditionally crashes the Vite production bundle
// before React mounts, causing a black screen on Firebase Hosting.

import { initializeApp } from 'firebase/app';
import { getAuth }       from 'firebase/auth';
import { getFirestore }  from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            "AIzaSyDrW_yAr1174gg3odDgnwTZWwcMFf8Xy0U",
  authDomain:        "live-attendance-d60ca.firebaseapp.com",
  projectId:         "live-attendance-d60ca",
  storageBucket:     "live-attendance-d60ca.firebasestorage.app",
  messagingSenderId: "232888850968",
  appId:             "1:232888850968:web:b36f3326db6d95287b016d",
  measurementId:     "G-2TSE0E3BZZ",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db   = getFirestore(app);

export default app;
