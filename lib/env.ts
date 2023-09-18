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

export function get_bool<D extends (boolean | undefined)>(key: string, default_value?: D): boolean | D {
    return env.has(key) ? !!env.get(key)! : default_value!;
}
