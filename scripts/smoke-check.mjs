import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");

assert.match(app, /signInWithOtp\(/, "email OTP request must be implemented");
assert.match(app, /verifyOtp\(/, "email OTP verification must be implemented");
assert.match(app, /if\(state\.user\)startNotifications\(\)/, "notifications must start after identity refresh");
assert.match(app, /if\(!films\?\.length\)/, "cinema empty state must be handled");
assert.doesNotMatch(html, /id="post-content"[^>]*required/, "media-only posts must be allowed");
for (const id of ["auth-form", "auth-email", "auth-otp", "post-form", "post-content", "post-media", "profile-form", "admin-film-form", "chat-panel"]) {
  assert.ok(html.includes(`id="${id}"`), `missing required HTML element: ${id}`);
}
console.log("MK Universe smoke checks passed.");
