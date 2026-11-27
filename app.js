import { createClient } from "https://esm.sh/@supabase/supabase-js@2.119.2";

const SUPABASE_URL = "https://zdiexngxbcummxhnuacr.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_kGDOwsesrJqXQ1rrCiBZ7Q_xSXp5Hkh";
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
});

const demoPosts = [
  {name:"فريق MK",time:"منذ قليل",body:"مرحباً بكم في MK Universe 🌌 مساحة جديدة تجمع السينما والمجتمع والتواصل في تجربة واحدة. هذه معاينة أولية للتصميم."},
  {name:"عالم الأفلام",time:"منذ ساعة",body:"ما نوع الأفلام الذي تحبون اكتشافه أكثر؟ الخيال العلمي، الدراما، الأكشن أم الوثائقيات؟ 🎬"},
  {name:"مجتمع MK",time:"أمس",body:"شاركوا أفكاركم واقتراحاتكم للأقسام التي تتمنون رؤيتها داخل MK Universe. نبني هذا العالم خطوة بخطوة ✨"}
];
const $ = (s,root=document)=>root.querySelector(s);
const $$ = (s,root=document)=>[...root.querySelectorAll(s)];
const state = { authMode:"signup", user:null, profile:null, busy:false };
function toast(message,type="success"){const el=document.createElement("div");el.className="toast "+type;el.textContent=message;$("#toast-region").append(el);setTimeout(()=>el.remove(),4200)}
function renderPosts(target){const host=$(target);host.innerHTML="";demoPosts.forEach(post=>{const card=document.createElement("article");card.className="post-card";const head=document.createElement("div");head.className="post-head";const avatar=document.createElement("div");avatar.className="avatar";avatar.textContent="MK";const meta=document.createElement("div");meta.className="post-meta";const name=document.createElement("b");name.textContent=post.name;const time=document.createElement("small");time.textContent=post.time;meta.append(name,time);head.append(avatar,meta);const body=document.createElement("p");body.className="post-body";body.textContent=post.body;const actions=document.createElement("div");actions.className="post-actions";const like=document.createElement("button");like.type="button";like.textContent="♡ إعجاب";like.addEventListener("click",()=>{like.textContent=like.textContent.startsWith("♡")?"♥ أعجبني":"♡ إعجاب"});const comment=document.createElement("button");comment.type="button";comment.textContent="◌ تعليق";comment.addEventListener("click",()=>toast("التعليقات الحقيقية ستضاف في مرحلة ربط المجتمع."));actions.append(like,comment);card.append(head,body,actions);host.append(card)})}
function navigate(page){const target=$("#page-"+page);if(!target)return;$$(".page").forEach(p=>p.classList.toggle("active",p===target));$$("[data-page]").forEach(b=>b.classList.toggle("active",b.dataset.page===page));window.scrollTo({top:0,behavior:"smooth"})}
$$("[data-page]").forEach(btn=>btn.addEventListener("click",()=>navigate(btn.dataset.page)));
$$("[data-go]").forEach(btn=>btn.addEventListener("click",()=>navigate(btn.dataset.go)));
function openAuth(mode=state.authMode){state.authMode=mode;const signup=mode==="signup";$("#auth-heading").textContent=signup?"انضم إلى MK Universe":"مرحباً بعودتك";$("#auth-description").textContent=signup?"أنشئ حسابك وابدأ رحلتك.":"سجل الدخول إلى حساب MK ID.";$("#display-name-wrap").classList.toggle("hidden",!signup);$("#auth-name").required=signup;$("#auth-password").autocomplete=signup?"new-password":"current-password";$("#auth-submit").textContent=signup?"إنشاء الحساب":"تسجيل الدخول";$("#auth-switch").textContent=signup?"لديك حساب؟ سجل الدخول":"ليس لديك حساب؟ أنشئ حساباً";$("#forgot-password").classList.toggle("hidden",signup);$("#auth-modal").classList.remove("hidden");$("#auth-modal").setAttribute("aria-hidden","false")}
function closeAuth(){$("#auth-modal").classList.add("hidden");$("#auth-modal").setAttribute("aria-hidden","true")}
$$("[data-close-auth]").forEach(el=>el.addEventListener("click",closeAuth));
$("#auth-button").addEventListener("click",()=>openAuth(state.user?"signin": "signup"));
$("#auth-switch").addEventListener("click",()=>openAuth(state.authMode==="signup"?"signin":"signup"));
$("#logout-button").addEventListener("click",async()=>{const {error}=await supabase.auth.signOut();if(error){toast(error.message,"error");return}state.user=null;state.profile=null;updateAccountUI();toast("تم تسجيل الخروج.")});
function updateAccountUI(){const button=$("#auth-button");const logout=$("#logout-button");if(state.user){button.textContent=state.profile?.display_name||state.user.email?.split("@")[0]||"حسابي";button.classList.add("hidden");logout.classList.remove("hidden");$(".profile-card h2").textContent=state.profile?.display_name||"عضو MK Universe";$(".profile-card p").textContent=state.user.email||"حساب MK ID";$(".profile-card .muted").textContent="حساب MK ID نشط"}else{button.textContent="دخول / إنشاء حساب";button.classList.remove("hidden");logout.classList.add("hidden");$(".profile-card h2").textContent="عضو MK Universe";$(".profile-card p").textContent="سيظهر اسمك وصورتك ونبذتك هنا بعد إنشاء حساب MK ID."}}
async function loadProfile(user){const {data,error}=await supabase.from("profiles").select("display_name,username,avatar_url,bio").eq("id",user.id).maybeSingle();if(error){console.error("Profile load:",error.message);return null}return data}
$("#auth-form").addEventListener("submit",async event=>{event.preventDefault();if(state.busy)return;const button=$("#auth-submit");const email=$("#auth-email").value.trim().toLowerCase();const password=$("#auth-password").value;const displayName=$("#auth-name").value.trim();state.busy=true;button.disabled=true;button.textContent="لحظة من فضلك...";
try{
 if(state.authMode==="signup"){
  const {data,error}=await supabase.auth.signUp({email,password,options:{data:{display_name:displayName},emailRedirectTo:window.location.href.split("#")[0]}});
  if(error)throw error;
  if(data.session){state.user=data.user;state.profile=await loadProfile(data.user);updateAccountUI();closeAuth();toast("تم إنشاء حساب MK ID بنجاح.")}
  else{closeAuth();toast("تم إرسال رابط تأكيد إلى بريدك الإلكتروني. افتح الرسالة لتفعيل الحساب.")}
 }else{
  const {data,error}=await supabase.auth.signInWithPassword({email,password});if(error)throw error;
  state.user=data.user;state.profile=await loadProfile(data.user);updateAccountUI();closeAuth();toast("مرحباً بك في MK Universe.");
 }
}catch(error){toast(error.message||"تعذر إكمال العملية. حاول مجدداً.","error")}
finally{state.busy=false;button.disabled=false;button.textContent=state.authMode==="signup"?"إنشاء الحساب":"تسجيل الدخول"}
});
$("#forgot-password").addEventListener("click",async()=>{const email=$("#auth-email").value.trim().toLowerCase();if(!email){toast("اكتب بريدك الإلكتروني أولاً.","error");return}const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:window.location.href.split("#")[0]});if(error){toast(error.message,"error");return}toast("إذا كان البريد مسجلاً، سيصلك رابط استعادة كلمة المرور.")});
supabase.auth.onAuthStateChange(async(event,session)=>{if(event==="PASSWORD_RECOVERY"){const next=window.prompt("أدخل كلمة المرور الجديدة (8 أحرف على الأقل):");if(next&&next.length>=8){const {error}=await supabase.auth.updateUser({password:next});toast(error?error.message:"تم تحديث كلمة المرور.",error?"error":"success")}return}if(session?.user){state.user=session.user;state.profile=await loadProfile(session.user)}else if(event==="SIGNED_OUT"){state.user=null;state.profile=null}updateAccountUI()});
$("#post-form").addEventListener("submit",event=>{event.preventDefault();const field=$("#post-content");const content=field.value.trim();if(!content)return;if(!state.user){toast("سجل الدخول أولاً قبل نشر منشور.","error");openAuth("signup");return}demoPosts.unshift({name:state.profile?.display_name||"عضو MK",time:"الآن",body:content});renderPosts("#social-feed");renderPosts("#home-feed");field.value="";toast("أُضيف المنشور إلى المعاينة فقط. الحفظ الدائم قادم في المرحلة التالية.")});
renderPosts("#home-feed");renderPosts("#social-feed");
const {data:{session}}=await supabase.auth.getSession();if(session?.user){state.user=session.user;state.profile=await loadProfile(session.user)}updateAccountUI();
