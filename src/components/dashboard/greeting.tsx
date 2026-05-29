"use client";

import { useEffect, useState } from "react";

export function Greeting({ name }: { name: string }) {
  const [text, setText] = useState<string>("");

  useEffect(() => {
    const hour = new Date().getHours();
    const first = name.split(" ")[0] ?? name;
    if (hour < 12) setText(`Good morning, ${first}`);
    else if (hour < 17) setText(`Good afternoon, ${first}`);
    else setText(`Good evening, ${first}`);
  }, [name]);

  // Render nothing until the client has run (avoids hydration mismatch)
  if (!text) return null;
  return <>{text}</>;
}
