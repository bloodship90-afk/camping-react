import { text } from "./reservationModel.js";

export function contactLinks(phone) {
  const number = text(phone).replace(/[\s().-]/g, "");
  if (!/^\+?\d{8,15}$/.test(number)) return null;
  return { call: `tel:${number}`, sms: `sms:${number}` };
}
