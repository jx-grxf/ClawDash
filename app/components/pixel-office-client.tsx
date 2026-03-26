"use client";

import { useEffect, useMemo, useState } from "react";
import type { AgentSummary } from "@/lib/openclaw-types";

type Room = {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  tint: string;
};

const rooms: Room[] = [
  { id: "welcome", name: "Welcome Deck", x: 2, y: 2, w: 16, h: 10, tint: "#f2d4c4" },
  { id: "ops", name: "Ops Room", x: 20, y: 2, w: 18, h: 10, tint: "#cfe0c8" },
  { id: "models", name: "Model Lab", x: 40, y: 2, w: 18, h: 10, tint: "#d5ddf7" },
  { id: "focus", name: "Focus Wing", x: 60, y: 2, w: 16, h: 10, tint: "#f4e5bd" },
  { id: "sessions", name: "Session Hall", x: 2, y: 16, w: 22, h: 12, tint: "#f0d8e5" },
  { id: "meeting", name: "Meeting Grid", x: 26, y: 16, w: 18, h: 12, tint: "#d5e9e5" },
  { id: "server", name: "Server Vault", x: 46, y: 16, w: 14, h: 12, tint: "#d3d3d3" },
  { id: "lounge", name: "Lounge", x: 62, y: 16, w: 14, h: 12, tint: "#edd8bc" },
  { id: "archive", name: "Archive", x: 12, y: 30, w: 22, h: 10, tint: "#d7d0ef" },
  { id: "studio", name: "Build Studio", x: 36, y: 30, w: 26, h: 10, tint: "#cbe7f1" },
];

function hash(input: string): number {
  return Array.from(input).reduce((acc, char) => acc * 31 + char.charCodeAt(0), 7);
}

function pickRoom(agent: AgentSummary): Room {
  if (agent.platforms.includes("telegram")) return rooms.find((room) => room.id === "sessions") || rooms[0];
  if (agent.model.includes("openai")) return rooms.find((room) => room.id === "models") || rooms[0];
  if (agent.state === "working") return rooms.find((room) => room.id === "studio") || rooms[0];
  if (agent.state === "online") return rooms.find((room) => room.id === "ops") || rooms[0];
  if (agent.state === "idle") return rooms.find((room) => room.id === "lounge") || rooms[0];
  return rooms.find((room) => room.id === "archive") || rooms[0];
}

export function PixelOfficeClient({ initialAgents }: { initialAgents: AgentSummary[] }) {
  const [agents, setAgents] = useState<AgentSummary[]>(initialAgents);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let active = true;
    const interval = window.setInterval(async () => {
      try {
        const response = await fetch("/api/config", { cache: "no-store" });
        const payload = await response.json();
        if (active && Array.isArray(payload.agents)) setAgents(payload.agents);
      } catch {}
    }, 10000);

    const animation = window.setInterval(() => setTick((value) => value + 1), 1600);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.clearInterval(animation);
    };
  }, []);

  const avatars = useMemo(() => {
    return agents.map((agent, index) => {
      const room = pickRoom(agent);
      const seed = hash(`${agent.id}-${tick}-${index}`);
      const x = room.x + 1 + (seed % Math.max(room.w - 3, 1));
      const y = room.y + 2 + (Math.floor(seed / 7) % Math.max(room.h - 4, 1));
      return { agent, room, x, y };
    });
  }, [agents, tick]);

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-[var(--border)] bg-[var(--card-strong)] p-6">
        <h2 className="text-2xl font-semibold">Pixel Office</h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Großes Office mit mehreren Räumen. Agents wandern je nach Aktivität und Rolle durch die Zonen.
        </p>
      </div>

      <div className="overflow-x-auto rounded-[30px] border border-[var(--border)] bg-[#f8f2ea] p-4 shadow-[0_24px_80px_rgba(77,48,26,0.08)]">
        <div
          className="relative mx-auto rounded-[24px] border border-[#8d7d70] bg-[#efe6db]"
          style={{
            width: 78 * 18,
            height: 42 * 18,
            backgroundImage: "linear-gradient(rgba(90,72,58,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(90,72,58,0.08) 1px, transparent 1px)",
            backgroundSize: "18px 18px",
          }}
        >
          <div className="absolute left-[18px] right-[18px] top-[234px] h-[18px] rounded-full bg-[#d8c5b2]" />
          <div className="absolute bottom-[162px] left-[216px] right-[216px] h-[18px] rounded-full bg-[#d8c5b2]" />

          {rooms.map((room) => (
            <div
              key={room.id}
              className="absolute rounded-[20px] border border-[#7d6b5d] shadow-[inset_0_0_0_2px_rgba(255,255,255,0.35)]"
              style={{
                left: room.x * 18,
                top: room.y * 18,
                width: room.w * 18,
                height: room.h * 18,
                background: room.tint,
              }}
            >
              <div className="p-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#5c4b40]">{room.name}</div>
            </div>
          ))}

          {avatars.map(({ agent, room, x, y }) => (
            <div
              key={agent.id}
              className="absolute transition-all duration-1000 ease-in-out"
              style={{ left: x * 18, top: y * 18 }}
              title={`${agent.name} · ${room.name}`}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#57473c] bg-[#f8efe6] text-lg shadow">
                {agent.emoji}
              </div>
              <div className="mt-1 rounded-full bg-black/70 px-2 py-0.5 text-center text-[10px] text-white">
                {agent.name}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {agents.map((agent) => (
          <article key={agent.id} className="rounded-[22px] border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-2xl">{agent.emoji}</div>
                <h3 className="mt-2 font-semibold">{agent.name}</h3>
              </div>
              <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs">{agent.state}</span>
            </div>
            <p className="mt-3 text-sm text-[var(--text-muted)]">{pickRoom(agent).name}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
