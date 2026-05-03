import { useState, useEffect } from "react";

/**
 * Returns true when viewport width < 768px.
 * Re-evaluates on resize with debounce.
 */
export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(() => window.innerWidth < 768);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const handler = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setMobile(window.innerWidth < 768), 80);
    };
    window.addEventListener("resize", handler, { passive: true });
    return () => { window.removeEventListener("resize", handler); clearTimeout(timer); };
  }, []);

  return mobile;
}
