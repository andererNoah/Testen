import type { IsoDate } from "./dates";

export type DeadlineStatus = "ok" | "warn" | "critical" | "overdue";
export type TrafficLight = "green" | "yellow" | "red";

export interface DeadlineWindow {
  dueDate: IsoDate;
  warnFrom: IsoDate;
  criticalFrom: IsoDate;
}

/** Status on `today`. The unshifted due date is decisive (no § 193 BGB grace). */
export function deadlineStatus(window: DeadlineWindow, today: IsoDate): DeadlineStatus {
  if (today > window.dueDate) return "overdue";
  if (today >= window.criticalFrom) return "critical";
  if (today >= window.warnFrom) return "warn";
  return "ok";
}

export function trafficLight(status: DeadlineStatus): TrafficLight {
  switch (status) {
    case "ok":
      return "green";
    case "warn":
      return "yellow";
    case "critical":
    case "overdue":
      return "red";
  }
}
