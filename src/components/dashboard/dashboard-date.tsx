"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";

export function DashboardDate({ orgName }: { orgName: string }) {
  const [label, setLabel] = useState<string>("");

  useEffect(() => {
    setLabel(format(new Date(), "EEEE, MMMM d"));
  }, []);

  if (!label) return null;
  return <>{label} · {orgName}</>;
}
