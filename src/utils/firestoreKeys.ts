export type FirestoreSafeKeyOptions = {
  /**
   * Maximum length of the generated key.
   * Keeps IDs readable and avoids overly long path segments.
   */
  maxLength?: number;

  /**
   * Fallback value when input becomes empty after sanitizing.
   */
  fallback?: string;

  /**
   * Separator used when replacing invalid characters.
   * Default: "_"
   */
  separator?: "_" | "-";

  /**
   * Convert to lowercase for consistency.
   * Default: true
   */
  lowercase?: boolean;

  /**
   * Add a short deterministic hash suffix from the ORIGINAL input.
   * Useful if you want to reduce collisions between similar labels.
   * Example: "A/C Unit" -> "a_c_unit_k3x9p2"
   * Default: false
   */
  includeHash?: boolean;
};

/**
 * Turns free text into a stable Firestore-safe key.
 *
 * Good for:
 * - Firestore document IDs
 * - Firestore map/object keys
 * - Firebase Storage path segments
 * - Reusable normalized identifiers across the app
 *
 * Examples:
 *   "Blood Pressure Monitor"   -> "blood_pressure_monitor"
 *   "A/C Unit #2"              -> "a_c_unit_2"
 *   " 溫度 Sensor "             -> "sensor"   // if non-latin chars are stripped
 *   ""                         -> "untitled"
 */
export function toFirestoreSafeKey(
  input: string,
  options: FirestoreSafeKeyOptions = {},
): string {
  const {
    maxLength = 60,
    fallback = "untitled",
    separator = "_",
    lowercase = true,
    includeHash = false,
  } = options;

  const raw = String(input ?? "").trim();

  // 1) Normalize Unicode so accented characters can be simplified
  //    e.g. "Café" -> "Café" -> "Cafe"
  let value = raw.normalize("NFKD");

  // 2) Remove combining diacritic marks
  value = value.replace(/[\u0300-\u036f]/g, "");

  // 3) Optional lowercase for consistency
  if (lowercase) {
    value = value.toLowerCase();
  }

  // 4) Replace apostrophes/quotes with nothing
  value = value.replace(/['"`’‘"]/g, "");

  // 5) Replace anything not alphanumeric with the separator
  //    This strips slashes and other risky path characters.
  value = value.replace(/[^a-zA-Z0-9]+/g, separator);

  // 6) Collapse repeated separators
  const repeatedSep = new RegExp(`${escapeRegExp(separator)}+`, "g");
  value = value.replace(repeatedSep, separator);

  // 7) Trim separators from both ends
  const edgeSep = new RegExp(`^${escapeRegExp(separator)}|${escapeRegExp(separator)}$`, "g");
  value = value.replace(edgeSep, "");

  // 8) Guard against empty / reserved-ish results
  if (!value || value === "." || value === "..") {
    value = fallback;
  }

  // 9) Avoid overly long keys
  if (value.length > maxLength) {
    value = value.slice(0, maxLength);

    // trim separator again after slicing
    value = value.replace(edgeSep, "");
    if (!value) value = fallback;
  }

  // 10) Optional deterministic hash suffix to reduce collisions
  if (includeHash) {
    const hash = shortStableHash(raw);
    const suffix = `${separator}${hash}`;

    const allowedBaseLength = Math.max(1, maxLength - suffix.length);
    let base = value.slice(0, allowedBaseLength).replace(edgeSep, "");
    if (!base) base = fallback;

    value = `${base}${suffix}`;
  }

  return value;
}

/**
 * Small deterministic hash for suffixing keys.
 * Not cryptographic — just collision reduction for human-entered text.
 */
function shortStableHash(input: string): string {
  let hash = 2166136261; // FNV-1a offset basis

  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  // convert unsigned -> base36 short string
  return (hash >>> 0).toString(36);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
