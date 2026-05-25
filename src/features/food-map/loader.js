import { projectPublicFoodMapPlaces } from "./core.js";
import {
  loadPublicFoodMapPlaces,
  normalizeFoodPlaceModules
} from "./loader-core.js";

const foodPlaceModules = import.meta.glob("../../content/food-places/*.yaml", { eager: true });

export const localFoodMapPlaces = normalizeFoodPlaceModules(foodPlaceModules);
export const publicFoodMapPlaces = projectPublicFoodMapPlaces(localFoodMapPlaces);
export { loadPublicFoodMapPlaces, normalizeFoodPlaceModules };
