import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

document.documentElement.classList.add("js");

const supabaseUrl = "https://qihrjjaatymkwdtapkht.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpaHJqamFhdHlta3dkdGFwa2h0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExOTY5NTQsImV4cCI6MjA5Njc3Mjk1NH0.3cCozUogaSG_RLeMBCflvMhs8v9hLwrtoopm8xDNllA";

const supabase = createClient(supabaseUrl, supabaseKey);

const hasSupabaseConfig = Boolean(
  supabaseUrl &&
  supabaseKey
);
const db = hasSupabaseConfig ? supabase : null;

const categories = [
  { id: "instrumental", name: "Instrumental quirurgico" },
  { id: "equipamiento", name: "Equipamiento clinico" },
  { id: "mantencion", name: "Mantencion" },
  { id: "insumos", name: "Insumos y accesorios" },
  { id: "alquiler", name: "Alquiler RentaMed" },
  { id: "habilitacion", name: "Habilitacion sanitaria" }
];

const services = [
  ["IQ", "Venta de instrumental quirurgico ELCON", "Seleccion y suministro de instrumental para pabellon, procedimientos y especialidades clinicas."],
  ["MP", "Mantencion preventiva y correctiva", "Gestion, planificacion y ejecucion de mantenciones para equipamiento medico."],
  ["GE", "Gestion de equipamiento clinico", "Apoyo en adquisicion, control operativo y continuidad de equipos medicos."],
  ["AC", "Accesorios medicos monitorizados", "Venta de partes, accesorios e insumos asociados a equipos medicos."],
  ["AS", "Asesoria tecnica-profesional", "Acompanamiento durante cualquier etapa del desarrollo de proyectos de salud."],
  ["HS", "Habilitacion de recintos", "Orientacion para autorizacion sanitaria y cumplimiento de requerimientos tecnicos."],
  ["OP", "Soluciones operativas", "Respuesta a problematicas del area de la salud con foco practico y tecnico."],
  ["RA", "Soluciones de alquiler", "Arriendo de equipos medicos o de rehabilitacion para necesidades temporales."]
];

const sectors = [
  "Centros medicos",
  "Clinicas",
  "Centros de especialidad",
  "Consultas",
  "Centros odontologicos",
  "Centros de rehabilitacion",
  "CESFAM",
  "CECOF",
  "Hospitales",
  "Profesionales independientes"
];

const regions = ["Calama", "Antofagasta", "Bio Bio", "Metropolitana", "Araucania", "Magallanes", "Zonas extremas"];

const seedProducts = [
  {
    id: "instrumental-elcon",
    categoryId: "instrumental",
    name: "Instrumental quirurgico ELCON",
    reference: "SUP-IQ-ELCON",
    short: "Linea de instrumental quirurgico para pabellon y procedimientos clinicos.",
    long: "Solucion cotizable segun especialidad, volumen de trabajo, requerimientos tecnicos y disponibilidad.",
    featured: true,
    sortOrder: 10
  },
  {
    id: "accesorios-monitorizados",
    categoryId: "insumos",
    name: "Accesorios medicos monitorizados",
    reference: "SUP-AM-UPN",
    short: "Accesorios y partes asociadas a equipos medicos y monitoreo clinico.",
    long: "Linea orientada a continuidad operativa, reposicion y necesidades de servicios clinicos.",
    featured: true,
    sortOrder: 20
  },
  {
    id: "mantencion-equipos",
    categoryId: "mantencion",
    name: "Mantencion de equipamiento medico",
    reference: "SUP-ST-001",
    short: "Servicio preventivo y correctivo para asegurar disponibilidad y funcionamiento.",
    long: "Incluye planificacion de mantenciones, respuesta tecnica y apoyo presencial segun cobertura.",
    featured: true,
    sortOrder: 30
  },
  {
    id: "gestion-equipamiento",
    categoryId: "equipamiento",
    name: "Gestion de equipamiento clinico",
    reference: "SUP-GE-010",
    short: "Seleccion, adquisicion y gestion tecnica de equipos medicos segun necesidad.",
    long: "Apoyo para elegir equipamiento adecuado, gestionar continuidad y resolver brechas operativas.",
    featured: false,
    sortOrder: 40
  },
  {
    id: "habilitacion-recintos",
    categoryId: "habilitacion",
    name: "Habilitacion para autorizacion sanitaria",
    reference: "SUP-HS-020",
    short: "Acompanamiento tecnico para recintos de salud y exigencias sanitarias.",
    long: "Asesoria basada en conocimiento de normas sanitarias, constructivas, energeticas y requerimientos del area.",
    featured: false,
    sortOrder: 50
  },
  {
    id: "insumos-limpieza",
    categoryId: "insumos",
    name: "Insumos clinicos y desinfectantes",
    reference: "SUP-IC-030",
    short: "Insumos de limpieza clinicos, desinfectantes y productos complementarios.",
    long: "Productos cotizables para continuidad operativa y necesidades de centros de salud.",
    featured: false,
    sortOrder: 60
  },
  {
    id: "alquiler-monitoreo",
    categoryId: "alquiler",
    name: "Alquiler de equipos de monitoreo",
    reference: "RM-MON-040",
    short: "Equipos de baja y media complejidad para monitoreo de signos vitales.",
    long: "Solucion temporal para situaciones transitorias, continuidad de servicio o soporte clinico puntual.",
    featured: false,
    sortOrder: 70
  },
  {
    id: "alquiler-rehabilitacion",
    categoryId: "alquiler",
    name: "Alquiler de equipamiento de rehabilitacion",
    reference: "RM-REH-050",
    short: "Equipos de rehabilitacion disponibles segun necesidad del usuario o institucion.",
    long: "Servicio respaldado por experiencia SUPMED y planificacion de mantencion para continuidad.",
    featured: false,
    sortOrder: 80
  }
];

let products = [...seedProducts];
const state = { category: "", search: "", user: null, loadingProducts: false };
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

function mapProductFromDb(row) {
  return {
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    reference: row.reference,
    short: row.short_description,
    long: row.long_description || "",
    featured: Boolean(row.featured),
    sortOrder: row.sort_order ?? 0
  };
}

function mapProductToDb(product) {
  return {
    category_id: product.categoryId,
    name: product.name,
    reference: product.reference,
    short_description: product.short,
    long_description: product.long,
    featured: Boolean(product.featured),
    sort_order: Number(product.sortOrder || 0)
  };
}

function renderServices() {
  $("#services-grid").innerHTML = services.map(([icon, title, description]) => `
    <article class="service-card">
      <span class="service-icon">${escapeHtml(icon)}</span>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(description)}</p>
    </article>
  `).join("");
  observeRevealItems($$("#services-grid .service-card"));
}

function renderTags() {
  $("#sector-list").innerHTML = sectors.map((item) => `<span>${escapeHtml(item)}</span>`).join("");
  $("#region-list").innerHTML = regions.map((item) => `<span>${escapeHtml(item)}</span>`).join("");
  observeRevealItems([...$$("#sector-list span"), ...$$("#region-list span")]);
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

function productVisual(product) {
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
    : "No hay resultados para ese filtro.";

  $("#prod-grid").innerHTML = items.length
    ? items.map(productCard).join("")
    : `<p class="empty">${emptyMessage}</p>`;

  bindProductButtons(document);
  observeRevealItems($("#prod-grid").children);
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
  observeRevealItems([...$$("#services-grid .service-card"), ...$$("#prod-grid > *"), ...$$("#sector-list span"), ...$$("#region-list span")]);
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
    toast("No se pudo cargar Supabase. Se muestran productos base.", "error");
    renderProducts();
    return;
  }

  products = data.map(mapProductFromDb);
  renderProducts();
}

function updateAuthUi() {
  const isAdmin = Boolean(state.user);
  document.body.classList.toggle("is-admin", isAdmin);
  $("#auth-button").classList.toggle("hidden", isAdmin);
  $("#logout-button").classList.toggle("hidden", !isAdmin);
  $("#admin-catalog-tools").classList.toggle("hidden", !isAdmin);
  $("#admin-user-label").textContent = isAdmin ? state.user.email : "Sesion no iniciada";
  renderProducts();
}

async function refreshSession() {
  if (!db) {
    $("#auth-button").title = "Configura Supabase para habilitar login";
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
    toast("Configura supabaseUrl y supabaseKey al inicio de script.js.", "error");
    return;
  }

  const form = event.target;
  const fields = form.elements;
  const email = fields.email.value.trim();
  const password = fields.password.value;
  const { error } = await db.auth.signInWithPassword({ email, password });

  if (error) {
    toast(error.message || "No se pudo iniciar sesion.", "error");
    return;
  }

  form.reset();
  closeModal("login-modal");
  toast("Sesion iniciada. Catalogo en modo administrador.", "success");
}

async function logout() {
  if (!db) return;
  await db.auth.signOut();
  toast("Sesion cerrada.", "success");
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
    toast("Inicia sesion para administrar productos.", "error");
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
  fields.featured.checked = Boolean(product?.featured);
  $("#product-editor-title").textContent = product ? "Editar producto" : "Agregar producto";
  openModal("product-editor-modal");
}

async function saveProduct(event) {
  event.preventDefault();

  if (!db || !state.user) {
    toast("Inicia sesion con Supabase para guardar productos.", "error");
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

  if (!product.name || !product.reference || !product.short) {
    toast("Nombre, referencia y descripcion corta son obligatorios.", "error");
    return;
  }

  const payload = mapProductToDb(product);
  const request = id
    ? db.from("products").update(payload).eq("id", id).select().single()
    : db.from("products").insert(payload).select().single();

  const { data, error } = await request;

  if (error) {
    toast(error.message || "No se pudo guardar el producto.", "error");
    return;
  }

  const saved = mapProductFromDb(data);
  products = id
    ? products.map((item) => item.id === id ? saved : item)
    : [...products, saved];

  renderProducts();
  closeModal("product-editor-modal");
  toast(id ? "Producto actualizado." : "Producto agregado.", "success");
}

async function deleteProduct(id) {
  if (!db || !state.user) {
    toast("Inicia sesion con Supabase para borrar productos.", "error");
    return;
  }

  const product = products.find((item) => item.id === id);
  if (!product) return;

  const confirmed = window.confirm(`Borrar "${product.name}" del catalogo?`);
  if (!confirmed) return;

  const { error } = await db.from("products").delete().eq("id", id);

  if (error) {
    toast(error.message || "No se pudo borrar el producto.", "error");
    return;
  }

  products = products.filter((item) => item.id !== id);
  renderProducts();
  toast("Producto borrado.", "success");
}

function openQuoteFor(productId = "") {
  const product = products.find((item) => item.id === productId);
  const tag = $("#quote-product-tag");

  $("#quote-product-name").value = product ? product.name : "";
  $("#quote-interest").value = product ? `${product.name} (${product.reference})` : "";

  if (product) {
    tag.textContent = `Interes: ${product.name}`;
    tag.classList.remove("hidden");
  } else {
    tag.classList.add("hidden");
  }

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
    toast("Nombre y correo son obligatorios.", "error");
    return;
  }

  const subject = encodeURIComponent(`Solicitud SUPMED - ${data.interest || "Asesoria o cotizacion"}`);
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
    renderProducts();
  });
  $("#filter-search").addEventListener("input", (event) => {
    state.search = event.target.value;
    renderProducts();
  });
  $("#quote-form").addEventListener("submit", submitQuote);
  $("#login-form").addEventListener("submit", submitLogin);
  $("#product-form").addEventListener("submit", saveProduct);

  renderServices();
  renderTags();
  renderCategories();
  renderProducts();
  initMotion();
  initHeaderBehavior();
  refreshSession();
  loadProducts();

  if (!db) {
    toast("Supabase aun no esta configurado. El catalogo usa productos base.", "info");
  }
}

document.addEventListener("DOMContentLoaded", init);
