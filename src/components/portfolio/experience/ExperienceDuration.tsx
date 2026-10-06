"use client";

import { useEffect, useState } from "react";
import {
  formatExperienceDuration,
  isCurrentExperienceEndDate,
  type CalendarMonth
} from "@/lib/content/experienceDuration";

function getBrowserCalendarMonth(): CalendarMonth {
  const today = new Date();
  return { year: today.getFullYear(), month: today.getMonth() + 1 };
}

type ExperienceDurationProps = {
  endDate?: string;
  startDate?: string;
};

/** Keeps the static role date range server-rendered while enhancing only current durations. */
export function ExperienceDuration({ endDate, startDate }: ExperienceDurationProps) {
  const current = isCurrentExperienceEndDate(endDate);
  const staticDuration = current ? undefined : formatExperienceDuration(startDate, endDate);
  const [duration, setDuration] = useState(staticDuration);

  useEffect(() => {
    if (!current) return;

    const refresh = () => {
      if (document.visibilityState === "visible") {
        setDuration(formatExperienceDuration(startDate, undefined, getBrowserCalendarMonth()));
      }
    };

    refresh();
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, [current, startDate]);

  return duration ? <span className="experience-duration"> · {duration}</span> : null;
}
