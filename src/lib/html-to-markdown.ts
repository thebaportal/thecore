const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
  "&#160;": " ",
  "&mdash;": "—",
  "&ndash;": "–",
  "&hellip;": "...",
  "&laquo;": "«",
  "&raquo;": "»",
};

function decodeEntities(html: string): string {
  return html
    .replace(/&[a-z#0-9]+;/gi, (e) => ENTITIES[e] ?? e)
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
}

// ES2017-compatible: use [\s\S] instead of . with s-flag
export function htmlToMarkdown(html: string): string {
  let md = html;

  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_, t: string) => `# ${t.trim()}\n\n`);
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, t: string) => `## ${t.trim()}\n\n`);
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, t: string) => `### ${t.trim()}\n\n`);
  md = md.replace(/<h[456][^>]*>([\s\S]*?)<\/h[456]>/gi, (_, t: string) => `#### ${t.trim()}\n\n`);
  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, t: string) =>
    t.trim().split("\n").map((l) => `> ${l}`).join("\n") + "\n\n"
  );
  md = md.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, (_, t: string) =>
    "```\n" + t.trim() + "\n```\n\n"
  );
  md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_, t: string) => "`" + t + "`");

  // Lists
  md = md.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, inner: string) =>
    inner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (__: string, item: string) => `- ${item.trim()}\n`) + "\n"
  );
  md = md.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, inner: string) => {
    let i = 0;
    return inner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (__: string, item: string) => `${++i}. ${item.trim()}\n`) + "\n";
  });

  // Inline
  md = md.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, (_, t: string) => `**${t}**`);
  md = md.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, (_, t: string) => `**${t}**`);
  md = md.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, (_, t: string) => `*${t}*`);
  md = md.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, (_, t: string) => `*${t}*`);
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_: string, url: string, text: string) =>
    text.trim() === url.trim() ? url : `[${text}](${url})`
  );
  md = md.replace(/<br\s*\/?>/gi, "\n");
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, t: string) => `${t.trim()}\n\n`);
  md = md.replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, (_, t: string) => `${t.trim()}\n`);
  md = md.replace(/<hr[^>]*>/gi, "\n---\n\n");

  // ── Basecamp-specific elements ───────────────────────────────────────────
  // @mentions: <bc-attachment content-type="application/vnd.basecamp.mention">Name</bc-attachment>
  md = md.replace(
    /<bc-attachment[^>]*content-type="application\/vnd\.basecamp\.mention"[^>]*>([\s\S]*?)<\/bc-attachment>/gi,
    (_, inner: string) => {
      const name = inner.replace(/<[^>]+>/g, "").trim();
      return name ? `**@${name}**` : "";
    }
  );

  // Quoted campfire replies: <bc-attachment content-type="...recording-line">quoted text</bc-attachment>
  md = md.replace(
    /<bc-attachment[^>]*content-type="application\/vnd\.basecamp\.3\.recording-line"[^>]*>([\s\S]*?)<\/bc-attachment>/gi,
    (_, inner: string) => {
      const text = inner.replace(/<[^>]+>/g, "").trim();
      return text ? `> ${text}\n\n` : "";
    }
  );

  // <bc-quote> tags (alternate quote format)
  md = md.replace(/<bc-quote[^>]*>([\s\S]*?)<\/bc-quote>/gi, (_, inner: string) =>
    inner.trim().split("\n").filter(Boolean).map((l: string) => `> ${l.replace(/<[^>]+>/g, "").trim()}`).join("\n") + "\n\n"
  );

  // Strip any remaining bc-* tags (keep their text content)
  md = md.replace(/<\/?bc-[a-z][^>]*>/gi, "");

  // Strip remaining tags
  md = md.replace(/<[^>]+>/g, "");

  md = decodeEntities(md);
  md = md.replace(/\n{3,}/g, "\n\n").trim();

  return md;
}

export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<p[^>]*>/gi, " ")
      .replace(/<[^>]+>/g, "")
  )
    .replace(/\s+/g, " ")
    .trim();
}
