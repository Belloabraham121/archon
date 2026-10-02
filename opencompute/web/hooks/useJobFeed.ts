"use client";
import { useEffect, useState } from "react";
import { connectFeed, type FeedEvent } from "@/lib/ws/feed";

export function useJobFeed(relayUrl?: string) {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  useEffect(() => {
    if (!relayUrl) return;
    const ws = connectFeed(relayUrl, (e) => setEvents((prev) => [...prev.slice(-99), e]));
    return () => ws.close();
  }, [relayUrl]);
  return events;
}
