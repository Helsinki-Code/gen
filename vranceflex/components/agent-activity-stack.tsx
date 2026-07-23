"use client";

import { BadgeCheck, Clock3, ScanSearch } from "lucide-react";
import { NotificationStack, type NotificationStackItem } from "./motion/notification-stack";

const activity: NotificationStackItem[] = [
  {
    id: "icp-ready",
    title: "3 ICPs mapped from the offer",
    description: "Lead Researcher · 18 evidence signals reviewed",
    trailing: <span className="activity-success"><BadgeCheck size={14} /> ready</span>,
  },
  {
    id: "enrichment",
    title: "17 of 25 contacts verified",
    description: "Parallel enrichment · email, phone and LinkedIn checked",
    trailing: <span className="activity-running"><ScanSearch size={14} /> live</span>,
  },
  {
    id: "sequence",
    title: "Sequence planner is waiting",
    description: "Starts when the verified lead threshold is reached",
    trailing: <span className="activity-waiting"><Clock3 size={14} /> queued</span>,
  },
];

export function AgentActivityStack() {
  return <NotificationStack items={activity} className="activity-stack" />;
}
