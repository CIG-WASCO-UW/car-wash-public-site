/* Render the validated public website design without replacing interactive nodes. */
(() => {
  "use strict";
  const BUILTINS = ["hero", "cases", "guide", "methodology"];
  const DENSITIES = ["standard", "compact", "reading"];
  const IMAGE_PATH = /^assets\/[A-Za-z0-9][A-Za-z0-9._-]{0,244}\.(?:png|jpe?g|webp|avif|svg)$/i;
  const DEFAULTS = {
    schema_version: 1, brand_name: "CAR-WASH", brand_subtitle: "WASCO · Climate Impacts Group",
    description: "Source-bounded climate adaptation case studies for Washington and the Pacific Northwest.",
    contact_email: "cig@uw.edu",
    theme: {primary: "#34735e", accent: "#57418f", background: "#f4f7f6", text: "#14273a"},
    density: "standard", hero_image: "", hero_alt: "",
    navigation: [{label: "Case Studies", href: "#library"}, {label: "Using Case Studies", href: "#using-cases"}, {label: "Methodology", href: "#methodology"}],
    sections: BUILTINS.map(id => ({id, type: "builtin", visible: true}))
  };
  let nodes = null;
  let originalCopy = null;
  const hiddenLinks = new Map();

  function fail(message) { throw new TypeError(message); }
  function object(value, label, allowed) {
    if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object.`);
    if (allowed && Object.keys(value).some(key => !allowed.includes(key))) fail(`${label} contains an unknown field.`);
    return value;
  }
  function text(value, label, limit, required = false, multiline = false) {
    if (typeof value !== "string" || value.length > limit) fail(`${label} must be text of at most ${limit} characters.`);
    const controls = multiline ? /[\x00-\x08\x0b-\x1f\x7f-\x9f]/ : /[\x00-\x1f\x7f-\x9f]/;
    if (controls.test(value) || (required && !value.trim())) fail(`${label} contains invalid or missing text.`);
    return value;
  }
  function email(value) {
    if (typeof value !== "string" || value.length > 254) return false;
    const parts = value.split("@");
    if (parts.length !== 2) return false;
    const [local, domain] = parts;
    const labels = domain.split(".");
    return local.length > 0 && local.length <= 64 && !local.startsWith(".") && !local.endsWith(".") && !local.includes("..") &&
      /^[A-Za-z0-9.!#$%&'*+?^_`{|}~-]+$/.test(local) && domain.length <= 253 && labels.length >= 2 &&
      labels.every(label => /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(label)) && /^[A-Za-z]{2,}$/.test(labels.at(-1));
  }
  function safeURL(value, label) {
    text(value, label, 2048, true);
    if (value.includes("\\") || /\s/.test(value)) fail(`${label} contains unsafe characters.`);
    if (value.startsWith("#") && value.length > 1) return value;
    let url;
    try { url = new URL(value); } catch (_) { fail(`${label} must be an HTTP(S), mailto, or fragment link.`); }
    if (["http:", "https:"].includes(url.protocol) && /^https?:\/\//i.test(value) && url.hostname && !url.username && !url.password) return value;
    if (url.protocol === "mailto:" && !url.host && !url.search && !url.hash && !/%(?![0-9a-f]{2})/i.test(url.pathname)) {
      try { if (email(decodeURIComponent(url.pathname))) return value; } catch (_) { /* Invalid percent escape. */ }
    }
    fail(`${label} must be an HTTP(S), mailto, or fragment link.`);
  }
  function imagePath(value, label) {
    text(value, label, 255);
    if (value && !IMAGE_PATH.test(value)) fail(`${label} must be a catalog assets/ image path.`);
    return value;
  }
  function validate(source) {
    source = source == null ? {} : object(source, "Site design", Object.keys(DEFAULTS));
    const design = {...DEFAULTS, ...source, theme: {...DEFAULTS.theme, ...object(source.theme === undefined ? {} : source.theme, "Theme", Object.keys(DEFAULTS.theme))}};
    if (design.schema_version !== 1) fail("Unsupported site design version.");
    text(design.brand_name, "Website name", 80, true);
    text(design.brand_subtitle, "Subtitle", 160);
    text(design.description, "Description", 700);
    text(design.contact_email, "Contact email", 254, true);
    if (!email(design.contact_email)) fail("Contact email must be a valid email address.");
    Object.entries(design.theme).forEach(([key, value]) => {
      if (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value)) fail(`Theme ${key} must be a six-digit color.`);
    });
    if (!DENSITIES.includes(design.density)) fail("Reading density must be standard, compact, or reading.");
    imagePath(design.hero_image, "Hero image");
    text(design.hero_alt, "Hero image description", 300, Boolean(design.hero_image));
    if (!Array.isArray(design.navigation) || !design.navigation.length || design.navigation.length > 8) fail("Navigation needs 1 to 8 links.");
    design.navigation = design.navigation.map(item => {
      object(item, "Navigation entry", ["label", "href"]);
      return {label: text(item.label, "Navigation label", 80, true), href: safeURL(item.href, "Navigation link")};
    });
    if (!Array.isArray(design.sections) || design.sections.length > 16) fail("Sections must include the four builtins and at most 12 custom blocks.");
    const seen = new Set();
    let customCount = 0;
    design.sections = design.sections.map(section => {
      object(section, "Section");
      if (typeof section.id !== "string" || seen.has(section.id)) fail("Every section needs a unique ID.");
      seen.add(section.id);
      if (section.type === "builtin") {
        object(section, "Builtin section", ["id", "type", "visible"]);
        if (!BUILTINS.includes(section.id) || typeof section.visible !== "boolean") fail("Invalid builtin section.");
        if (section.id === "cases" && !section.visible) fail("The case study library must remain visible.");
        return {...section};
      }
      object(section, "Custom section", ["id", "type", "visible", "heading", "body", "image_path", "image_alt", "link_label", "link_url"]);
      if (!/^custom-[A-Za-z0-9_-]{1,60}$/.test(section.id) || !["text", "image", "links"].includes(section.type) || ++customCount > 12) fail("Invalid custom section.");
      const item = {heading: "", body: "", image_path: "", image_alt: "", link_label: "", link_url: "", visible: true, ...section};
      if (typeof item.visible !== "boolean") fail("Section visibility must be true or false.");
      text(item.heading, "Section heading", 120);
      text(item.body, "Section body", 4000, false, true);
      imagePath(item.image_path, "Section image");
      text(item.image_alt, "Section image description", 300, item.type === "image");
      text(item.link_label, "Section link label", 80, item.type === "links");
      text(item.link_url, "Section link", 2048);
      if (item.type === "image" && !item.image_path) fail("Image sections need an image.");
      if (item.type !== "image" && (item.image_path || item.image_alt)) fail("Only image sections can contain image fields.");
      if (item.type !== "links" && (item.link_label || item.link_url)) fail("Only link sections can contain link fields.");
      if (item.type === "links") safeURL(item.link_url, "Section link");
      return item;
    });
    if (!BUILTINS.every(id => seen.has(id))) fail("All four builtin sections must be present.");
    return design;
  }
  function validateCopy(copy) {
    object(copy, "Page language");
    if (Object.keys(copy).length > 200) fail("Page language contains too many fields.");
    const result = Object.create(null);
    Object.entries(copy).forEach(([key, value]) => {
      if (!/^[a-z][a-z0-9_]{0,79}$/.test(key)) fail("Page language contains an invalid field.");
      result[key] = text(value, "Page language", 10000, false, true);
    });
    return result;
  }
  function validateCredits(credits) {
    object(credits, "Image credits");
    if (Object.keys(credits).length > 1000) fail("Image credits contains too many records.");
    const result = Object.create(null);
    Object.entries(credits).forEach(([path, item]) => {
      if (!IMAGE_PATH.test(path) || path.length > 255) fail("Image credit has an invalid catalog path.");
      object(item, "Image credit");
      result[path] = {
        attribution: text(item.attribution || "", "Image attribution", 4000, false, true),
        source_url: text(item.source_url || "", "Image source", 2048),
        rights_status: text(item.rights_status || "", "Image rights", 300)
      };
    });
    return result;
  }
  function element(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined) node.textContent = value;
    return node;
  }
  function initialize() {
    if (nodes) return;
    const builtin = {hero: document.querySelector(".research-atlas-hero"), cases: document.getElementById("library"), guide: document.getElementById("using-cases"), methodology: document.getElementById("methodology")};
    if (!Object.values(builtin).every(Boolean) || !document.getElementById("site-nav")) fail("The public page is missing a required section.");
    originalCopy = new Map(Array.from(document.querySelectorAll("[data-site-copy]")).map(node => [node, node.textContent]));
    const flow = element("div", "site-sections-flow");
    flow.id = "site-sections-flow";
    builtin.hero.before(flow);
    // Move these before moving main so they can be independently ordered and hidden.
    builtin.guide.remove();
    builtin.methodology.remove();
    Object.entries(builtin).forEach(([id, node]) => { node.dataset.siteSection = id; flow.append(node); });
    if (!builtin.hero.id) builtin.hero.id = "hero";
    const tail = element("div", "site-design-snapshot-tail page-shell");
    const snapshot = document.getElementById("snapshot-meta");
    if (snapshot) tail.append(snapshot);
    flow.append(tail);
    nodes = {builtin, flow, tail, nav: document.getElementById("site-nav")};
  }
  function mix(first, second, amount) {
    const channels = [1, 3, 5].map(i => Math.round(parseInt(first.slice(i, i + 2), 16) * (1 - amount) + parseInt(second.slice(i, i + 2), 16) * amount));
    return `#${channels.map(value => value.toString(16).padStart(2, "0")).join("")}`;
  }
  function applyTheme(theme) {
    const vars = {green: theme.primary, purple: theme.accent, paper: theme.background, ink: theme.text};
    const defaults = Object.keys(DEFAULTS.theme).every(key => theme[key].toLowerCase() === DEFAULTS.theme[key]);
    Object.assign(vars, defaults ? {"ink-deep": "#0b1c2a", muted: "#5d6d7d", "green-soft": "#e8f2ee", "lake-soft": "#eaf3f6", line: "#d7e1e5", blue: "#287b9c"} : {
      "ink-deep": mix(theme.text, "#000000", .35), muted: mix(theme.text, theme.background, .36),
      "green-soft": mix(theme.primary, theme.background, .90), "lake-soft": mix(theme.accent, theme.background, .92),
      line: mix(theme.text, theme.background, .82), blue: mix(theme.primary, theme.accent, .5)
    });
    Object.entries(vars).forEach(([key, value]) => document.documentElement.style.setProperty(`--${key}`, value));
    document.body.classList.toggle("site-design-custom-theme", !defaults);
  }
  function assetURL(path) {
    return location.protocol === "file:" || window.CAR_WASH_STATIC_SNAPSHOT === true ? path : `/${path}`;
  }
  function creditNode(path, credits, hero = false) {
    const credit = credits[path] || {};
    const caption = element(hero ? "p" : "figcaption", `site-design-image-credit${hero ? " site-design-hero-credit" : ""}`);
    caption.append(element("span", "", credit.attribution || "Image credit not recorded."));
    if (credit.rights_status) caption.append(element("span", "", `Rights: ${credit.rights_status}`));
    try {
      const source = safeURL(credit.source_url || "", "Image source");
      if (new URL(source).protocol === "https:") {
        const link = element("a", "", "Image source ↗");
        link.href = source; link.target = "_blank"; link.rel = "noopener noreferrer";
        caption.append(link);
      }
    } catch (_) { /* A missing or unsafe source is never made into a link. */ }
    return caption;
  }
  function imageNode(path, alt, hero = false) {
    const img = element("img", hero ? "site-design-hero-image" : "site-design-section-image");
    img.src = assetURL(path); img.alt = alt;
    if (hero) img.fetchPriority = "high";
    else img.loading = "lazy";
    return img;
  }
  function customNode(section, credits) {
    const node = element("section", `site-design-section site-design-section-${section.type}`);
    node.id = section.id; node.dataset.siteSection = section.id; node.hidden = !section.visible;
    if (section.heading) {
      const heading = element("h2", "", section.heading);
      heading.id = `${section.id}-heading`;
      node.setAttribute("aria-labelledby", heading.id); node.append(heading);
    }
    if (section.body) node.append(element("p", "site-design-body", section.body));
    if (section.type === "image") {
      const figure = element("figure", "site-design-figure");
      figure.append(imageNode(section.image_path, section.image_alt), creditNode(section.image_path, credits)); node.append(figure);
    }
    if (section.type === "links") {
      const link = element("a", "site-design-section-link", section.link_label);
      link.href = section.link_url; node.append(link);
    }
    return node;
  }
  function syncLinks() {
    // Restore only links that this module hid; other UI visibility belongs to its owner.
    hiddenLinks.forEach((wasHidden, link) => { if (link.isConnected) link.hidden = wasHidden; });
    hiddenLinks.clear();
    document.querySelectorAll('a[href]').forEach(link => {
      let url;
      try { url = new URL(link.getAttribute("href"), location.href); } catch (_) { return; }
      if (url.origin !== location.origin || url.pathname !== location.pathname || !url.hash) return;
      let id;
      try { id = decodeURIComponent(url.hash.slice(1)); } catch (_) { return; }
      if (id.startsWith("case=")) return;
      const target = document.getElementById(id);
      const section = target?.closest("[data-site-section]");
      // Removed custom blocks are also unavailable, while unrelated fragments remain intact.
      if ((section && section.hidden) || (!target && /^custom-[A-Za-z0-9_-]{1,60}$/.test(id))) {
        hiddenLinks.set(link, link.hidden); link.hidden = true;
      }
    });
  }
  function showError(error) {
    let alert = document.getElementById("site-design-error");
    if (!alert) {
      alert = element("p", "site-design-error"); alert.id = "site-design-error"; alert.setAttribute("role", "alert");
      document.body.prepend(alert);
    }
    alert.textContent = `Website preview could not be updated: ${error.message || "Invalid website design."}`;
    alert.hidden = false;
  }
  function render(source, suppliedCopy, suppliedCredits) {
    // Validate the whole message before changing visible content or metadata.
    const design = validate(source);
    const siteCopy = validateCopy(suppliedCopy == null ? (window.CAR_WASH_META?.site_copy || {}) : suppliedCopy);
    const credits = validateCredits(suppliedCredits === undefined ? (window.CAR_WASH_META?.site_image_credits || {}) : suppliedCredits);
    initialize();
    document.querySelector(".brand-copy strong").textContent = design.brand_name;
    document.querySelector(".brand-copy small").textContent = design.brand_subtitle;
    document.querySelector(".brand")?.setAttribute("aria-label", `${design.brand_name} case studies home`);
    let description = document.querySelector('meta[name="description"]');
    if (!description) { description = element("meta"); description.name = "description"; document.head.append(description); }
    description.content = design.description;
    document.querySelectorAll('.site-footer a[href^="mailto:"]').forEach(link => { link.href = `mailto:${design.contact_email}`; });
    originalCopy.forEach((fallback, node) => { node.textContent = Object.hasOwn(siteCopy, node.dataset.siteCopy) ? siteCopy[node.dataset.siteCopy] : fallback; });
    const title = siteCopy.site_title || document.querySelector('[data-site-copy="site_title"]')?.textContent || "Climate Adaptation Case Study Repository";
    document.title = `${design.brand_name} ${title}`;
    applyTheme(design.theme);
    const requested = new URLSearchParams(location.search).get("layout");
    const density = DENSITIES.includes(requested) ? requested : design.density;
    document.body.classList.remove(...DENSITIES.map(value => `layout-${value}`));
    document.body.classList.add(`layout-${density}`);
    const hero = nodes.builtin.hero;
    hero.querySelectorAll(".site-design-hero-image, .site-design-hero-credit").forEach(node => node.remove());
    hero.classList.toggle("site-design-has-hero-image", Boolean(design.hero_image));
    if (design.hero_image) { hero.prepend(imageNode(design.hero_image, design.hero_alt, true)); hero.append(creditNode(design.hero_image, credits, true)); }
    nodes.nav.replaceChildren(...design.navigation.map(item => {
      const link = element("a", item.href === "#library" ? "active" : "", item.label); link.href = item.href; return link;
    }));
    nodes.flow.querySelectorAll(":scope > .site-design-section").forEach(node => node.remove());
    design.sections.forEach(section => {
      const node = section.type === "builtin" ? nodes.builtin[section.id] : customNode(section, credits);
      node.hidden = section.id === "cases" ? false : !section.visible;
      nodes.flow.append(node);
    });
    nodes.flow.append(nodes.tail);
    syncLinks();
    const alert = document.getElementById("site-design-error");
    if (alert) alert.hidden = true;
    if (suppliedCredits !== undefined) {
      window.CAR_WASH_META = {...(window.CAR_WASH_META || {}), site_image_credits: credits};
    }
    window.dispatchEvent(new CustomEvent("car-wash-site-design-applied", {detail: {siteCopy, density}}));
    return design;
  }
  function apply(design, siteCopy) {
    try { return render(design, siteCopy); }
    catch (error) { showError(error); throw error; }
  }
  window.CAR_WASH_SITE_DESIGN = Object.freeze({apply});
  window.addEventListener("message", event => {
    if (new URLSearchParams(location.search).get("preview") !== "1" || window.parent === window ||
        event.origin !== location.origin || event.source !== window.parent || event.data?.type !== "car-wash-site-preview") return;
    try {
      render(event.data.design, event.data.siteCopy, event.data.imageCredits);
      window.parent.postMessage({type: "car-wash-site-preview-applied"}, location.origin);
    } catch (error) {
      showError(error);
      window.parent.postMessage({type: "car-wash-site-preview-error", message: error.message}, location.origin);
    }
  });
})();
