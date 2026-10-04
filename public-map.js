(() => {
  "use strict";

  const states = window.CAR_WASH_US_STATES || {features: []};
  let mapCases = window.CAR_WASH_MAP_CASES || {features: []};
  const climate = window.CAR_WASH_CLIMATE_CONTEXT || {layer_status: "REFERENCE_ONLY"};
  let byId = new Map(mapCases.features.map(feature => [feature.properties.public_id, feature]));
  const ns = "http://www.w3.org/2000/svg";
  let selectedId = "";

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  }

  function setCases(rows) {
    const features = (rows || [])
      .filter(row => row.latitude != null && row.longitude != null && row.map_visible !== false)
      .map(row => ({
        type:"Feature",
        geometry:{type:"Point", coordinates:[Number(row.longitude), Number(row.latitude)]},
        properties:{
          public_id:row.public_id,
          title:row.title,
          summary:row.summary,
          location:row.location || row.region,
          implementation_stage:row.implementation_stage,
          location_precision:row.location_precision,
          primary_hazard:row.primary_hazard || row.hazards?.[0] || "Other",
          hazard_label:row.hazard_label || row.hazards?.[0] || "Adaptation case",
          hazard_color:row.hazard_color || "#5D6570",
        },
      }));
    mapCases = {type:"FeatureCollection", features};
    byId = new Map(features.map(feature => [feature.properties.public_id, feature]));
    const legend = document.querySelector("#map-hazard-legend");
    if (legend) {
      const styles = [...new Map(features.map(feature => [feature.properties.primary_hazard, feature.properties])).values()];
      legend.innerHTML = styles.map(item => `<span data-hazard="${esc(item.primary_hazard)}"><i></i>${esc(item.hazard_label)}</span>`).join("");
    }
  }

  function excerpt(value, limit = 440) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    if (text.length <= limit) return text;
    const shortened = text.slice(0, limit + 1).replace(/\s+\S*$/, "").trim();
    return `${shortened || text.slice(0, limit).trim()}...`;
  }

  function project(coordinate, code = "") {
    let [longitude, latitude] = coordinate;
    if (code === "AK" && longitude > 0) longitude -= 360;
    if (code === "AK") return [45 + ((longitude + 180) / 50) * 225, 370 + ((72 - latitude) / 22) * 125];
    if (code === "HI") return [290 + ((longitude + 161) / 7) * 115, 430 + ((23 - latitude) / 5) * 65];
    if (code === "PR") return [850 + ((longitude + 68) / 3) * 90, 455 + ((19 - latitude) / 2) * 42];
    return [35 + ((longitude + 126) / 60) * 930, 30 + ((50 - latitude) / 26) * 405];
  }

  function geometryPath(geometry, code) {
    const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
    return polygons.map(polygon => polygon.map(ring => ring.map((point, index) => {
      const [x, y] = project(point, code);
      return `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ") + " Z").join(" ")).join(" ");
  }

  function stateLayer() {
    return states.features.map(feature => {
      const code = feature.properties?.STUSAB || "";
      if (["AS", "GU", "MP", "VI"].includes(code)) return "";
      if (!["AK", "HI", "PR"].includes(code)) {
        const center = feature.geometry?.coordinates?.flat(3)?.[0];
        if (center && (center[0] < -126 || center[0] > -66 || center[1] < 24 || center[1] > 50)) return "";
      }
      return `<path class="atlas-state" data-state="${esc(code)}" d="${geometryPath(feature.geometry, code)}"><title>${esc(feature.properties?.BASENAME || code)}</title></path>`;
    }).join("");
  }

  function pointPosition(feature, index, overlap) {
    const coordinates = feature.geometry.coordinates;
    const isUs = coordinates[0] >= -180 && coordinates[0] <= -65 && coordinates[1] >= 17 && coordinates[1] <= 72;
    if (!isUs) return null;
    const props = feature.properties || {};
    const location = String(props.location || "").toUpperCase();
    const code = location.includes("ALASKA") ? "AK" : location.includes("HAWAII") ? "HI" : location.includes("PUERTO RICO") ? "PR" : "";
    const [baseX, baseY] = project(coordinates, code);
    const key = `${baseX.toFixed(0)}:${baseY.toFixed(0)}`;
    const count = overlap.get(key) || 0;
    overlap.set(key, count + 1);
    const angle = count * 2.2;
    const radius = count ? 7 + Math.floor(count / 5) * 5 : 0;
    return [baseX + Math.cos(angle) * radius, baseY + Math.sin(angle) * radius, index];
  }

  function marker(feature, position) {
    const props = feature.properties || {};
    const [x, y] = position;
    const active = selectedId === props.public_id;
    return `<g class="atlas-marker ${active ? "is-selected" : ""}" role="button" tabindex="0" aria-label="Open ${esc(props.title)}" data-map-case="${esc(props.public_id)}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><circle class="marker-halo" r="${active ? 15 : 11}"></circle><circle class="marker-core" r="${active ? 7 : 5.5}" fill="${esc(props.hazard_color || "#5D6570")}"></circle><title>${esc(props.title)} — ${esc(props.location)}</title></g>`;
  }

  function detail(feature) {
    const target = document.querySelector("#map-case-detail");
    if (!feature) {
      target.innerHTML = `<p class="map-detail-empty">Select a point to inspect the case, evidence stage, and location precision.</p>`;
      return;
    }
    const props = feature.properties || {};
    target.innerHTML = `<p class="eyebrow">${esc(props.hazard_label || "Adaptation case")}</p><h3>${esc(props.title)}</h3><p class="map-place">${esc(props.location || "Location pending")}</p><p>${esc(excerpt(props.summary || "Open the case for the full source-linked record."))}</p><dl><div><dt>Implementation</dt><dd>${esc(props.implementation_stage || "Review pending")}</dd></div><div><dt>Map precision</dt><dd>${esc(String(props.location_precision || "Unresolved").replaceAll("_", " ").toLowerCase())}</dd></div></dl><button type="button" class="map-open-case" data-open-map-case="${esc(props.public_id)}">Open full case</button>`;
  }

  function wire(svg) {
    const activate = node => {
      selectedId = node.dataset.mapCase;
      detail(byId.get(selectedId));
      svg.querySelectorAll(".atlas-marker").forEach(markerNode => markerNode.classList.toggle("is-selected", markerNode.dataset.mapCase === selectedId));
    };
    svg.querySelectorAll("[data-map-case]").forEach(node => {
      node.addEventListener("click", () => activate(node));
      node.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); activate(node); }
      });
    });
  }

  function render(rows) {
    const svg = document.querySelector("#atlas-map");
    if (!svg) return;
    const visible = rows.map(row => byId.get(row.public_id)).filter(Boolean);
    const overlap = new Map();
    const positions = visible.map((feature, index) => pointPosition(feature, index, overlap)).filter(Boolean);
    const domestic = [];
    const outside = [];
    visible.forEach((feature, index) => {
      const position = positions.find(item => item[2] === index);
      if (position) domestic.push(marker(feature, position)); else outside.push(feature);
    });
    svg.innerHTML = `<g class="state-layer">${stateLayer()}</g><g class="case-point-layer">${domestic.join("")}</g><g class="map-labels"><text x="48" y="485">Alaska</text><text x="292" y="493">Hawaii</text><text x="850" y="500">Puerto Rico</text></g>`;
    wire(svg);
    const outsideNode = document.querySelector("#outside-us-cases");
    outsideNode.hidden = outside.length === 0;
    outsideNode.innerHTML = outside.length ? `<h3>Transferable examples outside the U.S.</h3>${outside.map(feature => `<button type="button" data-open-map-case="${esc(feature.properties.public_id)}"><b>${esc(feature.properties.title)}</b><span>${esc(feature.properties.location)}</span></button>`).join("")}` : "";
    outsideNode.querySelectorAll("[data-open-map-case]").forEach(button => button.addEventListener("click", () => document.dispatchEvent(new CustomEvent("carwash:open-case", {detail: {publicId: button.dataset.openMapCase}}))));
    const summary = document.querySelector("#map-result-summary");
    summary.textContent = `${visible.length} published case location${visible.length === 1 ? "" : "s"} match the current filters.`;
    if (selectedId && !visible.some(feature => feature.properties.public_id === selectedId)) {
      selectedId = "";
      detail(null);
    }
  }

  function init() {
    const legend = document.querySelector("#map-hazard-legend");
    if (legend) {
      const styles = [...new Map(mapCases.features.map(feature => [feature.properties.primary_hazard, feature.properties])).values()];
      legend.innerHTML = styles.map(item => `<span data-hazard="${esc(item.primary_hazard)}"><i></i>${esc(item.hazard_label)}</span>`).join("");
    }
    const climateNode = document.querySelector("#climate-layer-note");
    if (climateNode) {
      climateNode.innerHTML = `<strong>${esc(climate.layer_status === "DATA_AVAILABLE" ? "Official observations available" : "Official reference layer")}</strong><p>${esc(climate.message || "Climate observations are separate from case-study locations.")}</p><a href="${esc(climate.source_url)}" target="_blank" rel="noopener">Open ${esc(climate.source_name || "official source")}</a>`;
    }
    document.querySelector("#map-case-detail")?.addEventListener("click", event => {
      const id = event.target.closest("[data-open-map-case]")?.dataset.openMapCase;
      if (id) document.dispatchEvent(new CustomEvent("carwash:open-case", {detail: {publicId: id}}));
    });
    document.querySelectorAll("[data-map-layer]").forEach(button => button.addEventListener("click", () => {
      document.querySelectorAll("[data-map-layer]").forEach(node => node.classList.toggle("active", node === button));
      const climateMode = button.dataset.mapLayer === "climate";
      document.querySelector(".map-workspace")?.classList.toggle("show-climate-reference", climateMode);
      if (climateMode) climateNode?.scrollIntoView({behavior:"smooth", block:"nearest"});
    }));
    detail(null);
  }

  window.CAR_WASH_MAP = {init, render, setCases};
})();
