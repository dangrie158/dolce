/**
 * Convenience functions to get values from the environment in the requestst type
 * with a defaultvalue as fallback
 */

const env = Deno.env;

export function ensure_defined(...keys: string[]): boolean {
    return keys.every(key => env.has(key));
}

export function get_number<D extends (number | undefined)>(key: string, default_value?: D): number | D {
    return env.has(key) ? Number(env.get(key)!) : default_value!;
}

export function get_string<D extends (string | undefined)>(key: string, default_value?: D): string | D {
    return env.has(key) ? env.get(key)! : default_value!;
}

/**
 * get a boolean value. the truthiness of the value is determined by
 * the pure existence of the key in the environment
 * */
export function get_bool(key: string): boolean {
    return env.has(key);
}

/**
 * get a array of values split at `:`
 * e.g. EXAMPLE=test1:test2::last
 * ```js
 * get_array("EXAMPLE")
 * ["test1", "test2", "", "last"]
 * ```
 */
export function get_array(key: string): string[] {
    const string_value = env.has(key) ? env.get(key)! : "";
    return string_value.split(":").filter(x => x.length > 0);
}
