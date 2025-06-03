# 📚 Corner – Monorepo

**Corner** is a mobile-first learning platform designed to replace scattered communication tools like WhatsApp with structured, professional, and accessible course interactions.

This monorepo contains all components of the project:

```
Corner/
├── mobile/     # Expo React Native app (for students & teachers)
├── web/        # Web frontend (Next.js)
├── backend/    # Node.js + Express API server
├── shared/     # (optional) Shared types, constants, helpers
└── README.md   # This file
```


---

## 🔧 Setup Instructions

### 📱 Mobile (Expo React Native)
```bash
cd mobile
npm install
npx expo start

cd web
npm install
npm run dev

cd backend
npm install
npm start

```

