(() => {
  "use strict";
  const cases = window.CAR_WASH_CASES || [];
  const meta = window.CAR_WASH_META || {};
  const siteCopy = meta.site_copy || {};
  const siteText = (key, fallback) => clean(siteCopy[key]) || fallback;
  const assetVersion = encodeURIComponent(meta.snapshot_id || meta.dataset_version || "staging");
  const fileMode = location.protocol === "file:" || window.CAR_WASH_STATIC_SNAPSHOT === true;
  const initialParams = new URLSearchParams(location.search);
  const requestedLayout = initialParams.get("layout") || "standard";
  const layoutMode = ["standard", "compact", "reading"].includes(requestedLayout) ? requestedLayout : "standard";
  const layoutClasses = {standard:"layout-standard", compact:"layout-compact", reading:"layout-reading"};
  const previewMode = initialParams.get("preview") === "1";
  document.body.classList.add(layoutClasses[layoutMode]);
  if (previewMode) document.body.classList.add("website-preview");
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const clean = value => { const text = String(value ?? "").trim(); return /^not recorded|^not_recorded/i.test(text) ? "" : text; };
  const normalize = value => String(value ?? "").replace(/Impliment/gi, "Implement").replace(/efficency/gi, "efficiency").replace(/risk reductionwith/gi, "risk reduction with").replace(/,\s*/g, ", ").replace(/\s*→\s*/g, " to ").trim();
  const publicLabels = {
    MONITORING_DATA_EARLY_WARNING:"Data, monitoring, and early warning",
    NATURE_BASED_RESTORATION_GREEN_INFRASTRUCTURE:"Nature-based restoration and green infrastructure",
    BUILT_INFRASTRUCTURE_RETROFIT:"Built infrastructure and facility retrofit",
    EMERGENCY_PREPAREDNESS_RESPONSE:"Emergency preparedness and response",
    RELOCATION_MANAGED_RETREAT:"Relocation and managed retreat",
    COMMUNITY_ENGAGEMENT_CAPACITY_BUILDING:"Community engagement and capacity building",
    FINANCIAL_PROGRAM_INCENTIVE:"Financial programs and incentives",
    ASSESSMENT_PLANNING:"Assessment and planning",
    POLICY_GOVERNANCE:"Policy and governance",
  };
  const label = value => publicLabels[String(value || "").toUpperCase()] || normalize(value).replaceAll("_", " ").toLowerCase().replace(/^./, char => char.toUpperCase());
  const stageGroups = {ASSESS:"Planning and design",PLAN:"Planning and design",DESIGN:"Planning and design",PLANNING:"Planning and design",PILOT:"Pilot",IMPLEMENT:"Implementation",IMPLEMENTING:"Implementation",IMPLEMENTED:"Implementation","COMPLETED / OPERATIONAL":"Implementation",MONITOR:"Monitoring and adaptive management",EVALUATE:"Monitoring and adaptive management",ADAPT:"Monitoring and adaptive management","MONITORING / ADAPTIVE MANAGEMENT":"Monitoring and adaptive management"};
  const excerpt = (value, max = 150) => { const text = normalize(value).replace(/\s+/g, " "); return text.length > max ? `${text.slice(0, max).replace(/\s+\S*$/, "")}...` : text; };
  const arr = value => Array.isArray(value) ? value.filter(Boolean) : (value ? [value] : []);
  const assetPath = filename => `${fileMode ? "assets" : "/assets"}/${encodeURIComponent(filename)}?v=${assetVersion}`;
  const image = item => assetPath(item.asset_filename);
  const stage = item => { const raw = clean(normalize(item.implementation_stage || item.project_date)); return stageGroups[raw.toUpperCase()] || label(raw) || "Stage not specified"; };
  const sourceDate = item => { const raw = clean(item.last_source_checked_at); const match = raw.match(/^\d{4}-\d{2}-\d{2}/); return match ? match[0] : ""; };
  const slug = item => item.slug || item.public_id;
  const casePath = item => fileMode ? `#case=${encodeURIComponent(slug(item))}` : `/library/cases/${encodeURIComponent(slug(item))}`;
  const caseBySlug = value => cases.find(item => slug(item) === value || item.public_id === value);
  const controls = {
    q:$("#q"),
    hazard:$("#hazard"),
    region:$("#region"),
    location_type:$("#location-type"),
    theme:$("#theme"),
    strategy:$("#strategy"),
    stage:$("#stage"),
    lead_type:$("#lead-type"),
    sort:$("#sort"),
  };
  const searchFields = [
    ["title", "title"], ["summary", "summary"], ["location", "location"], ["region", "region"],
    ["hazards", "hazard"], ["themes", "theme"], ["climate_mechanism", "climate mechanism"],
    ["adaptation_action", "adaptation action"], ["lead_organization", "lead organization"],
    ["outcomes", "reported outcomes"], ["transferability", "transferability"],
  ];
  let activeCollection = "";
  let returnFocus = null;
  let openedInternally = false;
  function defaultVisibleLimit() {
    return matchMedia("(max-width: 719px)").matches ? 6 : 12;
  }
  let visibleLimit = defaultVisibleLimit();
  let filteredRows = [];
  let originCard = null;
  const compared = new Set();
  let resultView = initialParams.get("view") === "map" ? "map" : "grid";
  const cardExcerptLength = layoutMode === "compact" ? 92 : layoutMode === "reading" ? 250 : 156;
  const featuredExcerptLength = layoutMode === "compact" ? 145 : layoutMode === "reading" ? 290 : 210;

  function populate(select, options, formatter = value => value) { options.forEach(value => select.insertAdjacentHTML("beforeend", `<option value="${esc(value)}">${esc(formatter(value))}</option>`)); }
  function values(key) { return [...new Set(cases.flatMap(item => arr(item[key])).map(normalize).filter(Boolean))].sort(); }
  populate(controls.hazard, values("hazards"), label);
  populate(controls.region, values("region_tags"), label);
  populate(controls.location_type, values("location_types"), label);
  populate(controls.theme, values("themes"), label);
  populate(controls.strategy, values("adaptation_strategies"), label);
  populate(controls.stage, [...new Set(cases.map(stage))].sort());
  populate(controls.lead_type, values("lead_organization_types"), label);

  function readUrlState() {
    const params = new URLSearchParams(location.search);
    activeCollection = params.get("collection") || "";
    Object.entries(controls).forEach(([key, control]) => { control.value = params.get(key) || (key === "sort" ? "curated" : ""); });
    const limit = Number(params.get("limit"));
    if (Number.isInteger(limit) && limit > 0 && limit <= 100) visibleLimit = limit;
    $$(".tab").forEach(tab => tab.classList.toggle("active", tab.dataset.collection === activeCollection));
  }

  function listUrl() {
    const params = new URLSearchParams();
    if (layoutMode !== "standard") params.set("layout", layoutMode);
    if (previewMode) params.set("preview", "1");
    if (activeCollection) params.set("collection", activeCollection);
    if (resultView !== "grid") params.set("view", resultView);
    Object.entries(controls).forEach(([key, control]) => { const value = control.value.trim(); if (value && !(key === "sort" && value === "curated")) params.set(key, value); });
    if (visibleLimit !== defaultVisibleLimit()) params.set("limit", String(visibleLimit));
    const query = params.size ? `?${params}` : "";
    return fileMode ? `${location.pathname}${query}` : `/library${query}`;
  }

  function caseHref(item) {
    return fileMode ? `${listUrl()}${casePath(item)}` : `${casePath(item)}${location.search}`;
  }

  function routeSlug() {
    if (fileMode) return new URLSearchParams(location.hash.replace(/^#/, "")).get("case") || "";
    const match = location.pathname.match(/^\/library\/cases\/([^/]+)\/?$/);
    return match ? decodeURIComponent(match[1]) : "";
  }

  function updateListUrl() {
    if (!routeSlug()) history.replaceState({view:"list"}, "", listUrl());
  }

  function matchedFields(item) {
    const query = controls.q.value.trim().toLocaleLowerCase();
    if (!query) return [];
    return searchFields.filter(([key]) => arr(item[key]).map(normalize).join(" ").toLocaleLowerCase().includes(query)).map(([, label]) => label);
  }

  function matches(item) {
    const query = controls.q.value.trim();
    return (!query || matchedFields(item).length > 0) &&
      (!activeCollection || item.collection === activeCollection) &&
      (!controls.hazard.value || arr(item.hazards).map(normalize).includes(controls.hazard.value)) &&
      (!controls.region.value || arr(item.region_tags).map(normalize).includes(controls.region.value)) &&
      (!controls.location_type.value || arr(item.location_types).map(normalize).includes(controls.location_type.value)) &&
      (!controls.theme.value || arr(item.themes).map(normalize).includes(controls.theme.value)) &&
      (!controls.strategy.value || arr(item.adaptation_strategies).map(normalize).includes(controls.strategy.value)) &&
      (!controls.stage.value || stage(item) === controls.stage.value) &&
      (!controls.lead_type.value || arr(item.lead_organization_types).map(normalize).includes(controls.lead_type.value));
  }

  function tags(item) {
    const hazard = arr(item.hazards)[0], theme = arr(item.themes)[0];
    return `<div class="tags">${hazard ? `<span class="tag">${esc(label(hazard))}</span>` : ""}${theme ? `<span class="tag theme">${esc(label(theme))}</span>` : ""}</div>`;
  }

  function picture(item, {hero = false, eager = false} = {}) {
    const width = Number(item.asset_width || 960), height = Number(item.asset_height || 600);
    const variants = arr(item.asset_variants);
    const source = format => variants.filter(row => row.format === format).sort((a,b) => a.width - b.width).map(row => `${assetPath(row.filename)} ${row.width}w`).join(", ");
    const jpeg = variants.filter(row => row.format === "jpeg").sort((a,b) => a.width - b.width);
    const fallback = jpeg.at(-1)?.filename ? assetPath(jpeg.at(-1).filename) : image(item);
    const fallbackWidth = jpeg.at(-1)?.width || width;
    const fallbackHeight = hero ? Math.round(fallbackWidth * .625) : Math.round(fallbackWidth * .625);
    const sizes = hero ? "(max-width: 1099px) 100vw, 65vw" : "(max-width: 719px) 100vw, (max-width: 1099px) 50vw, 25vw";
    const focalClass = normalize(item.asset_focal_point) === "center 42%" ? "focal-center-42" : "focal-center-top";
    return `<picture>${source("avif") ? `<source type="image/avif" srcset="${source("avif")}" sizes="${sizes}">` : ""}${source("webp") ? `<source type="image/webp" srcset="${source("webp")}" sizes="${sizes}">` : ""}<img class="${focalClass}" src="${fallback}" ${source("jpeg") ? `srcset="${source("jpeg")}" sizes="${sizes}"` : ""} alt="${esc(item.asset_alt)}" width="${fallbackWidth}" height="${fallbackHeight}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"></picture>`;
  }

  function card(item) {
    const fields = matchedFields(item);
    const checked = sourceDate(item);
    const compareChecked = compared.has(item.public_id);
    return `<article class="case-card ${item.preview_target ? "preview-target" : ""}" data-case-id="${esc(item.public_id)}" data-preview-target="${item.preview_target ? "true" : "false"}"><a class="card-image-link open-case" data-case-slug="${esc(slug(item))}" href="${caseHref(item)}" aria-label="Open ${esc(normalize(item.title))}">${picture(item)}<span class="image-action">View case</span></a><div class="card-copy"><p class="collection-label">${esc(normalize(item.collection))}</p>${tags(item)}<h2><a class="open-case" data-case-slug="${esc(slug(item))}" href="${caseHref(item)}">${esc(normalize(item.title))}</a></h2><p class="place">${esc(clean(item.location || item.region) || "Location pending review")}</p>${fields.length ? `<p class="match-note">Matched: ${esc(fields.join(", "))}</p>` : ""}<div class="card-overview"><b>Case overview</b><p>${esc(excerpt(item.summary, cardExcerptLength))}</p></div><div class="card-meta"><span><b>Implementation</b>${esc(stage(item))}</span>${checked ? `<span><b>${esc(siteText("source_date_label", "Last updated"))}</b>${esc(checked)}</span>` : ""}</div><label class="compare-check"><input type="checkbox" data-compare="${esc(item.public_id)}" ${compareChecked ? "checked" : ""}> Compare</label></div></article>`;
  }

  function chips() {
    const selected = [["collection", activeCollection], ["hazard", controls.hazard.value], ["region", controls.region.value], ["location_type", controls.location_type.value], ["theme", controls.theme.value], ["strategy", controls.strategy.value], ["stage", controls.stage.value], ["lead_type", controls.lead_type.value], ["q", controls.q.value.trim()]].filter(([, value]) => value);
    const readable = (key, value) => ["hazard", "region", "location_type", "theme", "strategy", "lead_type"].includes(key) ? label(value) : value;
    $("#active-filters").innerHTML = selected.map(([key, value]) => `<button type="button" class="filter-chip" data-clear="${key}">${esc(readable(key, value))} <span aria-hidden="true">&times;</span></button>`).join("") + (selected.length > 1 ? `<button type="button" class="filter-chip clear-all" data-clear="all">Clear all</button>` : "");
  }

  function curatedFeatured() {
    return caseBySlug(meta.featured_public_id || "") || cases.find(item => item.collection === (meta.primary_collection || "Washington and Pacific Northwest")) || cases[0];
  }

  function drawFeatured() {
    const item = curatedFeatured();
    $("#featured").innerHTML = item ? `<article class="featured-card">${picture(item, {hero:true, eager:true})}<div class="featured-copy"><p class="eyebrow">Curated featured case</p><h2>${esc(normalize(item.title))}</h2><p>${esc(excerpt(item.summary, featuredExcerptLength))}</p><a class="featured-link open-case" data-case-slug="${esc(slug(item))}" href="${caseHref(item)}">Explore this case</a></div></article>` : "";
  }

  function draw({syncUrl = true} = {}) {
    const primary = meta.primary_collection || "Washington and Pacific Northwest";
    filteredRows = cases.filter(matches).sort((a, b) => {
      if (controls.sort.value === "curated") return Number(a.display_order ?? 9999) - Number(b.display_order ?? 9999);
      if (controls.sort.value === "title") return normalize(a.title).localeCompare(normalize(b.title));
      if (controls.sort.value === "review") return sourceDate(b).localeCompare(sourceDate(a));
      const order = Number(b.collection === primary) - Number(a.collection === primary);
      return order || normalize(a.title).localeCompare(normalize(b.title));
    });
    const countText = `${filteredRows.length} case ${filteredRows.length === 1 ? "study" : "studies"}`;
    $("#count").textContent = countText;
    $("#mobile-count").textContent = countText;
    $("#grid").innerHTML = filteredRows.slice(0, visibleLimit).map(card).join("") || `<p class="empty">No case studies match these filters.</p>`;
    $("#grid").classList.add("ready");
    $("#load-more").hidden = filteredRows.length <= visibleLimit;
    $("#load-more").textContent = `Load more (${filteredRows.length - visibleLimit} remaining)`;
    chips();
    wireCaseAnchors();
    wireCompareChecks();
    window.CAR_WASH_MAP?.render(filteredRows);
    if (syncUrl) updateListUrl();
  }

  function setResultView(view) {
    if (view === "compare") {
      resultView = "grid";
      document.body.classList.add("compare-select-mode");
      document.querySelector("#grid-view")?.scrollIntoView({behavior:"smooth", block:"start"});
    } else {
      resultView = view === "map" ? "map" : "grid";
      document.body.classList.remove("compare-select-mode");
    }
    $("#grid-view").hidden = resultView === "map";
    $("#map-view").hidden = resultView !== "map";
    $("#featured").hidden = resultView === "map";
    $$("[data-view]").forEach(button => {
      const active = button.dataset.view === resultView || (button.dataset.view === "compare" && document.body.classList.contains("compare-select-mode"));
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    window.CAR_WASH_MAP?.render(filteredRows);
    updateListUrl();
  }

  function focusables(container) { return [...container.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(node => !node.hidden); }
  function trap(event, container) {
    if (event.key !== "Tab") return;
    const nodes = focusables(container); if (!nodes.length) return;
    const first = nodes[0], last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  function setPageInert(value) {
    [$(".prototype-label"), $(".site-header"), $(".hero"), $("main"), $(".site-footer"), $("#compare-tray")].forEach(element => { if (!element) return; element.inert = value; if (value) element.setAttribute("aria-hidden", "true"); else element.removeAttribute("aria-hidden"); });
    document.body.classList.toggle("modal-open", value);
  }

  function citation(item) {
    const checked = sourceDate(item);
    const date = checked ? ` ${siteText("source_date_label", "Last updated")} ${checked}.` : "";
    return `CAR-WASH. “${normalize(item.title)}.” ${siteText("site_title", "Climate Adaptation Case Study Repository")}, ${normalize(item.collection)}.${date} ${new URL(caseHref(item), location.href).href}`;
  }

  async function copyText(value, status) {
    try { await navigator.clipboard.writeText(value); status.textContent = "Copied."; }
    catch { const input = document.createElement("textarea"); input.value = value; document.body.append(input); input.select(); document.execCommand("copy"); input.remove(); status.textContent = "Copied."; }
  }

  function relatedCases(item) {
    const hazards = new Set(arr(item.hazards).map(normalize));
    return cases.filter(candidate => candidate.public_id !== item.public_id).map(candidate => ({candidate, score: arr(candidate.hazards).map(normalize).filter(value => hazards.has(value)).length + Number(candidate.collection === item.collection)})).filter(row => row.score > 0).sort((a,b) => b.score - a.score).slice(0,3).map(row => row.candidate);
  }

  function openCase(item, {push = true, trigger = null} = {}) {
    if (!item) return;
    returnFocus = trigger || document.activeElement;
    originCard?.classList.remove("is-origin");
    originCard = trigger?.closest?.(".case-card") || null;
    originCard?.classList.add("is-origin");
    openedInternally = push;
    const detail = $("#case-detail");
    const main = [
      ["Case overview", item.summary],
      ["Adaptation approach", item.adaptation_action],
      ["Reported evidence", item.reported_outcomes || arr(item.outcomes).join(" ")],
      ["Evidence limits", item.limitations],
      ["Climate context", item.climate_mechanism],
      ["Transferability", item.transferability],
    ].filter(([, value]) => normalize(value));
    const facts = [["Place", item.location || item.region], ["Hazards", arr(item.hazards).map(label).join(", ")], ["Location type", arr(item.location_types).map(label).join(", ")], ["Sector", arr(item.themes).map(label).join(", ")], ["Adaptation strategy", arr(item.adaptation_strategies).map(label).join(", ")], ["Implementation stage", stage(item)], ["Lead organization", item.lead_organization], ["Partners", arr(item.partners).join(", ")], [siteText("source_date_label", "Last updated"), sourceDate(item)], ["Image credit", item.asset_attribution]].filter(([, value]) => normalize(value));
    const related = relatedCases(item);
    detail.innerHTML = `<div class="detail-hero">${picture(item, {eager:true})}<button class="close" type="button" aria-label="Close case">&times;</button><div class="detail-title">${tags(item)}<h2 id="detail-title">${esc(normalize(item.title))}</h2><p>${esc(clean(item.location || item.region) || "Location pending review")}</p></div></div><div class="detail-utility"><button data-copy-link type="button">Copy permalink</button><button data-copy-citation type="button">Copy citation</button><button data-print type="button">Print case</button><span class="utility-status" role="status"></span></div><div class="detail-body"><div class="detail-narrative">${main.map(([label,value], index) => `<section class="${index === 0 ? "detail-lede" : ""}"><h3>${esc(label)}</h3><p${index === 0 ? ' id="detail-summary"' : ""}>${esc(normalize(value))}</p></section>`).join("")}<a class="source-link" href="${esc(item.source_url)}" target="_blank" rel="noopener">${esc(siteText("original_source_label", "Open original source"))} <span aria-hidden="true">&rarr;</span></a>${related.length ? `<section class="related"><h3>Related cases</h3>${related.map(candidate => `<a class="related-link" href="${caseHref(candidate)}" data-related="${esc(slug(candidate))}">${esc(candidate.title)}</a>`).join("")}</section>` : ""}</div><aside class="fact-list">${facts.map(([label,value]) => `<div class="fact"><b>${esc(label)}</b>${esc(normalize(value))}</div>`).join("")}</aside></div>`;
    const overlay = $("#case-overlay");
    overlay.hidden = false;
    overlay.classList.add("is-entering");
    requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.remove("is-entering")));
    setPageInert(true);
    if (push) history.pushState({view:"case", slug:slug(item), list:listUrl()}, "", caseHref(item));
    detail.querySelector(".close").focus();
    detail.querySelector(".close").addEventListener("click", closeCase);
    detail.querySelector("[data-copy-link]").addEventListener("click", () => copyText(location.href, detail.querySelector(".utility-status")));
    detail.querySelector("[data-copy-citation]").addEventListener("click", () => copyText(citation(item), detail.querySelector(".utility-status")));
    detail.querySelector("[data-print]").addEventListener("click", () => { document.body.classList.add("print-detail"); window.print(); setTimeout(() => document.body.classList.remove("print-detail"), 0); });
    detail.querySelectorAll("[data-related]").forEach(link => link.addEventListener("click", event => { event.preventDefault(); const candidate = caseBySlug(link.dataset.related); history.replaceState({view:"case", slug:slug(candidate), list:listUrl()}, "", caseHref(candidate)); openCase(candidate, {push:false, trigger:link}); }));
  }

  function closeCase({useHistory = true} = {}) {
    const overlay = $("#case-overlay");
    overlay.classList.add("is-leaving");
    overlay.hidden = true;
    overlay.classList.remove("is-leaving", "is-entering");
    setPageInert(false);
    if (useHistory && openedInternally) history.back(); else history.replaceState({view:"list"}, "", listUrl());
    openedInternally = false;
    originCard?.classList.remove("is-origin");
    originCard = null;
    if (returnFocus?.isConnected) returnFocus.focus(); else $("#count").focus?.();
  }

  function wireCaseAnchors() {
    $$("a.open-case").forEach(link => link.addEventListener("click", event => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return; const item = caseBySlug(link.dataset.caseSlug); if (!item) return; event.preventDefault(); openCase(item, {push:true, trigger:link}); }));
  }

  function updateCompareTray(message = "") {
    $("#compare-tray").hidden = compared.size === 0;
    $("#compare-summary").textContent = message || `${compared.size} of 3 selected`;
    $("#open-compare").disabled = compared.size < 2;
  }

  function wireCompareChecks() {
    $$('[data-compare]').forEach(input => input.addEventListener("change", () => {
      if (input.checked && compared.size >= 3) {
        input.checked = false;
        updateCompareTray("Maximum three cases. Remove one before adding another.");
        return;
      }
      if (input.checked) compared.add(input.dataset.compare);
      else compared.delete(input.dataset.compare);
      updateCompareTray();
    }));
  }

  function openCompare() {
    const selected = [...compared]
      .map(id => cases.find(item => item.public_id === id))
      .filter(Boolean);
    if (selected.length < 2) return;
    const rows = [
      ["Place and setting", item => item.location || item.region],
      ["Climate pressure", item => item.climate_mechanism || arr(item.hazards).join(", ")],
      ["Adaptation response", item => item.adaptation_action],
      ["Implementation stage", stage],
      ["Evidence available", item => item.reported_outcomes || arr(item.outcomes).join(" ")],
      ["What may transfer", item => item.transferability],
      ["Important limits", item => item.limitations],
      [siteText("source_date_label", "Last updated"), sourceDate],
    ];
    $("#compare-detail").innerHTML = `<div class="compare-head"><div><p class="eyebrow">Case comparison</p><h2 id="compare-title">Compare selected cases</h2><p>Review differences before opening the original sources.</p><p class="compare-mobile-hint">Swipe horizontally to view every selected case.</p></div><button class="close" type="button" aria-label="Close comparison">&times;</button></div><div class="compare-table-wrap"><table class="compare-table"><thead><tr><th>Field</th>${selected.map(item => `<th><a class="open-case" data-case-slug="${esc(slug(item))}" href="${caseHref(item)}">${esc(normalize(item.title))}</a></th>`).join("")}</tr></thead><tbody>${rows.map(([rowLabel, getter]) => `<tr><th>${esc(rowLabel)}</th>${selected.map(item => `<td>${esc(normalize(getter(item)) || "Not recorded")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
    $("#compare-overlay").hidden = false;
    setPageInert(true);
    $("#compare-detail .close").focus();
    $("#compare-detail .close").addEventListener("click", closeCompare);
  }

  function closeCompare() {
    $("#compare-overlay").hidden = true;
    setPageInert(false);
    $("#open-compare").focus();
  }

  function csvCell(value) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }
  function exportCsv() {
    const fields = [["title", item => item.title], ["location", item => item.location || item.region], ["collection", item => item.collection], ["hazards", item => arr(item.hazards).join("; ")], ["themes", item => arr(item.themes).join("; ")], ["implementation_stage", stage], ["adaptation_action", item => item.adaptation_action], ["source_url", item => item.source_url], ["last_source_checked_at", sourceDate]];
    const csv = [fields.map(([name]) => csvCell(name)).join(","), ...filteredRows.map(item => fields.map(([,getter]) => csvCell(getter(item))).join(","))].join("\r\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], {type:"text/csv;charset=utf-8"})); link.download = `car-wash-filtered-${meta.snapshot_id || "staging"}.csv`; link.click(); URL.revokeObjectURL(link.href);
  }

  function openFilters() { const panel = $("#filter-panel"); $("#filter-backdrop").hidden = false; panel.classList.add("open"); $("#filter-trigger").setAttribute("aria-expanded", "true"); document.body.classList.add("drawer-open"); focusables(panel)[0]?.focus(); }
  function closeFilters() { const panel = $("#filter-panel"); panel.classList.remove("open"); $("#filter-backdrop").hidden = true; $("#filter-trigger").setAttribute("aria-expanded", "false"); document.body.classList.remove("drawer-open"); $("#filter-trigger").focus(); }

  function routeFromLocation() {
    readUrlState(); draw({syncUrl:false});
    const activeSlug = routeSlug();
    if (activeSlug) { const item = caseBySlug(activeSlug); if (item) openCase(item, {push:false}); else history.replaceState({view:"list"}, "", listUrl()); }
    else if (!$("#case-overlay").hidden) closeCase({useHistory:false});
  }

  function locatePreviewTarget() {
    if (!previewMode) return;
    const item = cases.find(candidate => candidate.preview_target);
    const card = document.querySelector('[data-preview-target="true"]');
    if (!item || !card) return;
    const position = cases
      .slice()
      .sort((a, b) => Number(a.display_order ?? 9999) - Number(b.display_order ?? 9999))
      .findIndex(candidate => candidate.public_id === item.public_id) + 1;
    const bar = document.createElement("div");
    bar.className = "preview-locator";
    bar.innerHTML = `<strong>Current draft · position ${position} of ${cases.length}</strong><button type="button" data-jump-preview>Jump to edited case</button><button type="button" data-open-preview>Open edited case</button>`;
    document.body.append(bar);
    const jump = () => card.scrollIntoView({behavior:"smooth", block:"center"});
    bar.querySelector("[data-jump-preview]").addEventListener("click", jump);
    bar.querySelector("[data-open-preview]").addEventListener("click", () => openCase(item, {push:true, trigger:card.querySelector(".open-case")}));
    requestAnimationFrame(jump);
  }

  let tourStep = 0;
  function showTourStep(index) {
    tourStep = Math.max(0, Math.min(3, index));
    $$('[data-tour-step]').forEach(step => { step.hidden = Number(step.dataset.tourStep) !== tourStep; });
    $("#tour-back").disabled = tourStep === 0;
    $("#tour-next").textContent = tourStep === 3 ? "Finish" : "Next";
    $("#tour-status").textContent = `Step ${tourStep + 1} of 4`;
  }
  function openTour() { showTourStep(0); $("#tour-overlay").hidden = false; setPageInert(true); $("#tour-close").focus(); }
  function closeTour() { $("#tour-overlay").hidden = true; setPageInert(false); $("#tour-trigger").focus(); }

  Object.values(controls).forEach(control => control.addEventListener("input", () => { visibleLimit = defaultVisibleLimit(); draw(); }));
  $("#active-filters").addEventListener("click", event => { const key = event.target.closest("[data-clear]")?.dataset.clear; if (!key) return; if (key === "all") { activeCollection = ""; Object.entries(controls).forEach(([name, control]) => { control.value = name === "sort" ? "collection" : ""; }); } else if (key === "collection") activeCollection = ""; else controls[key].value = ""; $$(".tab").forEach(tab => tab.classList.toggle("active", tab.dataset.collection === activeCollection)); draw(); });
  $$(".tab").forEach(tab => tab.addEventListener("click", () => { activeCollection = tab.dataset.collection; $$(".tab").forEach(item => item.classList.toggle("active", item === tab)); visibleLimit = defaultVisibleLimit(); draw(); }));
  $("#load-more").addEventListener("click", () => { visibleLimit += matchMedia("(max-width: 719px)").matches ? 6 : 12; draw(); });
  $("#export-csv").addEventListener("click", exportCsv);
  $$("[data-view]").forEach(button => button.addEventListener("click", () => setResultView(button.dataset.view)));
  document.addEventListener("carwash:open-case", event => {
    const item = cases.find(candidate => candidate.public_id === event.detail?.publicId);
    if (item) openCase(item, {push:true, trigger:document.querySelector(`[data-map-case="${CSS.escape(item.public_id)}"]`)});
  });
  $("#filter-trigger").addEventListener("click", openFilters); $("#filter-close").addEventListener("click", closeFilters); $("#filter-backdrop").addEventListener("click", closeFilters); $("#apply-filters").addEventListener("click", closeFilters);
  $("#case-overlay").addEventListener("click", event => { if (event.target.id === "case-overlay") closeCase(); });
  $("#compare-overlay").addEventListener("click", event => { if (event.target.id === "compare-overlay") closeCompare(); });
  $("#clear-compare").addEventListener("click", () => { compared.clear(); $$('[data-compare]').forEach(input => { input.checked = false; }); updateCompareTray(); });
  $("#open-compare").addEventListener("click", openCompare);
  $("#tour-trigger").addEventListener("click", openTour);
  $("#tour-close").addEventListener("click", closeTour);
  $("#tour-back").addEventListener("click", () => showTourStep(tourStep - 1));
  $("#tour-next").addEventListener("click", () => { if (tourStep === 3) closeTour(); else showTourStep(tourStep + 1); });
  $("#tour-overlay").addEventListener("click", event => { if (event.target.id === "tour-overlay") closeTour(); });
  $(".menu-button").addEventListener("click", event => { const open = event.currentTarget.getAttribute("aria-expanded") === "true"; event.currentTarget.setAttribute("aria-expanded", String(!open)); $("#site-nav").classList.toggle("open", !open); });
  $("#site-nav").addEventListener("click", () => { $("#site-nav").classList.remove("open"); $(".menu-button").setAttribute("aria-expanded", "false"); });
  document.addEventListener("keydown", event => {
    if (!$("#tour-overlay").hidden) { if (event.key === "Escape") closeTour(); else trap(event, $("#review-tour")); return; }
    if (!$("#case-overlay").hidden) { if (event.key === "Escape") closeCase(); else trap(event, $("#case-detail")); return; }
    if (!$("#compare-overlay").hidden) { if (event.key === "Escape") closeCompare(); else trap(event, $("#compare-detail")); return; }
    if ($("#filter-panel").classList.contains("open")) { if (event.key === "Escape") closeFilters(); else trap(event, $("#filter-panel")); }
  });
  addEventListener("popstate", routeFromLocation);
  if (fileMode) addEventListener("hashchange", routeFromLocation);
  addEventListener("afterprint", () => document.body.classList.remove("print-detail"));

  $("#snapshot-meta").textContent = meta.render_mode === "PUBLIC_PRODUCTION"
    ? `Published snapshot ${meta.snapshot_id || meta.dataset_version || ""}.`
    : `${previewMode ? "Local website preview" : "Internal staging snapshot"} ${meta.snapshot_id || meta.dataset_version || "pending"}. No public-use approval is implied.`;
  $("#footer-version").textContent = `V${meta.product_version || "3.6.6"}`;
  $$('[data-site-copy]').forEach(node => {
    const value = clean(siteCopy[node.dataset.siteCopy]);
    if (value) node.textContent = value;
  });
  document.title = `CAR-WASH ${siteText("site_title", "Climate Adaptation Case Study Repository")}`;
  $("#hero-case-count").textContent = String(cases.length);
  window.CAR_WASH_MAP?.init(); readUrlState(); drawFeatured(); draw({syncUrl:false}); setResultView(resultView); wireCaseAnchors(); routeFromLocation(); locatePreviewTarget();
})();
