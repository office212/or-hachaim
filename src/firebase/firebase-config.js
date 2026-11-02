/* Firebase web client config for project or-hachaim, TEST phase.
   WARNING: apiKey and appId are NOT SET in this build. They were not
   available in the local scaffold workspace when this wiring layer was
   written, and they are NOT guessed here. Until a follow-up fills them
   from the Firebase console (Project settings, web app or-hachaim-site),
   firebase-app.js stays in test-only mode and every page keeps using
   the existing TEST / SAMPLE data. Do NOT invent a key.
   Known, non-secret project fields:
   - projectId: or-hachaim
   - authDomain: or-hachaim.firebaseapp.com
   - messagingSenderId: 1030831668431 (project number)
   - storageBucket: NOT USED in this build. Bucket
     or-hachaim.firebasestorage.app was created by the owner
     2026-11-02, empty, with production-mode deny-all rules.
     A Storage rules draft is present locally at
     src/firebase/storage.rules (deny by default, upload only for
     authorized gabbaim via custom claims, see that file), but it
     is NOT deployed, and images stay local preview only until
     custom claims are set and tested.
   How to complete: replace apiKey and appId below with the values from
   the Firebase console, keep Google as the only Auth provider, and
   re-verify locally before pushing. */
window.FIREBASE_CONFIG = {
  apiKey: null,
  authDomain: "or-hachaim.firebaseapp.com",
  projectId: "or-hachaim",
  storageBucket: null,
  messagingSenderId: "1030831668431",
  appId: null
};
window.FIREBASE_CONFIG_COMPLETE = false;
