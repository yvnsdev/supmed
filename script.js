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

const categories = [
  { id: "general", name: "Cirugia general" },
  { id: "micro", name: "Microcirugia y delicado" },
  { id: "trauma", name: "Traumatologia" },
  { id: "gineco-uro", name: "Ginecologia y urologia" },
  { id: "odonto", name: "Odontologia y maxilofacial" },
  { id: "sets", name: "Sets y reposicion" }
];

let products = [];
const PRODUCTS_PER_PAGE = 8;
const state = { category: "", search: "", user: null, loadingProducts: false, page: 1 };
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
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
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

function normalizeCategoryId(categoryId, productText = "") {
  if (categories.some((category) => category.id === categoryId)) return categoryId;
  if (categoryId === "instrumental") return "general";
  if (productText.toLowerCase().includes("set") || productText.toLowerCase().includes("reposicion")) return "sets";
  return categoryId;
}

function mapProductFromDb(row) {
  const productText = `${row.name} ${row.reference} ${row.short_description} ${row.long_description || ""}`;
  return {
    id: row.id,
    categoryId: normalizeCategoryId(row.category_id, productText),
    name: row.name,
    reference: row.reference,
    short: row.short_description,
    long: row.long_description || "",
    imageUrl: row.image_url || "",
    imagePath: row.image_path || "",
    featured: Boolean(row.featured),
    sortOrder: row.sort_order ?? 0
  };
}

function mapProductToDb(product) {
  const payload = {
    category_id: product.categoryId,
    name: product.name,
    reference: product.reference,
    short_description: product.short,
    long_description: product.long,
    featured: Boolean(product.featured),
    sort_order: Number(product.sortOrder || 0)
  };
  if ("imageUrl" in product) payload.image_url = product.imageUrl || null;
  if ("imagePath" in product) payload.image_path = product.imagePath || null;
  return payload;
}

function categoryOptions(selected = "") {
  return categories.map((category) => (
    `<option value="${category.id}" ${category.id === selected ? "selected" : ""}>${escapeHtml(category.name)}</option>`
  )).join("");
}

function renderCategories() {
  $("#filter-cat").innerHTML = '<option value="">Todas las categorias</option>' + categoryOptions();
  $("#product-category-input").innerHTML = categoryOptions();
}

function isElconProduct(product) {
  const currentCategory = categories.some((category) => category.id === product.categoryId);
  const haystack = `${product.name} ${product.reference} ${product.short} ${product.long}`.toLowerCase();
  return currentCategory || haystack.includes("elcon");
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
        <div class="admin-actions">
          <button class="btn btn-sm btn-admin-edit" type="button" data-edit-prod="${product.id}">Editar</button>
          <button class="btn btn-sm btn-admin-delete" type="button" data-delete-prod="${product.id}">Borrar</button>
        </div>
      </div>
    </article>
  `;
}

function renderProducts() {
  const query = state.search.trim().toLowerCase();
  let items = [...products].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  if (state.category) {
    items = items.filter((product) => product.categoryId === state.category);
  }

  if (query) {
    items = items.filter((product) => {
      const category = categories.find((item) => item.id === product.categoryId)?.name || "";
      const haystack = `${product.name} ${product.reference} ${product.short} ${product.long} ${category}`.toLowerCase();
      return haystack.includes(query);
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
    button.addEventListener("click", () => openQuoteFor(button.dataset.quoteProd));
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
    toast("No se pudo cargar el catalogo. Intenta nuevamente en unos minutos.", "error");
    renderProducts();
    return;
  }

  const elconProducts = data.map(mapProductFromDb).filter(isElconProduct);
  products = elconProducts;
  renderProducts();
}

function updateAuthUi() {
  const isAdmin = Boolean(state.user);
  document.body.classList.toggle("is-admin", isAdmin);
  $("#auth-button").classList.toggle("hidden", isAdmin);
  $("#logout-button").classList.toggle("hidden", !isAdmin);
  $("#admin-catalog-tools").classList.toggle("hidden", !isAdmin);
  $("#admin-user-label").textContent = isAdmin ? `Conectado como ${state.user.email}` : "Acceso no iniciado";
  renderProducts();
}

async function refreshSession() {
  if (!db) {
    $("#auth-button").title = "El acceso privado no esta disponible en este momento";
    return;
  }

  const { data } = await db.auth.getSession();
  state.user = data.session?.user || null;
  updateAuthUi();

  db.auth.onAuthStateChange((_event, session) => {
    state.user = session?.user || null;
    updateAuthUi();
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
  toast("Acceso iniciado. Ya puedes gestionar el catalogo.", "success");
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
  $("#product-modal-title").textContent = product.name;
  $("#product-modal .modal-body").innerHTML = `
    ${productVisual(product)}
    ${category ? `<span class="prod-cat">${escapeHtml(category.name)}</span>` : ""}
    <h3 style="margin:12px 0 6px">${escapeHtml(product.name)}</h3>
    <p style="color:var(--muted);margin-bottom:12px">Ref. ${escapeHtml(product.reference)}</p>
    <p style="margin-bottom:10px">${escapeHtml(product.short)}</p>
    <p>${escapeHtml(product.long)}</p>
  `;
  $("#product-modal-quote").onclick = () => {
    closeModal("product-modal");
    openQuoteFor(product.id);
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
  fields.categoryId.value = product?.categoryId || categories[0].id;
  fields.sortOrder.value = product?.sortOrder ?? "";
  fields.short.value = product?.short || "";
  fields.long.value = product?.long || "";
  fields.image.value = "";
  fields.featured.checked = Boolean(product?.featured);
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
    name: fields.name.value.trim(),
    reference: fields.reference.value.trim(),
    short: fields.short.value.trim(),
    long: fields.long.value.trim(),
    featured: fields.featured.checked,
    sortOrder: fields.sortOrder.value ? Number(fields.sortOrder.value) : 0
  };
  const currentProduct = id ? products.find((item) => item.id === id) : null;
  const imageFile = fields.image.files?.[0] || null;

  if (!product.name || !product.reference || !product.short) {
    toast("Completa nombre, referencia y resumen del producto.", "error");
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
  renderProducts();
  toast("Producto borrado del catalogo.", "success");
}

function openQuoteFor(productId = "") {
  const product = products.find((item) => item.id === productId);
  const tag = $("#quote-product-tag");

  if (product) {
    const category = categories.find((item) => item.id === product.categoryId)?.name || "";
    const details = [
      `Hola SUPMED, quiero cotizar este producto: ${product.name}.`,
      product.reference ? `Referencia: ${product.reference}.` : "",
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

function submitQuote(event) {
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
    message: fields.message.value.trim()
  };

  if (!data.name || !data.email) {
    toast("Completa tu nombre y correo para enviar la solicitud.", "error");
    return;
  }

  const subject = encodeURIComponent(`Solicitud ELCON Medical - ${data.interest || "Instrumental quirurgico"}`);
  const body = encodeURIComponent(
    `Nombre: ${data.name}\nCargo: ${data.position}\nInstitucion: ${data.institution}\nTelefono: ${data.phone}\nCorreo: ${data.email}\nInteres: ${data.interest}\n\nMensaje:\n${data.message}`
  );

  localStorage.setItem("supmed-last-request", JSON.stringify({ ...data, createdAt: new Date().toISOString() }));
  window.location.href = `mailto:contacto@supmed.cl?subject=${subject}&body=${body}`;
  toast("Se abrio tu correo para enviar la solicitud.", "success");
  form.reset();
  closeModal("quote-modal");
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

  $("#auth-button").addEventListener("click", () => openModal("login-modal"));
  $("#logout-button").addEventListener("click", logout);
  $("#add-product-button").addEventListener("click", () => openProductEditor());

  $("#filter-cat").addEventListener("change", (event) => {
    state.category = event.target.value;
    state.page = 1;
    renderProducts();
  });
  $("#filter-search").addEventListener("input", (event) => {
    state.search = event.target.value;
    state.page = 1;
    renderProducts();
  });
  $("#quote-form").addEventListener("submit", submitQuote);
  $("#login-form").addEventListener("submit", submitLogin);
  $("#product-form").addEventListener("submit", saveProduct);

  renderCategories();
  renderProducts();
  initMotion();
  initHeroCarousel();
  initHeaderBehavior();
  refreshSession();
  loadProducts();

  if (!db) {
    toast("El catalogo aun no tiene productos publicados.", "info");
  }
}

document.addEventListener("DOMContentLoaded", init);
