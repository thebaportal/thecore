import { redirect } from "next/navigation";

// Sidebar now points to /dashboard which renders the student home for org:member users.
export default function StudentHomePage() {
  redirect("/dashboard");
}
