/**
 * Convenience functions to get values from the environment in the requestst type
 * with a defaultvalue as fallback
 */

type ConstructorType<T> = T extends number ? typeof Number
    : T extends string ? typeof String
    : T extends boolean ? typeof Boolean
    : T extends unknown[] ? typeof Array
    : undefined;
type ConfigurationParameterOptions<T> = {
    type?: ConstructorType<T>;
    env_variable?: string;
    required?: boolean;
    one_of?: T extends unknown[] ? never : readonly unknown[];
    some_of?: T extends unknown[] ? readonly T[number][] : never;
    transformer?: (value: T extends unknown[] ? string[] : string) => T;
};
const env = Deno.env;

/**
 * get a array of values split at `,`
 * e.g. `EXAMPLE=test1,test2,,last`
 * ```js
 * get_array("EXAMPLE")
 * ["test1", "test2", "last"]
 * ```
 */
function get_array(key: string): string[] {
    const string_value = env.has(key) ? env.get(key)! : "";
    return string_value.split(",").filter((x) => x.length > 0);
}

export function ConfigOption<T = string>(options: ConfigurationParameterOptions<T> = {}) {
    return function (_target: undefined, context: ClassFieldDecoratorContext) {
        if (context.static === false) {
            throw new Error("ConfigOption can only be used on static fields");
        }

        const property_name = context.name.toString();
        const env_variable_name = options.env_variable || property_name.toUpperCase();
        return (initial: T): T => {
            const validation_errors: string[] = [];

            let raw_value;
            switch (options.type) {
                case Boolean:
                    raw_value = env.has(env_variable_name) as T;
                    break;
                case Number:
                    raw_value = env.has(env_variable_name) ? Number(env.get(env_variable_name)) : initial!;
                    if (isNaN(raw_value as number)) {
                        validation_errors.push(`failed to parse ${env.get(env_variable_name)} as number`);
                        raw_value = initial!;
                    }
                    break;
                case Array: {
                    raw_value = env.has(env_variable_name) ? get_array(env_variable_name) : initial!;
                    break;
                }
                case String:
                default:
                    raw_value = env.has(env_variable_name) ? env.get(env_variable_name)! : initial!;
                    break;
            }

            if (options.required && !raw_value) {
                validation_errors.push(`${env_variable_name} is not set`);
            }

            let value: T = raw_value as T;
            if (options.transformer !== undefined) {
                try {
                    value = options.transformer(value as T extends unknown[] ? string[] : string) as T;
                } catch (transformation_error) {
                    validation_errors.push(`failed to transform ${value} using transformer: ${transformation_error}`);
                }
            }

            if (options.one_of !== undefined) {
                if (!options.one_of.includes(value)) {
                    const allowed_values = options.one_of.map((v) => JSON.stringify(v)).join(", ");
                    validation_errors.push(
                        `value for ${env_variable_name} not one of {${allowed_values}}, ${value} instead`,
                    );
                }
            }

            if (options.some_of !== undefined) {
                if (!Array.isArray(value)) {
                    validation_errors.push(`${property_name} has 'array_of' validation set, but value is not an array`);
                } else {
                    const disallowed_values = value
                        .filter((v) => !options.some_of!.includes(v))
                        .map((v) => JSON.stringify(v))
                        .join(", ");
                    if (disallowed_values.length > 0) {
                        validation_errors.push(`disallowed values { ${disallowed_values} } in ${env_variable_name}`);
                    }
                }
            }
            if (validation_errors.length > 0) {
                context.metadata[context.name] = validation_errors;
            }

            return value;
        };
    };
}

export class CheckedConfiguration {
    static get errors(): Record<string, string[]> {
        return this[Symbol.metadata]! as Record<string, string[]>;
    }

    static get is_valid() {
        return Object.keys(this.errors).length === 0;
    }
}
