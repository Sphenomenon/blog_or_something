import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { DecorativeAccent } from "../components/DecorativeAccent.jsx";
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
import { revealFrame } from "../lib/motion.js";

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
    <motion.section
      className="page-panel page-panel--food-map food-map-view"
      data-testid="food-map-view"
      variants={revealFrame}
      initial="hidden"
      animate="visible"
      custom={shouldReduceMotion}
    >
      <header className="food-map-page-heading">
        <h1>美食地图</h1>
        <span className="food-map-source-status" aria-label="来源载入状态">{sourceStatusText}</span>
      </header>

      {runtimeWarnings.length > 0 && (
        <div className="food-map-external-warning food-map-external-warning--compact" role="status" aria-live="polite">
          外部来源同步有警告，本地地点已保留{failedSourceNames.length > 0 ? `；失败来源：${failedSourceNames.join("、")}` : "。"}
        </div>
      )}

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
        <>
          <section className="food-map-layout" aria-label="美食地图结果">
            <FoodMapAmapPanel spots={filteredPlaces} selectedId={selectedId} selectionRequestId={selectionRequestId} onSelect={selectFoodMapPlace} />
            <div className="food-map-main">
              <FoodMapSpotList spots={filteredPlaces} selectedId={selectedId} onSelect={selectFoodMapPlace} />
            </div>
          </section>
          <section id="food-map-details" className="food-map-detail-section" aria-label="所选地点详情">
            <p className="food-map-detail-kicker">地点手记 <span>选择店铺，查看推荐与探店记录</span></p>
            <FoodMapDetail spot={selectedPlace} />
          </section>
        </>
      )}
      <footer className="food-map-footer">
        <DecorativeAccent id="food-map-header" />
      </footer>
    </motion.section>
  );
}
