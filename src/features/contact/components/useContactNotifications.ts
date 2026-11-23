"use client";

import { useCallback, useRef, useState } from "react";

export type ContactNotification = {
  id: number;
  revision: number;
  tone: "error" | "success";
  title: string;
  message: string;
};

export function useContactNotifications() {
  const sequence = useRef(0);
  const [notifications, setNotifications] = useState<ContactNotification[]>([]);
  const [announcement, setAnnouncement] = useState<ContactNotification>();

  const notify = useCallback((message: string, tone: ContactNotification["tone"] = "error") => {
    if (!message) return;
    const revision = ++sequence.current;
    const incoming = { id: revision, revision, tone, title: tone === "error" ? "Contact error" : "Request submitted", message };
    setNotifications((current) => {
      const duplicate = current.find((item) => item.tone === tone && item.message === message);
      const next = { ...incoming, id: duplicate?.id ?? incoming.id };
      return [next, ...current.filter((item) => item.id !== next.id)].slice(0, 3);
    });
    setAnnouncement(incoming);
  }, []);

  const dismiss = useCallback((id: number, revision: number) => {
    setNotifications((current) => current.filter((item) => item.id !== id || item.revision !== revision));
    setAnnouncement((current) => current?.revision === revision ? undefined : current);
  }, []);

  return { notifications, announcement, notify, dismiss };
}
