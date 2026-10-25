import { initializeApp, getApps } from "firebase/app";
import { getDatabase, connectDatabaseEmulator } from "firebase/database";
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
export const missingFirebaseKeys = [
  "apiKey",
  "databaseURL",
  "projectId",
  "appId",
]
  .filter((k) => !config[k])
  .map(
    (k) =>
      ({
        apiKey: "VITE_FIREBASE_API_KEY",
        databaseURL: "VITE_FIREBASE_DATABASE_URL",
        projectId: "VITE_FIREBASE_PROJECT_ID",
        appId: "VITE_FIREBASE_APP_ID",
      })[k],
  );
let app = null,
  db = null,
  initializationError = null;
if (!missingFirebaseKeys.length)
  try {
    const url = new URL(config.databaseURL);
    if (url.protocol !== "https:")
      throw new Error("Firebase Database URL은 https 주소여야 합니다.");
    app = getApps()[0] || initializeApp(config);
    db = getDatabase(app);
    // Explicit development-only emulator setting; production builds cannot use it.
    if (
      import.meta.env.DEV &&
      import.meta.env.VITE_USE_FIREBASE_EMULATOR === "true"
    )
      connectDatabaseEmulator(db, "127.0.0.1", 9000);
  } catch (error) {
    initializationError = error;
    db = null;
  }
export const isFirebaseConfigured = !!db;
export { db, initializationError };
export default app;
