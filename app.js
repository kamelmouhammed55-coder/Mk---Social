import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const SUPABASE_URL = "https://zdiexngxbcummxhnuacr.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_kGDOwsesrJQXQ1rrCiBZ7Q_xSXp5Hkh";
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
});

const $ = (selector) => document.querySelector(selector);
const state = { user: null, profile: null, authMode: "signin", busy: false };
const authView = $("#auth-view");
const appView = $("#app-view");
const toastRegion = $("#toast-region");

function toast(message, type = "success") {
  const item = document.createElement("div");
  item.className = "toast " + type;
  item.textContent = message;
  toastRegion.append(item);
  window.setTimeout(() => item.remove(), 4200);
}

function setConnection(online, label) {
  const status = $("#connection-status");
  status.lastChild.textContent = " " + label;
  status.querySelector("i").style.background = online ? "#68c58a" : "#ffb13b";
}

function setBusy(button, busy, label) {
  if (!button) return;
  button.disabled = busy;
  if (busy) {
    button.dataset.originalLabel = button.textContent;
    button.textContent = "لحظة من فضلك...";
  } else if (button.dataset.originalLabel) {
    button.textContent = button.dataset.originalLabel;
    delete button.dataset.originalLabel;
  }
}

function showAuth() {
  authView.classList.remove("hidden");
  appView.classList.add("hidden");
  $("#logout-button").classList.add("hidden");
}

function showApp() {
  authView.classList.add("hidden");
  appView.classList.remove("hidden");
  $("#logout-button").classList.remove("hidden");
}

function setAuthMode(mode) {
  state.authMode = mode;
  const signup = mode === "signup";
  $("#auth-title").textContent = signup ? "انضم إلى MK Social" : "مرحباً بعودتك";
  $("#auth-subtitle").textContent = signup ? "أنشئ حسابك وابدأ رحلتك." : "سجّل الدخول للمتابعة إلى عالمك.";
  $("#name-field").classList.toggle("hidden", !signup);
  $("#auth-name").required = signup;
  $("#auth-password").autocomplete = signup ? "new-password" : "current-password";
  $("#auth-submit").textContent = signup ? "إنشاء الحساب" : "تسجيل الدخول";
  $("#auth-switch").textContent = signup ? "لديك حساب؟ سجّل الدخول" : "إنشاء حساب جديد";
  $("#forgot-button").classList.toggle("hidden", signup);
}

function initials(name) {
  const value = (name || "MK").trim();
  return Array.from(value).slice(0, 1).join("").toUpperCase() || "M";
}

function makeAvatar(name, extraClass = "") {
  const avatar = document.createElement("div");
  avatar.className = "avatar " + extraClass;
  avatar.textContent = initials(name);
  return avatar;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ar-DZ", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

async function loadProfile() {
  const { data, error } = await supabase.from("profiles")
    .select("id,username,display_name,bio,avatar_url")
    .eq("id", state.user.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    const fallbackName = state.user.user_metadata?.display_name || state.user.email?.split("@")[0] || "عضو MK";
    const { data: created, error: createError } = await supabase.from("profiles")
      .insert({ id: state.user.id, display_name: fallbackName })
      .select("id,username,display_name,bio,avatar_url")
      .single();
    if (createError) throw createError;
    state.profile = created;
  } else {
    state.profile = data;
  }
  renderProfile();
}

function renderProfile() {
  const profile = state.profile;
  if (!profile) return;
  const name = profile.display_name || "عضو MK";
  $("#profile-display-name").textContent = name;
  $("#profile-username").textContent = profile.username ? "@" + profile.username : "اختر اسم مستخدم";
  $("#profile-avatar").textContent = initials(name);
  $("#profile-handle").value = profile.username || "";
  $("#profile-bio").value = profile.bio || "";
}

async function loadFeed() {
  const feed = $("#feed-list");
  feed.replaceChildren();
  const { data: posts, error } = await supabase.from("posts")
    .select("id,user_id,content,created_at")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  if (!posts?.length) {
    const empty = document.createElement("div");
    empty.className = "panel empty-state";
    empty.textContent = "مازال ما كاين حتى منشور. كن أول واحد يشارك فكرة مع المجتمع.";
    feed.append(empty);
    return;
  }

  const userIds = [...new Set(posts.map((post) => post.user_id))];
  const postIds = posts.map((post) => post.id);
  const [profilesResult, likesResult, ownLikesResult] = await Promise.all([
    supabase.from("profiles").select("id,username,display_name").in("id", userIds),
    supabase.from("likes").select("post_id").in("post_id", postIds),
    supabase.from("likes").select("post_id").eq("user_id", state.user.id).in("post_id", postIds)
  ]);
  if (profilesResult.error) throw profilesResult.error;
  if (likesResult.error) throw likesResult.error;
  if (ownLikesResult.error) throw ownLikesResult.error;
  const profiles = new Map((profilesResult.data || []).map((profile) => [profile.id, profile]));
  const counts = new Map();
  for (const like of likesResult.data || []) counts.set(like.post_id, (counts.get(like.post_id) || 0) + 1);
  const ownLikes = new Set((ownLikesResult.data || []).map((like) => like.post_id));

  for (const post of posts) {
    const profile = profiles.get(post.user_id) || { display_name: "عضو MK", username: "member" };
    feed.append(buildPostCard(post, profile, counts.get(post.id) || 0, ownLikes.has(post.id)));
  }
}

function buildPostCard(post, profile, likeCount, liked) {
  const card = document.createElement("article");
  card.className = "panel post-card";
  const head = document.createElement("div");
  head.className = "post-head";
  head.append(makeAvatar(profile.display_name));
  const author = document.createElement("div");
  author.className = "post-author";
  const name = document.createElement("strong");
  name.textContent = profile.display_name || "عضو MK";
  const meta = document.createElement("small");
  meta.textContent = (profile.username ? "@" + profile.username + " · " : "") + formatDate(post.created_at);
  author.append(name, meta);
  head.append(author);
  card.append(head);

  const body = document.createElement("p");
  body.className = "post-body";
  body.textContent = post.content;
  card.append(body);

  const actions = document.createElement("div");
  actions.className = "post-actions";
  const likeButton = document.createElement("button");
  likeButton.type = "button";
  likeButton.className = "post-action" + (liked ? " active" : "");
  likeButton.textContent = (liked ? "♥" : "♡") + " إعجاب " + likeCount;
  likeButton.addEventListener("click", async () => {
    likeButton.disabled = true;
    try {
      if (liked) {
        const { error } = await supabase.from("likes").delete().eq("post_id", post.id).eq("user_id", state.user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("likes").insert({ post_id: post.id, user_id: state.user.id });
        if (error && error.code !== "23505") throw error;
      }
      await loadFeed();
    } catch (error) {
      toast(friendlyError(error), "error");
      likeButton.disabled = false;
    }
  });
  const commentToggle = document.createElement("button");
  commentToggle.type = "button";
  commentToggle.className = "post-action";
  commentToggle.textContent = "التعليقات";
  actions.append(likeButton, commentToggle);
  card.append(actions);

  const commentsBox = document.createElement("section");
  commentsBox.className = "comments-box hidden";
  const commentList = document.createElement("div");
  commentList.className = "comment-list";
  const commentForm = document.createElement("form");
  commentForm.className = "comment-form";
  const commentInput = document.createElement("input");
  commentInput.type = "text";
  commentInput.maxLength = 2000;
  commentInput.placeholder = "اكتب تعليقاً...";
  commentInput.required = true;
  const commentSubmit = document.createElement("button");
  commentSubmit.type = "submit";
  commentSubmit.className = "button button-secondary";
  commentSubmit.textContent = "إرسال";
  commentForm.append(commentInput, commentSubmit);
  commentsBox.append(commentList, commentForm);
  card.append(commentsBox);

  async function refreshComments() {
    commentList.replaceChildren();
    const { data, error } = await supabase.from("comments")
      .select("id,user_id,content,created_at")
      .eq("post_id", post.id)
      .order("created_at", { ascending: true })
      .limit(50);
    if (error) throw error;
    const ids = [...new Set((data || []).map((item) => item.user_id))];
    let people = new Map();
    if (ids.length) {
      const result = await supabase.from("profiles").select("id,display_name").in("id", ids);
      if (result.error) throw result.error;
      people = new Map((result.data || []).map((person) => [person.id, person.display_name]));
    }
    if (!data?.length) {
      const empty = document.createElement("p");
      empty.className = "muted small";
      empty.textContent = "لا توجد تعليقات بعد.";
      commentList.append(empty);
    }
    for (const comment of data || []) {
      const line = document.createElement("div");
      line.className = "comment-item";
      const who = document.createElement("strong");
      who.textContent = people.get(comment.user_id) || "عضو MK";
      const text = document.createElement("span");
      text.textContent = comment.content;
      line.append(who, text);
      commentList.append(line);
    }
  }

  commentToggle.addEventListener("click", async () => {
    commentsBox.classList.toggle("hidden");
    if (!commentsBox.classList.contains("hidden")) {
      try { await refreshComments(); } catch (error) { toast(friendlyError(error), "error"); }
    }
  });
  commentForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const content = commentInput.value.trim();
    if (!content) return;
    setBusy(commentSubmit, true);
    try {
      const { error } = await supabase.from("comments").insert({
        post_id: post.id, user_id: state.user.id, content
      });
      if (error) throw error;
      commentInput.value = "";
      await refreshComments();
      toast("تم نشر تعليقك.");
    } catch (error) {
      toast(friendlyError(error), "error");
    } finally {
      setBusy(commentSubmit, false);
    }
  });
  return card;
}

function friendlyError(error) {
  const code = error?.code;
  if (code === "23505") return "هذا الإجراء مسجل من قبل.";
  if (code === "23514") return "المعلومات المدخلة لا تطابق الشروط.";
  if (code === "42501" || code === "PGRST301") return "ما عندكش صلاحية لهذا الإجراء. تأكد من تسجيل الدخول.";
  if (code === "PGRST116") return "تعذر العثور على البيانات المطلوبة.";
  return error?.message || "حدث خطأ غير متوقع. حاول مرة أخرى.";
}

async function refreshApp() {
  await loadProfile();
  await loadFeed();
}

$("#auth-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (state.busy) return;
  const button = $("#auth-submit");
  const email = $("#auth-email").value.trim();
  const password = $("#auth-password").value;
  const displayName = $("#auth-name").value.trim();
  if (password.length < 8) {
    toast("كلمة المرور لازم تكون 8 أحرف على الأقل.", "error");
    return;
  }
  state.busy = true;
  setBusy(button, true);
  try {
    if (state.authMode === "signup") {
      if (displayName.length < 2) throw new Error("اكتب اسماً ظاهراً من حرفين على الأقل.");
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: {
          data: { display_name: displayName },
          emailRedirectTo: window.location.href.split("#")[0]
        }
      });
      if (error) throw error;
      if (data.session) {
        toast("تم إنشاء الحساب بنجاح.");
      } else {
        toast("تم إرسال رابط التأكيد إلى بريدك الإلكتروني. افتحه لإكمال التسجيل.");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast("مرحباً بعودتك.");
    }
  } catch (error) {
    toast(friendlyError(error), "error");
  } finally {
    state.busy = false;
    setBusy(button, false);
  }
});

$("#auth-switch").addEventListener("click", () => {
  setAuthMode(state.authMode === "signin" ? "signup" : "signin");
});

$("#forgot-button").addEventListener("click", async () => {
  const email = $("#auth-email").value.trim();
  if (!email) {
    toast("اكتب بريدك الإلكتروني أولاً.", "error");
    $("#auth-email").focus();
    return;
  }
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.href.split("#")[0]
    });
    if (error) throw error;
    toast("إذا كان البريد مسجلاً، سيصلك رابط إعادة تعيين كلمة المرور.");
  } catch (error) {
    toast(friendlyError(error), "error");
  }
});

$("#logout-button").addEventListener("click", async () => {
  const { error } = await supabase.auth.signOut();
  if (error) toast(friendlyError(error), "error");
  else toast("تم تسجيل الخروج.");
});

$("#profile-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.submitter;
  const username = $("#profile-handle").value.trim().toLowerCase();
  const bio = $("#profile-bio").value.trim();
  if (!/^[a-z0-9_]{3,24}$/.test(username)) {
    toast("اسم المستخدم لازم يكون 3–24 حرفاً إنجليزياً أو رقماً أو _.", "error");
    return;
  }
  setBusy(button, true);
  try {
    const { data, error } = await supabase.from("profiles").update({
      username, bio, updated_at: new Date().toISOString()
    }).eq("id", state.user.id).select("id,username,display_name,bio,avatar_url").single();
    if (error) throw error;
    state.profile = data;
    renderProfile();
    toast("تم تحديث ملفك الشخصي.");
  } catch (error) {
    toast(error?.code === "23505" ? "اسم المستخدم مستعمل. اختَر اسماً آخر." : friendlyError(error), "error");
  } finally {
    setBusy(button, false);
  }
});

$("#post-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.submitter;
  const content = $("#post-content").value.trim();
  if (!content) {
    toast("اكتب محتوى المنشور أولاً.", "error");
    return;
  }
  setBusy(button, true);
  try {
    const { error } = await supabase.from("posts").insert({ user_id: state.user.id, content });
    if (error) throw error;
    $("#post-content").value = "";
    await loadFeed();
    toast("تم نشر منشورك.");
  } catch (error) {
    toast(friendlyError(error), "error");
  } finally {
    setBusy(button, false);
  }
});

$("#refresh-feed").addEventListener("click", async () => {
  const button = $("#refresh-feed");
  setBusy(button, true);
  try { await loadFeed(); } catch (error) { toast(friendlyError(error), "error"); }
  finally { setBusy(button, false); }
});

$("#search-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const term = $("#search-input").value.trim().replace(/^@/, "").toLowerCase();
  const resultsBox = $("#search-results");
  resultsBox.replaceChildren();
  if (!/^[a-z0-9_]{2,24}$/.test(term)) {
    toast("استعمل حروفاً إنجليزية أو أرقاماً أو _ (من 2 إلى 24).", "error");
    return;
  }
  try {
    const { data, error } = await supabase.from("profiles")
      .select("id,username,display_name,bio")
      .ilike("username", "%" + term + "%")
      .neq("id", state.user.id)
      .limit(10);
    if (error) throw error;
    if (!data?.length) {
      const empty = document.createElement("p");
      empty.className = "muted small";
      empty.textContent = "ما لقيناش أعضاء بهذا الاسم.";
      resultsBox.append(empty);
      return;
    }
    const ids = data.map((person) => person.id);
    const followsResult = await supabase.from("follows").select("following_id")
      .eq("follower_id", state.user.id).in("following_id", ids);
    if (followsResult.error) throw followsResult.error;
    const followed = new Set((followsResult.data || []).map((row) => row.following_id));
    for (const person of data) {
      const row = document.createElement("div");
      row.className = "search-result";
      row.append(makeAvatar(person.display_name));
      const copy = document.createElement("div");
      copy.className = "search-result-copy";
      const name = document.createElement("strong");
      name.textContent = person.display_name || "عضو MK";
      const handle = document.createElement("small");
      handle.textContent = person.username ? "@" + person.username : "عضو";
      copy.append(name, handle);
      const followButton = document.createElement("button");
      followButton.type = "button";
      followButton.className = "button button-secondary follow-button";
      followButton.textContent = followed.has(person.id) ? "إلغاء" : "متابعة";
      followButton.addEventListener("click", async () => {
        followButton.disabled = true;
        try {
          if (followed.has(person.id)) {
            const { error } = await supabase.from("follows").delete()
              .eq("follower_id", state.user.id).eq("following_id", person.id);
            if (error) throw error;
            followed.delete(person.id);
            followButton.textContent = "متابعة";
          } else {
            const { error } = await supabase.from("follows").insert({
              follower_id: state.user.id, following_id: person.id
            });
            if (error) throw error;
            followed.add(person.id);
            followButton.textContent = "إلغاء";
          }
          toast("تم تحديث قائمة المتابعة.");
        } catch (error) {
          toast(friendlyError(error), "error");
        } finally {
          followButton.disabled = false;
        }
      });
      row.append(copy, followButton);
      resultsBox.append(row);
    }
  } catch (error) {
    toast(friendlyError(error), "error");
  }
});

async function handleSession(session) {
  state.user = session?.user || null;
  if (!state.user) {
    state.profile = null;
    showAuth();
    setConnection(true, "غير مسجل");
    return;
  }
  showApp();
  setConnection(true, "متصل");
  try {
    await refreshApp();
  } catch (error) {
    toast(friendlyError(error), "error");
  }
}

supabase.auth.onAuthStateChange((event, session) => {
  if (event === "PASSWORD_RECOVERY") {
    const dialog = $("#password-dialog");
    if (dialog && !dialog.open) dialog.showModal();
  }
  queueMicrotask(() => handleSession(session));
});

$("#password-reset-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.submitter;
  const password = $("#new-password").value;
  const confirmation = $("#confirm-password").value;
  if (password.length < 8) return toast("كلمة المرور لازم تكون 8 أحرف على الأقل.", "error");
  if (password !== confirmation) return toast("كلمتا المرور غير متطابقتين.", "error");
  setBusy(button, true);
  try {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    $("#password-dialog").close();
    $("#password-reset-form").reset();
    toast("تم تغيير كلمة المرور بنجاح.");
  } catch (error) { toast(friendlyError(error), "error"); }
  finally { setBusy(button, false); }
});

(async function initialize() {
  setAuthMode("signin");
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    await handleSession(data.session);
  } catch (error) {
    setConnection(false, "تعذر الاتصال");
    toast(friendlyError(error), "error");
  }
})();
