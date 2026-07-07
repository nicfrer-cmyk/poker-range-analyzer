"use client";

function todayKey(metric: string): string {
  const day = new Date().toISOString().slice(0, 10);
  return `pra:usage:${metric}:${day}`;
}

export function getTodayCount(metric: string): number {
  if (typeof window === "undefined") return 0;
  return Number(window.localStorage.getItem(todayKey(metric)) ?? "0");
}

export function incrementToday(metric: string): number {
  const next = getTodayCount(metric) + 1;
  if (typeof window === "undefined") return next;
  window.localStorage.setItem(todayKey(metric), String(next));
  return next;
}
