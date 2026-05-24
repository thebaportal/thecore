"use client";

import { useEffect, useState } from "react";
import { X, Keyboard } from "lucide-react";

const SHORTCUTS = [
  { category: "Navigation", items: [
    { keys: ["⌘", "K"], desc: "Open command bar" },
    { keys: ["G", "H"], desc: "Go to Home / Dashboard" },
    { keys: ["G", "P"], desc: "Go to Projects" },
    { keys: ["G", "T"], desc: "Go to My Tasks" },
    { keys: ["G", "M"], desc: "Go to Messages" },
    { keys: ["G", "A"], desc: "Go to Activity" },
  ]},
  { category: "Tasks", items: [
    { keys: ["C"], desc: "Create new task (on tasks page)" },
    { keys: ["⌘", "Enter"], desc: "Submit form / Save comment" },
    { keys: ["Esc"], desc: "Close dialog / Cancel" },
  ]},
  { category: "General", items: [
    { keys: ["?"], desc: "Show keyboard shortcuts" },
    { keys: ["⌘", "/"], desc: "Show keyboard shortcuts" },
  ]},
];

export function KeyboardShortcutsModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "?" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === "/" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 px-4">
        <div className="rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Keyboard className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Keyboard Shortcuts</h2>
            </div>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Shortcuts */}
          <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
            {SHORTCUTS.map((section) => (
              <div key={section.category}>
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                  {section.category}
                </h3>
                <div className="space-y-1.5">
                  {section.items.map((item) => (
                    <div key={item.desc} className="flex items-center justify-between">
                      <span className="text-sm text-foreground">{item.desc}</span>
                      <div className="flex items-center gap-1">
                        {item.keys.map((key, i) => (
                          <kbd
                            key={i}
                            className="inline-flex items-center justify-center min-w-[1.5rem] h-6 rounded border border-border bg-muted px-1.5 font-mono text-[11px] text-muted-foreground"
                          >
                            {key}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="px-5 py-3 border-t border-border bg-muted/30">
            <p className="text-xs text-muted-foreground">Press <kbd className="px-1 py-0.5 rounded border border-border bg-muted font-mono text-[10px]">?</kbd> or <kbd className="px-1 py-0.5 rounded border border-border bg-muted font-mono text-[10px]">⌘/</kbd> to toggle this panel</p>
          </div>
        </div>
      </div>
    </>
  );
}
