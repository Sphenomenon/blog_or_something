import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { aggregateFoodMapExternalSources, loadFoodMapSourceConfig } from "../features/food-map/index.js";
import { localFoodMapPlaces, publicFoodMapPlaces } from "../features/food-map/loader.js";
import {
  FOOD_MAP_DEFAULT_FILTERS,
  FoodMapAmapPanel,
  FoodMapDetail,
  FoodMapEmptyState,
  FoodMapFilters,
  FoodMapNoResults,
  FoodMapSpotList,
  filterFoodMapPlaces,
  getFoodMapFilterOptions
} from "../features/food-map/FoodMapComponents.jsx";
import { revealFrame, staggerContainer } from "../lib/motion.js";

const FOOD_MAP_SHARED_JSON_PATH = "/food-map/index.json";

function hasActiveFilters(filters) {
  return Object.entries(filters).some(([key, value]) => {
    if (key === "source") return value !== FOOD_MAP_DEFAULT_FILTERS.source;
    return String(value ?? "").trim() !== "";
  });
}

export function FoodMapView() {
  const shouldReduceMotion = useReducedMotion();
  const [aggregationState, setAggregationState] = useState({
    status: "local",
    loading: false,
    places: publicFoodMapPlaces,
    sources: [],
    failedSources: [],
    warnings: [],
    errors: []
  });
  const [filters, setFilters] = useState(FOOD_MAP_DEFAULT_FILTERS);
  const [selectedId, setSelectedId] = useState(publicFoodMapPlaces[0]?.id ?? "");
  const [selectionRequestId, setSelectionRequestId] = useState(0);
  const [copyStatus, setCopyStatus] = useState("idle");

  const places = aggregationState.places;
  const runtimeWarnings = [...new Set([...aggregationState.warnings, ...aggregationState.errors])];
  const options = useMemo(() => getFoodMapFilterOptions(places), [places]);
  const filteredPlaces = useMemo(() => filterFoodMapPlaces(places, filters), [filters, places]);
  const selectedPlace = filteredPlaces.find((spot) => spot.id === selectedId) ?? null;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function loadExternalPlaces() {
      setAggregationState((currentState) => ({ ...currentState, status: "loading", loading: true }));

      const configResult = await loadFoodMapSourceConfig({ signal: controller.signal });
      if (!active || controller.signal.aborted) return;

      if (configResult.sources.length === 0) {
        setAggregationState({
          status: "ready",
          loading: false,
          places: publicFoodMapPlaces,
          sources: [],
          failedSources: [],
          warnings: configResult.warnings,
          errors: configResult.errors
        });
        return;
      }

      const aggregateResult = await aggregateFoodMapExternalSources(localFoodMapPlaces, configResult.sources, { signal: controller.signal });
      if (!active || controller.signal.aborted) return;

      setAggregationState({
        status: aggregateResult.status,
        loading: aggregateResult.loading,
        places: aggregateResult.places,
        sources: aggregateResult.sources,
        failedSources: aggregateResult.failedSources ?? [],
        warnings: [...configResult.warnings, ...aggregateResult.warnings],
        errors: [...configResult.errors, ...aggregateResult.errors]
      });
    }

    loadExternalPlaces().catch((error) => {
      if (!active || controller.signal.aborted) return;
      const message = error?.message ?? "unknown error";
      setAggregationState({
        status: "ready",
        loading: false,
        places: publicFoodMapPlaces,
        sources: [],
        failedSources: [],
        warnings: [`[food-map] external aggregation failed: ${message}`],
        errors: [`[food-map] external aggregation failed: ${message}`]
      });
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const nextSelectedId = filteredPlaces.some((spot) => spot.id === selectedId)
      ? selectedId
      : filteredPlaces[0]?.id ?? "";

    if (nextSelectedId !== selectedId) {
      setSelectedId(nextSelectedId);
    }
  }, [filteredPlaces, selectedId]);

  function resetFilters() {
    setFilters(FOOD_MAP_DEFAULT_FILTERS);
  }

  const selectFoodMapPlace = useCallback((spotId) => {
    setSelectedId(spotId);
    setSelectionRequestId((currentRequestId) => currentRequestId + 1);
  }, []);

  async function copySharedJsonUrl() {
    const clipboard = typeof window === "undefined" ? undefined : window.navigator?.clipboard;
    if (!clipboard?.writeText) {
      setCopyStatus("failed");
      return;
    }

    try {
      await clipboard.writeText(`${window.location.origin}${FOOD_MAP_SHARED_JSON_PATH}`);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  }

  const totalCount = places.length;
  const localCount = places.filter((spot) => spot.source?.type !== "external").length;
  const externalCount = totalCount - localCount;
  const failedSourceNames = [...new Set((aggregationState.failedSources ?? [])
    .map((source) => source?.name || source?.id)
    .filter(Boolean))];
  const failedCount = failedSourceNames.length;
  const sourceStatusText = [
    `本地 ${localCount}`,
    `外部 ${externalCount}`,
    aggregationState.loading ? "同步中" : "",
    failedCount > 0 ? `失败 ${failedCount}` : ""
  ].filter(Boolean).join(" · ");

  return (
    <motion.main
      className="page-panel page-panel--food-map food-map-view"
      data-testid="food-map-view"
      variants={revealFrame}
      initial="hidden"
      animate="visible"
      custom={shouldReduceMotion}
    >
      <header className="page-panel-header page-panel-header--stacked">
        <div>
          <p className="hero-code">FOOD MAP / PUBLIC ATLAS</p>
          <h1>美食地图</h1>
          <p className="page-panel-lead">把公开可分享的餐馆、咖啡馆和路边小店收进同一张轻量地图；没有密钥时也能用列表和 fallback marker 浏览。</p>
        </div>
        <div className="food-map-status-row" aria-label="美食地图状态">
          <span className="food-map-status-badge food-map-status-badge--loading">{totalCount} 个公开地点</span>
          <span className="food-map-source-status" aria-label="来源载入状态">{sourceStatusText}</span>
        </div>
      </header>

      {externalCount > 0 && (
        <div className="food-map-external-warning" role="note">
          已载入 {aggregationState.sources.length} 个外部来源。外部来源只显示共享 JSON 中的公开字段；本地私密访问人与私密备注不会进入这里。
        </div>
      )}

      {runtimeWarnings.length > 0 && (
        <div className="food-map-external-warning food-map-external-warning--compact" role="status" aria-live="polite">
          外部来源同步有警告，本地地点已保留{failedSourceNames.length > 0 ? `；失败来源：${failedSourceNames.join("、")}` : "。"}
        </div>
      )}

      <section className="food-map-share-panel" aria-labelledby="food-map-share-title">
        <div className="food-map-share-copy">
          <span className="food-map-source-badge food-map-source-badge--local">共享 JSON</span>
          <div>
            <h2 id="food-map-share-title">公开订阅入口</h2>
            <p>把这个静态端点交给朋友站点读取；这里只暴露已发布的公开字段。</p>
          </div>
        </div>
        <div className="food-map-share-actions">
          <code className="food-map-share-path">{FOOD_MAP_SHARED_JSON_PATH}</code>
          <a className="food-map-share-link" href={FOOD_MAP_SHARED_JSON_PATH} target="_blank" rel="noopener noreferrer">直接打开</a>
          <button className="food-map-button food-map-share-button" type="button" onClick={copySharedJsonUrl}>
            {copyStatus === "copied" ? "已复制" : "复制链接"}
          </button>
        </div>
        <p className="food-map-share-feedback" role="status" aria-live="polite">
          {copyStatus === "copied" && "已复制"}
          {copyStatus === "failed" && "无法自动复制，请手动复制上方路径。"}
        </p>
      </section>

      <FoodMapFilters
        filters={filters}
        options={options}
        totalCount={totalCount}
        resultCount={filteredPlaces.length}
        onChange={setFilters}
        onReset={resetFilters}
      />

      {totalCount === 0 ? (
        <FoodMapEmptyState />
      ) : filteredPlaces.length === 0 ? (
        <FoodMapNoResults onReset={resetFilters} />
      ) : (
        <section className="food-map-layout" aria-label="美食地图结果">
          <motion.div className="food-map-main" variants={staggerContainer} initial="hidden" animate="visible" custom={shouldReduceMotion}>
            {hasActiveFilters(filters) && <p className="food-map-count">当前筛选显示 {filteredPlaces.length} 个地点。</p>}
            <FoodMapSpotList spots={filteredPlaces} selectedId={selectedId} onSelect={selectFoodMapPlace} />
          </motion.div>
          <aside className="food-map-side" aria-label="地点详情与地图">
            <FoodMapDetail spot={selectedPlace} />
            <FoodMapAmapPanel spots={filteredPlaces} selectedId={selectedId} selectionRequestId={selectionRequestId} onSelect={selectFoodMapPlace} />
          </aside>
        </section>
      )}
    </motion.main>
  );
}
