import { getMyPings } from "@/actions/pings";
import { PingsShell } from "@/components/pings/pings-shell";

export default async function PingsLayout({ children }: { children: React.ReactNode }) {
  const { pings, currentDbUserId } = await getMyPings();

  return (
    <PingsShell pings={pings} currentDbUserId={currentDbUserId ?? ""}>
      {children}
    </PingsShell>
  );
}
