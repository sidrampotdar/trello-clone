"use client";

import { useEffect, useState } from "react";
import { useBoardStore } from "@/lib/store";

export function AriaLiveRegion() {
  const setAnnouncer = useBoardStore((s) => s.setAnnouncer);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setAnnouncer((m) => {
      setMsg("");
      requestAnimationFrame(() => setMsg(m));
    });
  }, [setAnnouncer]);

  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {msg}
    </div>
  );
}
