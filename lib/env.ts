/**
 * Convenience functions to get values from the environment in the requestst type
 * with a defaultvalue as fallback
 */

type ConfigurationParameter = number | string | boolean | string[];
type ConfigurationParameterConstructorType = typeof Number | typeof String | typeof Boolean | typeof Array;
type ConfigurationParameterMetadata = Record<string | symbol, ConfigurationParameterOptions>;
type ConfigurationParameterOptions = {
    type?: ConfigurationParameterConstructorType;
    env_variable?: string;
    required?: boolean;
    one_of?: readonly ConfigurationParameter[];
    some_of?: readonly ConfigurationParameter[];
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

export function ConfigOption<T extends ConfigurationParameter>(
    options: ConfigurationParameterOptions = { type: String }
) {
    return function (_target: undefined, context: ClassFieldDecoratorContext) {
        if (context.static === false) {
            throw new Error("ConfigOption can only be used on static fields");
        }

        const property_name = context.name.toString();
        const env_variable_name = options.env_variable || property_name.toUpperCase();
        return (initial: T | undefined): T => {
            const validation_errors: string[] = [];

            if (!env.has(env_variable_name) && initial === undefined) {
                validation_errors.push(`${env_variable_name} is not set and no default value provided`);
            }

            let value: ConfigurationParameter;
            switch (options.type) {
                case Boolean:
                    value = env.has(env_variable_name) as T;
                    break;
                case Number:
                    value = env.has(env_variable_name) ? Number(env.get(env_variable_name)) : initial!;
                    if (isNaN(value as number)) {
                        validation_errors.push(`failed to parse ${env.get(env_variable_name)} as number`);
                        value = initial!;
                    }
                    break;
                case Array: {
                    value = env.has(env_variable_name) ? get_array(env_variable_name) : initial!;
                    break;
                }
                case String:
                default:
                    value = env.has(env_variable_name) ? env.get(env_variable_name)! : initial!;
                    break;
            }

            if (options.required && !value) {
                validation_errors.push(`${env_variable_name} is not set`);
            }

            if (options.one_of !== undefined) {
                if (!options.one_of.includes(value!)) {
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

            return value as T;
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
