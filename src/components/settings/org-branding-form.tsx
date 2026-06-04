"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, Upload, X, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUploadThing } from "@/lib/uploadthing";
import { updateOrgBranding } from "@/actions/org-branding";
import { cn } from "@/lib/utils";

const PRESET_COLORS = [
  "#1E3A8A", "#0F766E", "#7C3AED", "#DC2626",
  "#EA580C", "#D97706", "#16A34A", "#0369A1",
  "#1E293B", "#374151",
];

function ColorSwatch({
  color,
  selected,
  onClick,
}: {
  color: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-7 h-7 rounded-lg transition-all",
        selected ? "ring-2 ring-offset-2 ring-foreground/60 scale-110" : "hover:scale-105"
      )}
      style={{ backgroundColor: color }}
      title={color}
    />
  );
}

export function OrgBrandingForm({
  initialLogoUrl,
  initialBrandColor,
  initialSecondaryColor,
  initialDisplayName,
  orgName,
}: {
  initialLogoUrl: string | null;
  initialBrandColor: string | null;
  initialSecondaryColor: string | null;
  initialDisplayName: string | null;
  orgName: string;
}) {
  const router = useRouter();
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [logoUploading, setLogoUploading] = useState(false);
  const [brandColor, setBrandColor] = useState(initialBrandColor ?? "");
  const [secondaryColor, setSecondaryColor] = useState(initialSecondaryColor ?? "");
  const [displayName, setDisplayName] = useState(initialDisplayName ?? "");
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initials = orgName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const { startUpload } = useUploadThing("orgLogoUploader", {
    onClientUploadComplete: (res) => {
      const url = res?.[0]?.serverData?.url ?? res?.[0]?.ufsUrl;
      if (url) { setLogoUrl(url); router.refresh(); }
      setLogoUploading(false);
    },
    onUploadError: () => setLogoUploading(false),
  });

  function handleLogoFile(file: File) {
    setLogoUploading(true);
    void startUpload([file])?.catch(() => setLogoUploading(false));
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        await updateOrgBranding({
          brandColor: brandColor || null,
          secondaryColor: secondaryColor || null,
          displayName: displayName.trim() || null,
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save.");
      }
    });
  }

  function handleRemoveLogo() {
    startTransition(async () => {
      await updateOrgBranding({ logoUrl: null });
      setLogoUrl(null);
      router.refresh();
    });
  }

  const isValidHex = (v: string) => /^#[0-9a-f]{6}$/i.test(v.trim()) || v === "";

  return (
    <div className="space-y-6">
      {/* Display name */}
      <div className="space-y-2">
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Workspace display name
          </label>
          <p className="text-xs text-muted-foreground/60 mt-0.5">
            Shown in the sidebar and workspace screens. Leave blank to use your organization name.
          </p>
        </div>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder={orgName}
          maxLength={60}
          className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
        />
      </div>

      {/* Logo */}
      <div className="space-y-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Organization logo
          </label>
          <p className="text-xs text-muted-foreground/60 mt-0.5">
            Displayed in the sidebar header. PNG or SVG on a transparent or white background recommended.
          </p>
        </div>
        <input
          ref={logoInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleLogoFile(file);
            e.target.value = "";
          }}
        />
        <div className="flex items-center gap-4">
          {/* Current logo preview */}
          <div className="w-32 h-14 rounded-xl border border-border bg-card flex items-center justify-center overflow-hidden shrink-0">
            {logoUrl ? (
              <img src={logoUrl} alt={orgName} className="max-h-10 max-w-28 object-contain" />
            ) : (
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                  style={{ backgroundColor: brandColor || "#1E3A8A" }}
                >
                  {initials}
                </div>
                <span className="text-xs text-muted-foreground/40 italic">No logo</span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => logoInputRef.current?.click()}
              disabled={logoUploading}
              className="gap-1.5 h-8 w-fit"
            >
              {logoUploading
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Upload className="w-3.5 h-3.5" />}
              {logoUploading ? "Uploading…" : logoUrl ? "Replace logo" : "Upload logo"}
            </Button>
            {logoUrl && (
              <button
                type="button"
                onClick={handleRemoveLogo}
                disabled={isPending}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="w-3 h-3" /> Remove
              </button>
            )}
            <p className="text-[11px] text-muted-foreground/50">Max 4 MB · PNG, JPEG, WebP, SVG</p>
          </div>
        </div>
      </div>

      {/* Brand color */}
      <div className="space-y-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Palette className="w-3 h-3" /> Brand color
          </label>
          <p className="text-xs text-muted-foreground/60 mt-0.5">
            Used for active states, buttons, badges, and highlights across the workspace.
          </p>
        </div>

        {/* Presets */}
        <div className="flex flex-wrap gap-2">
          {PRESET_COLORS.map((c) => (
            <ColorSwatch
              key={c}
              color={c}
              selected={brandColor.toUpperCase() === c.toUpperCase()}
              onClick={() => setBrandColor(c)}
            />
          ))}
          <button
            type="button"
            onClick={() => setBrandColor("")}
            className={cn(
              "w-7 h-7 rounded-lg border-2 border-dashed border-border text-muted-foreground text-[9px] flex items-center justify-center transition-colors hover:border-foreground/40",
              !brandColor && "border-foreground/40"
            )}
            title="Use default color"
          >
            ✕
          </button>
        </div>

        {/* Hex input */}
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg border border-border shrink-0 transition-colors"
            style={{ backgroundColor: isValidHex(brandColor) && brandColor ? brandColor : "transparent" }}
          />
          <input
            type="text"
            value={brandColor}
            onChange={(e) => setBrandColor(e.target.value)}
            placeholder="#1E3A8A"
            maxLength={7}
            className={cn(
              "w-28 h-8 px-2.5 rounded-lg border text-sm font-mono bg-background text-foreground outline-none transition-all",
              !isValidHex(brandColor) && brandColor
                ? "border-destructive focus:ring-destructive/20"
                : "border-input focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
            )}
          />
          {brandColor && (
            <span className="text-[11px] text-muted-foreground/50">hex</span>
          )}
        </div>
      </div>

      {/* Secondary color */}
      <div className="space-y-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Palette className="w-3 h-3" /> Secondary accent <span className="text-muted-foreground/40 normal-case font-normal">(optional)</span>
          </label>
          <p className="text-xs text-muted-foreground/60 mt-0.5">
            Used for hover states and secondary visual treatments.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg border border-border shrink-0 transition-colors"
            style={{ backgroundColor: isValidHex(secondaryColor) && secondaryColor ? secondaryColor : "transparent" }}
          />
          <input
            type="text"
            value={secondaryColor}
            onChange={(e) => setSecondaryColor(e.target.value)}
            placeholder="#0F766E"
            maxLength={7}
            className={cn(
              "w-28 h-8 px-2.5 rounded-lg border text-sm font-mono bg-background text-foreground outline-none transition-all",
              !isValidHex(secondaryColor) && secondaryColor
                ? "border-destructive focus:ring-destructive/20"
                : "border-input focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
            )}
          />
        </div>
      </div>

      {/* Preview strip */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Preview</p>
        <div className="flex items-center gap-3">
          {/* Mini sidebar header */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border">
            {logoUrl ? (
              <img src={logoUrl} alt={orgName} className="h-5 w-auto max-w-[100px] object-contain" />
            ) : (
              <>
                <div
                  className="w-5 h-5 rounded-md flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                  style={{ backgroundColor: isValidHex(brandColor) && brandColor ? brandColor : "#1E3A8A" }}
                >
                  {initials}
                </div>
                <span className="text-xs font-medium text-foreground truncate max-w-[80px]">{orgName}</span>
              </>
            )}
          </div>

          {/* Sample active nav item */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
            style={{ backgroundColor: isValidHex(brandColor) && brandColor ? brandColor : "#1E3A8A" }}
          >
            <span>● Projects</span>
          </div>

          {/* Sample badge */}
          <div
            className="px-2 py-0.5 rounded-full text-[11px] font-semibold text-white"
            style={{ backgroundColor: isValidHex(brandColor) && brandColor ? brandColor : "#1E3A8A" }}
          >
            Active
          </div>
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex items-center gap-3">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={isPending || (!isValidHex(brandColor) && !!brandColor) || (!isValidHex(secondaryColor) && !!secondaryColor)}
        >
          {isPending ? (
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          ) : saved ? (
            <Check className="w-3.5 h-3.5 mr-1.5" />
          ) : null}
          {saved ? "Saved" : "Save branding"}
        </Button>
        {saved && <p className="text-xs text-emerald-600 font-medium">Branding updated across the workspace.</p>}
      </div>
    </div>
  );
}
