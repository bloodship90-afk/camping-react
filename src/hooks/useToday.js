import { useEffect, useState } from "react";
import { dateStr } from "../utils/dateUtils.js";
export function useToday() {
  const [today, setToday] = useState(() => dateStr(new Date()));
  useEffect(() => {
    const refresh = () => setToday(dateStr(new Date()));
    const timer = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return today;
}
