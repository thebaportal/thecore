"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { updateProject } from "@/actions/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  targetDate: z.string().optional(),
});
type FormValues = z.infer<typeof formSchema>;

const PROJECT_COLORS = [
  { label: "Navy",    value: "#1E3A8A" },
  { label: "Teal",    value: "#0F766E" },
  { label: "Indigo",  value: "#4F46E5" },
  { label: "Violet",  value: "#7C3AED" },
  { label: "Rose",    value: "#E11D48" },
  { label: "Amber",   value: "#D97706" },
  { label: "Emerald", value: "#059669" },
  { label: "Slate",   value: "#475569" },
];

const PROJECT_EMOJIS = ["📋", "🚀", "⚡", "🎯", "💡", "🔧", "📊", "🌟", "🛠️", "📱", "🎨", "🔬"];

type Project = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  iconEmoji: string | null;
  targetDate: Date | null;
};

export function EditProjectDialog({
  project,
  open,
  onOpenChange,
}: {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedColor, setSelectedColor] = useState(project.color ?? PROJECT_COLORS[0]!.value);
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(project.iconEmoji);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: project.name,
      description: project.description ?? "",
      targetDate: project.targetDate
        ? new Date(project.targetDate).toISOString().split("T")[0]
        : "",
    },
  });

  function handleClose() {
    onOpenChange(false);
  }

  function onSubmit(data: FormValues) {
    startTransition(async () => {
      try {
        const result = await updateProject(project.id, {
          name: data.name,
          description: data.description || undefined,
          color: selectedColor,
          iconEmoji: selectedEmoji ?? undefined,
          targetDate: data.targetDate ? new Date(data.targetDate) : undefined,
        });
        if (result.success) {
          handleClose();
          router.refresh();
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 mt-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Name</label>
            <Input {...form.register("name")} placeholder="Project name" className="h-9" autoFocus />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Description <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Textarea
              {...form.register("description")}
              placeholder="What is this project about?"
              className="resize-none h-20 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Color</label>
            <div className="flex gap-2 flex-wrap">
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  onClick={() => setSelectedColor(c.value)}
                  className={cn(
                    "w-6 h-6 rounded-full transition-all",
                    selectedColor === c.value && "ring-2 ring-offset-2 ring-foreground/30 scale-110"
                  )}
                  style={{ backgroundColor: c.value }}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Icon <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {PROJECT_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setSelectedEmoji(selectedEmoji === emoji ? null : emoji)}
                  className={cn(
                    "w-8 h-8 rounded-lg text-base flex items-center justify-center transition-all border",
                    selectedEmoji === emoji
                      ? "border-primary bg-accent"
                      : "border-transparent hover:border-border hover:bg-muted"
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Target date <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Input {...form.register("targetDate")} type="date" className="h-9 text-sm" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={handleClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
