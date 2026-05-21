# 🏕️ 캠핑장 예약 현황판 (React + Vite)

포레스트소울 캠핑장 운영 자동화의 기반 앱.
기존 단일 HTML 버전을 React + Vite 구조로 재구축한 것이며,
**Firebase Realtime Database 의 `reservations` 경로 데이터는 그대로 사용**합니다.

---

## 핵심 원칙

- **데이터 무결성**: 기존 RTDB 데이터는 절대 마이그레이션·초기화·덮어쓰기 하지 않습니다.
- **호환성**: 기존 데이터 구조(`reservationId`, `name`, `site`, `checkin`, `nights`, `phone`, `platform`, `status`, `cancelledAt`)를 그대로 읽고 씁니다.
- **확장성 우선**: 이번 작업은 기능 확장이 아닌 *확장 가능한 틀* 만들기입니다.

---

## 설치 & 실행

```bash
npm install
npm run dev      # 개발 서버 (http://localhost:5173)
npm run build    # 프로덕션 빌드 (dist/)
npm run preview  # 빌드 산출물 미리보기
```

---

## 환경 변수 (.env.local)

Firebase Web Config 는 비밀값은 아니지만, 환경 분리/배포 편의를 위해 Vite 환경변수로 관리합니다.
**보안의 핵심은 Firebase Realtime Database Rules 와 (추후) Firebase Auth** 입니다.

1. `.env.example` 을 복사해서 `.env.local` 을 만듭니다.
2. Firebase 콘솔 → 프로젝트 설정 → 일반 → 웹 앱 → "SDK 설정 및 구성" 에서 값을 가져와 채웁니다.

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_DATABASE_URL=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

> `.env.local` 은 `.gitignore` 에 포함되어 있어 커밋되지 않습니다.

---

## 기존 RTDB 데이터 유지 방식

- 기존 Realtime Database 의 **`/reservations` 경로를 그대로 구독**합니다.
- 기존 키(예: Firebase 가 만든 `-Nabc...` 형태) 와 필드 구조를 변경하지 않습니다.
- 신규 저장은 `push()`, 수정은 `update()`, 취소는 `status: "cancelled"` 로 처리(soft delete) 합니다.
- 마이그레이션 스크립트나 일괄 변환 없이 **읽고 쓰는 호환성**만 유지합니다.

---

## 디렉토리 구조

```
src/
  main.jsx
  App.jsx
  firebase/
    firebaseClient.js     # Firebase 초기화 + db export
  constants/
    sites.js              # A1~A4, B1~B4, C1~C7
    platforms.js          # 색상/라벨
  hooks/
    useReservations.js    # RTDB 실시간 구독 + CRUD
  utils/
    dateUtils.js
    reservationUtils.js   # 중복 감지, 바 배치, 점유율, 취소 매칭
    kakaoParsers.js       # 캠핏/땡큐캠핑 파서 (parser interface)
  components/
    Layout.jsx
    TabNav.jsx
    ReservationBoard.jsx
    WeekNavigator.jsx
    ReservationGrid.jsx
    ReservationModal.jsx
    KakaoParserPanel.jsx
    StatsRow.jsx
  styles/
    global.css
```

---

## Vercel 배포

1. 이 폴더를 GitHub 저장소로 푸시합니다.
2. [Vercel](https://vercel.com) → New Project → GitHub 저장소 연결.
3. Framework: **Vite** 가 자동 감지됩니다. (`vercel.json` 포함)
4. Environment Variables 에 위 7개 `VITE_FIREBASE_*` 값을 등록합니다.
5. Deploy.

> 기존 Netlify 단일 HTML 방식에서 GitHub → Vercel 배포 구조로 전환합니다.

---

## 보안 — 다음 단계 (필수)

현재 코드는 익명 RTDB 접근을 전제로 동작합니다. 운영 단계에서는 다음을 반드시 진행하세요.

- **Firebase Auth (관리자 로그인)** 도입 — 이메일/Google 로그인 등.
- **Realtime Database Rules** 강화 — 최소한 다음과 같은 형태:

  ```json
  {
    "rules": {
      "reservations": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    }
  }
  ```

- 운영에 익숙해진 뒤 관리자 화이트리스트(`auth.token.email` 검증 등)도 고려.

`src/firebase/firebaseClient.js` 는 Auth 도입을 염두에 두고 작성되었습니다.

---

## 향후 확장 — AI 카톡 파싱 자동화

`src/utils/kakaoParsers.js` 는 다음 인터페이스를 따릅니다.

```js
parseReservationMessages(text) => {
  platform: "캠핏" | "땡큐캠핑" | null,
  newItems: Reservation[],
  cancelList: CancelItem[],
  warnings: string[]
}
```

이 형태를 유지하면 추후 다음 확장이 가능합니다.

- [ ] Gemini/Claude API 기반 자유형 카톡 메시지 파서 (`parseWithAI`)
- [ ] 카톡 대화 요약 + 예약 후보 자동 추출
- [ ] 사람이 확인 후 저장하는 **반자동 승인 플로우**
- [ ] 예약 알림 수신 자동화 (웹훅 → RTDB 임시 큐 → 관리자 승인)
- [ ] 파싱 로그 저장
- [ ] 예약 변경/취소 이력 관리

이번 작업에서 AI 연동은 **하지 않습니다**. 위는 구조만 열어둔 것입니다.

---

## 기능 체크리스트 (기존 index.html 대비)

- [x] Firebase RTDB 실시간 구독
- [x] 주간 예약 보드 / 사이트별 행
- [x] 예약 추가 / 수정 / soft delete 취소
- [x] cancelled 예약 화면 제외
- [x] 중복 예약 감지 (날짜 범위 겹침)
- [x] 주간 이동 / 점유율 / 중복 카운트
- [x] 캠핏 메시지 파싱
- [x] 땡큐캠핑 메시지 파싱
- [x] reservationId 기준 중복 저장 방지
- [x] 취소 메시지 매칭 (ID 우선, fallback 포함)
- [x] 파싱 결과 확인 후 저장
- [x] 이미지 저장 (html2canvas 동적 import — 패키지 미설치 시 안내)
- [x] 플랫폼 색상 / 모바일 대응
