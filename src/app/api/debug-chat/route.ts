import { auth } from "@clerk/nextjs/server";
import { htmlToMarkdown } from "@/lib/html-to-markdown";
import { NextResponse } from "next/server";

export async function GET() {
  const { orgId } = await auth();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tests = [
    "<div>y</div><div>e</div><div>s</div>",
    "<div>Hello every</div><div>one</div>",
    "<div>Hi team,</div><div>please join</div>",
    "y\ne\ns",
    "Hello every\none",
  ];

  return NextResponse.json(
    tests.map(input => ({
      input,
      output: htmlToMarkdown(input),
      outputEscaped: JSON.stringify(htmlToMarkdown(input)),
    }))
  );
}
