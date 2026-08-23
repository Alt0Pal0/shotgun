/** Writes a branded email preview to test-results/screens/email-preview.html (dev aid). */
import { writeFileSync, mkdirSync } from "node:fs";
import { renderEmail } from "../src/lib/email/template";
mkdirSync("test-results/screens", { recursive: true });
writeFileSync(
  "test-results/screens/email-preview.html",
  renderEmail({
    subject: "Verify your email",
    intro: "Welcome! Confirm your email address to start using Shotgun.Rocks.",
    link: "https://www.shotgun.rocks/auth/verify?token=abc123",
    cta: "Verify my email",
  }),
);
console.log("ok");
