import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import {
  buildClientPageViewPayload,
  shouldTrackAnalyticsPath,
} from "../lib/analytics-core.mjs";

function shouldCollectInThisBrowser() {
  if (typeof window === "undefined") return false;
  if (import.meta.env.VITE_DISABLE_SITE_ANALYTICS === "1") return false;
  if (import.meta.env.VITE_ANALYTICS_DEBUG === "1") return true;
  return import.meta.env.PROD && !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);
}

function sendSitePageView() {
  if (!shouldCollectInThisBrowser()) return;
  if (!shouldTrackAnalyticsPath(window.location.pathname)) return;

  const payload = buildClientPageViewPayload({
    href: window.location.href,
    referrer: document.referrer,
  });
  const body = JSON.stringify(payload);
  const endpoint = "/api/analytics/collect";

  if (navigator.sendBeacon) {
    const accepted = navigator.sendBeacon(
      endpoint,
      new Blob([body], { type: "application/json" }),
    );
    if (accepted) return;
  }

  void fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    credentials: "same-origin",
    keepalive: true,
  }).catch(() => {
    // Analytics must never block the product experience.
  });
}

export function Observability() {
  const location = useLocation();

  useEffect(() => {
    sendSitePageView();
  }, [location.pathname, location.search]);

  return (
    <>
      <Analytics
        beforeSend={(event) => {
          if (!shouldTrackAnalyticsPath(event.url)) return null;
          return event;
        }}
      />
      <SpeedInsights />
    </>
  );
}
