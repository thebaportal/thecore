"use client";

import { useState, useTransition } from "react";
import { User2, CalendarDays, Users2, Pencil } from "lucide-react";
import { updateProjectMeta } from "@/actions/projects";
import { cn } from "@/lib/utils";

function EditableField({
  label,
  icon: Icon,
  value,
  projectId,
  field,
  isEditable,
}: {
  label: string;
  icon: React.ElementType;
  value: string | null;
  projectId: string;
  field: "instructor" | "cohort";
  isEditable: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [, startTransition] = useTransition();

  function save() {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed === (value ?? "")) return;
    startTransition(() =>
      updateProjectMeta(projectId, { [field]: trimmed || null })
    );
  }

  return (
    <span className="flex items-center gap-1.5 group/field">
      <Icon className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
      <span className="text-xs text-muted-foreground/70">{label}:</span>
      {editing ? (
        <input
          autoFocus
          className="text-xs font-medium text-foreground bg-transparent border-b border-primary outline-none w-32 pb-px"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") { setDraft(value ?? ""); setEditing(false); }
          }}
        />
      ) : (
        <button
          onClick={() => isEditable && setEditing(true)}
          disabled={!isEditable}
          className={cn(
            "text-xs font-medium",
            value ? "text-foreground" : "text-muted-foreground/40 italic",
            isEditable && "hover:text-primary transition-colors cursor-pointer"
          )}
        >
          {value || (isEditable ? `Add ${label.toLowerCase()}` : "—")}
        </button>
      )}
      {isEditable && !editing && (
        <Pencil className="w-3 h-3 text-transparent group-hover/field:text-muted-foreground/40 transition-colors shrink-0" />
      )}
    </span>
  );
}

export function ProjectHeaderMeta({
  projectId,
  instructor,
  cohort,
  studentCount,
  isInstructor,
}: {
  projectId: string;
  instructor: string | null;
  cohort: string | null;
  studentCount: number;
  isInstructor: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
      <EditableField
        label="Instructor"
        icon={User2}
        value={instructor}
        projectId={projectId}
        field="instructor"
        isEditable={isInstructor}
      />

      <span className="text-muted-foreground/25 text-xs select-none">·</span>

      <EditableField
        label="Cohort"
        icon={CalendarDays}
        value={cohort}
        projectId={projectId}
        field="cohort"
        isEditable={isInstructor}
      />

      <span className="text-muted-foreground/25 text-xs select-none">·</span>

      <span className="flex items-center gap-1.5">
        <Users2 className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
        <span className="text-xs text-muted-foreground/70">Students:</span>
        <span className="text-xs font-medium text-foreground">{studentCount}</span>
      </span>
    </div>
  );
}
