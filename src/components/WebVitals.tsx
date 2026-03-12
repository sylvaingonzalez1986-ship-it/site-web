"use client";

import { useEffect } from "react";

type Metric = {
  name: string;
  value: number;
  rating: "good" | "needs-improvement" | "poor";
};

function getRating(name: string, value: number): Metric["rating"] {
  const thresholds: Record<string, [number, number]> = {
    LCP: [2500, 4000],
    INP: [200, 500],
    CLS: [0.1, 0.25],
    FCP: [1800, 3000],
    TTFB: [800, 1800],
  };
  const [good, poor] = thresholds[name] ?? [Infinity, Infinity];
  if (value <= good) return "good";
  if (value <= poor) return "needs-improvement";
  return "poor";
}

function observeMetric(type: string, callback: (metric: Metric) => void) {
  try {
    const po = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        let value: number;
        if (type === "largest-contentful-paint") {
          value = (entry as PerformanceEntry).startTime;
          callback({ name: "LCP", value, rating: getRating("LCP", value) });
        } else if (type === "layout-shift") {
          const lsEntry = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
          if (!lsEntry.hadRecentInput) {
            value = (lsEntry.value ?? 0) * 1000;
            callback({ name: "CLS", value: lsEntry.value ?? 0, rating: getRating("CLS", lsEntry.value ?? 0) });
          }
        } else if (type === "event") {
          const eventEntry = entry as PerformanceEntry & { processingStart?: number; duration?: number };
          value = eventEntry.duration ?? 0;
          callback({ name: "INP", value, rating: getRating("INP", value) });
        }
      }
    });
    po.observe({ type, buffered: true });
    return po;
  } catch {
    return null;
  }
}

export function WebVitals() {
  useEffect(() => {
    const observers: (PerformanceObserver | null)[] = [];

    const logMetric = (metric: Metric) => {
      if (process.env.NODE_ENV === "development") {
        const color = metric.rating === "good" ? "#0cce6b" : metric.rating === "needs-improvement" ? "#ffa400" : "#ff4e42";
        console.log(`%c[Web Vitals] ${metric.name}: ${metric.value.toFixed(metric.name === "CLS" ? 3 : 0)} (${metric.rating})`, `color: ${color}; font-weight: bold`);
      }
    };

    observers.push(observeMetric("largest-contentful-paint", logMetric));
    observers.push(observeMetric("layout-shift", logMetric));
    observers.push(observeMetric("event", logMetric));

    return () => {
      for (const o of observers) o?.disconnect();
    };
  }, []);

  return null;
}
