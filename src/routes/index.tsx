import { createFileRoute, redirect } from "@tanstack/react-router";

// অ্যাপে এখন শুধু হিসাব আছে — মূল ঠিকানায় এলে সরাসরি সেখানেই পাঠানো হয়।
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/hisab" });
  },
});
