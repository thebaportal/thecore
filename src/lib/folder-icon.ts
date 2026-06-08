import {
  FileText, ClipboardList, ClipboardCheck, GitBranch,
  Share2, Table2, Target, BarChart2, ImageIcon, HelpCircle,
  Users, Calendar, ShieldAlert, Layers, Files, BookOpen,
  type LucideIcon,
} from "lucide-react";

export type FolderIconStyle = {
  Icon: LucideIcon;
  iconColor: string;
  bgColor: string;
  borderColor: string;
};

const RULES: Array<{ pattern: RegExp; style: FolderIconStyle }> = [
  // Testing / QA
  {
    pattern: /test|qa\b|quality|defect|bug/i,
    style: { Icon: ClipboardCheck, iconColor: "#D97706", bgColor: "#FFFBEB", borderColor: "#FDE68A" },
  },
  // Logo / branding / image / visual
  {
    pattern: /logo|brand|image|photo|visual|graphic|design asset/i,
    style: { Icon: ImageIcon, iconColor: "#0D9488", bgColor: "#F0FDFA", borderColor: "#99F6E4" },
  },
  // Process / flow / workflow / BPMN
  {
    pattern: /process|flow|workflow|bpmn|sequence|pipeline/i,
    style: { Icon: GitBranch, iconColor: "#16A34A", bgColor: "#F0FDF4", borderColor: "#BBF7D0" },
  },
  // Swimlane diagrams
  {
    pattern: /swimlane|swim.?lane/i,
    style: { Icon: Layers, iconColor: "#16A34A", bgColor: "#F0FDF4", borderColor: "#BBF7D0" },
  },
  // Use case (must come before generic "diagram" rule)
  {
    pattern: /use.?case/i,
    style: { Icon: Users, iconColor: "#4F46E5", bgColor: "#EEF2FF", borderColor: "#C7D2FE" },
  },
  // Diagrams / UML / architecture
  {
    pattern: /diagram|uml|entity|class diagram|architecture|wireframe|mockup/i,
    style: { Icon: Share2, iconColor: "#7C3AED", bgColor: "#F5F3FF", borderColor: "#DDD6FE" },
  },
  // RACI / matrix / responsibility
  {
    pattern: /raci|matrix|responsibi/i,
    style: { Icon: Table2, iconColor: "#0D9488", bgColor: "#F0FDFA", borderColor: "#99F6E4" },
  },
  // Report / summary / final
  {
    pattern: /report|summary|final|retrospective|post.?mortem/i,
    style: { Icon: BarChart2, iconColor: "#2563EB", bgColor: "#EFF6FF", borderColor: "#BFDBFE" },
  },
  // Mandate / charter / scope / brief
  {
    pattern: /mandate|charter|scope|brief|objective|goal/i,
    style: { Icon: Target, iconColor: "#EA580C", bgColor: "#FFF7ED", borderColor: "#FED7AA" },
  },
  // Elicitation / questions / interview / survey
  {
    pattern: /elicitation|interview|questionnaire|survey|question/i,
    style: { Icon: HelpCircle, iconColor: "#7C3AED", bgColor: "#F5F3FF", borderColor: "#DDD6FE" },
  },
  // Requirements / specification (functional, non-functional, business)
  {
    pattern: /requirement|specification|spec\b|functional|non.?functional|business req/i,
    style: { Icon: ClipboardList, iconColor: "#0284C7", bgColor: "#F0F9FF", borderColor: "#BAE6FD" },
  },
  // Risk / issues / constraints
  {
    pattern: /risk|issue|constraint|assumption/i,
    style: { Icon: ShieldAlert, iconColor: "#DC2626", bgColor: "#FEF2F2", borderColor: "#FECACA" },
  },
  // Planning / schedule / timeline / roadmap
  {
    pattern: /plan|schedule|timeline|roadmap|gantt|sprint/i,
    style: { Icon: Calendar, iconColor: "#7C3AED", bgColor: "#F5F3FF", borderColor: "#DDD6FE" },
  },
  // Meeting / minutes / agenda
  {
    pattern: /meeting|minutes|agenda/i,
    style: { Icon: Users, iconColor: "#0284C7", bgColor: "#F0F9FF", borderColor: "#BAE6FD" },
  },
  // Reference / knowledge / library / guide
  {
    pattern: /reference|knowledge|guide|handbook|manual|policy/i,
    style: { Icon: BookOpen, iconColor: "#0284C7", bgColor: "#F0F9FF", borderColor: "#BAE6FD" },
  },
  // Other / misc / general
  {
    pattern: /other|misc|general|document/i,
    style: { Icon: Files, iconColor: "#DB2777", bgColor: "#FDF2F8", borderColor: "#FBCFE8" },
  },
  // Plain "doc" / text document fallback (before the catch-all)
  {
    pattern: /doc\b|text|note/i,
    style: { Icon: FileText, iconColor: "#2563EB", bgColor: "#EFF6FF", borderColor: "#BFDBFE" },
  },
];

const DEFAULT: FolderIconStyle = {
  Icon: FileText,
  iconColor: "#2563EB",
  bgColor: "#EFF6FF",
  borderColor: "#BFDBFE",
};

export function getFolderIcon(name: string): FolderIconStyle {
  for (const { pattern, style } of RULES) {
    if (pattern.test(name)) return style;
  }
  return DEFAULT;
}
