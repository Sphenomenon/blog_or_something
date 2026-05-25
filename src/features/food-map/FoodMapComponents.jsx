import { useEffect, useMemo, useRef, useState } from "react";

import { FOOD_MAP_AMAP_LOADER_STATES, createAmapAdapter } from "./index.js";

export const FOOD_MAP_SOURCE_FILTERS = Object.freeze({
  all: "all",
  local: "local",
  external: "external"
});

export const FOOD_MAP_DEFAULT_FILTERS = Object.freeze({
  city: "",
  category: "",
  query: "",
  source: FOOD_MAP_SOURCE_FILTERS.all
});

function asText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function uniqueSorted(values) {
  return [...new Set(values.map(asText).filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function validCoordinates(spot) {
  const lng = Number(spot?.lng);
  const lat = Number(spot?.lat);
  return Number.isFinite(lng) && Number.isFinite(lat) && lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
}

function getAmapPanelStatusText(state, coordinateCount, error) {
  if (!coordinateCount) {
    return "暂无有效公开坐标。列表和详情仍可使用，公开地点补齐经纬度后会自动接入地图。";
  }

  if (state === FOOD_MAP_AMAP_LOADER_STATES.loading || state === FOOD_MAP_AMAP_LOADER_STATES.idle) {
    return "正在尝试加载高德地图；加载完成前先保留可访问的 fallback marker 列表。";
  }

  if (state === FOOD_MAP_AMAP_LOADER_STATES.ready) {
    return "高德地图已就绪；点击地图 marker 或地点卡片会同步选中同一个公开地点。";
  }

  if (state === FOOD_MAP_AMAP_LOADER_STATES.failed) {
    const diagnostic = error?.message ? `（${error.message}）` : "";
    return `高德地图脚本加载失败${diagnostic}，已自动回退到 marker 列表；请检查 webapi.amap.com 是否能访问、Key/安全密钥是否匹配、域名白名单是否包含当前域名。`;
  }

  return "未配置 VITE_AMAP_KEY，当前使用可访问的 fallback marker 列表；地点卡片、详情和高德外链仍可使用。";
}

function formatRating(rating) {
  return hasValue(rating) ? `评分 ${rating}` : "";
}

function formatInfoWindowPrice(price) {
  if (!hasValue(price)) return "";
  const numericPrice = Number(price);
  if (!Number.isFinite(numericPrice)) return "";
  return `¥${Number.isInteger(numericPrice) ? numericPrice : numericPrice.toFixed(1)}/人`;
}

function formatInfoWindowRating(rating) {
  if (!hasValue(rating)) return "";
  const numericRating = Number(rating);
  if (!Number.isFinite(numericRating)) return "";
  return `${numericRating.toFixed(1)} 分`;
}

function getFoodMapRatingClassName(rating) {
  const numericRating = Number(rating);
  if (!Number.isFinite(numericRating)) return "food-map-marker--rating-default";
  if (numericRating >= 4.5) return "food-map-marker--rating-loved";
  if (numericRating >= 4.0) return "food-map-marker--rating-good";
  return "food-map-marker--rating-default";
}

function sourceLabel(source) {
  if (!source?.type) return "未知来源";
  return source.type === "external" ? `来源：${source.name || source.id || "外部来源"}` : "本地收藏";
}

export function getFoodMapFilterOptions(spots = []) {
  return {
    cities: uniqueSorted(spots.map((spot) => spot.city)),
    categories: uniqueSorted(spots.map((spot) => spot.category)),
    hasExternal: spots.some((spot) => spot.source?.type === "external")
  };
}

export function createAmapUrl(spot) {
  if (!spot?.showAmapLink || !validCoordinates(spot)) return "";
  if (hasValue(spot.amapUrl)) return String(spot.amapUrl).trim();

  const name = encodeURIComponent(spot.name || "美食地点");
  return `https://uri.amap.com/marker?position=${Number(spot.lng)},${Number(spot.lat)}&name=${name}`;
}

export function getFoodMapPlaceUrl(spot) {
  if (hasValue(spot?.articleSlug)) {
    return { href: `/posts/${encodeURIComponent(String(spot.articleSlug).trim())}`, external: false };
  }
  if (hasValue(spot?.articleUrl)) {
    return { href: String(spot.articleUrl).trim(), external: true };
  }
  return undefined;
}

export function createFoodMapInfoWindowContent(spot) {
  if (!spot) return "";

  const link = getFoodMapPlaceUrl(spot);
  const price = formatInfoWindowPrice(spot.price);
  const rating = formatInfoWindowRating(spot.rating);
  const meta = [spot.city, spot.category, price, rating].filter(Boolean).map(escapeHtml).join(" · ");
  const recommendations = Array.isArray(spot.recommend)
    ? spot.recommend.map(asText).filter(Boolean)
    : [];

  return `
    <article class="food-map-info-window" aria-label="${escapeHtml(spot.name || "美食地点")}">
      <span class="food-map-info-window__eyebrow">${escapeHtml(sourceLabel(spot.source))}</span>
      <h3 class="food-map-info-window__title">${escapeHtml(spot.name || "美食地点")}</h3>
      ${meta ? `<p class="food-map-info-window__meta">${meta}</p>` : ""}
      ${hasValue(spot.address) ? `<p class="food-map-info-window__address">地址：${escapeHtml(spot.address)}</p>` : ""}
      ${recommendations.length > 0 ? `<p class="food-map-info-window__recommend">推荐：${recommendations.map(escapeHtml).join("、")}</p>` : ""}
      ${link ? `<div class="food-map-info-window__actions"><a class="food-map-info-window__link" href="${escapeHtml(link.href)}"${link.external ? ' target="_blank" rel="noopener noreferrer"' : ""}>查看探店文章</a></div>` : ""}
    </article>
  `;
}

export function filterFoodMapPlaces(spots = [], filters = FOOD_MAP_DEFAULT_FILTERS) {
  const city = asText(filters.city);
  const category = asText(filters.category);
  const query = asText(filters.query).toLocaleLowerCase();
  const source = filters.source || FOOD_MAP_SOURCE_FILTERS.all;

  return spots.filter((spot) => {
    if (city && spot.city !== city) return false;
    if (category && spot.category !== category) return false;
    if (source !== FOOD_MAP_SOURCE_FILTERS.all && spot.source?.type !== source) return false;

    if (!query) return true;
    const haystack = [
      spot.name,
      spot.city,
      spot.district,
      spot.category,
      spot.address,
      spot.description,
      ...(Array.isArray(spot.tags) ? spot.tags : []),
      ...(Array.isArray(spot.recommend) ? spot.recommend : [])
    ].map(asText).join(" ").toLocaleLowerCase();
    return haystack.includes(query);
  });
}

export function FoodMapFilters({ filters, options, totalCount, resultCount, onChange, onReset }) {
  const sourceOptions = [
    { value: FOOD_MAP_SOURCE_FILTERS.all, label: "全部来源" },
    { value: FOOD_MAP_SOURCE_FILTERS.local, label: "本地收藏" },
    ...(options.hasExternal ? [{ value: FOOD_MAP_SOURCE_FILTERS.external, label: "外部地图" }] : [])
  ];

  function updateFilter(key, value) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <section className="food-map-filters" aria-label="美食地图筛选">
      <div className="food-map-filter-row">
        <div className="food-map-filter-group">
          <label htmlFor="food-map-query">关键词</label>
          <input
            id="food-map-query"
            className="food-map-search-input"
            type="search"
            value={filters.query}
            placeholder="店名、地址、标签、推荐菜"
            onChange={(event) => updateFilter("query", event.target.value)}
          />
        </div>
        <div className="food-map-filter-group">
          <label htmlFor="food-map-city">城市</label>
          <select id="food-map-city" className="food-map-select" value={filters.city} onChange={(event) => updateFilter("city", event.target.value)}>
            <option value="">全部城市</option>
            {options.cities.map((city) => <option key={city} value={city}>{city}</option>)}
          </select>
        </div>
        <div className="food-map-filter-group">
          <label htmlFor="food-map-category">类别</label>
          <select id="food-map-category" className="food-map-select" value={filters.category} onChange={(event) => updateFilter("category", event.target.value)}>
            <option value="">全部类别</option>
            {options.categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </div>
      </div>

      <div className="food-map-summary">
        <div className="food-map-source-list" aria-label="来源筛选">
          {sourceOptions.map((option) => (
            <button
              key={option.value}
              className="food-map-filter-button"
              type="button"
              aria-pressed={filters.source === option.value}
              onClick={() => updateFilter("source", option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="food-map-status-row">
          <span className="food-map-count">{resultCount} / {totalCount} 个地点</span>
          <button className="food-map-reset-button" type="button" onClick={onReset}>重置筛选</button>
        </div>
      </div>
    </section>
  );
}

export function FoodMapEmptyState() {
  return (
    <section className="food-map-empty-state" aria-live="polite">
      <h2>地图还在等待第一枚坐标</h2>
      <p>当前公开美食地点为空。等内容目录加入已发布且非私密的记录后，这里会自动显示卡片和 fallback 地图。</p>
    </section>
  );
}

export function FoodMapNoResults({ onReset }) {
  return (
    <section className="food-map-no-results" aria-live="polite">
      <h2>没有匹配的地点</h2>
      <p>换一个城市、类别或关键词试试看；地图不会丢失，只是这组筛选暂时没有公开结果。</p>
      <button className="food-map-button" type="button" onClick={onReset}>清空筛选</button>
    </section>
  );
}

function SourceBadge({ source }) {
  const type = source?.type === "external" ? "external" : "local";
  return <span className={`food-map-source-badge food-map-source-badge--${type}`}>{sourceLabel(source)}</span>;
}

function Tags({ tags, className }) {
  if (!Array.isArray(tags) || tags.length === 0) return null;
  return (
    <div className={className} aria-label="标签">
      {tags.map((tag) => <span key={tag} className={className.includes("detail") ? "food-map-detail-tag" : "food-map-card-tag"}>#{tag}</span>)}
    </div>
  );
}

export function FoodMapSpotCard({ spot, selected, onSelect }) {
  const link = getFoodMapPlaceUrl(spot);
  const meta = [spot.city, spot.district, spot.category, formatRating(spot.rating)].filter(Boolean).join(" · ");

  return (
    <button
      className={`food-map-spot-card${selected ? " food-map-spot-card--selected" : ""}`}
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(spot.id)}
    >
      <span className="food-map-card-header">
        <span className="food-map-card-title">{spot.name}</span>
        <span className="food-map-card-meta">
          <SourceBadge source={spot.source} />
          {meta && <span>{meta}</span>}
        </span>
      </span>
      {spot.description && <span className="food-map-card-description">{spot.description}</span>}
      {spot.address && <span className="food-map-card-address">{spot.address}</span>}
      {Array.isArray(spot.recommend) && spot.recommend.length > 0 && (
        <span className="food-map-card-note">推荐：{spot.recommend.join("、")}</span>
      )}
      <Tags tags={spot.tags} className="food-map-card-tags" />
      {link && <span className="food-map-card-link">{link.external ? "外部记录" : "关联文章"}</span>}
    </button>
  );
}

export function FoodMapSpotList({ spots, selectedId, onSelect }) {
  return (
    <ol className="food-map-list" aria-label="美食地点列表">
      {spots.map((spot) => (
        <li key={spot.id}>
          <FoodMapSpotCard spot={spot} selected={spot.id === selectedId} onSelect={onSelect} />
        </li>
      ))}
    </ol>
  );
}

export function FoodMapVisits({ visits = [] }) {
  if (!Array.isArray(visits) || visits.length === 0) return null;
  return (
    <ol className="food-map-visits" aria-label="公开访问记录">
      {visits.map((visit, index) => (
        <li className="food-map-visit" key={`${visit.visitedAt}-${index}`}>
          <span className="food-map-visit-date">{visit.visitedAt}</span>
          {hasValue(visit.rating) && <span className="food-map-visit-rating">{formatRating(visit.rating)}</span>}
          {visit.note && <span className="food-map-visit-note">{visit.note}</span>}
        </li>
      ))}
    </ol>
  );
}

export function FoodMapDetail({ spot }) {
  if (!spot) {
    return (
      <section className="food-map-detail food-map-detail--empty" aria-live="polite">
        <h2>选择一个地点查看详情</h2>
        <p>左侧卡片和下方 fallback marker 都可以同步选中同一个公开地点。</p>
      </section>
    );
  }

  const link = getFoodMapPlaceUrl(spot);
  const amapUrl = createAmapUrl(spot);

  return (
    <article className="food-map-detail" aria-live="polite">
      <header className="food-map-detail-header">
        <p className="food-map-detail-meta"><SourceBadge source={spot.source} /></p>
        <h2 className="food-map-detail-title">{spot.name}</h2>
        <p className="food-map-detail-meta">{[spot.city, spot.district, spot.category, formatRating(spot.rating)].filter(Boolean).join(" · ")}</p>
      </header>
      {spot.description && <p className="food-map-detail-description">{spot.description}</p>}
      {spot.address && <p className="food-map-detail-address">地址：{spot.address}</p>}
      {Array.isArray(spot.recommend) && spot.recommend.length > 0 && <p className="food-map-detail-note">推荐：{spot.recommend.join("、")}</p>}
      <Tags tags={spot.tags} className="food-map-detail-tags" />
      <div className="food-map-detail-meta">
        {link && (
          <a href={link.href} target={link.external ? "_blank" : undefined} rel={link.external ? "noopener noreferrer" : undefined}>
            {link.external ? "打开外部记录" : "阅读关联文章"}
          </a>
        )}
        {amapUrl && <a href={amapUrl} target="_blank" rel="noopener noreferrer">在高德地图中打开</a>}
      </div>
      <FoodMapVisits visits={spot.visits} />
    </article>
  );
}

export function FoodMapFallbackMap({ spots, selectedId, onSelect, statusText }) {
  const coordinateSpots = spots.filter(validCoordinates);

  return (
    <section className="food-map-map-shell" aria-label="美食地图 fallback" data-amap-state="fallback">
      <h2>地图坐标</h2>
      <div className="food-map-map-status" role="status">{statusText ?? getAmapPanelStatusText(FOOD_MAP_AMAP_LOADER_STATES.missingKey, coordinateSpots.length)}</div>
      <div className="food-map-map-fallback">
        <div className="food-map-marker-list" aria-label="地点 marker 列表">
          {coordinateSpots.map((spot, index) => (
            <button
              key={spot.id}
              className={`food-map-marker ${getFoodMapRatingClassName(spot.rating)}${spot.id === selectedId ? " food-map-marker--selected" : ""}`}
              type="button"
              aria-pressed={spot.id === selectedId}
              onClick={() => onSelect(spot.id)}
            >
              <span className="food-map-marker-index">{index + 1}</span>
              <span>
                <span className="food-map-marker-title">{spot.name}</span>
                <span className="food-map-marker-address">{spot.address || `${spot.lng}, ${spot.lat}`}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FoodMapAmapPanel({ spots, selectedId, selectionRequestId = 0, onSelect }) {
  const mapElementRef = useRef(null);
  const adapterRef = useRef(null);
  const infoWindowRef = useRef(null);
  const markerRefs = useRef(new Map());
  const lastPopupSelectionRef = useRef({ selectedId: null, selectionRequestId: null });
  const [popupFocusedId, setPopupFocusedId] = useState(selectedId || "");
  const [adapterState, setAdapterState] = useState(FOOD_MAP_AMAP_LOADER_STATES.idle);
  const [adapterError, setAdapterError] = useState(null);

  const coordinateSpots = useMemo(() => spots.filter(validCoordinates), [spots]);
  const statusText = getAmapPanelStatusText(adapterState, coordinateSpots.length, adapterError);
  const isReady = adapterState === FOOD_MAP_AMAP_LOADER_STATES.ready && coordinateSpots.length > 0;
  const showFallback = !isReady;

  useEffect(() => {
    let cancelled = false;

    adapterRef.current?.destroy();
    adapterRef.current = null;
    infoWindowRef.current = null;
    markerRefs.current = new Map();

    if (coordinateSpots.length === 0) {
      setAdapterState(FOOD_MAP_AMAP_LOADER_STATES.idle);
      setAdapterError(null);
      return () => {};
    }

    setAdapterState(FOOD_MAP_AMAP_LOADER_STATES.loading);
    setAdapterError(null);

    createAmapAdapter().then((adapter) => {
      if (cancelled) {
        adapter.destroy();
        return;
      }

      setAdapterState(adapter.state);
      setAdapterError(adapter.error ?? null);
      if (adapter.state !== FOOD_MAP_AMAP_LOADER_STATES.ready || !mapElementRef.current) {
        adapter.destroy();
        return;
      }

      try {
        adapter.createMap(mapElementRef.current);
      } catch (error) {
        adapter.destroy();
        if (!cancelled) {
          setAdapterState(FOOD_MAP_AMAP_LOADER_STATES.failed);
          setAdapterError(error instanceof Error ? error : new Error("AMap map creation failed"));
        }
        return;
      }

      const nextMarkers = new Map();
      const nextInfoWindow = adapter.createInfoWindow("", {
        onClose: () => {
          if (!cancelled) {
            setPopupFocusedId("");
          }
        }
      });

      for (const spot of coordinateSpots) {
        const marker = adapter.createMarker(spot);
        if (!marker) continue;

        nextMarkers.set(spot.id, marker);
        adapter.addListener(marker, "click", () => onSelect(spot.id));
      }

      markerRefs.current = nextMarkers;
      infoWindowRef.current = nextInfoWindow;
      adapterRef.current = adapter;
      adapter.fitBounds(Array.from(nextMarkers.values()));
      requestAnimationFrame(() => {
        if (cancelled || adapterRef.current !== adapter) return;
        adapter.resize();
        adapter.fitBounds(Array.from(nextMarkers.values()));
      });
    });

    return () => {
      cancelled = true;
      adapterRef.current?.destroy();
      adapterRef.current = null;
      infoWindowRef.current = null;
      markerRefs.current = new Map();
    };
  }, [coordinateSpots, onSelect]);

  useEffect(() => {
    const adapter = adapterRef.current;
    if (!adapter || adapterState !== FOOD_MAP_AMAP_LOADER_STATES.ready) return;

    const marker = markerRefs.current.get(selectedId);
    const selectedSpot = coordinateSpots.find((spot) => spot.id === selectedId);
    const lastPopupSelection = lastPopupSelectionRef.current;
    const selectedChanged = selectedId !== lastPopupSelection.selectedId;
    const selectionRequested = selectionRequestId !== lastPopupSelection.selectionRequestId;
    if (marker) {
      adapter.selectMarker(marker);
    } else {
      adapter.clearSelectedMarker();
    }

    if (!selectedSpot) {
      lastPopupSelectionRef.current = { selectedId, selectionRequestId };
      adapter.closeInfoWindow(infoWindowRef.current);
      return;
    }

    if (popupFocusedId !== selectedId && !selectedChanged && !selectionRequested) {
      return;
    }

    const content = createFoodMapInfoWindowContent(selectedSpot);
    adapter.setInfoWindowContent(infoWindowRef.current, content);
    adapter.focusPlace(selectedSpot, infoWindowRef.current);
    lastPopupSelectionRef.current = { selectedId, selectionRequestId };
    if (popupFocusedId !== selectedId) {
      setPopupFocusedId(selectedId || "");
    }
  }, [adapterState, coordinateSpots, popupFocusedId, selectedId, selectionRequestId]);

  return (
    <section className="food-map-map-shell food-map-map-shell--amap" aria-label="美食地图" data-amap-state={adapterState}>
      <h2>地图坐标</h2>
      <div className="food-map-map-status" role="status">{statusText}</div>
      <div className="food-map-amap-frame" aria-hidden={showFallback} data-amap-active={isReady ? "true" : "false"}>
        <div ref={mapElementRef} className="food-map-amap-canvas" aria-label="高德地图" />
      </div>
      {(showFallback || isReady) && (
        <div className="food-map-map-fallback" data-amap-backup={isReady ? "true" : "false"}>
          <div className="food-map-marker-list" aria-label="地点 marker 列表">
            {coordinateSpots.map((spot, index) => (
              <button
                key={spot.id}
                className={`food-map-marker ${getFoodMapRatingClassName(spot.rating)}${spot.id === selectedId ? " food-map-marker--selected" : ""}`}
                type="button"
                aria-pressed={spot.id === selectedId}
                onClick={() => onSelect(spot.id)}
              >
                <span className="food-map-marker-index">{index + 1}</span>
                <span>
                  <span className="food-map-marker-title">{spot.name}</span>
                  <span className="food-map-marker-address">{spot.address || `${spot.lng}, ${spot.lat}`}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
