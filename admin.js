import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://qihrjjaatymkwdtapkht.supabase.co";
// Keep the browser key identical to the public site. Row-level security protects writes.
const PUBLIC_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpaHJqamFhdHlta3dkdGFwa2h0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExOTY5NTQsImV4cCI6MjA5Njc3Mjk1NH0.3cCozUogaSG_RLeMBCflvMhs8v9hLwrtoopm8xDNllA";
const db = createClient(SUPABASE_URL, PUBLIC_KEY);
const IMAGE_BUCKET = "product-images";

const CATEGORY_NAMES = {
  general: "Cirugía general", micro: "Microcirugía y delicado", trauma: "Traumatología",
  "gineco-uro": "Ginecología y urología", odonto: "Odontología y maxilofacial",
  sets: "Sets y reposición", instrumental: "Instrumental", equipamiento: "Equipamiento",
  mantencion: "Mantención", insumos: "Insumos", alquiler: "Alquiler", habilitacion: "Habilitación"
};

const QUOTE_STATUS = {
  new: { label: "Nuevo", tone: "new" }, contacted: { label: "Contactado", tone: "contacted" },
  quoting: { label: "Cotizando", tone: "quoting" }, sent: { label: "Cotización enviada", tone: "sent" },
  won: { label: "Ganado", tone: "won" }, lost: { label: "Perdido", tone: "lost" },
  archived: { label: "Archivado", tone: "archived" }
};
const PRIORITY_LABELS = { low: "Baja", normal: "Normal", high: "Alta", urgent: "Urgente" };

const state = { user: null, products: [], quotes: [], view: "overview", productSearch: "", productCategory: "", quoteSearch: "", quoteDate: "all", quoteStatus: "" };
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function toast(message, type = "info") {
  const item = document.createElement("div");
  item.className = `toast ${type}`;
  item.textContent = message;
  $("#toast-stack").appendChild(item);
  window.setTimeout(() => item.remove(), 4200);
}

function setBusy(button, busy, label = "Guardando…") {
  if (!button) return;
  if (busy) { button.dataset.label = button.textContent; button.textContent = label; button.disabled = true; }
  else { button.textContent = button.dataset.label || button.textContent; button.disabled = false; }
}

function initials(value) {
  return String(value || "S").split(/\s|@/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("");
}

function categoryName(id) {
  return CATEGORY_NAMES[id] || String(id || "Sin categoría").replace(/[-_]/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}

function formatDate(value, withTime = true) {
  const options = withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" };
  return new Intl.DateTimeFormat("es-CL", options).format(new Date(value));
}

function quoteStatus(quote) { return QUOTE_STATUS[quote.status] || QUOTE_STATUS.new; }
function statusBadge(quote) { const status = quoteStatus(quote); return `<span class="status-badge ${status.tone}">${escapeHtml(status.label)}</span>`; }
function priorityBadge(quote) { const priority = quote.priority || "normal"; return `<span class="priority-badge ${escapeHtml(priority)}">${escapeHtml(PRIORITY_LABELS[priority] || "Normal")}</span>`; }

function mapProduct(row) {
  return { id: row.id, categoryId: row.category_id, filter: row.filter || "", name: row.name, reference: row.reference, short: row.short_description, long: row.long_description || "", variants: row.variants || "", hasVariants: Boolean(row.has_variants), imageUrl: row.image_url || "", imagePath: row.image_path || "", featured: Boolean(row.featured), sortOrder: row.sort_order ?? 0 };
}

function showAuth(user) {
  state.user = user;
  $("#login-view").classList.toggle("hidden", Boolean(user));
  $("#admin-view").classList.toggle("hidden", !user);
  if (!user) return;
  $("#user-name").textContent = user.email || "Administrador";
  $("#user-initial").textContent = initials(user.email);
}

async function loadProducts(showMessage = false) {
  const { data, error } = await db.from("products").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: true });
  if (error) { toast("No se pudo cargar el catálogo.", "error"); return; }
  state.products = (data || []).map(mapProduct);
  populateFilters();
  renderProducts();
  renderMetrics();
  if (showMessage) toast("Catálogo actualizado.", "success");
}

async function loadQuotes(showMessage = false) {
  const { data, error } = await db.from("quote_requests").select("*").order("created_at", { ascending: false });
  if (error) { toast("No se pudieron cargar las solicitudes.", "error"); return; }
  state.quotes = data || [];
  renderQuotes();
  renderPipeline();
  renderRecentQuotes();
  renderMetrics();
  if (showMessage) toast("Solicitudes actualizadas.", "success");
}

function renderMetrics() {
  const now = new Date();
  const monthCount = state.quotes.filter((quote) => { const date = new Date(quote.created_at); return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear(); }).length;
  $("#metric-products").textContent = state.products.length;
  $("#metric-quotes").textContent = state.quotes.length;
  $("#metric-featured").textContent = state.products.filter((product) => product.featured).length;
  $("#metric-month").textContent = monthCount;
  $("#metric-month-label").textContent = new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric" }).format(now);
  $("#nav-products-count").textContent = state.products.length;
  $("#nav-quotes-count").textContent = state.quotes.length;
}

function renderPipeline() {
  const stages = ["new", "contacted", "quoting", "sent", "won"];
  $("#quote-pipeline").innerHTML = stages.map((key) => {
    const count = state.quotes.filter((quote) => (quote.status || "new") === key).length;
    return `<button type="button" class="pipeline-card ${state.quoteStatus === key ? "active" : ""}" data-pipeline-status="${key}"><span class="status-dot ${QUOTE_STATUS[key].tone}"></span><small>${escapeHtml(QUOTE_STATUS[key].label)}</small><strong>${count}</strong></button>`;
  }).join("");
  $$('[data-pipeline-status]').forEach((button) => button.addEventListener("click", () => {
    state.quoteStatus = state.quoteStatus === button.dataset.pipelineStatus ? "" : button.dataset.pipelineStatus;
    $("#quote-status-filter").value = state.quoteStatus;
    renderQuotes(); renderPipeline();
  }));
}

function populateFilters() {
  const categoryIds = [...new Set([...Object.keys(CATEGORY_NAMES), ...state.products.map((product) => product.categoryId).filter(Boolean)])];
  const options = categoryIds.map((id) => `<option value="${escapeHtml(id)}">${escapeHtml(categoryName(id))}</option>`).join("");
  $("#product-category-filter").innerHTML = '<option value="">Todas las categorías</option>' + options;
  $("#product-form").elements.categoryId.innerHTML = options;
  const filters = [...new Set(state.products.map((product) => product.filter).filter(Boolean))];
  $("#filter-options").innerHTML = filters.map((value) => `<option value="${escapeHtml(value)}"></option>`).join("");
}

function filteredProducts() {
  const query = state.productSearch.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return state.products.filter((product) => {
    const text = `${product.name} ${product.reference} ${product.short} ${product.filter}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return (!query || text.includes(query)) && (!state.productCategory || product.categoryId === state.productCategory);
  });
}

function renderProducts() {
  const products = filteredProducts();
  if (!products.length) { $("#products-table").innerHTML = '<div class="empty-state">No hay productos que coincidan con la búsqueda.</div>'; return; }
  $("#products-table").innerHTML = `<table class="data-table"><thead><tr><th>Producto</th><th>Categoría</th><th>Filtro</th><th>Orden</th><th>Estado</th><th></th></tr></thead><tbody>${products.map((product) => `
    <tr><td><div class="product-cell">${product.imageUrl ? `<img class="product-thumb" src="${escapeHtml(product.imageUrl)}" alt="">` : `<span class="product-thumb product-placeholder">${escapeHtml(initials(product.name))}</span>`}<div><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.reference)}</small></div></div></td>
    <td>${escapeHtml(categoryName(product.categoryId))}</td><td><span class="pill">${escapeHtml(product.filter || "—")}</span></td><td>${product.sortOrder}</td><td>${product.featured ? '<span class="pill featured">★ Destacado</span>' : '<span class="pill">Publicado</span>'}</td>
    <td><div class="table-actions"><button type="button" data-edit-product="${product.id}" title="Editar">✎</button><button class="danger" type="button" data-delete-product="${product.id}" title="Eliminar">⌫</button></div></td></tr>`).join("")}</tbody></table>`;
  $$('[data-edit-product]').forEach((button) => button.addEventListener("click", () => openProductModal(button.dataset.editProduct)));
  $$('[data-delete-product]').forEach((button) => button.addEventListener("click", () => deleteProduct(button.dataset.deleteProduct)));
}

function quoteInDateRange(quote) {
  const date = new Date(quote.created_at); const now = new Date();
  if (state.quoteDate === "today") return date.toDateString() === now.toDateString();
  if (state.quoteDate === "week") return now - date <= 7 * 86400000;
  if (state.quoteDate === "month") return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  return true;
}

function filteredQuotes() {
  const query = state.quoteSearch.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return state.quotes.filter((quote) => {
    const text = `${quote.name} ${quote.email} ${quote.institution} ${quote.interest} ${quote.product_name}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const currentStatus = quote.status || "new";
    return (!query || text.includes(query)) && (!state.quoteStatus || currentStatus === state.quoteStatus) && quoteInDateRange(quote);
  });
}

function renderQuotes() {
  const quotes = filteredQuotes();
  if (!quotes.length) { $("#quotes-table").innerHTML = '<div class="empty-state">No hay solicitudes que coincidan con los filtros.</div>'; return; }
  $("#quotes-table").innerHTML = `<table class="data-table"><thead><tr><th>Cliente</th><th>Interés</th><th>Estado</th><th>Prioridad</th><th>Fecha</th><th></th></tr></thead><tbody>${quotes.map((quote) => `
    <tr><td><div class="product-cell"><span class="product-thumb product-placeholder">${escapeHtml(initials(quote.name))}</span><div><strong>${escapeHtml(quote.name)}</strong><small>${escapeHtml(quote.institution || quote.email)}</small></div></div></td><td>${escapeHtml(quote.interest || quote.product_name || "Solicitud general")}</td><td>${statusBadge(quote)}</td><td>${priorityBadge(quote)}</td><td>${escapeHtml(formatDate(quote.created_at))}</td><td><div class="table-actions"><button type="button" data-view-quote="${quote.id}">Gestionar</button></div></td></tr>`).join("")}</tbody></table>`;
  $$('[data-view-quote]').forEach((button) => button.addEventListener("click", () => openQuoteModal(button.dataset.viewQuote)));
}

function renderRecentQuotes() {
  const items = state.quotes.slice(0, 5);
  $("#recent-quotes").innerHTML = items.length ? items.map((quote) => `<article class="recent-item"><span class="recent-avatar">${escapeHtml(initials(quote.name))}</span><div><strong>${escapeHtml(quote.name)}</strong><span>${escapeHtml(quote.interest || quote.product_name || quote.institution || "Solicitud general")}</span></div>${statusBadge(quote)}<button type="button" data-recent-quote="${quote.id}" aria-label="Gestionar solicitud">›</button></article>`).join("") : '<div class="empty-state">Aún no hay solicitudes.</div>';
  $$('[data-recent-quote]').forEach((button) => button.addEventListener("click", () => openQuoteModal(button.dataset.recentQuote)));
}

function changeView(view) {
  state.view = view;
  const titles = { overview: ["Panel SUPMED", "Resumen"], products: ["Gestión de catálogo", "Productos"], quotes: ["Gestión comercial", "Cotizaciones"] };
  $$(".panel-view").forEach((panel) => panel.classList.toggle("active", panel.id === `view-${view}`));
  $$(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  $("#view-kicker").textContent = titles[view][0]; $("#view-title").textContent = titles[view][1];
  $("#admin-view").classList.remove("menu-open");
}

function openModal(id) { $(id).classList.add("open"); document.body.style.overflow = "hidden"; }
function closeModals() { $$(".modal-backdrop").forEach((modal) => modal.classList.remove("open")); document.body.style.overflow = ""; }

function openProductModal(id = "") {
  const product = state.products.find((item) => item.id === id);
  const form = $("#product-form"); form.reset();
  form.elements.id.value = product?.id || ""; form.elements.name.value = product?.name || ""; form.elements.reference.value = product?.reference || "";
  form.elements.categoryId.value = product?.categoryId || "instrumental"; form.elements.filter.value = product?.filter || ""; form.elements.sortOrder.value = product?.sortOrder ?? 0;
  form.elements.short.value = product?.short || ""; form.elements.long.value = product?.long || ""; form.elements.variants.value = product?.variants || "";
  form.elements.hasVariants.checked = Boolean(product?.hasVariants); form.elements.featured.checked = Boolean(product?.featured); form.elements.removeImage.checked = false;
  $("#product-modal-title").textContent = product ? "Editar producto" : "Agregar producto";
  $("#variants-field").classList.toggle("hidden", !form.elements.hasVariants.checked);
  $("#remove-image-label").classList.toggle("hidden", !product?.imageUrl);
  $("#image-preview").innerHTML = product?.imageUrl ? `<img src="${escapeHtml(product.imageUrl)}" alt="Imagen actual">` : "<span>Sin imagen</span>";
  openModal("#product-modal");
}

function fileExtension(file) { const ext = file.name.split(".").pop()?.toLowerCase(); return ext && /^[a-z0-9]+$/.test(ext) ? ext : "jpg"; }
async function uploadImage(file, reference) {
  if (file.size > 5 * 1024 * 1024) throw new Error("La imagen supera el máximo de 5 MB.");
  const safe = reference.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "producto";
  const path = `${safe}-${Date.now()}.${fileExtension(file)}`;
  const { error } = await db.storage.from(IMAGE_BUCKET).upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;
  return { path, url: db.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl };
}

async function saveProduct(event) {
  event.preventDefault(); const form = event.currentTarget; const fields = form.elements; const id = fields.id.value;
  const current = state.products.find((product) => product.id === id); const file = fields.image.files?.[0]; const button = $("#save-product");
  if (fields.hasVariants.checked && !fields.variants.value.trim()) { toast("Agrega al menos una variante.", "error"); return; }
  setBusy(button, true);
  let imageUrl = current?.imageUrl || ""; let imagePath = current?.imagePath || ""; let oldImageToDelete = "";
  try {
    if (file) { const uploaded = await uploadImage(file, fields.reference.value.trim()); oldImageToDelete = imagePath; imageUrl = uploaded.url; imagePath = uploaded.path; }
    else if (fields.removeImage.checked) { oldImageToDelete = imagePath; imageUrl = ""; imagePath = ""; }
    const payload = { category_id: fields.categoryId.value, filter: fields.filter.value.trim(), name: fields.name.value.trim(), reference: fields.reference.value.trim(), short_description: fields.short.value.trim(), long_description: fields.long.value.trim(), variants: fields.variants.value.trim(), has_variants: fields.hasVariants.checked, featured: fields.featured.checked, sort_order: Number(fields.sortOrder.value || 0), image_url: imageUrl || null, image_path: imagePath || null };
    const request = id ? db.from("products").update(payload).eq("id", id).select().single() : db.from("products").insert(payload).select().single();
    const { data, error } = await request; if (error) throw error;
    if (oldImageToDelete && oldImageToDelete !== imagePath) await db.storage.from(IMAGE_BUCKET).remove([oldImageToDelete]);
    const saved = mapProduct(data); state.products = id ? state.products.map((product) => product.id === id ? saved : product) : [...state.products, saved];
    populateFilters(); renderProducts(); renderMetrics(); closeModals(); toast(id ? "Producto actualizado correctamente." : "Producto publicado correctamente.", "success");
  } catch (error) { toast(error.code === "23505" ? "Ya existe un producto con esa referencia." : (error.message || "No se pudo guardar el producto."), "error"); }
  finally { setBusy(button, false); }
}

async function deleteProduct(id) {
  const product = state.products.find((item) => item.id === id); if (!product) return;
  if (!window.confirm(`¿Eliminar “${product.name}” del catálogo? Esta acción no se puede deshacer.`)) return;
  const { error } = await db.from("products").delete().eq("id", id); if (error) { toast("No se pudo eliminar el producto.", "error"); return; }
  if (product.imagePath) await db.storage.from(IMAGE_BUCKET).remove([product.imagePath]);
  state.products = state.products.filter((item) => item.id !== id); populateFilters(); renderProducts(); renderMetrics(); toast("Producto eliminado.", "success");
}

function openQuoteModal(id) {
  const quote = state.quotes.find((item) => item.id === id); if (!quote) return;
  $("#quote-detail").innerHTML = `<div class="quote-detail-grid"><div class="detail-item"><small>Nombre</small><strong>${escapeHtml(quote.name)}</strong></div><div class="detail-item"><small>Fecha de ingreso</small><strong>${escapeHtml(formatDate(quote.created_at))}</strong></div><div class="detail-item"><small>Correo</small><a href="mailto:${escapeHtml(quote.email)}">${escapeHtml(quote.email)}</a></div><div class="detail-item"><small>Teléfono</small><a href="tel:${escapeHtml(quote.phone)}">${escapeHtml(quote.phone || "No informado")}</a></div><div class="detail-item"><small>Institución</small><strong>${escapeHtml(quote.institution || "No informada")}</strong></div><div class="detail-item"><small>Cargo</small><strong>${escapeHtml(quote.position || "No informado")}</strong></div><div class="detail-item full"><small>Producto o interés</small><strong>${escapeHtml(quote.interest || quote.product_name || "Solicitud general")}</strong></div><div class="detail-item full"><small>Mensaje del cliente</small><div class="detail-message">${escapeHtml(quote.message || "Sin mensaje adicional.")}</div></div></div><div class="quote-contact-actions"><a class="button primary" href="mailto:${escapeHtml(quote.email)}?subject=${encodeURIComponent("Cotización SUPMED")}">Responder por correo</a>${quote.phone ? `<a class="button secondary" href="https://wa.me/${escapeHtml(quote.phone.replace(/\D/g, ""))}" target="_blank" rel="noopener">WhatsApp</a>` : ""}</div>`;
  const form = $("#quote-management-form");
  form.elements.id.value = quote.id;
  form.elements.status.value = quote.status || "new";
  form.elements.priority.value = quote.priority || "normal";
  form.elements.internalNotes.value = quote.internal_notes || "";
  openModal("#quote-modal");
}

async function saveQuoteManagement(event) {
  event.preventDefault();
  const form = event.currentTarget; const fields = form.elements; const button = $("#save-quote");
  const payload = { status: fields.status.value, priority: fields.priority.value, internal_notes: fields.internalNotes.value.trim() };
  setBusy(button, true);
  const { data, error } = await db.from("quote_requests").update(payload).eq("id", fields.id.value).select().single();
  setBusy(button, false);
  if (error) {
    const needsMigration = /status|priority|internal_notes|schema cache/i.test(error.message || "");
    toast(needsMigration ? "Falta ejecutar la migración de seguimiento en Supabase." : "No se pudo actualizar la solicitud.", "error");
    return;
  }
  state.quotes = state.quotes.map((quote) => quote.id === data.id ? data : quote);
  renderQuotes(); renderPipeline(); renderRecentQuotes(); renderMetrics(); closeModals();
  toast("Seguimiento actualizado correctamente.", "success");
}

function csvCell(value) { return `"${String(value ?? "").replace(/"/g, '""')}"`; }
function exportQuotes() {
  const rows = filteredQuotes(); if (!rows.length) { toast("No hay solicitudes para exportar.", "error"); return; }
  const headers = ["Fecha", "Nombre", "Cargo", "Institución", "Teléfono", "Correo", "Producto", "Interés", "Mensaje", "Estado", "Prioridad", "Notas internas"];
  const csv = "\ufeff" + [headers, ...rows.map((quote) => [formatDate(quote.created_at), quote.name, quote.position, quote.institution, quote.phone, quote.email, quote.product_name, quote.interest, quote.message, quoteStatus(quote).label, PRIORITY_LABELS[quote.priority || "normal"], quote.internal_notes || ""])].map((row) => row.map(csvCell).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); const link = document.createElement("a");
  link.href = url; link.download = `cotizaciones-supmed-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
}

async function init() {
  $("#login-form").addEventListener("submit", async (event) => { event.preventDefault(); const button = event.currentTarget.querySelector("button"); setBusy(button, true, "Ingresando…"); const { error } = await db.auth.signInWithPassword({ email: event.currentTarget.elements.email.value.trim(), password: event.currentTarget.elements.password.value }); if (error) toast("Correo o contraseña incorrectos.", "error"); setBusy(button, false); });
  $("#logout-button").addEventListener("click", () => db.auth.signOut());
  $$(".nav-item").forEach((button) => button.addEventListener("click", () => changeView(button.dataset.view)));
  $$('[data-go]').forEach((button) => button.addEventListener("click", () => changeView(button.dataset.go)));
  $$('[data-new-product]').forEach((button) => button.addEventListener("click", () => openProductModal()));
  $$('[data-close-modal]').forEach((button) => button.addEventListener("click", closeModals));
  $$(".modal-backdrop").forEach((modal) => modal.addEventListener("click", (event) => { if (event.target === modal) closeModals(); }));
  $("#menu-button").addEventListener("click", () => $("#admin-view").classList.toggle("menu-open"));
  $("#product-search").addEventListener("input", (event) => { state.productSearch = event.target.value; renderProducts(); });
  $("#product-category-filter").addEventListener("change", (event) => { state.productCategory = event.target.value; renderProducts(); });
  $("#quote-search").addEventListener("input", (event) => { state.quoteSearch = event.target.value; renderQuotes(); });
  $("#quote-status-filter").addEventListener("change", (event) => { state.quoteStatus = event.target.value; renderQuotes(); renderPipeline(); });
  $("#quote-date-filter").addEventListener("change", (event) => { state.quoteDate = event.target.value; renderQuotes(); });
  $("#refresh-products").addEventListener("click", () => loadProducts(true)); $("#refresh-quotes").addEventListener("click", () => loadQuotes(true));
  $("#export-quotes").addEventListener("click", exportQuotes); $("#product-form").addEventListener("submit", saveProduct);
  $("#quote-management-form").addEventListener("submit", saveQuoteManagement);
  $("#product-form").elements.hasVariants.addEventListener("change", (event) => $("#variants-field").classList.toggle("hidden", !event.target.checked));
  $("#product-form").elements.image.addEventListener("change", (event) => { const file = event.target.files?.[0]; if (!file) return; $("#image-preview").innerHTML = `<img src="${URL.createObjectURL(file)}" alt="Vista previa">`; });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeModals(); });

  const { data } = await db.auth.getSession(); showAuth(data.session?.user || null);
  if (state.user) await Promise.all([loadProducts(), loadQuotes()]);
  db.auth.onAuthStateChange((_event, session) => {
    const wasLoggedIn = Boolean(state.user);
    showAuth(session?.user || null);
    if (session?.user && !wasLoggedIn) {
      window.setTimeout(async () => {
        await Promise.all([loadProducts(), loadQuotes()]);
        toast("Sesión iniciada correctamente.", "success");
      }, 0);
    }
  });
}

document.addEventListener("DOMContentLoaded", init);
