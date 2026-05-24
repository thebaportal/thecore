"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, MessageCircle, Camera } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { updateUserProfile } from "@/actions/users";
import { useUploadThing } from "@/lib/uploadthing";
import { cn } from "@/lib/utils";

function CardPreview({
  name,
  avatarUrl,
  jobTitle,
  bio,
  onAvatarClick,
  uploading,
}: {
  name: string;
  avatarUrl: string | null;
  jobTitle: string;
  bio: string;
  onAvatarClick?: () => void;
  uploading?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-popover shadow-md overflow-hidden text-center w-60 mx-auto">
      <div className="pt-8 pb-4 px-5 flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={onAvatarClick}
          disabled={uploading}
          className="relative group rounded-full focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          aria-label="Upload profile photo"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt={name} className="w-20 h-20 rounded-full object-cover ring-2 ring-border" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-primary/10 border-2 border-dashed border-primary/40 text-primary flex flex-col items-center justify-center gap-1">
              <Camera className="w-5 h-5 opacity-60" />
              <span className="text-[10px] font-medium opacity-60">Add photo</span>
            </div>
          )}
          <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            {uploading ? (
              <Loader2 className="w-5 h-5 text-white animate-spin" />
            ) : (
              <Camera className="w-5 h-5 text-white" />
            )}
          </div>
          {!avatarUrl && !uploading && (
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-destructive rounded-full border-2 border-background" />
          )}
        </button>

        <div>
          <p className="text-[15px] font-semibold text-foreground leading-snug">{name || "Your Name"}</p>
          {jobTitle ? (
            <p className="text-xs text-muted-foreground mt-0.5">{jobTitle}</p>
          ) : (
            <p className="text-xs text-muted-foreground/40 mt-0.5 italic">Job title</p>
          )}
        </div>
        {bio ? (
          <p className="text-xs text-foreground/60 leading-relaxed line-clamp-2">{bio}</p>
        ) : (
          <p className="text-xs text-muted-foreground/30 italic">Your bio will appear here</p>
        )}
      </div>
      <div className="border-t border-border/60 p-2">
        <div className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground bg-muted/50">
          <MessageCircle className="w-4 h-4" />
          Message {name.split(" ")[0] || "you"}
        </div>
      </div>
    </div>
  );
}

export function CoreProfileForm({
  initialJobTitle,
  initialBio,
  name,
  avatarUrl: initialAvatarUrl,
}: {
  initialJobTitle: string;
  initialBio: string;
  name: string;
  avatarUrl: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [jobTitle, setJobTitle] = useState(initialJobTitle);
  const [bio, setBio] = useState(initialBio);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { startUpload } = useUploadThing("avatarUploader", {
    onClientUploadComplete: (res) => {
      const url = res?.[0]?.serverData?.url ?? res?.[0]?.ufsUrl;
      if (url) setAvatarUrl(url);
      setAvatarUploading(false);
      router.refresh();
    },
    onUploadError: () => setAvatarUploading(false),
  });

  function handleAvatarFile(file: File) {
    setAvatarUploading(true);
    void startUpload([file])?.catch(() => setAvatarUploading(false));
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        await updateUserProfile({ jobTitle, bio });
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save.");
      }
    });
  }

  return (
    <div className="space-y-5">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleAvatarFile(file);
          e.target.value = "";
        }}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8 items-start">
        {/* Fields */}
        <div className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Job title / role
            </label>
            <Input
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g. Business Analyst · Cohort 4"
              className="h-9"
            />
            <p className="text-xs text-muted-foreground/60">Shown under your name on your profile card.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Bio
            </label>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell your team a little about yourself."
              className="text-sm resize-none h-24"
            />
            <p className="text-xs text-muted-foreground/60">Keep it to 2 sentences. Your teammates will thank you.</p>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex items-center gap-3">
            <Button size="sm" onClick={handleSave} disabled={isPending}>
              {isPending ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : saved ? (
                <Check className="w-3.5 h-3.5 mr-1.5" />
              ) : null}
              {saved ? "Saved" : "Save profile"}
            </Button>
            {saved && (
              <p className="text-xs text-emerald-600 font-medium">Changes visible to teammates.</p>
            )}
          </div>
        </div>

        {/* Live preview with clickable avatar */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">
            Preview
          </p>
          <CardPreview
            name={name}
            avatarUrl={avatarUrl}
            jobTitle={jobTitle}
            bio={bio}
            onAvatarClick={() => !avatarUploading && inputRef.current?.click()}
            uploading={avatarUploading}
          />
          <p className={cn(
            "text-[11px] text-center",
            !avatarUrl ? "text-destructive font-medium" : "text-muted-foreground/50"
          )}>
            {!avatarUrl ? "Click your photo to upload · Required" : "Click your photo to change it"}
          </p>
        </div>
      </div>
    </div>
  );
}
