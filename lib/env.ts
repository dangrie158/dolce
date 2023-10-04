import { ReflectMetadata } from "../deps.ts";
/**
 * Convenience functions to get values from the environment in the requestst type
 * with a defaultvalue as fallback
 */

type ConfigurationParameter = number | string | boolean | string[];
type ConfigurationParameterConstructorType = typeof Number | typeof String | typeof Boolean | typeof Array;
type ConfigurationParameterMetadata = Record<string, ConfigurationParameterOptions>;
type ConfigurationParameterOptions = {
    type: ConfigurationParameterConstructorType;
    env_variable?: string;
    required?: boolean;
    one_of?: readonly ConfigurationParameter[];
    array_of?: readonly ConfigurationParameter[];
};

const PARAMETEROPTIONS_METADATAKEY = Symbol("config:parameteroptions_metadata");
const CONFIGURATION_ERRORSKEY = Symbol("errors");

const env = Deno.env;

function get_number<D extends (number | undefined)>(key: string, default_value?: D): number | D {
    return env.has(key) ? Number(env.get(key)!) : default_value!;
}

function get_string<D extends (string | undefined)>(key: string, default_value?: D): string | D {
    return env.has(key) ? env.get(key)! : default_value!;
}

/**
 * get a boolean value. the truthiness of the value is determined by
 * the pure existence of the key in the environment
 */
function get_bool(key: string): boolean {
    return env.has(key);
}

/**
 * get a array of values split at `:`
 * e.g. `EXAMPLE=test1:test2::last`
 * ```js
 * get_array("EXAMPLE")
 * ["test1", "test2", "last"]
 * ```
 */
function get_array(key: string): string[] {
    const string_value = env.has(key) ? env.get(key)! : "";
    return string_value.split(":").filter((x) => x.length > 0);
}

export function ConfigOption(options?: Omit<ConfigurationParameterOptions, "type">) {
    return function <T extends { new (): InstanceType<T> }>(constructor: T, property_key: string) {
        const property_type = ReflectMetadata.getMetadata(
            "design:type",
            constructor,
            property_key,
        ) as ConfigurationParameterConstructorType;
        const existing_parameters: ConfigurationParameterMetadata =
            ReflectMetadata.getOwnMetadata(PARAMETEROPTIONS_METADATAKEY, constructor) || {};
        existing_parameters[property_key] = {
            type: property_type,
            ...options,
        };
        ReflectMetadata.defineMetadata(PARAMETEROPTIONS_METADATAKEY, existing_parameters, constructor);
    };
}

export function EnvironmentConfiguration<T extends { new (): InstanceType<T> }>(constructor: T) {
    const type_information = ReflectMetadata.getOwnMetadata(
        PARAMETEROPTIONS_METADATAKEY,
        constructor,
    ) as ConfigurationParameterMetadata;
    const validation_errors: Record<string, string> = {};

    for (const property_name of Object.keys(constructor)) {
        const property_options = type_information[property_name];
        const default_value = Reflect.get(constructor, property_name);
        const env_variable_name = property_options.env_variable || property_name.toUpperCase();

        // try to get the value from the environment
        let value: ConfigurationParameter;
        switch (property_options.type) {
            case Boolean:
                value = get_bool(env_variable_name);
                break;
            case Number:
                value = get_number(env_variable_name, default_value as number);
                if (isNaN(value)) {
                    validation_errors[property_name] = `failed to parse ${get_string(env_variable_name)} as number`;
                    value = default_value as number;
                }
                break;
            case Array: {
                value = env.has(env_variable_name) ? get_array(env_variable_name) : default_value as string[];
                break;
            }
            case String:
            default:
                value = get_string(env_variable_name, default_value as string);
                break;
        }

        // validate the value we found with all configured checks
        if (property_options.required && !value) {
            validation_errors[property_name] = `${env_variable_name} is not set`;
        }

        if (property_options.one_of !== undefined) {
            if (!property_options.one_of.includes(value)) {
                const allowed_values = property_options.one_of.map((v) => JSON.stringify(v)).join(", ");
                validation_errors[property_name] =
                    `value for ${env_variable_name} not one of {${allowed_values}}, ${value} instead`;
            }
        }

        if (property_options.array_of !== undefined) {
            if (!Array.isArray(value)) {
                validation_errors[property_name] =
                    `${constructor.name}.${property_name} has 'array_of' validation set, but value is not an array`;
            } else {
                const disallowed_values = value
                    .filter((v) => !property_options.array_of!.includes(v))
                    .map((v) => JSON.stringify(v)).join(", ");
                if (disallowed_values.length > 0) {
                    validation_errors[property_name] =
                        `disallowed values { ${disallowed_values} } in ${env_variable_name}`;
                }
            }
        }

        // set the value found either by the default value or in the environment
        Reflect.set(constructor, property_name, value);
    }
    Reflect.set(constructor, CONFIGURATION_ERRORSKEY, validation_errors);
}

export class CheckedConfiguration {
    static get errors(): Record<string, string> {
        return Reflect.get(this, CONFIGURATION_ERRORSKEY);
    }

    static get is_valid() {
        return Object.keys(Reflect.get(this, CONFIGURATION_ERRORSKEY)).length === 0;
    }
}
