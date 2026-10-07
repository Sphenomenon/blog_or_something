import { publicFoodMapPlaces } from "../../generated/content.js";
import { FOOD_MAP_STATUS_VALUES } from "./contracts.js";
import {
  loadPublicFoodMapPlaces,
  normalizeFoodPlaceModules
} from "./loader-core.js";

export { publicFoodMapPlaces, loadPublicFoodMapPlaces, normalizeFoodPlaceModules };
export const localFoodMapPlaces = publicFoodMapPlaces.map((place) => ({
  ...place,
  status: FOOD_MAP_STATUS_VALUES.published,
  visits: place.visits ?? []
}));
