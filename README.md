# 🎓 Live Attendance — Education Management Platform
> Powered by **FarhadAIStudio**

A full production-ready SaaS platform for Universities, Colleges, Schools and Academies.

---

## 🚀 Quick Start

```bash
npm install
npm run dev
# Open http://localhost:5173
```

---

## 🔥 Firebase Setup (5 minutes)

### 1. Firebase Console → Authentication
Enable **Email/Password** provider

### 2. Firebase Console → Firestore Database  
Create database → Production mode → Choose region

### 3. Firestore Security Rules
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == uid;
    }
    match /departments/{deptId} {
      allow read: if request.auth != null && 
        resource.data.members.hasAny([request.auth.uid]);
      allow create: if request.auth != null;
      allow update: if request.auth.uid == resource.data.chairmanId;
      allow delete: if request.auth.uid == resource.data.chairmanId;
      match /{sub}/{docId} {
        allow read, write: if request.auth != null;
        match /{sub2}/{doc2} {
          allow read, write: if request.auth != null;
        }
      }
    }
  }
}
```

### 4. Create Platform Owner Account
1. Sign up via `/signup` (choose any role)
2. Go to Firebase Console → Firestore → `users` collection
3. Find your document → change `role` to `"owner"` and `status` to `"approved"`
4. Sign in via `/owner-login`

---

## 👥 5-Role System

| Role | Access | Dashboard |
|------|--------|-----------|
| **Owner** | Platform analytics, all departments, all users | `/owner` |
| **Chairman** | Full dept control, approve members, manage everything | `/chairman` |
| **Teacher** | Take attendance with live QR, view reports | `/teacher` |
| **CR** | Assist attendance scanning, view announcements | `/cr` |
| **Student** | View own attendance, classes, announcements | `/student` |

---

## 📱 How Attendance Works

**Mode 1 — Students Scan:**
1. Teacher starts session → QR generated
2. Students open `/student/scan` and scan the QR
3. GPS verified within 300m of classroom
4. Attendance marked instantly in real-time

**Mode 2 — Teacher Scans:**
1. Teacher starts session
2. Each student shows their personal QR code
3. Teacher/CR scans with the scan input
4. Instant confirmation

---

## 🗂 Project Structure
```
src/
├── App.jsx                    # All routes + guards
├── contexts/AuthContext.jsx   # Firebase auth + 5 roles
├── firebase/
│   ├── config.js              # Your Firebase config
│   └── firestore.js           # All DB operations
├── components/
│   ├── layout/Layout.jsx      # Sidebar + topbar (role-aware)
│   └── ui/index.jsx           # Modal, Card, StatsCard, Avatar…
├── pages/
│   ├── auth/AuthPages.jsx     # Login, Signup, Pending, OwnerLogin
│   ├── LandingPage.jsx
│   ├── owner/                 # Platform owner pages
│   ├── chairman/              # Chairman management pages
│   ├── teacher/               # Teacher pages
│   ├── cr/                    # CR pages
│   ├── student/               # Student pages
│   └── shared/                # Join dept, 404
└── utils/
    ├── helpers.js             # Formatting, GPS, etc.
    └── export.js              # PDF + Excel export
```

---

## 🌐 Deploy to Firebase Hosting
```bash
npm run build
npm install -g firebase-tools
firebase login
firebase init hosting    # Public dir: dist, SPA: yes
firebase deploy
```

---

*Built by FarhadAIStudio · Live Attendance Platform*
