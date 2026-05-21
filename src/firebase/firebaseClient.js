import { initializeApp, getApps } from "firebase/app";
import { getDatabase } from "firebase/database";

// Firebase Web Config는 완전한 비밀값이 아니지만,
// 환경별 분리/배포 편의를 위해 Vite 환경변수로 관리합니다.
// 보안의 핵심은 Firebase Realtime Database Rules 와 (추후) Firebase Auth 입니다.
// TODO(보안): 관리자 로그인(Firebase Auth) 도입 후 Rules 에서 auth != null 검사 강제
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// RTDB 동작에 필수인 키. 특히 databaseURL 이 없으면 getDatabase() 가 즉시 throw 하여
// 앱 전체가 백지(white screen)가 되므로, 미설정 시에는 초기화를 건너뜁니다.
const REQUIRED_KEYS = ["apiKey", "databaseURL", "projectId", "appId"];
export const missingFirebaseKeys = REQUIRED_KEYS.filter(
  (k) => !firebaseConfig[k]
);
export const isFirebaseConfigured = missingFirebaseKeys.length === 0;

let app = null;
let db = null;

if (isFirebaseConfigured) {
  app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  db = getDatabase(app);
} else {
  // 빌드/런타임을 죽이지 않고 경고만 — App 에서 안내 배너로 처리
  console.warn(
    "[firebaseClient] Firebase 환경변수가 누락되어 초기화를 건너뜁니다. " +
      ".env.local 을 확인하세요. 누락 키:",
    missingFirebaseKeys
  );
}

export { db };
export default app;
