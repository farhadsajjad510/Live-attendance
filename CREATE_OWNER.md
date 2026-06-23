# Create Platform Owner Account

## Method: Firebase Console (Recommended — 2 minutes)

### Step 1 — Create Auth Account
1. Go to https://console.firebase.google.com/project/live-attendance-d60ca/authentication/users
2. Click **Add user**
3. Email: `sajjad.ali.9u5y@gmail.com`
4. Password: `LiveAtt@Owner2024`
5. Click **Add user** → Note the UID shown

### Step 2 — Create Firestore Profile
1. Go to https://console.firebase.google.com/project/live-attendance-d60ca/firestore
2. Click **+ Start collection** (or open existing `users` collection)
3. Click **+ Add document**
4. Document ID: paste the UID from Step 1
5. Add these fields:

| Field | Type | Value |
|-------|------|-------|
| uid | string | (paste UID) |
| email | string | sajjad.ali.9u5y@gmail.com |
| displayName | string | Platform Owner |
| role | string | owner |
| status | string | approved |
| active | boolean | true |

6. Click **Save**

### Step 3 — Login
Go to: `https://live-attendance-d60ca.web.app/owner-login`
- Email: `sajjad.ali.9u5y@gmail.com`
- Password: `LiveAtt@Owner2024`

---

## IMPORTANT: Change your password immediately after first login
Go to Firebase Console → Authentication → find your user → Edit → change password

---

## Alternative: Run this in browser console on your live site
Open `https://live-attendance-d60ca.web.app` → Press F12 → Console → paste:

```javascript
// Run this ONCE to create the owner account
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, doc, setDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const app = initializeApp({
  apiKey: "AIzaSyDrW_yAr1174gg3odDgnwTZWwcMFf8Xy0U",
  authDomain: "live-attendance-d60ca.firebaseapp.com",
  projectId: "live-attendance-d60ca"
});
const auth = getAuth(app);
const db = getFirestore(app);

const { user } = await createUserWithEmailAndPassword(auth, "sajjad.ali.9u5y@gmail.com", "LiveAtt@Owner2024");
await setDoc(doc(db, "users", user.uid), {
  uid: user.uid,
  email: "sajjad.ali.9u5y@gmail.com",
  displayName: "Platform Owner",
  role: "owner",
  status: "approved",
  active: true
});
console.log("Owner created! UID:", user.uid);
```
