// Shared Office-style file type icons used across project files and library

function WordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="8" fill="#2B579A"/>
      <rect x="24" y="7" width="17" height="34" rx="2" fill="white" fillOpacity="0.1"/>
      <line x1="26" y1="14" x2="39" y2="14" stroke="white" strokeWidth="1" strokeOpacity="0.25"/>
      <line x1="26" y1="20" x2="39" y2="20" stroke="white" strokeWidth="1" strokeOpacity="0.25"/>
      <line x1="26" y1="26" x2="39" y2="26" stroke="white" strokeWidth="1" strokeOpacity="0.25"/>
      <line x1="26" y1="32" x2="36" y2="32" stroke="white" strokeWidth="1" strokeOpacity="0.25"/>
      <rect x="7" y="7" width="21" height="34" rx="2" fill="#1A3F7A"/>
      <polyline points="11,15 14.5,31 18,20 21.5,31 25,15" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ExcelIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="8" fill="#1E7145"/>
      <rect x="24" y="7" width="17" height="34" rx="2" fill="white" fillOpacity="0.12"/>
      <line x1="32" y1="7" x2="32" y2="41" stroke="white" strokeWidth="1" strokeOpacity="0.2"/>
      <line x1="24" y1="18" x2="41" y2="18" stroke="white" strokeWidth="1" strokeOpacity="0.2"/>
      <line x1="24" y1="27" x2="41" y2="27" stroke="white" strokeWidth="1" strokeOpacity="0.2"/>
      <line x1="24" y1="36" x2="41" y2="36" stroke="white" strokeWidth="1" strokeOpacity="0.2"/>
      <rect x="7" y="7" width="21" height="34" rx="2" fill="#0B5C30"/>
      <line x1="11" y1="15" x2="22" y2="33" stroke="white" strokeWidth="3" strokeLinecap="round"/>
      <line x1="22" y1="15" x2="11" y2="33" stroke="white" strokeWidth="3" strokeLinecap="round"/>
    </svg>
  );
}

function PowerPointIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="8" fill="#C43E1C"/>
      <rect x="24" y="10" width="17" height="12" rx="2" fill="white" fillOpacity="0.15"/>
      <line x1="29" y1="27" x2="29" y2="36" stroke="white" strokeWidth="1" strokeOpacity="0.25"/>
      <line x1="23" y1="36" x2="35" y2="36" stroke="white" strokeWidth="1" strokeOpacity="0.25"/>
      <rect x="7" y="7" width="21" height="34" rx="2" fill="#962E14"/>
      <path d="M12 33 L12 15 L19.5 15 Q26 15 26 21.5 Q26 28 19.5 28 L12 28" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function PdfIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="8" fill="#E5221C"/>
      <rect x="24" y="7" width="17" height="34" rx="2" fill="white" fillOpacity="0.1"/>
      <line x1="26" y1="14" x2="39" y2="14" stroke="white" strokeWidth="1" strokeOpacity="0.2"/>
      <line x1="26" y1="20" x2="39" y2="20" stroke="white" strokeWidth="1" strokeOpacity="0.2"/>
      <rect x="7" y="7" width="21" height="34" rx="2" fill="#B01A15"/>
      <text x="17.5" y="30" textAnchor="middle" fill="white" fontSize="11" fontWeight="800" fontFamily="system-ui,Arial,sans-serif">PDF</text>
    </svg>
  );
}

function VisioIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="8" fill="#3955A3"/>
      <rect x="7" y="7" width="21" height="34" rx="2" fill="#243E8B"/>
      <polyline points="11,15 17,31 23,15" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function VideoFileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="8" fill="#7C3AED"/>
      <polygon points="16,13 37,24 16,35" fill="white" fillOpacity="0.9"/>
    </svg>
  );
}

function AudioFileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="8" fill="#DB2777"/>
      <path d="M20 13v15M20 28a5 5 0 1 0-5 5" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M20 13l12-3v11" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ImageFileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="8" fill="#0284C7"/>
      <circle cx="17" cy="18" r="4" fill="white" fillOpacity="0.85"/>
      <path d="M7 36l11-12 8 8 6-6 9 8H7z" fill="white" fillOpacity="0.85"/>
    </svg>
  );
}

function ZipIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="8" fill="#CA8A04"/>
      <rect x="7" y="7" width="21" height="34" rx="2" fill="#A16207"/>
      <text x="17.5" y="30" textAnchor="middle" fill="white" fontSize="11" fontWeight="800" fontFamily="system-ui,Arial,sans-serif">ZIP</text>
    </svg>
  );
}

function GenericFileIcon({ className, ext }: { className?: string; ext?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="8" fill="#6B7280"/>
      {ext
        ? <text x="24" y="31" textAnchor="middle" fill="white" fontSize={ext.length > 3 ? "10" : "13"} fontWeight="700" fontFamily="system-ui,Arial,sans-serif">{ext.toUpperCase()}</text>
        : <text x="24" y="31" textAnchor="middle" fill="white" fontSize="11" fontWeight="700" fontFamily="system-ui,Arial,sans-serif">FILE</text>
      }
    </svg>
  );
}

export function FileTypeIcon({
  mimeType,
  filename = "",
  className,
}: {
  mimeType: string;
  filename?: string;
  className?: string;
}) {
  if (mimeType.includes("wordprocessingml") || mimeType === "application/msword")
    return <WordIcon className={className} />;
  if (mimeType.includes("spreadsheetml") || mimeType === "application/vnd.ms-excel")
    return <ExcelIcon className={className} />;
  if (mimeType.includes("presentationml") || mimeType === "application/vnd.ms-powerpoint")
    return <PowerPointIcon className={className} />;
  if (mimeType === "application/pdf")
    return <PdfIcon className={className} />;
  if (mimeType.includes("visio") || filename.toLowerCase().endsWith(".vsdx"))
    return <VisioIcon className={className} />;
  if (mimeType.startsWith("video/"))
    return <VideoFileIcon className={className} />;
  if (mimeType.startsWith("audio/"))
    return <AudioFileIcon className={className} />;
  if (mimeType.startsWith("image/"))
    return <ImageFileIcon className={className} />;
  if (mimeType.includes("zip") || mimeType.includes("archive"))
    return <ZipIcon className={className} />;
  const ext = filename.split(".").pop() ?? "";
  return <GenericFileIcon className={className} ext={ext} />;
}
