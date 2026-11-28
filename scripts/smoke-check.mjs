import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");

assert.match(app, /signInWithPassword\(/, "email and password sign-in must be implemented");
assert.match(app, /auth\.signUp\(/, "email and password sign-up must be implemented");
assert.doesNotMatch(app, /signInWithOtp\(|verifyOtp\(/, "OTP authentication must be removed");
assert.doesNotMatch(app, /#auth-email"\)\.value\s*=\s*["\'][^"\']+@/i, "auth form must not expose a prefilled email address");
assert.ok(html.includes('id="auth-password"'), "password input must be present");
assert.ok(html.includes('id="auth-mode-switch"'), "sign-in/sign-up switch must be present");
assert.match(app, /if\(state\.user\)startNotifications\(\)/, "notifications must start after identity refresh");
assert.match(app, /if\(!filtered\.length\)/, "cinema empty state must be handled");
assert.doesNotMatch(html, /id="post-content"[^>]*required/, "media-only posts must be allowed");
for (const id of ["auth-form", "auth-email", "auth-password", "auth-mode-switch", "post-form", "post-content", "post-media", "profile-form", "admin-film-form", "chat-panel"]) {
  assert.ok(html.includes(`id="${id}"`), `missing required HTML element: ${id}`);
}
console.log("MK Universe smoke checks passed.");
