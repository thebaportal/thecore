import { ExternalLink, Printer } from "lucide-react";

export const metadata = { title: "Help — The Core" };

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-lg font-semibold text-foreground border-b border-border pb-2 mb-4">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground mb-2">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="space-y-1.5 pl-1">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-sm text-foreground/80">
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-semibold flex items-center justify-center mt-0.5">
            {i + 1}
          </span>
          <span dangerouslySetInnerHTML={{ __html: item }} />
        </li>
      ))}
    </ol>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-lg bg-primary/5 border border-primary/15 px-4 py-3">
      <span className="text-primary font-bold text-sm shrink-0 mt-px">Note</span>
      <p className="text-sm text-foreground/80 leading-relaxed">{children}</p>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3">
      <span className="text-emerald-700 font-bold text-sm shrink-0 mt-px">Tip</span>
      <p className="text-sm text-emerald-900 leading-relaxed">{children}</p>
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="rounded-lg border border-border overflow-hidden text-sm">
      <table className="w-full">
        <thead>
          <tr className="bg-muted/50">
            {headers.map((h) => (
              <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2.5 text-foreground/80 border-b border-border/50 last:border-b-0">
                  {j === 0 ? <span className="font-medium text-foreground">{cell}</span> : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const TOC = [
  { id: "overview",   label: "Navigation Overview" },
  { id: "projects",   label: "Projects" },
  { id: "tasks",      label: "Tasks" },
  { id: "inbox",      label: "Inbox & Messaging" },
  { id: "knowledge",  label: "Library & Templates" },
  { id: "team",       label: "Team & People" },
  { id: "settings",   label: "Settings & Administration" },
  { id: "tips",       label: "Tips & Shortcuts" },
];

export default function HelpPage() {
  return (
    <div className="max-w-4xl mx-auto pb-20">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-10">
        <div>
          <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-1">User Guide</p>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">The Core</h1>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed max-w-xl">
            A complete reference for managing projects, knowledge, tasks, and team communication inside The Core.
          </p>
        </div>
        <a
          href="/thecore-guide.html"
          target="_blank"
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card hover:bg-muted transition-colors text-sm font-medium text-foreground shrink-0"
        >
          <Printer className="w-4 h-4" />
          Export PDF
        </a>
      </div>

      <div className="flex gap-10">

        {/* Table of Contents — sticky left panel */}
        <aside className="hidden lg:block w-48 shrink-0">
          <div className="sticky top-6">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">On this page</p>
            <nav className="space-y-1">
              {TOC.map(({ id, label }) => (
                <a
                  key={id}
                  href={`#${id}`}
                  className="block text-xs text-muted-foreground hover:text-foreground transition-colors py-0.5"
                >
                  {label}
                </a>
              ))}
            </nav>
            <div className="mt-6 pt-4 border-t border-border">
              <a
                href="/thecore-guide.html"
                target="_blank"
                className="flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                Open PDF version
              </a>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 space-y-12">

          {/* Navigation Overview */}
          <Section id="overview" title="Navigation Overview">
            <p className="text-sm text-foreground/80 leading-relaxed">
              The sidebar on the left provides access to every area of The Core. It can be collapsed to icon-only mode by clicking the <strong>‹</strong> toggle at the top-right edge of the sidebar.
            </p>
            <Table
              headers={["Section", "Purpose"]}
              rows={[
                ["Home", "Personal dashboard with activity feed and quick links"],
                ["Projects", "All active projects within your organisation"],
                ["My Tasks", "Every task assigned to you, across all projects"],
                ["Inbox", "Direct messages and project group chats"],
                ["Library", "Shared documents and files for the whole organisation"],
                ["Templates", "Reusable document templates"],
                ["Team", "All members in your organisation"],
                ["Activity", "A live feed of everything happening across the platform"],
                ["Settings", "Profile, organisation settings, and Basecamp import tools"],
                ["Help", "This guide"],
              ]}
            />
          </Section>

          {/* Projects */}
          <Section id="projects" title="Projects">
            <p className="text-sm text-foreground/80 leading-relaxed">
              Projects are the primary unit of work in The Core. Each project has its own tasks, posts, chat, files, and team.
            </p>

            <SubSection title="Opening a project">
              <Steps items={[
                "Click <strong>Projects</strong> in the sidebar.",
                "Click any project card to open it.",
                "Use the <strong>← All projects</strong> link at the top of the page to return to the list.",
              ]} />
            </SubSection>

            <SubSection title="Project tabs">
              <Table
                headers={["Tab", "Contents"]}
                rows={[
                  ["Overview", "Project mandate, description, status, and key metadata"],
                  ["Tasks", "To-do items with assignees, priorities, and due dates"],
                  ["Posts", "Long-form announcements and updates from the team"],
                  ["Messages", "The project's group chat (Campfire)"],
                  ["Files", "Uploaded documents organised into folders"],
                  ["Team", "Members assigned to this project"],
                  ["Phases", "Milestone phases with deliverables (instructor-managed)"],
                ]}
              />
            </SubSection>

            <SubSection title="Creating a project">
              <Steps items={[
                "Click <strong>Projects</strong> in the sidebar.",
                "Click <strong>+ New Project</strong>.",
                "Enter a name, description, colour, and icon.",
                "Click <strong>Create</strong>.",
              ]} />
            </SubSection>

            <Note>Only Admins and Owners can create and archive projects. Members can view and contribute to projects they are assigned to.</Note>
          </Section>

          {/* Tasks */}
          <Section id="tasks" title="Tasks">
            <p className="text-sm text-foreground/80 leading-relaxed">
              Tasks track individual pieces of work. They can be created inside a project or viewed in aggregate from <strong>My Tasks</strong>.
            </p>

            <SubSection title="Creating a task">
              <Steps items={[
                "Open a project and go to the <strong>Tasks</strong> tab.",
                "Click <strong>+ New Task</strong>.",
                "Enter a title, then optionally set an assignee, priority, due date, and description.",
                "Click <strong>Save</strong>.",
              ]} />
            </SubSection>

            <SubSection title="Task priorities">
              <Table
                headers={["Priority", "When to use"]}
                rows={[
                  ["Critical", "Blocking — must be resolved immediately"],
                  ["High", "Important — complete before lower-priority items"],
                  ["Medium", "Standard priority (default)"],
                  ["Low", "Nice-to-have — complete when capacity allows"],
                ]}
              />
            </SubSection>

            <SubSection title="Task statuses">
              <Table
                headers={["Status", "Meaning"]}
                rows={[
                  ["To Do", "Not yet started"],
                  ["In Progress", "Actively being worked on"],
                  ["In Review", "Awaiting feedback or approval"],
                  ["Done", "Complete"],
                ]}
              />
            </SubSection>

            <Tip>Use <strong>My Tasks</strong> in the sidebar to see every task assigned to you across all projects, sorted by due date.</Tip>
          </Section>

          {/* Inbox */}
          <Section id="inbox" title="Inbox & Messaging">
            <p className="text-sm text-foreground/80 leading-relaxed">
              The Inbox handles all direct messages (DMs) and project group chats. Messages support basic markdown formatting.
            </p>

            <SubSection title="Starting a direct message">
              <Steps items={[
                "Click <strong>Inbox</strong> in the sidebar.",
                "Click the compose icon or search for a person by name.",
                "Type your message and press <strong>Enter</strong> to send.",
              ]} />
            </SubSection>

            <SubSection title="Sending a message in project chat">
              <Steps items={[
                "Open a project and go to the <strong>Messages</strong> tab.",
                "Type your message in the input bar at the bottom.",
                "Press <strong>Enter</strong> to send, or <strong>Shift + Enter</strong> for a new line.",
              ]} />
            </SubSection>

            <SubSection title="Message actions">
              <p className="text-sm text-foreground/80">Hover over any message to reveal the action toolbar:</p>
              <Table
                headers={["Action", "How to use"]}
                rows={[
                  ["React", "Click the 😊 icon and select an emoji"],
                  ["Reply", "Click Reply to quote the message in your response"],
                  ["Edit", "Click the pencil icon (own messages only)"],
                  ["Delete", "Click the bin icon (own messages only)"],
                ]}
              />
            </SubSection>

            <SubSection title="Formatting messages">
              <Table
                headers={["Syntax", "Result"]}
                rows={[
                  ["**text**", "Bold"],
                  ["*text*", "Italic"],
                  ["> text", "Block quote"],
                  ["@Name", "Mention a person — click to open their profile"],
                ]}
              />
            </SubSection>

            <SubSection title="AI tools in chat">
              <p className="text-sm text-foreground/80">Two AI actions appear at the top of every chat thread:</p>
              <Table
                headers={["Button", "What it does"]}
                rows={[
                  ["Summarize", "Generates a concise summary of the conversation"],
                  ["Suggest tasks", "Extracts action items and lets you add them as project tasks"],
                ]}
              />
            </SubSection>
          </Section>

          {/* Library & Templates */}
          <Section id="knowledge" title="Library & Templates">
            <p className="text-sm text-foreground/80 leading-relaxed">
              The Library stores shared documents accessible to the whole organisation. Templates provides reusable starting points for common document types.
            </p>

            <SubSection title="Creating a document">
              <Steps items={[
                "Click <strong>Library</strong> (or <strong>Templates</strong>) in the sidebar.",
                "Open or create a folder by clicking <strong>+ New Folder</strong>.",
                "Inside the folder, click <strong>+ New Document</strong>.",
                "Write your content and click <strong>Save</strong>.",
              ]} />
            </SubSection>

            <SubSection title="Using a template">
              <Steps items={[
                "Click <strong>Templates</strong> in the sidebar.",
                "Open the relevant folder and click a template card.",
                "Click <strong>Use Template</strong> to create a new document pre-filled with the template content.",
              ]} />
            </SubSection>

            <Note>Templates can only be created and managed by Admins and Owners. Members can use templates but not edit them.</Note>
          </Section>

          {/* Team & People */}
          <Section id="team" title="Team & People">
            <p className="text-sm text-foreground/80 leading-relaxed">
              The Team page lists every member in your organisation. Profile cards provide quick access to contact information and messaging.
            </p>

            <SubSection title="Viewing a profile card">
              <p className="text-sm text-foreground/80">Click any avatar or @mention anywhere in the app. The profile card shows:</p>
              <ul className="space-y-1 pl-4">
                {["Full name, job title, and organisation", "Bio (if set)", "Number of projects", "A Message button to start a DM"].map((item) => (
                  <li key={item} className="text-sm text-foreground/80 list-disc">{item}</li>
                ))}
              </ul>
            </SubSection>

            <SubSection title="Updating your profile">
              <Steps items={[
                "Click <strong>Settings</strong> in the sidebar.",
                "Select <strong>Profile</strong>.",
                "Update your name, job title, bio, or profile photo.",
                "Click <strong>Save</strong>.",
              ]} />
            </SubSection>
          </Section>

          {/* Settings & Administration */}
          <Section id="settings" title="Settings & Administration">
            <p className="text-sm text-foreground/80 leading-relaxed">
              Administrators have access to organisation-wide settings, including the Basecamp import pipeline.
            </p>

            <SubSection title="Basecamp import">
              <Steps items={[
                "Click <strong>Settings → Basecamp</strong>.",
                "Click <strong>Connect Basecamp</strong> and authorise via OAuth.",
                "Select the projects you wish to import from the list.",
                "Click <strong>Import selected</strong> and wait for the import to complete.",
                "Use the backfill tools (collapsible cards below the project list) to import additional data types.",
              ]} />
            </SubSection>

            <SubSection title="Backfill tools">
              <p className="text-sm text-foreground/80 mb-2">Each tool is collapsed by default. Click the <strong>›</strong> chevron to expand, then click <strong>Run</strong>. All tools are safe to run multiple times.</p>
              <Table
                headers={["Tool", "Purpose"]}
                rows={[
                  ["Import Message Board Posts", "Pulls Basecamp message board posts into Posts"],
                  ["Import To-dos as Tasks", "Converts Basecamp to-do lists to tasks"],
                  ["Import Project Campfire Chats", "Pulls project group chat history"],
                  ["Add Members to Projects", "Syncs who belongs to which project"],
                  ["Import Private Messages", "Brings in your Basecamp DMs"],
                  ["Populate Project Mandates", "Fills the mandate tab from project descriptions"],
                  ["Fix: Projects hidden", "Resets imported-archived projects to Active"],
                  ["Clear Imported Messages", "Removes all imported chat data (irreversible)"],
                ]}
              />
            </SubSection>

            <Note>The <strong>Clear Imported Messages</strong> action cannot be undone. Use it only to clean up a failed import before re-running.</Note>
          </Section>

          {/* Tips */}
          <Section id="tips" title="Tips & Shortcuts">
            <Table
              headers={["Action", "How"]}
              rows={[
                ["Send a message", "Press Enter in the message input"],
                ["New line in message", "Shift + Enter"],
                ["Collapse the sidebar", "Click the ‹ toggle on the sidebar edge"],
                ["View a user profile", "Click any avatar or @mention"],
                ["Mention someone in chat", "Type @ followed by their name"],
                ["React to a message", "Hover the message → click 😊"],
                ["Edit your message", "Hover the message → click the pencil icon"],
                ["AI summary of a chat", "Open any chat → click Summarize at the top"],
              ]}
            />

            <Tip>
              The <strong>Activity</strong> feed is the fastest way to catch up after time away — it shows every action across all projects in reverse chronological order.
            </Tip>
          </Section>

        </main>
      </div>
    </div>
  );
}
