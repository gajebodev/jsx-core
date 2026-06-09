/**
 * Simple conditional classname utility.
 * Filters out falsy values and joins with spaces.
 *
 * @example
 * cx("btn", isPrimary && "btn-primary", isDisabled && "btn-disabled")
 * // => "btn btn-primary" (when isPrimary=true, isDisabled=false)
 */
export function cx(
  ...classes: (string | boolean | undefined | null)[]
): string {
  return classes
    .filter((c): c is string => typeof c === "string" && c.length > 0)
    .join(" ");
}
