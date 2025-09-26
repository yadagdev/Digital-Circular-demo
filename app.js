// Digital-Circular-demo — simple Ichinoichi-like circular board demo.
// Data persisted in localStorage; roles: officer/member/guest.

const KEYS = {
  user: "dc_demo_user",
  posts: "dc_demo_posts",
  seen: "dc_demo_seen",
};

// --- URL Params for Demo ---
function getParams() {
  const u = new URLSearchParams(location.search);
  const obj = {};
  for (const [k,v] of u.entries()) obj[k] = v;
  return obj;
}
const DEMO = getParams();
if (DEMO.fresh === "1") {
  try {
    localStorage.removeItem(KEYS.user);
    localStorage.removeItem(KEYS.posts);
    localStorage.removeItem(KEYS.seen);
  } catch (e) {}
}

// Utilities
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const nowISO = () => new Date().toISOString();
const uid = () => Math.random().toString(36).slice(2, 10);
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const load = (k, d) => JSON.parse(localStorage.getItem(k) || JSON.stringify(d));

// Seed data
function seedSample() {
  const posts = [
    {
      id: uid(),
      title: "【防災訓練】9/30(日) 9:00 集合",
      body: "集合場所: 第三公園。持ち物: 水、タオル、動きやすい服装。\n参加可否はコメントで教えてください。",
      tags: ["防災", "回覧板"],
      group: "全体",
      author: { id: "sys-officer", name: "自治会 役員" },
      createdAt: nowISO(),
      requireConfirm: true,
      allowComments: true,
      likes: [],
      confirms: [],
      comments: [],
    },
    {
      id: uid(),
      title: "【清掃活動】A班 10/5(土) 7:00",
      body: "A班のみ、集合は資源置き場付近。軍手配布します。",
      tags: ["清掃", "A班"],
      group: "A班",
      author: { id: "sys-officer", name: "A班 班長" },
      createdAt: nowISO(),
      requireConfirm: true,
      allowComments: true,
      likes: [],
      confirms: [],
      comments: [],
    },
    {
      id: uid(),
      title: "【回覧】資源回収スケジュール（10月）",
      body: "第1・第3火曜: 可燃\n第2・第4金曜: 資源\n祝日の週は変更あり。詳細は掲示板をご確認ください。",
      tags: ["資源回収", "回覧板"],
      group: "全体",
      author: { id: "sys-officer", name: "資源委員" },
      createdAt: nowISO(),
      requireConfirm: false,
      allowComments: false,
      likes: [],
      confirms: [],
      comments: [],
    },
  ];
  save(KEYS.posts, posts);
  save(KEYS.seen, {});
}

function currentUser() { return load(KEYS.user, null); }
function setUser(u) { save(KEYS.user, u); }

function postsAll() { return load(KEYS.posts, []); }
function postsSave(arr) { save(KEYS.posts, arr); }

function ensureSeed() {
  if (!localStorage.getItem(KEYS.posts)) {
    seedSample();
  }
}

// UI State
const state = { tab: "home", filterGroup: "", q: "" };

// DOM refs
const loginView = $("#loginView");
const homeView = $("#homeView");
const newView = $("#newView");
const groupsView = $("#groupsView");
const navTabs = $("#navTabs");
const roleBadge = $("#roleBadge");
const feedEl = $("#feed");
const searchInput = $("#searchInput");
const groupFilter = $("#groupFilter");
const userButton = $("#userButton");
const menuPanel = $("#menuPanel");
const userInfo = $("#userInfo");
const logoutBtn = $("#logoutBtn");
const seedBtn = $("#seedBtn");
const exportBtn = $("#exportBtn");
const importInput = $("#importInput");
const notif = $("#notif");
const postDialog = $("#postDialog");
const postDetail = $("#postDetail");
const closeDialog = $("#closeDialog");

// Init
function init() {
  ensureSeed();
  // group filter options
  const groups = ["全体", "A班", "B班", "C班"];
  groups.forEach(g => {
    const opt = document.createElement("option");
    opt.value = g;
    opt.textContent = g;
    groupFilter.appendChild(opt);
  });

  // Event wiring
  $("#loginBtn").addEventListener("click", onLogin);
  userButton.addEventListener("click", () => menuPanel.hidden = !menuPanel.hidden);
  document.body.addEventListener("click", (e) => { if (!e.target.closest(".menu")) menuPanel.hidden = true; });
  logoutBtn.addEventListener("click", () => { localStorage.removeItem(KEYS.user); location.reload(); });
  seedBtn.addEventListener("click", () => { seedSample(); render(); alert("サンプルデータを再投入しました。"); });
  exportBtn.addEventListener("click", exportData);
  importInput.addEventListener("change", importData);

  $("#newForm").addEventListener("submit", onCreatePost);
  searchInput.addEventListener("input", () => { state.q = searchInput.value.trim(); renderFeed(); });
  groupFilter.addEventListener("change", () => { state.filterGroup = groupFilter.value; renderFeed(); });
  $$("button.tab").forEach(btn => btn.addEventListener("click", () => switchTab(btn.dataset.tab)));
  closeDialog.addEventListener("click", () => postDialog.close());

  // Demo hooks
  if (DEMO.demo === "1" && !localStorage.getItem(KEYS.posts)) { seedSample(); }
  if (DEMO.autologin === "1") {
    const name = decodeURIComponent(DEMO.name || "デモ 太郎");
    const group = decodeURIComponent(DEMO.group || "A班");
    const role = (DEMO.role === "officer" || DEMO.role === "member" || DEMO.role === "guest") ? DEMO.role : "member";
    setUser({ id: uid(), name, group, role });
  }

  // Start
  if (currentUser()) { showApp(); } else { showLogin(); }
}

function onLogin() {
  const name = $("#loginName").value.trim() || "名無し";
  const group = $("#loginGroup").value;
  const role = document.querySelector('input[name="role"]:checked').value;
  setUser({ id: uid(), name, group, role });
  showApp();
}

function showLogin() {
  loginView.hidden = false;
  homeView.hidden = true;
  newView.hidden = true;
  groupsView.hidden = true;
  navTabs.hidden = true;
  userButton.textContent = "未ログイン";
}

function switchTab(t) {
  state.tab = t;
  $$(".tab").forEach(b => b.classList.toggle("active", b.dataset.tab === t));
  homeView.hidden = t !== "home";
  newView.hidden = t !== "new";
  groupsView.hidden = t !== "groups";
  render();
}

function showApp() {
  const u = currentUser();
  userButton.textContent = u.name;
  navTabs.hidden = false;
  loginView.hidden = true;
  switchTab("home");
}

function render() {
  const u = currentUser();
  userInfo.innerHTML = `<div><b>${u.name}</b>（${roleLabel(u.role)}）</div><div class="small">所属: ${u.group}</div>`;
  roleBadge.textContent = `ロール: ${roleLabel(u.role)}`;
  document.querySelector('[data-tab="new"]').style.display = (u.role === "officer") ? "inline-flex" : "none";
  renderFeed();
  updateNotifBadge();
}

function roleLabel(role) { return role === "officer" ? "役員" : role === "member" ? "一般" : "ゲスト"; }

function renderFeed() {
  const u = currentUser();
  const posts = postsAll()
    .filter(p => !state.filterGroup || p.group === state.filterGroup || (state.filterGroup === "全体" && p.group === "全体"))
    .filter(p => !state.q || (p.title + " " + p.body + " " + (p.tags||[]).join(",")).includes(state.q))
    .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));

  feedEl.innerHTML = "";
  if (posts.length === 0) { feedEl.innerHTML = `<p class="muted">投稿がありません。</p>`; return; }

  posts.forEach(p => {
    const isLiked = p.likes.includes(u.id);
    const isConfirmed = p.confirms.some(c => c.id === u.id);
    const canInteract = u.role !== "guest";
    const isAuthor = p.author.id === u.id || u.role === "officer";

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="meta">
        <span>${escapeHtml(p.author.name)}</span>
        <span>・</span>
        <span>${new Date(p.createdAt).toLocaleString()}</span>
        <span>・</span>
        <span class="tag">${p.group}</span>
      </div>
      <div class="title">${escapeHtml(p.title)}</div>
      <div class="body">${escapeHtml(p.body)}</div>
      <div class="tags">${(p.tags||[]).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join(" ")}</div>
      <div class="actions">
        <button class="btn" data-act="open">詳細</button>
        <button class="btn" data-act="like" ${!canInteract ? "disabled":""}>❤️ いいね (${p.likes.length})</button>
        <button class="btn ${isConfirmed ? "ok":""}" data-act="confirm" ${!canInteract || !p.requireConfirm ? "disabled":""}>✅ 確認する (${p.confirms.length})</button>
        <button class="btn" data-act="who">確認者一覧</button>
        ${p.allowComments ? `<button class="btn" data-act="comment" ${!canInteract ? "disabled":""}>💬 コメント (${p.comments.length})</button>` : ""}
        ${isAuthor ? `<button class="btn danger" data-act="delete">削除</button>` : ""}
      </div>
    `;

    card.querySelector('[data-act="open"]').addEventListener("click", () => openPost(p.id));
    card.querySelector('[data-act="who"]').addEventListener("click", () => showConfirmers(p.id));
    if (card.querySelector('[data-act="like"]')) card.querySelector('[data-act="like"]').addEventListener("click", () => toggleLike(p.id));
    if (card.querySelector('[data-act="confirm"]')) card.querySelector('[data-act="confirm"]').addEventListener("click", () => doConfirm(p.id));
    if (card.querySelector('[data-act="comment"]')) card.querySelector('[data-act="comment"]').addEventListener("click", () => openPost(p.id, true));
    if (card.querySelector('[data-act="delete"]')) card.querySelector('[data-act="delete"]').addEventListener("click", () => deletePost(p.id));

    feedEl.appendChild(card);
    markSeen(p.id);
  });
}

function openPost(id, focusComment=false) {
  const u = currentUser();
  const posts = postsAll();
  const p = posts.find(x => x.id === id);

  const isLiked = p.likes.includes(u.id);
  const isConfirmed = p.confirms.some(c => c.id === u.id);
  const canInteract = u.role !== "guest";
  const isAuthor = p.author.id === u.id || u.role === "officer";

  postDetail.innerHTML = `
    <div class="meta">
      <span>${escapeHtml(p.author.name)}</span>・
      <span>${new Date(p.createdAt).toLocaleString()}</span>・
      <span class="tag">${p.group}</span>
    </div>
    <h3>${escapeHtml(p.title)}</h3>
    <div class="body">${escapeHtml(p.body)}</div>
    ${(p.tags||[]).length ? `<div class="tags" style="margin-top:8px;">${p.tags.map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join(" ")}</div>`:""}
    <div class="actions">
      <button class="btn" id="dlg-like" ${!canInteract ? "disabled":""}>❤️ いいね (${p.likes.length})</button>
      <button class="btn ${isConfirmed ? "ok":""}" id="dlg-confirm" ${!canInteract || !p.requireConfirm ? "disabled":""}>✅ 確認する (${p.confirms.length})</button>
      <button class="btn" id="dlg-who">確認者一覧</button>
      ${isAuthor ? `<button class="btn danger" id="dlg-delete">削除</button>` : ""}
    </div>
    ${p.allowComments ? `
      <div class="comment-box">
        <input id="commentInput" placeholder="コメントを書く（Enterで送信）" ${!canInteract?"disabled":""}>
      </div>
      <div id="comments"></div>
    ` : `<p class="small" style="margin-top:8px;">コメントは無効化されています。</p>`}
    <div class="kakunin-list"></div>
  `;

  $("#dlg-like").addEventListener("click", () => toggleLike(p.id, true));
  $("#dlg-confirm").addEventListener("click", () => doConfirm(p.id, true));
  $("#dlg-who").addEventListener("click", () => showConfirmers(p.id, true));
  if ($("#dlg-delete")) $("#dlg-delete").addEventListener("click", () => { deletePost(p.id); postDialog.close(); });

  if (p.allowComments) {
    const ci = $("#commentInput");
    ci?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const val = ci.value.trim();
        if (!val) return;
        addComment(p.id, val);
        ci.value = "";
        renderComments(p.id);
        renderFeed();
      }
    });
    renderComments(p.id);
  }

  postDialog.showModal();
  if (focusComment) $("#commentInput")?.focus();
}

function renderComments(id) {
  const posts = postsAll();
  const p = posts.find(x=>x.id === id);
  const wrap = $("#comments");
  wrap.innerHTML = "";
  p.comments.forEach(c => {
    const el = document.createElement("div");
    el.className = "comment";
    el.innerHTML = `
      <div class="meta">${escapeHtml(c.user.name)} ・ ${new Date(c.at).toLocaleString()}</div>
      <div>${escapeHtml(c.body)}</div>
    `;
    wrap.appendChild(el);
  });
}

function addComment(id, body) {
  const u = currentUser();
  const posts = postsAll();
  const p = posts.find(x=>x.id === id);
  p.comments.push({ id: uid(), user: { id: u.id, name: u.name }, body, at: nowISO() });
  postsSave(posts);
}

function showConfirmers(id, inDialog=false) {
  const posts = postsAll();
  const p = posts.find(x=>x.id === id);
  const list = p.confirms.map(c => `${escapeHtml(c.name)}（${new Date(c.at).toLocaleString()}）`).join("<br>") || "まだ確認者はいません。";
  if (inDialog) {
    postDetail.querySelector(".kakunin-list").innerHTML = `<div class="small">確認者</div>${list}`;
  } else {
    alert(`確認者一覧:\n\n${p.confirms.map(c => `${c.name}（${new Date(c.at).toLocaleString()}）`).join("\n") || "（なし）"}`);
  }
}

function toggleLike(id, inDialog=false) {
  const u = currentUser();
  const posts = postsAll();
  const p = posts.find(x=>x.id === id);
  const i = p.likes.indexOf(u.id);
  if (i >= 0) p.likes.splice(i,1); else p.likes.push(u.id);
  postsSave(posts);
  renderFeed();
  if (inDialog) openPost(id);
}

function doConfirm(id, inDialog=false) {
  const u = currentUser();
  const posts = postsAll();
  const p = posts.find(x=>x.id === id);
  if (!p.requireConfirm) return;
  if (!p.confirms.some(c => c.id === u.id)) {
    p.confirms.push({ id: u.id, name: u.name, at: nowISO() });
  }
  postsSave(posts);
  renderFeed();
  if (inDialog) openPost(id);
}

function deletePost(id) {
  if (!confirm("この投稿を削除しますか？")) return;
  const posts = postsAll().filter(p => p.id !== id);
  postsSave(posts);
  renderFeed();
}

function onCreatePost(e) {
  e.preventDefault();
  const u = currentUser();
  if (u.role !== "officer") { alert("役員のみ投稿できます。"); return; }
  const fd = new FormData(e.target);
  const post = {
    id: uid(),
    title: (fd.get("title")||"").toString().trim(),
    body: (fd.get("body")||"").toString().trim(),
    tags: (fd.get("tags")||"").toString().split(",").map(s=>s.trim()).filter(Boolean),
    group: (fd.get("group")||"全体").toString(),
    author: { id: u.id, name: u.name },
    createdAt: nowISO(),
    requireConfirm: !!fd.get("requireConfirm"),
    allowComments: !!fd.get("allowComments"),
    likes: [],
    confirms: [],
    comments: [],
  };
  if (!post.title || !post.body) { alert("タイトルと本文は必須です。"); return; }
  const posts = postsAll();
  posts.unshift(post);
  postsSave(posts);
  e.target.reset();
  alert("投稿しました。");
  switchTab("home");
}

// Notifications (approximate: new within 48h and unseen)
function updateNotifBadge() {
  const u = currentUser();
  const seen = load(KEYS.seen, {});
  const posts = postsAll().filter(p => {
    const ageH = (Date.now()-new Date(p.createdAt).getTime())/36e5;
    return ageH < 48;
  });
  let count = 0;
  posts.forEach(p => { const m = seen[p.id] || {}; if (!m[u.id]) count++; });
  notif.textContent = String(count);
}
function markSeen(postId) {
  const u = currentUser();
  const seen = load(KEYS.seen, {});
  seen[postId] = seen[postId] || {};
  seen[postId][u.id] = Date.now();
  save(KEYS.seen, seen);
}

function exportData() {
  const data = { user: load(KEYS.user, null), posts: load(KEYS.posts, []), seen: load(KEYS.seen, {}), exportedAt: nowISO() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "digital-circular-demo-data.json";
  a.click();
  URL.revokeObjectURL(url);
}

function importData(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const obj = JSON.parse(reader.result);
      if (obj.posts) save(KEYS.posts, obj.posts);
      if (obj.seen) save(KEYS.seen, obj.seen);
      if (obj.user) save(KEYS.user, obj.user);
      alert("読み込みました。");
      location.reload();
    } catch (err) {
      alert("JSONの読み込みに失敗しました。");
    }
  };
  reader.readAsText(file);
}

// Escape
function escapeHtml(s) { return s.replace(/[&<>"']/g, (c)=>({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c])); }

// Boot
init();
