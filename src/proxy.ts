import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/accept-invite(.*)",        // Invitation landing page — handles its own auth state
  "/api/webhooks(.*)",
  "/api/uploadthing(.*)",      // UploadThing does its own auth inside the route handler
  "/api/digest",               // Cron job — protected by CRON_SECRET header
  "/api/basecamp/callback(.*)", // OAuth callback — no session yet
  "/api/org-branding(.*)",     // Called from org-selection page before active org
]);

export default clerkMiddleware(
  async (auth, request) => {
    if (!isPublicRoute(request)) {
      await auth.protect();
    }
  },
  {
    publishableKey: "pk_live_Y2xlcmsub250aGVjb3JlLmNvbSQ",
  }
);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
