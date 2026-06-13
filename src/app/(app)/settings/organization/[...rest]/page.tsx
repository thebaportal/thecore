import { redirect } from "next/navigation";

export default function OrganizationProfileCatchAll() {
  redirect("/settings/organization");
}
