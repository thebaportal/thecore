"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { FolderKanban, CheckSquare, CheckCircle2, MessageCircle, Paperclip, FileText, Upload, RotateCcw, X } from "lucide-react";
import type { ActivityItem } from "@/actions/activity";
import { hideActivityItem } from "@/actions/activity-hide";
import { cn } from "@/lib/utils";

function Avatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} className="w-7 h-7 rounded-full object-cover shrink-0" />;
  }
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
      <span className="text-[10px] font-semibold text-primary">{initials}</span>
    </div>
  );
}

function TimeAgo({ date }: { date: Date }) {
  return (
    <time
      dateTime={date.toISOString()}
      className="text-xs text-muted-foreground whitespace-nowrap shrink-0"
      title={date.toLocaleString()}
    >
      {formatDistanceToNow(date, { addSuffix: true })}
    </time>
  );
}

function ActivityRow({
  id,
  actor,
  at,
  icon,
  iconBg,
  children,
}: {
  id: string;
  actor: { name: string; avatarUrl: string | null };
  at: Date;
  icon: React.ReactNode;
  iconBg: string;
  children: React.ReactNode;
}) {
  const [isPending, startTransition] = useTransition();
  const [hidden, setHidden] = useState(false);
  const router = useRouter();

  if (hidden) return null;

  function dismiss(e: React.MouseEvent) {
    e.preventDefault();
    setHidden(true);
    startTransition(async () => {
      await hideActivityItem(id);
      router.refresh();
    });
  }

  return (
    <div className={cn("group flex items-start gap-3 py-3.5 border-b border-border last:border-0", isPending && "opacity-40 pointer-events-none")}>
      <div className="relative shrink-0">
        <Avatar name={actor.name} avatarUrl={actor.avatarUrl} />
        <span className={cn("absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center border-2 border-card", iconBg)}>
          {icon}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground leading-snug">{children}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <TimeAgo date={at} />
        <button
          onClick={dismiss}
          title="Remove from feed"
          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function ProjectCreatedRow({ item }: { item: Extract<ActivityItem, { kind: "project_created" }> }) {
  return (
    <ActivityRow id={item.id} actor={item.actor} at={item.at} iconBg="bg-blue-500" icon={<FolderKanban className="w-2.5 h-2.5 text-white" />}>
      <span className="font-medium">{item.actor.name}</span> created project{" "}
      <Link href={`/projects/${item.project.id}`} className="font-medium text-primary hover:underline">
        {item.project.iconEmoji && <span className="mr-1">{item.project.iconEmoji}</span>}
        {item.project.name}
      </Link>
    </ActivityRow>
  );
}

function TaskCreatedRow({ item }: { item: Extract<ActivityItem, { kind: "task_created" }> }) {
  return (
    <ActivityRow id={item.id} actor={item.actor} at={item.at} iconBg="bg-amber-500" icon={<CheckSquare className="w-2.5 h-2.5 text-white" />}>
      <span className="font-medium">{item.actor.name}</span> added task{" "}
      <Link href={`/projects/${item.project.id}/tasks`} className="font-medium text-foreground hover:text-primary hover:underline">
        {item.task.title}
      </Link>{" "}
      in{" "}
      <Link href={`/projects/${item.project.id}`} className="text-muted-foreground hover:text-foreground hover:underline">
        {item.project.name}
      </Link>
    </ActivityRow>
  );
}

function TaskDoneRow({ item }: { item: Extract<ActivityItem, { kind: "task_done" }> }) {
  return (
    <ActivityRow id={item.id} actor={item.actor} at={item.at} iconBg="bg-emerald-500" icon={<CheckCircle2 className="w-2.5 h-2.5 text-white" />}>
      <span className="font-medium">{item.actor.name}</span> completed{" "}
      <Link href={`/projects/${item.project.id}/tasks`} className="font-medium text-foreground hover:text-primary hover:underline line-through decoration-muted-foreground/50">
        {item.task.title}
      </Link>{" "}
      in{" "}
      <Link href={`/projects/${item.project.id}`} className="text-muted-foreground hover:text-foreground hover:underline">
        {item.project.name}
      </Link>
    </ActivityRow>
  );
}

function MessageSentRow({ item }: { item: Extract<ActivityItem, { kind: "message_sent" }> }) {
  const preview = item.body.length > 80 ? item.body.slice(0, 80) + "…" : item.body;
  const label = item.ping.title ?? (item.ping.type === "DIRECT" ? "a direct conversation" : "a group ping");
  return (
    <ActivityRow id={item.id} actor={item.actor} at={item.at} iconBg="bg-violet-500" icon={<MessageCircle className="w-2.5 h-2.5 text-white" />}>
      <span className="font-medium">{item.actor.name}</span> sent a message in{" "}
      <Link href={`/inbox/${item.ping.id}`} className="font-medium text-primary hover:underline">
        {label}
      </Link>
      {preview && (
        <span className="block mt-0.5 text-xs text-muted-foreground truncate">&ldquo;{preview}&rdquo;</span>
      )}
    </ActivityRow>
  );
}

function FileUploadedRow({ item }: { item: Extract<ActivityItem, { kind: "file_uploaded" }> }) {
  return (
    <ActivityRow id={item.id} actor={item.actor} at={item.at} iconBg="bg-teal-500" icon={<Paperclip className="w-2.5 h-2.5 text-white" />}>
      <span className="font-medium">{item.actor.name}</span> uploaded{" "}
      <span className="font-medium text-foreground">{item.fileName}</span>{" "}
      to{" "}
      <Link href={`/projects/${item.project.id}/files`} className="text-muted-foreground hover:text-foreground hover:underline">
        {item.project.name}
      </Link>
    </ActivityRow>
  );
}

function DocCreatedRow({ item }: { item: Extract<ActivityItem, { kind: "doc_created" }> }) {
  return (
    <ActivityRow id={item.id} actor={item.actor} at={item.at} iconBg="bg-indigo-500" icon={<FileText className="w-2.5 h-2.5 text-white" />}>
      <span className="font-medium">{item.actor.name}</span> created doc{" "}
      <Link href={`/projects/${item.project.id}/docs/${item.docId}`} className="font-medium text-primary hover:underline">
        {item.emoji && <span className="mr-1">{item.emoji}</span>}
        {item.docTitle}
      </Link>{" "}
      in{" "}
      <Link href={`/projects/${item.project.id}`} className="text-muted-foreground hover:text-foreground hover:underline">
        {item.project.name}
      </Link>
    </ActivityRow>
  );
}

function DeliverableSubmittedRow({ item }: { item: Extract<ActivityItem, { kind: "deliverable_submitted" }> }) {
  return (
    <ActivityRow id={item.id} actor={item.actor} at={item.at} iconBg="bg-amber-500" icon={<Upload className="w-2.5 h-2.5 text-white" />}>
      <span className="font-medium">{item.actor.name}</span> submitted{" "}
      <Link href={`/projects/${item.project.id}/phases`} className="font-medium text-foreground hover:text-primary hover:underline">
        {item.deliverableTitle}
      </Link>{" "}
      <span className="text-muted-foreground">
        · Phase {item.phaseOrder} in{" "}
        <Link href={`/projects/${item.project.id}`} className="hover:text-foreground hover:underline">
          {item.project.name}
        </Link>
      </span>
    </ActivityRow>
  );
}

function DeliverableReviewedRow({ item }: { item: Extract<ActivityItem, { kind: "deliverable_reviewed" }> }) {
  const approved = item.decision === "APPROVED";
  return (
    <ActivityRow
      id={item.id}
      actor={item.actor}
      at={item.at}
      iconBg={approved ? "bg-emerald-500" : "bg-amber-500"}
      icon={approved
        ? <CheckCircle2 className="w-2.5 h-2.5 text-white" />
        : <RotateCcw className="w-2.5 h-2.5 text-white" />
      }
    >
      <span className="font-medium">{item.actor.name}</span>{" "}
      {approved ? (
        <span className="text-emerald-600 font-medium">approved</span>
      ) : (
        <span className="text-amber-600 font-medium">requested revision on</span>
      )}{" "}
      <Link href={`/projects/${item.project.id}/phases`} className="font-medium text-foreground hover:text-primary hover:underline">
        {item.deliverableTitle}
      </Link>{" "}
      <span className="text-muted-foreground">
        · Phase {item.phaseOrder} in{" "}
        <Link href={`/projects/${item.project.id}`} className="hover:text-foreground hover:underline">
          {item.project.name}
        </Link>
      </span>
      {item.note && (
        <span className="block mt-0.5 text-xs text-muted-foreground truncate">&ldquo;{item.note}&rdquo;</span>
      )}
    </ActivityRow>
  );
}

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-12 flex flex-col items-center justify-center gap-2">
        <p className="text-sm font-medium text-foreground">No activity yet</p>
        <p className="text-xs text-muted-foreground">Create a project or task to get started.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card divide-y divide-border px-4">
      {items.map((item) => {
        switch (item.kind) {
          case "project_created":        return <ProjectCreatedRow       key={item.id} item={item} />;
          case "task_created":           return <TaskCreatedRow          key={item.id} item={item} />;
          case "task_done":              return <TaskDoneRow             key={item.id} item={item} />;
          case "message_sent":           return <MessageSentRow          key={item.id} item={item} />;
          case "file_uploaded":          return <FileUploadedRow         key={item.id} item={item} />;
          case "doc_created":            return <DocCreatedRow           key={item.id} item={item} />;
          case "deliverable_submitted":  return <DeliverableSubmittedRow key={item.id} item={item} />;
          case "deliverable_reviewed":   return <DeliverableReviewedRow  key={item.id} item={item} />;
        }
      })}
    </div>
  );
}
