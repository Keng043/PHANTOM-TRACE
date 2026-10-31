"use client";

import { useEffect } from "react";
import { POLICY_VERSION } from "@/lib/security/consent";

type Signal =
  | "DECISION_CHANGE" | "DECISION_SUBMIT" | "LINK_CLICK"
  | "SCROLL_25" | "SCROLL_50" | "SCROLL_75" | "SCROLL_100"
  | "TAB_HIDDEN" | "TAB_VISIBLE" | "IDLE_30S" | "RETURNED";

function elapsedBucket(startedAt: number) {
  const seconds = (performance.now() - startedAt) / 1000;
  if (seconds < 1) return "LT_1S";
  if (seconds < 3) return "1_3S";
  if (seconds < 10) return "3_10S";
  if (seconds < 30) return "10_30S";
  if (seconds < 60) return "30_60S";
  return "GT_60S";
}

export function InteractionTracker() {
  useEffect(() => {
    let active = true;
    let enabled = false;
    let idle = false;
    const startedAt = performance.now();
    const sentScroll = new Set<number>();
    let idleTimer = 0;

    const send = (signal: Signal) => {
      if (!active || !enabled) return;
      void fetch("/api/simulation/interaction", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientEventId: crypto.randomUUID(), signal, elapsedBucket: elapsedBucket(startedAt),
        }),
        keepalive: true,
      }).catch(() => undefined);
    };

    const resetIdle = () => {
      if (idle) { idle = false; send("RETURNED"); }
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        if (!active || !enabled || document.visibilityState !== "visible") return;
        idle = true;
        send("IDLE_30S");
      }, 30_000);
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('[data-pt-track="decision-submit"]')) send("DECISION_SUBMIT");
      else if (target.closest('[data-pt-track="link"]')) send("LINK_CLICK");
      resetIdle();
    };
    const onChange = (event: Event) => {
      const target = event.target;
      if (target instanceof Element && target.closest('[data-pt-track="decision-choice"]')) send("DECISION_CHANGE");
      resetIdle();
    };
    const onScroll = () => {
      const root = document.documentElement;
      const maxScroll = Math.max(1, root.scrollHeight - window.innerHeight);
      const progress = Math.min(100, Math.round((window.scrollY / maxScroll) * 100));
      for (const threshold of [25, 50, 75, 100]) {
        if (progress >= threshold && !sentScroll.has(threshold)) {
          sentScroll.add(threshold);
          send((`SCROLL_${threshold}`) as Signal);
        }
      }
      resetIdle();
    };
    const onVisibility = () => {
      send(document.visibilityState === "hidden" ? "TAB_HIDDEN" : "TAB_VISIBLE");
      if (document.visibilityState === "visible") resetIdle();
      else window.clearTimeout(idleTimer);
    };
    const onActivity = () => resetIdle();

    void fetch("/api/simulation/consent", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!active || !data) return;
        enabled = data.capabilities?.some((item: { capability: string; granted: boolean; revokedAt: string | null; policyVersion: string }) =>
          item.capability === "INTERACTION_TRACKING" && item.granted && !item.revokedAt && item.policyVersion === POLICY_VERSION);
        if (!enabled) return;
        document.addEventListener("click", onClick, true);
        document.addEventListener("change", onChange, true);
        document.addEventListener("visibilitychange", onVisibility);
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("pointerdown", onActivity, { passive: true });
        resetIdle();
      })
      .catch(() => undefined);

    return () => {
      active = false;
      enabled = false;
      window.clearTimeout(idleTimer);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("change", onChange, true);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointerdown", onActivity);
    };
  }, []);

  return null;
}
