import { createClient } from "https://esm.sh/@supabase/supabase-js@2.119.2";

const SUPABASE_URL = "https://zdiexngxbcummxhnuacr.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_kGDOwsesrJqXQ1rrCiBZ7Q_xSXp5Hkh";
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
});

const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const state = { user:null, profile:null, isOwner:false, authMode:"signup", busy:false, chatId:null, chatChannel:null, notificationChannel:null, posts:[] };
let searchDelay;

function toast(message,type="success"){
  const el=document.createElement("div");el.className="toast "+type;el.textContent=message;
  $("#toast-region").append(el);setTimeout(()=>el.remove(),4500);
}
function safeText(el,value){el.textContent=value??"";return el}
function formatDate(value){try{return new Intl.DateTimeFormat("ar",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value))}catch{return ""}}
function navigate(page){
  if(page==="admin"&&!state.isOwner){toast("هذه الصفحة خاصة بمالك المنصة.","error");return}
  const target=$("#page-"+page);if(!target)return;
  $$(".page").forEach(p=>p.classList.toggle("active",p===target));
  $$("[data-page]").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
  window.scrollTo({top:0,behavior:"smooth"});
}
$$("[data-page]").forEach(btn=>btn.addEventListener("click",()=>navigate(btn.dataset.page)));
$$("[data-go]").forEach(btn=>btn.addEventListener("click",()=>navigate(btn.dataset.go)));

function openAuth(mode=state.authMode){
  state.authMode=mode;const signup=mode==="signup";
  $("#auth-heading").textContent=signup?"انضم إلى MK Universe":"مرحباً بعودتك";
  $("#auth-description").textContent=signup?"أنشئ حسابك وابدأ رحلتك.":"سجل الدخول إلى حساب MK ID.";
  $("#display-name-wrap").classList.toggle("hidden",!signup);$("#auth-name").required=signup;
  $("#auth-password").autocomplete=signup?"new-password":"current-password";
  $("#auth-submit").textContent=signup?"إنشاء الحساب":"تسجيل الدخول";
  $("#auth-switch").textContent=signup?"لديك حساب؟ سجل الدخول":"ليس لديك حساب؟ أنشئ حساباً";
  $("#forgot-password").classList.toggle("hidden",signup);
  $("#auth-modal").classList.remove("hidden");$("#auth-modal").setAttribute("aria-hidden","false");
}
function closeAuth(){$("#auth-modal").classList.add("hidden");$("#auth-modal").setAttribute("aria-hidden","true")}
$$("[data-close-auth]").forEach(el=>el.addEventListener("click",closeAuth));
$("#auth-button").addEventListener("click",()=>openAuth(state.user?"signin":"signup"));
$("#auth-switch").addEventListener("click",()=>openAuth(state.authMode==="signup"?"signin":"signup"));
$("#logout-button").addEventListener("click",async()=>{const {error}=await supabase.auth.signOut();if(error){toast(error.message,"error");return}state.user=null;state.profile=null;state.isOwner=false;updateAccountUI();toast("تم تسجيل الخروج.")});

async function uploadUserMedia(file,folder){
  if(!state.user)throw new Error("سجل الدخول أولاً.");
  if(file.size>100*1024*1024)throw new Error("الحد الأقصى للملف 100 ميغابايت.");
  const ext=(file.name.split(".").pop()||"bin").toLowerCase();
  const path=state.user.id+"/"+folder+"/"+crypto.randomUUID()+"."+ext;
  const {error}=await supabase.storage.from("mk-universe-media").upload(path,file,{contentType:file.type,upsert:false});
  if(error)throw error;
  return supabase.storage.from("mk-universe-media").getPublicUrl(path).data.publicUrl;
}
async function loadProfile(user){
  const {data,error}=await supabase.from("profiles").select("display_name,username,avatar_url,bio").eq("id",user.id).maybeSingle();
  if(error){console.error("Profile load:",error.message);return null}return data;
}
function updateAccountUI(){
  const button=$("#auth-button"),logout=$("#logout-button");
  $("#admin-nav").classList.toggle("hidden",!state.isOwner);
  $("#admin-mobile-nav").classList.toggle("hidden",!state.isOwner);
  $("#notifications-button").classList.toggle("hidden",!state.user);
  if(state.user){
    button.textContent=state.isOwner?"مالك MK":(state.profile?.display_name||state.user.email?.split("@")[0]||"حسابي");
    button.classList.add("hidden");logout.classList.remove("hidden");
    $(".profile-card h2").textContent=state.profile?.display_name||"عضو MK Universe";
    $(".profile-card p").textContent=state.user.email||"حساب MK ID";
    $(".profile-card .muted").textContent=state.isOwner?"مالك المنصة · صلاحيات الإدارة":"حساب MK ID نشط";
    $("#profile-name").value=state.profile?.display_name||"";
    $("#profile-username").value=state.profile?.username||"";
    $("#profile-bio").value=state.profile?.bio||"";
  }else{
    button.textContent="دخول / إنشاء حساب";button.classList.remove("hidden");logout.classList.add("hidden");
    $(".profile-card h2").textContent="عضو MK Universe";
    $(".profile-card p").textContent="سجل الدخول لعرض ملفك الشخصي.";
    $(".profile-card .muted").textContent="حساب MK ID";
    $("#profile-name").value="";$("#profile-username").value="";$("#profile-bio").value="";
  }
}
async function refreshIdentity(user){
  state.user=user||null;state.profile=null;state.isOwner=false;
  if(user){
    state.profile=await loadProfile(user);
    const [{data:isOwner,error:ownerError},{data:ban,error:banError}]=await Promise.all([
      supabase.rpc("is_current_user_platform_owner"),
      supabase.from("platform_bans").select("reason,expires_at").eq("user_id",user.id).maybeSingle()
    ]);
    state.isOwner=!ownerError&&isOwner===true;
    const activeBan=!banError&&ban&&(ban.expires_at===null||new Date(ban.expires_at)>new Date());
    if(activeBan&&!state.isOwner){
      await supabase.auth.signOut();
      state.user=null;state.profile=null;state.isOwner=false;
      toast("هذا الحساب موقوف من استخدام MK Universe.","error");
    }
  }
  updateAccountUI();
  if(state.isOwner)loadAdminDashboard();
  if(state.user){loadSocialFeed();loadCinema()}
}
$("#auth-form").addEventListener("submit",async event=>{
  event.preventDefault();if(state.busy)return;
  const button=$("#auth-submit"),email=$("#auth-email").value.trim().toLowerCase(),password=$("#auth-password").value,displayName=$("#auth-name").value.trim();
  state.busy=true;button.disabled=true;button.textContent="لحظة من فضلك...";
  try{
    if(state.authMode==="signup"){
      const {data,error}=await supabase.auth.signUp({email,password,options:{data:{display_name:displayName},emailRedirectTo:window.location.href.split("#")[0]}});
      if(error)throw error;
      closeAuth();
      if(data.session){await refreshIdentity(data.user);toast("تم إنشاء حساب MK ID.")}
      else toast("أرسلنا رابط تأكيد إلى بريدك. أكّد البريد ثم سجل الدخول.");
    }else{
      const {data,error}=await supabase.auth.signInWithPassword({email,password});if(error)throw error;
      await refreshIdentity(data.user);closeAuth();toast("مرحباً بك في MK Universe.");
    }
  }catch(error){toast(error.message||"تعذر إكمال العملية.","error")}
  finally{state.busy=false;button.disabled=false;button.textContent=state.authMode==="signup"?"إنشاء الحساب":"تسجيل الدخول"}
});
$("#forgot-password").addEventListener("click",async()=>{
  const email=$("#auth-email").value.trim().toLowerCase();if(!email){toast("اكتب بريدك الإلكتروني أولاً.","error");return}
  const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:window.location.href.split("#")[0]});
  if(error){toast(error.message,"error");return}toast("إذا كان البريد مسجلاً، سيصلك رابط استعادة كلمة المرور.");
});
supabase.auth.onAuthStateChange((event,session)=>{
  if(event==="PASSWORD_RECOVERY"){
    setTimeout(async()=>{const next=window.prompt("أدخل كلمة المرور الجديدة (8 أحرف على الأقل):");if(next&&next.length>=8){const {error}=await supabase.auth.updateUser({password:next});toast(error?error.message:"تم تحديث كلمة المرور.",error?"error":"success")}else if(next)toast("كلمة المرور يجب أن تتكون من 8 أحرف على الأقل.","error")},0);return;
  }
  if(event==="SIGNED_OUT"){state.user=null;state.profile=null;state.isOwner=false;if(state.notificationChannel){supabase.removeChannel(state.notificationChannel);state.notificationChannel=null}updateAccountUI();return}
  if(session?.user)setTimeout(()=>refreshIdentity(session.user),0);
});

function renderPostCard(post,liked=false){
  const card=document.createElement("article");card.className="post-card";
  const head=document.createElement("div");head.className="post-head";
  const avatar=document.createElement("div");avatar.className="avatar";avatar.textContent=(post.display_name||"MK").slice(0,2);
  const meta=document.createElement("div");meta.className="post-meta";
  const name=safeText(document.createElement("b"),post.display_name||"عضو MK");
  const time=safeText(document.createElement("small"),formatDate(post.created_at));meta.append(name,time);head.append(avatar,meta);
  const body=document.createElement("p");body.className="post-body";body.textContent=post.content||"";
  card.append(head);if(post.content)card.append(body);
  if(post.media_url){
    if(post.media_type==="video"){const video=document.createElement("video");video.className="feed-media feed-video";video.controls=true;video.preload="metadata";video.src=post.media_url;card.append(video)}
    else{const img=document.createElement("img");img.className="feed-media";img.loading="lazy";img.alt="وسائط المنشور";img.src=post.media_url;card.append(img)}
  }
  const actions=document.createElement("div");actions.className="post-actions";
  const like=document.createElement("button");like.type="button";like.textContent=(liked?"♥ أعجبني":"♡ إعجاب")+" · "+(post.likes_count||0);
  like.addEventListener("click",async()=>{
    if(!state.user){toast("سجل الدخول للتفاعل.","error");openAuth("signin");return}
    like.disabled=true;
    const result=liked?await supabase.from("likes").delete().eq("post_id",post.id).eq("user_id",state.user.id):await supabase.from("likes").insert({post_id:post.id,user_id:state.user.id});
    like.disabled=false;if(result.error){toast(result.error.message,"error");return}loadSocialFeed();
  });
  const comment=document.createElement("button");comment.type="button";comment.textContent="◌ تعليق · "+(post.comments_count||0);
  comment.addEventListener("click",async()=>{
    if(!state.user){toast("سجل الدخول للتعليق.","error");openAuth("signin");return}
    const content=window.prompt("اكتب تعليقك:");
    if(!content?.trim())return;
    const {error}=await supabase.from("comments").insert({post_id:post.id,user_id:state.user.id,content:content.trim()});
    if(error){toast(error.message,"error");return}toast("تم نشر التعليق.");loadSocialFeed();
  });
  const report=document.createElement("button");report.type="button";report.textContent="⚑ بلاغ";
  report.addEventListener("click",async()=>{
    if(!state.user){toast("سجل الدخول لإرسال بلاغ.","error");openAuth("signin");return}
    const reason=window.prompt("سبب الإبلاغ عن المنشور:");
    if(!reason?.trim())return;
    const {error}=await supabase.from("content_reports").insert({reporter_id:state.user.id,target_type:"post",target_id:post.id,reason:reason.trim().slice(0,120)});
    if(error){toast(error.message,"error");return}toast("وصل البلاغ إلى إدارة MK.");
  });
  actions.append(like,comment,report);
  if(state.isOwner){
    const hide=document.createElement("button");hide.className="danger";hide.type="button";hide.textContent=post.is_hidden?"إظهار":"إخفاء";
    hide.addEventListener("click",async()=>{const {error}=await supabase.rpc("admin_set_post_visibility",{p_post_id:post.id,p_hidden:!post.is_hidden});if(error){toast(error.message,"error");return}toast("تم تحديث حالة المنشور.");loadSocialFeed()});
    const del=document.createElement("button");del.className="danger";del.type="button";del.textContent="حذف";
    del.addEventListener("click",async()=>{if(!confirm("هل تريد حذف هذا المنشور نهائياً؟"))return;const {error}=await supabase.rpc("admin_delete_post",{p_post_id:post.id});if(error){toast(error.message,"error");return}toast("تم حذف المنشور.");loadSocialFeed()});
    actions.append(hide,del);
  }
  card.append(actions);return card;
}
async function loadSocialFeed(){
  const hosts=[$("#social-feed"),$("#home-feed")];if(!hosts[0])return;
  const {data:posts,error}=await supabase.from("mk_feed").select("id,user_id,content,media_url,media_type,created_at,display_name,username,avatar_url,likes_count,comments_count,is_hidden").order("created_at",{ascending:false}).limit(30);
  if(error){hosts.forEach(h=>h.innerHTML="");if(state.user)toast("تعذر تحميل المنشورات: "+error.message,"error");return}
  state.posts=posts||[];
  let likedIds=new Set();
  if(state.user&&posts?.length){const {data:likes}=await supabase.from("likes").select("post_id").eq("user_id",state.user.id).in("post_id",posts.map(p=>p.id));likedIds=new Set((likes||[]).map(x=>x.post_id))}
  for(const host of hosts){
    host.innerHTML="";
    if(!posts?.length){const empty=document.createElement("div");empty.className="empty-state";const icon=document.createElement("span");icon.textContent="◉";const title=safeText(document.createElement("b"),"لا توجد منشورات بعد");const desc=safeText(document.createElement("p"),"كن أول من يشارك فكرة أو صورة في مجتمع MK.");empty.append(icon,title,desc);host.append(empty);continue}
    posts.forEach(post=>host.append(renderPostCard(post,likedIds.has(post.id))));
  }
}
$("#post-form").addEventListener("submit",async event=>{
  event.preventDefault();if(!state.user){toast("سجل الدخول قبل النشر.","error");openAuth("signin");return}
  const content=$("#post-content").value.trim(),file=$("#post-media").files?.[0];if(!content&&!file){toast("اكتب شيئاً أو اختر صورة/فيديو.","error");return}
  if(file&&file.size>100*1024*1024){toast("الحد الأقصى للملف 100 ميغابايت.","error");return}
  const button=$("#post-form button[type=submit]");button.disabled=true;button.textContent="جارٍ النشر...";
  try{
    let media_url=null,media_type=null;
    if(file){
      if(!["image/jpeg","image/png","image/webp","image/gif","video/mp4","video/webm"].includes(file.type))throw new Error("نوع الملف غير مدعوم.");
      const ext=(file.name.split(".").pop()||"bin").toLowerCase(),path=state.user.id+"/"+crypto.randomUUID()+"."+ext;
      const {error:uploadError}=await supabase.storage.from("mk-universe-media").upload(path,file,{contentType:file.type,upsert:false});
      if(uploadError)throw uploadError;
      media_url=supabase.storage.from("mk-universe-media").getPublicUrl(path).data.publicUrl;
      media_type=file.type.startsWith("video/")?"video":"image";
    }
    const {error}=await supabase.from("posts").insert({user_id:state.user.id,content,media_url,media_type});
    if(error)throw error;
    $("#post-content").value="";$("#post-media").value="";toast("تم نشر المنشور.");await loadSocialFeed();
  }catch(error){toast(error.message||"تعذر نشر المنشور.","error")}
  finally{button.disabled=false;button.textContent="نشر المنشور"}
});

$("#profile-form").addEventListener("submit",async event=>{
  event.preventDefault();if(!state.user){openAuth("signin");return}
  try{
    const updates={
      display_name:$("#profile-name").value.trim().slice(0,40),
      username:$("#profile-username").value.trim().toLowerCase().slice(0,24)||null,
      bio:$("#profile-bio").value.trim().slice(0,160),
      updated_at:new Date().toISOString()
    };
    const avatarFile=$("#profile-avatar-file").files?.[0];
    if(avatarFile){if(!avatarFile.type.startsWith("image/"))throw new Error("اختر صورة صالحة.");updates.avatar_url=await uploadUserMedia(avatarFile,"avatar")}
    const {error}=await supabase.from("profiles").update(updates).eq("id",state.user.id);
    if(error)throw error;state.profile=await loadProfile(state.user);updateAccountUI();$("#profile-avatar-file").value="";toast("تم حفظ ملفك الشخصي.");
  }catch(error){toast(error.message||"تعذر حفظ الملف.","error")}
});

async function loadNotifications(){
  if(!state.user)return;
  const {data,error}=await supabase.from("notifications").select("id,kind,actor_id,post_id,conversation_id,is_read,created_at").eq("recipient_id",state.user.id).order("created_at",{ascending:false}).limit(30);
  if(error){console.error("Notifications:",error.message);return}
  const host=$("#notifications-list");host.innerHTML="";
  const unread=(data||[]).filter(n=>!n.is_read).length;
  $("#notification-count").textContent=String(unread);$("#notification-count").classList.toggle("hidden",unread===0);
  if(!data?.length){const empty=document.createElement("div");empty.className="notifications-empty";empty.textContent="لا توجد إشعارات حالياً.";host.append(empty);return}
  const labels={like:"أعجب أحدهم بمنشورك",comment:"علّق أحدهم على منشورك",follow:"بدأ أحدهم بمتابعتك",message:"وصلتك رسالة جديدة"};
  data.forEach(item=>{
    const button=document.createElement("button");button.className="notification-item"+(item.is_read?"":" unread");button.type="button";
    const label=document.createElement("b");label.textContent=labels[item.kind]||"إشعار جديد";
    const date=document.createElement("small");date.textContent=formatDate(item.created_at);button.append(label,date);
    button.addEventListener("click",async()=>{
      await supabase.from("notifications").update({is_read:true}).eq("id",item.id);
      $("#notifications-panel").classList.add("hidden");loadNotifications();
      if(item.kind==="message"&&item.conversation_id){await loadChatList();await openChat(item.conversation_id,"محادثة")}
      else if(item.post_id)navigate("social");else navigate("profile");
    });
    host.append(button);
  });
}
function startNotifications(){
  if(!state.user)return;
  loadNotifications();
  if(state.notificationChannel)supabase.removeChannel(state.notificationChannel);
  state.notificationChannel=supabase.channel("mk-notifications-"+state.user.id)
    .on("postgres_changes",{event:"INSERT",schema:"public",table:"notifications",filter:"recipient_id=eq."+state.user.id},()=>loadNotifications()).subscribe();
}
$("#notifications-button").addEventListener("click",()=>{$("#notifications-panel").classList.toggle("hidden");if(!$("#notifications-panel").classList.contains("hidden"))loadNotifications()});
$("#notifications-close").addEventListener("click",()=>$("#notifications-panel").classList.add("hidden"));
async function loadCinema(){
  const host=$("#page-cinema");if(!host)return;
  const {data:films,error}=await supabase.from("cinema_catalog").select("id,title,description,content_type,release_year,genres,poster_url,trailer_url,watch_url,source_name,rights_basis,published").eq("published",true).order("created_at",{ascending:false}).limit(100);
  if(error){console.error("Cinema:",error.message);return}
  const existing=$("#cinema-live-grid");if(existing)existing.remove();
  if(!films?.length)return;
  const grid=document.createElement("div");grid.id="cinema-live-grid";grid.className="cinema-grid";
  films.forEach(film=>{
    const card=document.createElement("article");card.className="cinema-card-live";
    if(film.poster_url){const img=document.createElement("img");img.loading="lazy";img.alt=film.title;img.src=film.poster_url;card.append(img)}
    const info=document.createElement("div");info.className="film-info";const title=safeText(document.createElement("b"),film.title);
    const desc=safeText(document.createElement("p"),[film.release_year,film.content_type,film.genres?.join("، ")].filter(Boolean).join(" · ")+"\n"+(film.description||""));
    const link=document.createElement("a");link.href=film.watch_url;link.target="_blank";link.rel="noopener noreferrer";link.textContent="المشاهدة من المصدر الرسمي ↗";
    info.append(title,desc,link);card.append(info);grid.append(card);
  });
  const section=$("#page-cinema .section-head");section.after(grid);
}

async function loadChatList(){
  if(!state.user)return;
  const host=$("#chat-list");host.innerHTML="جارٍ تحميل المحادثات...";
  const {data:members,error}=await supabase.from("conversation_members").select("conversation_id,user_id").eq("user_id",state.user.id);
  if(error){host.textContent=error.message;return}
  const ids=[...new Set((members||[]).map(x=>x.conversation_id))];if(!ids.length){host.textContent="لا توجد محادثات بعد.";return}
  const {data:conversations}=await supabase.from("conversations").select("id,title,is_group,created_at").in("id",ids).order("created_at",{ascending:false});
  const {data:allMembers}=await supabase.from("conversation_members").select("conversation_id,user_id").in("conversation_id",ids);
  const others=[...new Set((allMembers||[]).filter(x=>x.user_id!==state.user.id).map(x=>x.user_id))];
  const {data:profiles}=others.length?await supabase.from("profiles").select("id,display_name,username").in("id",others):{data:[]};
  const byId=new Map((profiles||[]).map(p=>[p.id,p]));
  host.innerHTML="";
  (conversations||[]).forEach(conv=>{
    const other=(allMembers||[]).find(x=>x.conversation_id===conv.id&&x.user_id!==state.user.id);
    const profile=other?byId.get(other.user_id):null;
    const button=document.createElement("button");button.className="chat-user";button.type="button";
    safeText(document.createElement("span"),"");button.textContent=conv.title||profile?.display_name||profile?.username||"محادثة";
    const small=document.createElement("small");small.textContent=conv.is_group?"مجموعة":"محادثة خاصة";button.append(small);
    button.addEventListener("click",()=>openChat(conv.id,button.firstChild.textContent));host.append(button);
  });
}
async function searchChatUsers(term){
  const host=$("#chat-user-results");host.innerHTML="";
  if(!term.trim()||term.trim().length<2)return;
  const [{data:a,error:e1},{data:b,error:e2}]=await Promise.all([
    supabase.from("profiles").select("id,display_name,username").ilike("display_name","%"+term.trim()+"%").limit(8),
    supabase.from("profiles").select("id,display_name,username").ilike("username","%"+term.trim()+"%").limit(8)
  ]);
  if(e1||e2){host.textContent="تعذر البحث.";return}
  const rows=[...new Map([...(a||[]),...(b||[])].filter(p=>p.id!==state.user?.id).map(p=>[p.id,p])).values()];
  if(!rows.length){host.textContent="لم نجد عضواً بهذا الاسم.";return}
  rows.forEach(profile=>{
    const row=document.createElement("div");row.className="chat-user";const title=document.createElement("b");title.textContent=profile.display_name||profile.username;row.append(title);
    const small=document.createElement("small");small.textContent="@"+(profile.username||"member");row.append(small);
    const start=document.createElement("button");start.className="small-action ok chat-start";start.textContent="مراسلة";start.addEventListener("click",()=>startConversation(profile));row.append(start);
    const follow=document.createElement("button");follow.className="small-action chat-start";follow.textContent="متابعة";follow.addEventListener("click",async()=>{const {error}=await supabase.from("follows").insert({follower_id:state.user.id,following_id:profile.id});if(error?.code==="23505"){toast("أنت تتابع هذا العضو بالفعل.");return}if(error){toast(error.message,"error");return}toast("تمت المتابعة.")});row.append(follow);host.append(row);
  });
}

$("#chat-user-search").addEventListener("input",event=>{clearTimeout(searchDelay);const term=event.target.value;searchDelay=setTimeout(()=>searchChatUsers(term),250)});
async function startConversation(profile){
  if(!state.user)return;
  const {data:mine}=await supabase.from("conversation_members").select("conversation_id").eq("user_id",state.user.id);
  const ids=(mine||[]).map(x=>x.conversation_id);
  if(ids.length){
    const {data:shared}=await supabase.from("conversation_members").select("conversation_id").eq("user_id",profile.id).in("conversation_id",ids).limit(1);
    if(shared?.length){await openChat(shared[0].conversation_id,profile.display_name||profile.username);return}
  }
  const id=crypto.randomUUID();
  const {error:createError}=await supabase.from("conversations").insert({id,created_by:state.user.id,is_group:false});
  if(createError){toast(createError.message,"error");return}
  const {error:memberError}=await supabase.from("conversation_members").insert([{conversation_id:id,user_id:state.user.id},{conversation_id:id,user_id:profile.id}]);
  if(memberError){toast(memberError.message,"error");return}
  await loadChatList();openChat(id,profile.display_name||profile.username);
}
$("#create-group").addEventListener("click",async()=>{
  if(!state.user){openAuth("signin");return}
  const title=prompt("اسم المجموعة:");if(!title?.trim())return;
  const names=prompt("أسماء المستخدمين (username) مفصولة بفواصل:");if(!names?.trim())return;
  const usernames=[...new Set(names.split(",").map(x=>x.trim().replace(/^@/,"").toLowerCase()).filter(Boolean))].slice(0,30);
  if(!usernames.length)return;
  const {data:people,error}=await supabase.from("profiles").select("id,username").in("username",usernames);
  if(error){toast(error.message,"error");return}
  const valid=(people||[]).filter(p=>p.id!==state.user.id);
  if(!valid.length){toast("لم نجد أعضاء بهذه الأسماء.","error");return}
  const id=crypto.randomUUID();
  const {error:createError}=await supabase.from("conversations").insert({id,created_by:state.user.id,is_group:true,title:title.trim().slice(0,80)});
  if(createError){toast(createError.message,"error");return}
  const members=[state.user.id,...valid.map(p=>p.id)].map(user_id=>({conversation_id:id,user_id}));
  const {error:memberError}=await supabase.from("conversation_members").insert(members);
  if(memberError){toast(memberError.message,"error");return}
  await loadChatList();await openChat(id,title.trim());toast("تم إنشاء المجموعة.");
});
async function openChat(id,title){
  state.chatId=id;
  if(state.chatChannel){await supabase.removeChannel(state.chatChannel);state.chatChannel=null}
  const panel=$("#chat-panel");panel.innerHTML="";
  const head=document.createElement("div");head.className="chat-head";head.textContent=title;const messages=document.createElement("div");messages.className="message-list";messages.id="message-list";
  const form=document.createElement("form");form.className="message-form";form.id="message-form";
  const input=document.createElement("input");input.placeholder="اكتب رسالة...";input.maxLength=5000;input.required=true;
  const send=document.createElement("button");send.className="primary";send.type="submit";send.textContent="إرسال";
  form.append(input,send);panel.append(head,messages,form);
  form.addEventListener("submit",async event=>{
    event.preventDefault();if(!input.value.trim())return;send.disabled=true;
    const {error}=await supabase.from("messages").insert({conversation_id:id,sender_id:state.user.id,content:input.value.trim()});
    send.disabled=false;if(error){toast(error.message,"error");return}input.value="";await loadMessages(id);
  });
  await loadMessages(id);
  state.chatChannel=supabase.channel("mk-chat-"+id).on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:"conversation_id=eq."+id},()=>loadMessages(id)).subscribe();
}
async function loadMessages(id){
  const host=$("#message-list");if(!host||state.chatId!==id)return;
  const {data,error}=await supabase.from("messages").select("id,sender_id,content,created_at").eq("conversation_id",id).order("created_at",{ascending:true}).limit(100);
  if(error){toast(error.message,"error");return}
  host.innerHTML="";(data||[]).forEach(message=>{
    const bubble=document.createElement("div");bubble.className="message-bubble"+(message.sender_id===state.user.id?" mine":"");
    const content=safeText(document.createElement("span"),message.content);const time=safeText(document.createElement("small"),formatDate(message.created_at));bubble.append(content,time);host.append(bubble);
  });host.scrollTop=host.scrollHeight;
}
$("#chat-user-search").addEventListener("focus",()=>{if(!state.user){openAuth("signin")}});
async function callOwnerAction(action,payload){
  const {data,error}=await supabase.functions.invoke("owner-user-admin",{body:{action,...payload}});
  if(error)throw error;
  if(data?.error)throw new Error(data.error);
  return data;
}
async function loadAdminDashboard(){
  if(!state.isOwner)return;
  const {data:stats,error}=await supabase.rpc("admin_get_stats");
  if(error){toast("تعذر تحميل لوحة المالك: "+error.message,"error");return}
  const statItems=[["الأعضاء",stats.users],["المنشورات",stats.posts],["بلاغات معلّقة",stats.reports_pending],["الأفلام",stats.films],["حسابات محظورة",stats.bans]];
  const statHost=$("#admin-stats");statHost.innerHTML="";
  statItems.forEach(([label,value])=>{const card=document.createElement("div");card.className="stat-card";const small=safeText(document.createElement("small"),label);const strong=safeText(document.createElement("b"),String(value));card.append(small,strong);statHost.append(card)});
  await Promise.all([loadAdminUsers(),loadAdminReports(),loadAdminFilms(),loadAdminAudit()]);
}
async function loadAdminUsers(){
  if(!state.isOwner)return;const search=$("#admin-user-search").value.trim();
  const {data,error}=await supabase.rpc("admin_list_users",{p_search:search||null,p_limit:100});
  const host=$("#admin-users");host.innerHTML="";if(error){host.textContent=error.message;return}
  if(!data?.length){host.textContent="لا يوجد أعضاء مطابقون.";return}
  const {data:profiles}=await supabase.from("profiles").select("id,username,bio").in("id",data.map(x=>x.user_id));
  const profileMap=new Map((profiles||[]).map(p=>[p.id,p]));
  data.forEach(user=>{user.username=profileMap.get(user.user_id)?.username||"";user.bio=profileMap.get(user.user_id)?.bio||"";
    const row=document.createElement("div");row.className="admin-row";const info=document.createElement("div");
    const name=safeText(document.createElement("b"),user.display_name||user.email||user.user_id);
    const detail=safeText(document.createElement("small"),user.email+" · "+formatDate(user.created_at));info.append(name,detail);
    const actions=document.createElement("div");actions.className="admin-row-actions";
    const banned=user.banned_reason&&(user.expires_at===null||new Date(user.expires_at)>new Date());
    const button=document.createElement("button");button.className="small-action "+(banned?"ok":"danger");button.textContent=banned?"رفع الحظر":"حظر";
    button.addEventListener("click",async()=>{
      try{
        if(banned){if(!confirm("هل تريد رفع الحظر عن هذا العضو؟"))return;await callOwnerAction("unban",{user_id:user.user_id});toast("تم رفع الحظر.")}
        else{const reason=prompt("سبب الحظر:","مخالفة قواعد المجتمع");if(!reason?.trim())return;const duration=prompt("اكتب مدة الحظر: day أو week أو month أو permanent","week");if(!["day","week","month","permanent"].includes(duration))return;await callOwnerAction("ban",{user_id:user.user_id,reason,duration});toast("تم حظر الحساب.")}
        await loadAdminDashboard();
      }catch(error){toast(error.message||"تعذر تنفيذ الإجراء.","error")}
    });
    const del=document.createElement("button");del.className="small-action danger";del.textContent="حذف الحساب";
    del.addEventListener("click",async()=>{
      if(prompt("هذا الإجراء نهائي ويحذف الحساب ومحتواه. اكتب DELETE للتأكيد:")!=="DELETE")return;
      try{await callOwnerAction("delete",{user_id:user.user_id});toast("تم حذف الحساب.");await loadAdminDashboard()}
      catch(error){toast(error.message||"تعذر حذف الحساب.","error")}
    });
    const editProfile=document.createElement("button");editProfile.className="small-action";editProfile.textContent="تعديل الملف";
    editProfile.addEventListener("click",async()=>{
      const displayName=prompt("الاسم الظاهر:",user.display_name||"");if(displayName===null)return;
      const username=prompt("اسم المستخدم:",user.username||"");if(username===null)return;
      const bio=prompt("النبذة:",user.bio||"");if(bio===null)return;
      const {error}=await supabase.rpc("admin_update_profile",{p_user_id:user.user_id,p_display_name:displayName,p_bio:bio,p_username:username});
      if(error){toast(error.message,"error");return}toast("تم تحديث الملف الشخصي.");loadAdminUsers();
    });
    actions.append(button,editProfile,del);row.append(info,actions);host.append(row);
  });
}
async function loadAdminReports(){
  if(!state.isOwner)return;const host=$("#admin-reports");host.innerHTML="";
  const {data,error}=await supabase.from("content_reports").select("id,reporter_id,target_type,target_id,reason,details,status,created_at").order("created_at",{ascending:false}).limit(100);
  if(error){host.textContent=error.message;return}if(!data?.length){host.textContent="لا توجد بلاغات حالياً.";return}
  data.forEach(report=>{
    const row=document.createElement("div");row.className="admin-row";const info=document.createElement("div");
    info.append(safeText(document.createElement("b"),report.target_type+" · "+report.reason),safeText(document.createElement("small"),report.details+" · "+report.status+" · "+formatDate(report.created_at)));
    const actions=document.createElement("div");actions.className="admin-row-actions";
    const review=document.createElement("button");review.className="small-action ok";review.textContent="تمت المراجعة";
    review.addEventListener("click",async()=>{const {error}=await supabase.rpc("admin_review_report",{p_report_id:report.id,p_status:"reviewed"});if(error){toast(error.message,"error");return}loadAdminReports()});
    const reject=document.createElement("button");reject.className="small-action";reject.textContent="رفض البلاغ";
    reject.addEventListener("click",async()=>{const {error}=await supabase.rpc("admin_review_report",{p_report_id:report.id,p_status:"rejected"});if(error){toast(error.message,"error");return}loadAdminReports()});
    actions.append(review,reject);
    if(report.target_type==="post"){
      const hide=document.createElement("button");hide.className="small-action danger";hide.textContent="إخفاء المنشور";
      hide.addEventListener("click",async()=>{const {error}=await supabase.rpc("admin_set_post_visibility",{p_post_id:report.target_id,p_hidden:true});if(error){toast(error.message,"error");return}toast("تم إخفاء المنشور.");loadSocialFeed()});actions.append(hide);
    }
    if(report.target_type==="comment"){
      const removeComment=document.createElement("button");removeComment.className="small-action danger";removeComment.textContent="حذف التعليق";
      removeComment.addEventListener("click",async()=>{const {error}=await supabase.rpc("admin_delete_comment",{p_comment_id:report.target_id});if(error){toast(error.message,"error");return}toast("تم حذف التعليق.");loadAdminReports()});actions.append(removeComment);
    }
    if(report.target_type==="user"){
      const banUser=document.createElement("button");banUser.className="small-action danger";banUser.textContent="حظر العضو";
      banUser.addEventListener("click",async()=>{const reason=prompt("سبب الحظر:",report.reason);if(!reason?.trim())return;try{await callOwnerAction("ban",{user_id:report.target_id,reason,duration:"week"});toast("تم حظر العضو.");loadAdminUsers()}catch(error){toast(error.message,"error")}});actions.append(banUser);
    }
    row.append(info,actions);host.append(row);
  });
}
async function loadAdminFilms(){
  if(!state.isOwner)return;const host=$("#admin-films");host.innerHTML="";
  const {data,error}=await supabase.from("cinema_catalog").select("id,title,content_type,published,rights_basis,source_name").order("created_at",{ascending:false}).limit(100);
  if(error){host.textContent=error.message;return}if(!data?.length){host.textContent="لم تضف أفلاماً بعد.";return}
  data.forEach(film=>{
    const row=document.createElement("div");row.className="admin-row";const info=document.createElement("div");
    info.append(safeText(document.createElement("b"),film.title),safeText(document.createElement("small"),film.content_type+" · "+film.source_name+" · "+film.rights_basis+" · "+(film.published?"منشور":"مسودة")));
    const actions=document.createElement("div");actions.className="admin-row-actions";
    const edit=document.createElement("button");edit.className="small-action";edit.textContent="تعديل";
    edit.addEventListener("click",async()=>{
      const {data:full,error}=await supabase.from("cinema_catalog").select("*").eq("id",film.id).single();
      if(error){toast(error.message,"error");return}
      $("#film-id").value=full.id;$("#film-title").value=full.title;$("#film-type").value=full.content_type;$("#film-year").value=full.release_year||"";$("#film-genres").value=(full.genres||[]).join(", ");
      $("#film-poster").value=full.poster_url||"";$("#film-trailer").value=full.trailer_url||"";$("#film-watch").value=full.watch_url;$("#film-source").value=full.source_name||"";$("#film-rights").value=full.rights_basis;$("#film-description").value=full.description||"";$("#film-published").checked=full.published;
      $("#admin-film-form").scrollIntoView({behavior:"smooth",block:"center"});
    });
    const del=document.createElement("button");del.className="small-action danger";del.textContent="حذف";
    del.addEventListener("click",async()=>{if(!confirm("حذف هذا العنوان من مكتبة السينما؟"))return;const {error}=await supabase.rpc("admin_delete_film",{p_film_id:film.id});if(error){toast(error.message,"error");return}loadAdminFilms();loadCinema()});
    actions.append(edit,del);row.append(info,actions);host.append(row);
  });
}
async function loadAdminAudit(){
  if(!state.isOwner)return;const host=$("#admin-audit");host.innerHTML="";
  const {data,error}=await supabase.from("admin_audit_log").select("action,target_type,target_id,created_at").order("created_at",{ascending:false}).limit(30);
  if(error){host.textContent=error.message;return}if(!data?.length){host.textContent="لا توجد عمليات مسجلة بعد.";return}
  data.forEach(item=>{const row=document.createElement("div");row.className="admin-row";row.append(safeText(document.createElement("b"),item.action+" · "+item.target_type),safeText(document.createElement("small"),(item.target_id||"")+" · "+formatDate(item.created_at)));host.append(row)});
}
$("#admin-user-search").addEventListener("input",()=>{clearTimeout(searchDelay);searchDelay=setTimeout(loadAdminUsers,250)});
$("#refresh-users").addEventListener("click",loadAdminUsers);$("#refresh-reports").addEventListener("click",loadAdminReports);$("#refresh-audit").addEventListener("click",loadAdminAudit);
$("#admin-film-form").addEventListener("submit",async event=>{
  event.preventDefault();if(!state.isOwner)return;
  const button=$("#admin-film-form button[type=submit]");button.disabled=true;
  try{
    let posterUrl=$("#film-poster").value.trim()||null,trailerUrl=$("#film-trailer").value.trim()||null;
    const posterFile=$("#film-poster-file").files?.[0],trailerFile=$("#film-trailer-file").files?.[0];
    if(posterFile){if(!posterFile.type.startsWith("image/"))throw new Error("ملف الملصق يجب أن يكون صورة.");posterUrl=await uploadUserMedia(posterFile,"cinema-posters")}
    if(trailerFile){if(!trailerFile.type.startsWith("video/"))throw new Error("ملف الإعلان يجب أن يكون فيديو.");trailerUrl=await uploadUserMedia(trailerFile,"cinema-trailers")}
    const {error}=await supabase.rpc("admin_upsert_film",{
      p_id:$("#film-id").value||null,p_title:$("#film-title").value.trim(),p_description:$("#film-description").value.trim(),
      p_content_type:$("#film-type").value,p_release_year:$("#film-year").value?Number($("#film-year").value):null,
      p_genres:$("#film-genres").value.split(",").map(x=>x.trim()).filter(Boolean),
      p_poster_url:posterUrl,p_trailer_url:trailerUrl,
      p_watch_url:$("#film-watch").value.trim(),p_source_name:$("#film-source").value.trim(),
      p_rights_basis:$("#film-rights").value,p_published:$("#film-published").checked
    });
    if(error)throw error;$("#admin-film-form").reset();$("#film-id").value="";toast("تم حفظ عنوان السينما.");await loadAdminFilms();await loadCinema();await loadAdminDashboard();
  }catch(error){toast(error.message||"تعذر حفظ العنوان.","error")}
  finally{button.disabled=false}
});

$("#chat-user-search").addEventListener("focus",()=>{if(!state.user)openAuth("signin")});
const initial=await supabase.auth.getSession();
if(initial.data.session?.user){await refreshIdentity(initial.data.session.user);await loadChatList()}
renderPostsPlaceholder();
function renderPostsPlaceholder(){
  // The feed is populated from Supabase after authentication; no fake user content is inserted.
  $("#home-feed").innerHTML='<div class="empty-state"><span>◉</span><b>اكتشف مجتمع MK</b><p>المنشورات العامة ستظهر هنا.</p></div>';
  $("#social-feed").innerHTML='<div class="empty-state"><span>◉</span><b>ابدأ أول منشور في مجتمع MK</b><p>سجل الدخول وشارك أفكارك وصورك وفيديوهاتك.</p></div>';
}
await loadSocialFeed();await loadCinema();
if(state.user)await loadChatList();
