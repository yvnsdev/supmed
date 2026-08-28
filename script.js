import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

document.documentElement.classList.add("js");

const supabaseUrl = "https://qihrjjaatymkwdtapkht.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpaHJqamFhdHlta3dkdGFwa2h0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExOTY5NTQsImV4cCI6MjA5Njc3Mjk1NH0.3cCozUogaSG_RLeMBCflvMhs8v9hLwrtoopm8xDNllA";

const supabase = createClient(supabaseUrl, supabaseKey);
const PRODUCT_IMAGE_BUCKET = "product-images";

const hasSupabaseConfig = Boolean(
  supabaseUrl &&
  supabaseKey
);
const db = hasSupabaseConfig ? supabase : null;

const CATEGORY_NAMES = {
  general: "Cirugia general",
  micro: "Microcirugia y delicado",
  trauma: "Traumatologia",
  "gineco-uro": "Ginecologia y urologia",
  odonto: "Odontologia y maxilofacial",
  sets: "Sets y reposicion",
  instrumental: "Instrumental",
  equipamiento: "Equipamiento",
  mantencion: "Mantencion",
  insumos: "Insumos",
  alquiler: "Alquiler",
  habilitacion: "Habilitacion"
};

let products = [];
let quoteRequests = [];
let categories = [];
let catalogFilters = [];
const PRODUCTS_PER_PAGE = 8;
const state = { filter: "", search: "", user: null, loadingProducts: false, page: 1 };
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
let revealObserver = null;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function toast(message, type = "info") {
  const stack = $("#toast-stack");
  const item = document.createElement("div");
  item.className = `toast ${type}`;
  item.textContent = message;
  stack.appendChild(item);
  setTimeout(() => item.remove(), 4200);
}

function openModal(id) {
  $(`#${id}`)?.classList.add("open");
  document.body.classList.add("modal-open");
}

function closeModal(id) {
  $(`#${id}`)?.classList.remove("open");
  if (!$(".modal-backdrop.open")) {
    document.body.classList.remove("modal-open");
  }
}

function whatsappUrl(message) {
  return `https://wa.me/56989747446?text=${encodeURIComponent(message)}`;
}

function openWhatsapp(message) {
  window.open(whatsappUrl(message), "_blank", "noopener");
}

function imageExtension(file) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  return extension && /^[a-z0-9]+$/.test(extension) ? extension : "jpg";
}

async function uploadProductImage(file, reference) {
  if (!file) return null;
  if (!file.type.startsWith("image/")) {
    throw new Error("Selecciona una imagen valida.");
  }

  const safeReference = reference
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "producto";
  const path = `${safeReference}-${Date.now()}.${imageExtension(file)}`;
  const { error } = await db.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false
    });

  if (error) throw error;

  const { data } = db.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(path);
  return { imagePath: path, imageUrl: data.publicUrl };
}

function categoryName(categoryId) {
  const value = String(categoryId || "");
  if (CATEGORY_NAMES[value.toLowerCase()]) return CATEGORY_NAMES[value.toLowerCase()];
  return value
    .replace(/[-_]+/g, " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function updateCategories() {
  categories = [...new Set(products.map((product) => product.categoryId).filter(Boolean))]
    .map((id) => ({ id, name: categoryName(id) }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  catalogFilters = [...new Set(products.map((product) => product.filter).filter(Boolean))]
    .map((id) => ({ id, name: categoryName(id) }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  if (state.filter && !catalogFilters.some((filter) => filter.id === state.filter)) {
    state.filter = "";
    state.page = 1;
  }
}

function mapProductFromDb(row) {
  return {
    id: row.id,
    categoryId: row.category_id || "",
    filter: row.filter || "",
    name: row.name,
    reference: row.reference,
    short: row.short_description,
    long: row.long_description || "",
    imageUrl: row.image_url || "",
    imagePath: row.image_path || "",
    variants: row.variants || "",
    hasVariants: Boolean(row.has_variants),
    featured: Boolean(row.featured),
    sortOrder: row.sort_order ?? 0
  };
}

function mapProductToDb(product) {
  const payload = {
    category_id: product.categoryId,
    filter: product.filter || "",
    name: product.name,
    reference: product.reference,
    short_description: product.short,
    long_description: product.long,
    variants: product.variants || "",
    has_variants: Boolean(product.hasVariants),
    featured: Boolean(product.featured),
    sort_order: Number(product.sortOrder || 0)
  };
  if ("imageUrl" in product) payload.image_url = product.imageUrl || null;
  if ("imagePath" in product) payload.image_path = product.imagePath || null;
  return payload;
}

function categoryOptions(selected = "") {
  return categories.map((category) => (
    `<option value="${escapeHtml(category.id)}" ${category.id === selected ? "selected" : ""}>${escapeHtml(category.name)}</option>`
  )).join("");
}

function formatQuoteDate(value) {
  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function renderQuoteRequests() {
  const list = $("#quote-requests-list");
  if (!list) return;

  if (!state.user) {
    list.innerHTML = "";
    return;
  }

  if (!quoteRequests.length) {
    list.innerHTML = '<p class="quote-requests-empty">Aún no hay solicitudes de cotización.</p>';
    return;
  }

  list.innerHTML = quoteRequests.map((request) => `
    <article class="quote-request-card">
      <div class="quote-request-title">
        <strong>${escapeHtml(request.name)}</strong>
        <time datetime="${escapeHtml(request.created_at)}">${escapeHtml(formatQuoteDate(request.created_at))}</time>
      </div>
      <p><b>Correo:</b> <a href="mailto:${escapeHtml(request.email)}">${escapeHtml(request.email)}</a>${request.phone ? ` · <a href="tel:${escapeHtml(request.phone)}">${escapeHtml(request.phone)}</a>` : ""}</p>
      ${request.position || request.institution ? `<p><b>Empresa:</b> ${escapeHtml([request.position, request.institution].filter(Boolean).join(" · "))}</p>` : ""}
      ${request.product_name || request.interest ? `<p><b>Interés:</b> ${escapeHtml(request.interest || request.product_name)}</p>` : ""}
      ${request.message ? `<p><b>Mensaje:</b> ${escapeHtml(request.message)}</p>` : ""}
    </article>
  `).join("");
}

async function loadQuoteRequests() {
  if (!db || !state.user) {
    quoteRequests = [];
    renderQuoteRequests();
    return;
  }

  const { data, error } = await db
    .from("quote_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    toast("No se pudieron cargar las solicitudes de cotización.", "error");
    return;
  }

  quoteRequests = data || [];
  renderQuoteRequests();
}

function normalizeSearchText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function compactSearchText(value) {
  return normalizeSearchText(value).replace(/[^a-z0-9]+/g, "");
}

function filterOptions(selected = "") {
  return catalogFilters.map((filter) => (
    `<option value="${escapeHtml(filter.id)}" ${filter.id === selected ? "selected" : ""}>${escapeHtml(filter.name)}</option>`
  )).join("");
}

function variantOptions(value) {
  const text = String(value || "").trim();
  if (!text) return [];

  if (text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return [...new Set(parsed.map((item) => String(item).trim()).filter(Boolean))];
      }
    } catch (_) {
      // Continue with the plain-text format.
    }
  }

  return [...new Set(text.split(/[\n;|,]+/).map((item) => item.trim()).filter(Boolean))];
}

function renderCategories() {
  $("#filter-cat").innerHTML = '<option value="">Todas las categorias</option>' + filterOptions(state.filter);
}

function productVisual(product) {
  if (product.imageUrl) {
    return `
      <div class="product-visual has-image" aria-hidden="true">
        <img src="${escapeHtml(product.imageUrl)}" alt="">
      </div>
    `;
  }

  return `
    <div class="product-visual" aria-hidden="true">
      <strong>${escapeHtml(product.name)}</strong>
    </div>
  `;
}

function productCard(product) {
  const category = categories.find((item) => item.id === product.categoryId);
  return `
    <article class="product-card">
      <div class="prod-img-wrap">
        ${product.featured ? '<span class="badge">Destacado</span>' : ""}
        ${productVisual(product)}
      </div>
      <div class="prod-body">
        ${category ? `<span class="prod-cat">${escapeHtml(category.name)}</span>` : ""}
        <h3>${escapeHtml(product.name)}</h3>
        <small>Ref. ${escapeHtml(product.reference)}</small>
        <p class="prod-desc">${escapeHtml(product.short)}</p>
        <div class="prod-actions">
          <button class="btn btn-primary btn-sm" type="button" data-quote-prod="${product.id}">Cotizar</button>
          <button class="btn btn-secondary btn-sm" type="button" data-view-prod="${product.id}">Ver detalle</button>
        </div>
      </div>
    </article>
  `;
}

function renderProducts() {
  const query = normalizeSearchText(state.search.trim());
  const compactQuery = compactSearchText(query);
  let items = [...products].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  if (state.filter) {
    items = items.filter((product) => product.filter === state.filter);
  }

  if (query) {
    items = items.filter((product) => {
      const category = categories.find((item) => item.id === product.categoryId)?.name || "";
      const haystack = normalizeSearchText(`${product.name} ${product.reference} ${product.short} ${product.long} ${category} ${product.filter}`);
      // La forma compacta permite encontrar referencias aunque se escriban con
      // guiones, espacios o separadores distintos: 122-230, 122 230 y 122230.
      return haystack.includes(query) || compactSearchText(haystack).includes(compactQuery);
    });
  }

  const emptyMessage = state.loadingProducts
    ? "Cargando productos..."
    : "Por ahora no hay productos publicados en el catalogo.";
  const totalPages = Math.max(1, Math.ceil(items.length / PRODUCTS_PER_PAGE));
  state.page = Math.min(Math.max(state.page, 1), totalPages);
  const pageStart = (state.page - 1) * PRODUCTS_PER_PAGE;
  const pageItems = items.slice(pageStart, pageStart + PRODUCTS_PER_PAGE);

  $("#prod-grid").innerHTML = pageItems.length
    ? pageItems.map(productCard).join("")
    : `<p class="empty">${emptyMessage}</p>`;

  renderPagination(items.length, totalPages);
  bindProductButtons(document);
  observeRevealItems($("#prod-grid").children);
}

function renderPagination(totalItems, totalPages) {
  const pagination = $("#catalog-pagination");
  if (!pagination) return;

  if (totalItems <= PRODUCTS_PER_PAGE) {
    pagination.innerHTML = "";
    pagination.classList.add("hidden");
    return;
  }

  const firstItem = (state.page - 1) * PRODUCTS_PER_PAGE + 1;
  const lastItem = Math.min(state.page * PRODUCTS_PER_PAGE, totalItems);
  pagination.classList.remove("hidden");
  pagination.innerHTML = `
    <button class="btn btn-secondary btn-sm" type="button" data-page-action="prev" ${state.page === 1 ? "disabled" : ""}>Anterior</button>
    <span>Mostrando ${firstItem}-${lastItem} de ${totalItems}</span>
    <strong>Pagina ${state.page} de ${totalPages}</strong>
    <button class="btn btn-secondary btn-sm" type="button" data-page-action="next" ${state.page === totalPages ? "disabled" : ""}>Siguiente</button>
  `;

  pagination.querySelectorAll("[data-page-action]").forEach((button) => {
    button.addEventListener("click", () => {
      state.page += button.dataset.pageAction === "next" ? 1 : -1;
      renderProducts();
      $("#catalogo")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function observeRevealItems(items) {
  const nodes = Array.from(items || []).filter(Boolean);
  if (!nodes.length) return;

  nodes.forEach((node, index) => {
    node.classList.add("reveal");
    node.style.transitionDelay = `${Math.min(index * 45, 220)}ms`;

    if (revealObserver) {
      revealObserver.observe(node);
    } else {
      node.classList.add("is-visible");
    }
  });
}

function initMotion() {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const revealTargets = [
    ...$$("main > section"),
    ...$$(".proof-grid > div"),
    ...$$(".contact-card"),
    ...$$(".manual-panel"),
    ...$$(".final-cta")
  ];

  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealTargets.forEach((node) => node.classList.add("reveal", "is-visible"));
    return;
  }

  revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      revealObserver.unobserve(entry.target);
    });
  }, { threshold: 0.14, rootMargin: "0px 0px -8% 0px" });

  observeRevealItems(revealTargets);
  observeRevealItems($$("#prod-grid > *"));
}

function initHeaderBehavior() {
  const header = $(".site-header");
  const navLinks = $$("#main-nav a[href^='#']");
  const sections = navLinks
    .map((link) => $(link.getAttribute("href")))
    .filter(Boolean);

  const updateHeader = () => {
    header.classList.toggle("scrolled", window.scrollY > 12);
  };

  updateHeader();
  window.addEventListener("scroll", updateHeader, { passive: true });

  if (!("IntersectionObserver" in window)) return;

  const sectionObserver = new IntersectionObserver((entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

    if (!visible) return;

    navLinks.forEach((link) => {
      link.classList.toggle("active", link.getAttribute("href") === `#${visible.target.id}`);
    });
  }, { threshold: [0.18, 0.35, 0.6], rootMargin: "-20% 0px -55% 0px" });

  sections.forEach((section) => sectionObserver.observe(section));
}

function initHeroCarousel() {
  const slides = $$(".hero-slide");
  if (slides.length < 2) return;

  let activeIndex = slides.findIndex((slide) => slide.classList.contains("is-active"));
  if (activeIndex < 0) activeIndex = 0;
  slides[activeIndex].classList.add("is-active");

  window.setInterval(() => {
    const nextIndex = (activeIndex + 1) % slides.length;
    slides[activeIndex].classList.remove("is-active");
    slides[nextIndex].classList.add("is-active");
    activeIndex = nextIndex;
  }, 7000);
}

function bindProductButtons(root) {
  root.querySelectorAll("[data-quote-prod]").forEach((button) => {
    button.addEventListener("click", () => {
      const product = products.find((item) => item.id === button.dataset.quoteProd);
      if (product?.hasVariants && variantOptions(product.variants).length) {
        openProductModal(product.id);
        return;
      }
      openQuoteFor(button.dataset.quoteProd);
    });
  });

  root.querySelectorAll("[data-view-prod]").forEach((button) => {
    button.addEventListener("click", () => openProductModal(button.dataset.viewProd));
  });

  root.querySelectorAll("[data-edit-prod]").forEach((button) => {
    button.addEventListener("click", () => openProductEditor(button.dataset.editProd));
  });

  root.querySelectorAll("[data-delete-prod]").forEach((button) => {
    button.addEventListener("click", () => deleteProduct(button.dataset.deleteProd));
  });
}

async function loadProducts() {
  if (!db) {
    renderProducts();
    return;
  }

  state.loadingProducts = true;
  renderProducts();

  const { data, error } = await db
    .from("products")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  state.loadingProducts = false;

  if (error) {
    products = [];
    updateCategories();
    renderCategories();
    toast("No se pudo cargar el catalogo. Intenta nuevamente en unos minutos.", "error");
    renderProducts();
    return;
  }

  products = data.map(mapProductFromDb);
  updateCategories();
  renderCategories();
  renderProducts();
}

function updateAuthUi() {
  const isAdmin = Boolean(state.user);
  document.body.classList.toggle("is-admin", isAdmin);
  $("#auth-button").classList.toggle("hidden", isAdmin);
  $("#logout-button").classList.toggle("hidden", !isAdmin);
  $("#admin-catalog-tools").classList.toggle("hidden", !isAdmin);
  $("#admin-quotes-panel").classList.toggle("hidden", !isAdmin);
  $("#admin-user-label").textContent = isAdmin ? `Conectado como ${state.user.email}` : "Acceso no iniciado";
  renderProducts();
  if (!isAdmin) renderQuoteRequests();
}

async function refreshSession() {
  if (!db) {
    $("#auth-button").title = "El acceso privado no esta disponible en este momento";
    return;
  }

  const { data } = await db.auth.getSession();
  state.user = data.session?.user || null;
  updateAuthUi();
  if (state.user) loadQuoteRequests();

  db.auth.onAuthStateChange((_event, session) => {
    state.user = session?.user || null;
    updateAuthUi();
    if (state.user) loadQuoteRequests();
  });
}

async function submitLogin(event) {
  event.preventDefault();

  if (!db) {
    toast("El acceso privado no esta disponible en este momento.", "error");
    return;
  }

  const form = event.target;
  const fields = form.elements;
  const email = fields.email.value.trim();
  const password = fields.password.value;
  const { error } = await db.auth.signInWithPassword({ email, password });

  if (error) {
    toast("No pudimos iniciar el acceso. Revisa el correo y la contrasena.", "error");
    return;
  }

  form.reset();
  closeModal("login-modal");
  toast("Acceso iniciado. Ya puedes gestionar el catálogo y revisar cotizaciones.", "success");
}

async function logout() {
  if (!db) return;
  await db.auth.signOut();
  toast("Acceso cerrado.", "success");
}

function openProductModal(id) {
  const product = products.find((item) => item.id === id);
  if (!product) return;

  const category = categories.find((item) => item.id === product.categoryId);
  const variants = product.hasVariants ? variantOptions(product.variants) : [];
  $("#product-modal-title").textContent = product.name;
  $("#product-modal .modal-body").innerHTML = `
    ${productVisual(product)}
    ${category ? `<span class="prod-cat">${escapeHtml(category.name)}</span>` : ""}
    <h3 style="margin:12px 0 6px">${escapeHtml(product.name)}</h3>
    <p style="color:var(--muted);margin-bottom:12px">Ref. ${escapeHtml(product.reference)}</p>
    <p style="margin-bottom:10px">${escapeHtml(product.short)}</p>
    <p>${escapeHtml(product.long)}</p>
    ${variants.length ? `
      <label class="product-variant-picker" for="product-modal-variant">
        <span>Variante</span>
        <select id="product-modal-variant">
          <option value="">Selecciona una opcion</option>
          ${variants.map((variant) => `<option value="${escapeHtml(variant)}">${escapeHtml(variant)}</option>`).join("")}
        </select>
      </label>
    ` : ""}
  `;
  $("#product-modal-quote").onclick = () => {
    const variant = $("#product-modal-variant")?.value || "";
    if (variants.length && !variant) {
      toast("Selecciona una variante para cotizar.", "error");
      return;
    }
    closeModal("product-modal");
    openQuoteFor(product.id, variant);
  };
  openModal("product-modal");
}

function openProductEditor(id = "") {
  if (!state.user) {
    toast("Ingresa al acceso privado para gestionar productos.", "error");
    return;
  }

  const product = products.find((item) => item.id === id);
  const form = $("#product-form");
  const fields = form.elements;
  form.reset();
  fields.id.value = product?.id || "";
  fields.name.value = product?.name || "";
  fields.reference.value = product?.reference || "";
  fields.categoryId.value = product?.categoryId || categories[0]?.id || "";
  fields.filter.value = product?.filter || "";
  fields.sortOrder.value = product?.sortOrder ?? "";
  fields.short.value = product?.short || "";
  fields.long.value = product?.long || "";
  fields.variants.value = product?.variants || "";
  fields.image.value = "";
  fields.hasVariants.checked = Boolean(product?.hasVariants);
  fields.featured.checked = Boolean(product?.featured);
  syncVariantsField();
  $("#product-current-image").textContent = product?.imageUrl
    ? "Este producto ya tiene una imagen. Puedes subir otra para reemplazarla."
    : "Puedes subir una imagen JPG, PNG o WebP.";
  $("#product-editor-title").textContent = product ? "Editar producto" : "Agregar producto";
  openModal("product-editor-modal");
}

async function saveProduct(event) {
  event.preventDefault();

  if (!db || !state.user) {
    toast("Ingresa al acceso privado para guardar productos.", "error");
    return;
  }

  const form = event.target;
  const fields = form.elements;
  const id = fields.id.value;
  const product = {
    categoryId: fields.categoryId.value,
    filter: fields.filter.value.trim(),
    name: fields.name.value.trim(),
    reference: fields.reference.value.trim(),
    short: fields.short.value.trim(),
    long: fields.long.value.trim(),
    variants: fields.variants.value.trim(),
    hasVariants: fields.hasVariants.checked,
    featured: fields.featured.checked,
    sortOrder: fields.sortOrder.value ? Number(fields.sortOrder.value) : 0
  };
  const currentProduct = id ? products.find((item) => item.id === id) : null;
  const imageFile = fields.image.files?.[0] || null;

  if (!product.name || !product.reference || !product.categoryId || !product.filter || !product.short) {
    toast("Completa nombre, referencia, categoria, filtro y resumen del producto.", "error");
    return;
  }

  if (product.hasVariants && !variantOptions(product.variants).length) {
    toast("Agrega al menos una variante o desactiva la opcion de variantes.", "error");
    return;
  }

  try {
    if (imageFile) {
      const uploaded = await uploadProductImage(imageFile, product.reference);
      product.imageUrl = uploaded.imageUrl;
      product.imagePath = uploaded.imagePath;
    } else if (currentProduct) {
      product.imageUrl = currentProduct.imageUrl;
      product.imagePath = currentProduct.imagePath;
    }
  } catch (error) {
    toast(error.message || "No se pudo subir la imagen. Intenta con otro archivo.", "error");
    return;
  }

  const payload = mapProductToDb(product);
  const request = id
    ? db.from("products").update(payload).eq("id", id).select().single()
    : db.from("products").insert(payload).select().single();

  const { data, error } = await request;

  if (error) {
    toast("No se pudo guardar el producto. Revisa los datos e intenta nuevamente.", "error");
    return;
  }

  const saved = mapProductFromDb(data);
  products = id
    ? products.map((item) => item.id === id ? saved : item)
    : [...products, saved];

  updateCategories();
  renderCategories();
  renderProducts();
  closeModal("product-editor-modal");
  toast(id ? "Producto actualizado." : "Producto agregado al catalogo.", "success");
}

async function deleteProduct(id) {
  if (!db || !state.user) {
    toast("Ingresa al acceso privado para borrar productos.", "error");
    return;
  }

  const product = products.find((item) => item.id === id);
  if (!product) return;

  const confirmed = window.confirm(`Quieres borrar "${product.name}" del catalogo?`);
  if (!confirmed) return;

  const { error } = await db.from("products").delete().eq("id", id);

  if (error) {
    toast("No se pudo borrar el producto. Intenta nuevamente.", "error");
    return;
  }

  products = products.filter((item) => item.id !== id);
  updateCategories();
  renderCategories();
  renderProducts();
  toast("Producto borrado del catalogo.", "success");
}

function openQuoteFor(productId = "", variant = "") {
  const product = products.find((item) => item.id === productId);
  const tag = $("#quote-product-tag");

  if (product) {
    const category = categories.find((item) => item.id === product.categoryId)?.name || "";
    const details = [
      `Hola SUPMED, quiero cotizar este producto: ${product.name}.`,
      product.reference ? `Referencia: ${product.reference}.` : "",
      variant ? `Variante: ${variant}.` : "",
      category ? `Linea: ${category}.` : "",
      product.short ? `Detalle: ${product.short}` : ""
    ].filter(Boolean).join("\n");

    openWhatsapp(details);
    return;
  }

  $("#quote-product-name").value = product ? product.name : "";
  $("#quote-interest").value = product ? `${product.name} (${product.reference})` : "";

  tag.classList.add("hidden");

  openModal("quote-modal");
}

function syncVariantsField() {
  const form = $("#product-form");
  const enabled = form.elements.hasVariants.checked;
  $("#product-variants-field").classList.toggle("hidden", !enabled);
  form.elements.variants.disabled = !enabled;
}

async function submitQuote(event) {
  event.preventDefault();
  const form = event.target;
  const fields = form.elements;
  const data = {
    name: fields.name.value.trim(),
    position: fields.position.value.trim(),
    institution: fields.institution.value.trim(),
    phone: fields.phone.value.trim(),
    email: fields.email.value.trim(),
    interest: fields.interest.value.trim(),
    message: fields.message.value.trim(),
    productName: fields.product_name.value.trim()
  };

  if (!data.name || !data.email) {
    toast("Completa tu nombre y correo para enviar la solicitud.", "error");
    return;
  }

  if (!db) {
    toast("No podemos registrar tu solicitud en este momento. Intenta nuevamente más tarde.", "error");
    return;
  }

  const { error } = await db.from("quote_requests").insert({
    name: data.name,
    position: data.position,
    institution: data.institution,
    phone: data.phone,
    email: data.email,
    product_name: data.productName,
    interest: data.interest,
    message: data.message
  });

  if (error) {
    toast("No se pudo guardar la solicitud. Intenta nuevamente.", "error");
    return;
  }

  if (state.user) loadQuoteRequests();
  toast("Tu solicitud fue enviada correctamente.", "success");
  form.reset();
  closeModal("quote-modal");
}

function initBaseChat() {
  const form = $("#chat-form");
  const input = $("#chat-input");
  const messages = $("#chat-messages");
  if (!form || !input || !messages) return;

  const answers = {
    pieza: "Sí. Puedes enviarnos el nombre, referencia o una descripción de la pieza. Si indicas el uso clínico, podremos orientar mejor la búsqueda.",
    sets: "Sí. Revisamos requerimientos de piezas, sets y reposiciones para ordenar la solicitud antes de cotizar.",
    solicitud: "Para comenzar, indica el producto o especialidad, cantidad aproximada, uso esperado y plazo requerido. Una referencia o fotografía también ayuda."
  };

  const addMessage = (text, type) => {
    const bubble = document.createElement("div");
    bubble.className = `chat-bubble ${type}`;
    bubble.textContent = text;
    messages.appendChild(bubble);
    messages.scrollTop = messages.scrollHeight;
  };

  const getAnswer = (question) => {
    const normalized = question.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (normalized.includes("pieza") || normalized.includes("referencia")) return answers.pieza;
    if (normalized.includes("set") || normalized.includes("bandeja") || normalized.includes("completar")) return answers.sets;
    if (normalized.includes("cotiz") || normalized.includes("solicitud") || normalized.includes("necesito") || normalized.includes("informacion")) return answers.solicitud;
    return "Por ahora puedo responder dudas básicas sobre piezas, sets y cómo iniciar una cotización. Para disponibilidad, precios o productos específicos, escríbenos y te ayudaremos directamente.";
  };

  const answerQuestion = (question) => {
    const cleanQuestion = question.trim();
    if (!cleanQuestion) return;
    addMessage(cleanQuestion, "user");
    input.value = "";
    window.setTimeout(() => addMessage(getAnswer(cleanQuestion), "bot"), 260);
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    answerQuestion(input.value);
  });
  $$('[data-chat-question]').forEach((button) => {
    button.addEventListener("click", () => answerQuestion(button.textContent));
  });
}

function init() {
  $("#menu-toggle").addEventListener("click", () => {
    const isOpen = $("#main-nav").classList.toggle("open");
    document.body.classList.toggle("menu-open", isOpen);
  });
  $$("#main-nav a").forEach((link) => link.addEventListener("click", () => {
    $("#main-nav").classList.remove("open");
    document.body.classList.remove("menu-open");
  }));
  $$(".quote-trigger").forEach((button) => button.addEventListener("click", () => openQuoteFor()));
  $$("[data-close]").forEach((button) => button.addEventListener("click", () => closeModal(button.dataset.close)));
  $$(".modal-backdrop").forEach((backdrop) => {
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) backdrop.classList.remove("open");
      if (!$(".modal-backdrop.open")) document.body.classList.remove("modal-open");
    });
  });

  $("#filter-cat").addEventListener("change", (event) => {
    state.filter = event.target.value;
    state.page = 1;
    renderProducts();
  });
  $("#filter-search").addEventListener("input", (event) => {
    state.search = event.target.value;
    state.page = 1;
    renderProducts();
  });
  $("#quote-form").addEventListener("submit", submitQuote);

  renderCategories();
  renderProducts();
  initMotion();
  initHeroCarousel();
  initHeaderBehavior();
  initBaseChat();
  loadProducts();

  if (!db) {
    toast("El catalogo aun no tiene productos publicados.", "info");
  }
}

document.addEventListener("DOMContentLoaded", init);
