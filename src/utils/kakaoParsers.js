import { toDate } from "./dateUtils.js";

// ─────────────────────────────────────────────────────────────
// Parser Interface
// ─────────────────────────────────────────────────────────────
// parseReservationMessages(text) => {
//   platform: "캠핏" | "땡큐캠핑" | null,
//   newItems: Reservation[],
//   cancelList: CancelItem[],
//   warnings: string[]
// }
//
// 향후 확장 (TODO):
// - Gemini/Claude API 기반 자유형 카톡 메시지 파서 (parseWithAI)
// - 사람이 확인 후 저장하는 반자동 승인 플로우
// - 파싱 로그 저장
// - 예약 변경/취소 이력 관리
// ─────────────────────────────────────────────────────────────

export function fmtPhone(p) {
  p = (p || "").replace(/\D/g, "");
  if (p.length === 11) return `${p.slice(0, 3)}-${p.slice(3, 7)}-${p.slice(7)}`;
  if (p.length === 10) return `${p.slice(0, 3)}-${p.slice(3, 6)}-${p.slice(6)}`;
  return p;
}

function mapSiteCamfit(zone) {
  const z = zone.replace(/[\u{1F300}-\u{1FFFF}]/gu, "").toUpperCase().trim();
  const m = z.match(/NO\s*KIDS\s*-\s*([A-C])\s*(?:[\/])?\s*-?\s*0?(\d+)/i);
  if (m) return m[1].toUpperCase() + m[2];
  return null;
}

export function detectPlatform(text) {
  if (text.includes("[땡큐캠핑]")) return "땡큐캠핑";
  if (
    text.includes("신규 예약이 성사되었습니다") ||
    text.includes("예약취소 알림")
  )
    return "캠핏";
  return null;
}

function getCutoff() {
  const c = new Date();
  c.setDate(c.getDate() - 30);
  return c;
}

function parseCamfit(text) {
  const newItems = {};
  const cancelList = [];
  const cutoff = getCutoff();

  const re =
    /신규 예약이 성사되었습니다[.。]?\s*\n+예약번호 : (\S+)\s*\n캠핑존 : (.+?)\s*\n입실일자 : (\d{4})\/(\d+)\/(\d+)[^\n]*\((\d+)박\)\s*\n고객정보 : (.+?) \/ (\d+)/g;
  for (const m of text.matchAll(re)) {
    const [, num, zone, y, mo, d, nights, name, phone] = m;
    const checkin = `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
    if (toDate(checkin) < cutoff) continue;
    newItems[num] = {
      reservationId: num,
      name: name.trim(),
      site: mapSiteCamfit(zone),
      checkin,
      nights: parseInt(nights),
      phone: fmtPhone(phone),
      platform: "캠핏",
      status: "active",
    };
  }

  const cancelRe =
    /예약취소 알림[\s\S]*?예약번호 : (\S+)\s*\n캠핑존 : (.+?)\s*\n예약일자 : (\d{4})\/(\d+)\/(\d+)[^\n]*\n고객정보 : (.+?) \/ (\d+)/g;
  for (const m of text.matchAll(cancelRe)) {
    const [, num, , y, mo, d, name, phone] = m;
    const checkin = `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
    cancelList.push({
      reservationId: num,
      name: name.trim(),
      phone: fmtPhone(phone),
      checkin,
    });
    delete newItems[num];
  }

  const simpleRe = /예약취소 알림[\s\S]*?예약번호 : (\S+)/g;
  for (const m of text.matchAll(simpleRe)) {
    const num = m[1];
    if (newItems[num]) {
      const r = newItems[num];
      cancelList.push({
        reservationId: num,
        name: r.name,
        phone: r.phone,
        checkin: r.checkin,
      });
      delete newItems[num];
    } else if (!cancelList.some((c) => c.reservationId === num)) {
      cancelList.push({ reservationId: num, name: "", phone: "", checkin: "" });
    }
  }

  return { newItems: Object.values(newItems), cancelList };
}

function parseThanku(text) {
  const newItems = {};
  const cancelList = [];
  const cutoff = getCutoff();

  const blocks = text.split(/(?=\[땡큐캠핑\] 예약)/);
  for (const block of blocks) {
    const isCancel = block.includes("예약 취소 안내");
    const isConfirm =
      block.includes("예약 확정 안내") || block.includes("예약 신청 안내");
    if (!isCancel && !isConfirm) continue;

    const dateM = block.match(/- 예약일자 : (\d{4}-\d{2}-\d{2})/);
    const siteM = block.match(/- 사이트명 : .+?\(([A-C]\d)\/(\d+)박\)/);
    const numM = block.match(/- 예약번호 : (\d+)/);
    const nameM = block.match(/- 예약자명 : (.+)/);
    const phoneM = block.match(/- 전화번호 : ([\d\-]+)/);

    if (!dateM || !numM) continue;
    const checkin = dateM[1];
    const num = numM[1];
    if (toDate(checkin) < cutoff) continue;

    const name = nameM ? nameM[1].trim() : "";
    const phone = phoneM ? phoneM[1].trim() : "";

    if (isCancel) {
      cancelList.push({ reservationId: num, name, phone, checkin });
      continue;
    }
    if (!siteM || !nameM || !phoneM) continue;
    newItems[num] = {
      reservationId: num,
      name,
      site: siteM[1],
      checkin,
      nights: parseInt(siteM[2]),
      phone,
      platform: "땡큐캠핑",
      status: "active",
    };
  }

  return { newItems: Object.values(newItems), cancelList };
}

// 통합 진입점 — 향후 AI 파서로 교체/확장 가능
export function parseReservationMessages(text) {
  const warnings = [];
  if (!text || !text.trim()) {
    return { platform: null, newItems: [], cancelList: [], warnings };
  }
  const platform = detectPlatform(text);
  if (!platform) {
    warnings.push("플랫폼 감지 실패 — 메시지 형식 변경 가능성");
    return { platform: null, newItems: [], cancelList: [], warnings };
  }
  const result = platform === "캠핏" ? parseCamfit(text) : parseThanku(text);
  return { platform, ...result, warnings };
}

// TODO(AI): 추후 Gemini/Claude API 호출 기반의 파서 추가
// export async function parseWithAI(text) { ... }
