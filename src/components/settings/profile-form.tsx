"use client";

import { useRef, useState, useEffect, useTransition } from "react";
import { useUser } from "@clerk/nextjs";
import { Camera, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateMyProfile } from "@/actions/profile";

export function ProfileForm({ initialJobTitle }: { initialJobTitle: string }) {
  const { user, isLoaded } = useUser();
  const fileRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [jobTitle, setJobTitle] = useState(initialJobTitle);

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName ?? "");
      setLastName(user.lastName ?? "");
    }
  }, [user]);

  if (!isLoaded || !user) return null;

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    startTransition(async () => {
      try {
        await user!.setProfileImage({ file });
      } catch {
        setError("Failed to update photo.");
      }
    });
  }

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await Promise.all([
          user!.update({ firstName: firstName.trim(), lastName: lastName.trim() }),
          updateMyProfile({ jobTitle }),
        ]);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } catch {
        setError("Failed to save changes.");
      }
    });
  }

  return (
    <div className="space-y-8 max-w-lg">
      <div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
          <a href="/settings" className="hover:text-foreground transition-colors">Settings</a>
          <span>/</span>
          <span className="text-foreground">Profile</span>
        </div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Your Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">Update your photo, name, and title.</p>
      </div>

      {/* Avatar */}
      <div className="flex items-center gap-5">
        <div className="relative group">
          <img
            src={user.imageUrl}
            alt={user.fullName ?? "Avatar"}
            className="w-20 h-20 rounded-full object-cover"
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={isPending}
            className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Camera className="w-5 h-5 text-white" />
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{user.fullName ?? "—"}</p>
          {jobTitle && (
            <p className="text-xs text-muted-foreground mt-0.5">{jobTitle}</p>
          )}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={isPending}
            className="text-xs text-primary hover:underline mt-1"
          >
            Change photo
          </button>
        </div>
      </div>

      {/* Fields */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">First name</label>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={isPending} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Last name</label>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={isPending} />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Job title</label>
          <Input
            placeholder="e.g. Business Analyst, Junior Consultant"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            disabled={isPending}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email</label>
          <Input value={user.primaryEmailAddress?.emailAddress ?? ""} disabled className="opacity-60" />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button onClick={handleSave} disabled={isPending} className="gap-2">
        {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
        {saved && <Check className="w-4 h-4" />}
        {saved ? "Saved" : "Save changes"}
      </Button>
    </div>
  );
}
