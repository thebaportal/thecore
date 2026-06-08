"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Check, Layers, Loader2 } from "lucide-react";
import { createProject, getPhaseTemplates } from "@/actions/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  startDate: z.string().optional(),
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

type PhaseTemplate = {
  id: string;
  name: string;
  description: string | null;
  _count: { phases: number };
};

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates?: PhaseTemplate[];
}

export function NewProjectDialog({ open, onOpenChange, templates: templatesProp = [] }: NewProjectDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<PhaseTemplate[]>(templatesProp);

  // Fetch templates when dialog opens so every caller gets them
  useEffect(() => {
    if (open && templates.length === 0) {
      getPhaseTemplates().then((t) => setTemplates(t as PhaseTemplate[]));
    }
  }, [open]);
  const [selectedColor, setSelectedColor] = useState(PROJECT_COLORS[0]!.value);
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", description: "", startDate: "", targetDate: "" },
  });

  function handleClose() {
    onOpenChange(false);
    setTimeout(() => {
      form.reset();
      setStep(1);
      setSelectedTemplateId(null);
      setSelectedEmoji(null);
      setSelectedColor(PROJECT_COLORS[0]!.value);
    }, 150);
  }

  function onSubmit(data: FormValues) {
    setSubmitError(null);
    startTransition(async () => {
      try {
        const result = await createProject({
          name: data.name,
          description: data.description,
          color: selectedColor,
          iconEmoji: selectedEmoji ?? undefined,
          startDate: data.startDate ? new Date(data.startDate) : undefined,
          targetDate: data.targetDate ? new Date(data.targetDate) : undefined,
          templateId: selectedTemplateId ?? undefined,
        });
        if (result.success) {
          handleClose();
          router.push(`/projects/${result.project.id}`);
        }
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "Failed to create project. Please try again.");
      }
    });
  }

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {step === 2 && (
              <button
                onClick={() => setStep(1)}
                className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground -ml-1"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <DialogTitle>New Project</DialogTitle>
          </div>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-4 mt-1">
            <p className="text-sm text-muted-foreground">
              Choose a template to auto-populate phases and deliverables, or start blank.
            </p>

            <div className="space-y-2">
              {/* Blank option */}
              <button
                type="button"
                onClick={() => setSelectedTemplateId(null)}
                className={cn(
                  "w-full text-left rounded-xl border p-4 transition-all flex items-start gap-3",
                  selectedTemplateId === null
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border hover:border-border/80 hover:bg-muted/40"
                )}
              >
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                  <div className="w-4 h-4 rounded border-2 border-muted-foreground/40" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">No template</p>
                    {selectedTemplateId === null && (
                      <Check className="w-4 h-4 text-primary shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Start with a blank project and add phases manually.
                  </p>
                </div>
              </button>

              {/* Template options */}
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTemplateId(t.id)}
                  className={cn(
                    "w-full text-left rounded-xl border p-4 transition-all flex items-start gap-3",
                    selectedTemplateId === t.id
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-border/80 hover:bg-muted/40"
                  )}
                >
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Layers className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground truncate">{t.name}</p>
                      {selectedTemplateId === t.id && (
                        <Check className="w-4 h-4 text-primary shrink-0" />
                      )}
                    </div>
                    {t.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground/70 mt-1.5 font-medium">
                      {t._count.phases} {t._count.phases === 1 ? "phase" : "phases"}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <Button size="sm" onClick={() => setStep(2)}>
                Next
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 mt-1">
            {/* Selected template badge */}
            {selectedTemplate && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20">
                <Layers className="w-3.5 h-3.5 text-primary shrink-0" />
                <p className="text-xs text-primary font-medium truncate">{selectedTemplate.name}</p>
                <span className="text-xs text-primary/60 shrink-0">
                  · {selectedTemplate._count.phases} phases
                </span>
              </div>
            )}

            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Name</label>
              <Input
                {...form.register("name")}
                placeholder="Project name"
                autoFocus
                className="h-9"
              />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>

            {/* Description */}
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

            {/* Color */}
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

            {/* Emoji icon */}
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

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  Start date <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <Input {...form.register("startDate")} type="date" className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  Target date <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <Input {...form.register("targetDate")} type="date" className="h-9 text-sm" />
              </div>
            </div>

            {submitError && (
              <p className="text-xs text-destructive">{submitError}</p>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={handleClose} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isPending}>
                {isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                Create Project
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
