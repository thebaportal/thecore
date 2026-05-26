import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <SignUp
      appearance={{
        variables: {
          colorPrimary: "#1e3a8a",
          colorBackground: "#ffffff",
          colorText: "#171923",
          colorTextSecondary: "#6b7280",
          colorInputBackground: "#ffffff",
          colorInputText: "#171923",
          colorAlphaShade: "#171923",
          borderRadius: "0.625rem",
          fontSize: "0.875rem",
        },
        elements: {
          rootBox: "w-full max-w-[400px]",
          card: "shadow-sm border border-gray-100 rounded-xl p-8 w-full",
          headerTitle: "text-lg font-semibold tracking-tight text-[#171923]",
          headerSubtitle: "text-sm text-[#6b7280]",
          socialButtonsBlockButton:
            "border border-[#e5e7eb] bg-white hover:bg-[#f9fafb] text-[#171923] font-medium rounded-lg",
          formButtonPrimary:
            "bg-[#1e3a8a] hover:bg-[#1e3a8a]/90 text-white font-semibold rounded-lg",
          formFieldInput:
            "border-[#e5e7eb] bg-white text-[#171923] rounded-lg focus:border-[#1e3a8a] focus:ring-[#1e3a8a]",
          formFieldLabel: "text-sm font-medium text-[#374151]",
          footerActionLink: "text-[#1e3a8a] font-medium hover:text-[#1e3a8a]/80",
          identityPreviewEditButtonIcon: "text-[#1e3a8a]",
          dividerLine: "bg-[#e5e7eb]",
          dividerText: "text-[#9ca3af] text-xs",
          alertText: "text-sm",
          badge: "hidden",
          footer: "hidden",
        },
      }}
    />
  );
}
