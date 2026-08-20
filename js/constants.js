export const VERSION = "1.10";
export const API = "https://api.jsonbin.io/v3";
export const CREDS_KEY = "pulse.creds";
export const CACHE_KEY = "pulse.cache";
export const CELL_W = 40;
export const NAME_W = 248;
export const TAIL_W = 132;
export const MIN_HISTORY = 90;
export const RING = 2 * Math.PI * 52;
export const IDENTITY_HALF_LIFE = 21;
export const IDENTITY_TAU = 45;
export const IDENTITY_ALPHA = 1 - Math.pow(0.5, 1 / IDENTITY_HALF_LIFE);

export const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
export const MONTHS = [
  "JANUARY",
  "FEBRUARY",
  "MARCH",
  "APRIL",
  "MAY",
  "JUNE",
  "JULY",
  "AUGUST",
  "SEPTEMBER",
  "OCTOBER",
  "NOVEMBER",
  "DECEMBER",
];
export const HEAT_WD = ["m", "t", "w", "t", "f", "s", "s"];
