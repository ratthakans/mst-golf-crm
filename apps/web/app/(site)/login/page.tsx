import { redirect } from "next/navigation";

// Sign-up and sign-in are one flow (mobile number → SMS code) on the member page.
export default function Page() {
  redirect("/app/member");
}
