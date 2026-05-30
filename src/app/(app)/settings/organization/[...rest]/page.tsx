import { OrganizationProfile } from "@clerk/nextjs";

export default function OrganizationProfileCatchAll() {
  return (
    <div className="max-w-2xl">
      <OrganizationProfile
        routing="path"
        path="/settings/organization"
        appearance={{
          elements: {
            rootBox: "w-full",
            card: "border border-border rounded-xl shadow-none",
          },
        }}
      />
    </div>
  );
}
