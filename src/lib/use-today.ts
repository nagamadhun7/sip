import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { localDay } from "./model";
export function useToday() {
  const [day, setDay] = useState(() => localDay());
  useEffect(() => {
    const refresh = () => setDay(localDay());
    const timer = setInterval(refresh, 30000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);
  return day;
}
