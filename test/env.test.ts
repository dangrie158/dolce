import { CheckedConfiguration, ConfigOption } from "../lib/env.ts";

import { assert, assertEquals, assertStrictEquals } from "https://deno.land/std@0.204.0/assert/mod.ts";

Deno.test("EnvironmentConfiguration", async (test) => {
    Deno.env.set("DOLCE_TEST_STRING", "TEST");
    Deno.env.set("DOLCE_TEST_NUMBER", "123");
    Deno.env.set("DOLCE_TEST_ARRAY", "TEST1,TEST2,,TEST3");
    Deno.env.set("DOLCE_TEST_BOOL_TRUE", "something");
    Deno.env.delete("DOLCE_TEST_BOOL_FALSE");
    Deno.env.set("TEST_AUTO_NAME", "TEST_AUTO_NAME");

    await test.step("EnvironmentConfiguration automatically finds environemnt variables", () => {
        class TestConfiguration {
            @ConfigOption()
            static readonly test_auto_name: string;
        }
        assertEquals(TestConfiguration.test_auto_name, "TEST_AUTO_NAME");
    });

    await test.step("EnvironmentConfiguration autodetects basic types", () => {
        class TestConfiguration {
            @ConfigOption({ env_variable: "DOLCE_TEST_STRING" })
            static readonly test_string?: string;
            @ConfigOption({ type: Number, env_variable: "DOLCE_TEST_NUMBER" })
            static readonly test_number?: number;
            @ConfigOption({ type: Array, env_variable: "DOLCE_TEST_ARRAY" })
            static readonly test_array?: string[];
            @ConfigOption({ type: Boolean, env_variable: "DOLCE_TEST_BOOL_TRUE" })
            static readonly test_bool_true: boolean = false;
            @ConfigOption({ type: Boolean, env_variable: "DOLCE_TEST_BOOL_FALSE" })
            static readonly test_bool_false: boolean = true;
        }

        assert(typeof TestConfiguration.test_string === "string");
        assertStrictEquals(TestConfiguration.test_string, "TEST");

        assert(typeof TestConfiguration.test_number === "number");
        assertStrictEquals(TestConfiguration.test_number, 123);

        assert(Array.isArray(TestConfiguration.test_array));
        assertEquals(TestConfiguration.test_array, ["TEST1", "TEST2", "TEST3"]);

        assert(typeof TestConfiguration.test_bool_true === "boolean");
        assertStrictEquals(TestConfiguration.test_bool_true, true);

        assert(typeof TestConfiguration.test_bool_false === "boolean");
        assertStrictEquals(TestConfiguration.test_bool_false, false);
    });

    await test.step("ConfigOption.one_of", () => {
        class TestConfiguration extends CheckedConfiguration {
            @ConfigOption({ env_variable: "DOLCE_TEST_STRING", one_of: ["TEST"] })
            static readonly test_oneof_true: string;

            @ConfigOption({ env_variable: "DOLCE_TEST_STRING", one_of: ["TEST1", "TEST2"] })
            static readonly test_oneof_false: string;
        }

        assert(!("test_oneof_true" in TestConfiguration.errors));
        assert("test_oneof_false" in TestConfiguration.errors);
    });

    await test.step("ConfigOption.array_of", () => {
        class TestConfiguration extends CheckedConfiguration {
            @ConfigOption({ env_variable: "DOLCE_TEST_ARRAY", some_of: ["TEST1", "TEST2", "TEST3"] })
            static readonly test_arrayof_notanarray: string;

            @ConfigOption({
                type: Array,
                env_variable: "DOLCE_TEST_ARRAY",
                some_of: ["TEST1", "TEST2", "TEST3", "TEST4"],
            })
            static readonly test_arrayof_true: string[];

            @ConfigOption({ type: Array, env_variable: "DOLCE_TEST_ARRAY", one_of: ["TEST1", "TEST5"] })
            static readonly test_arrayof_false: string[];
        }
        assert("test_arrayof_notanarray" in TestConfiguration.errors);
        assert(!("test_arrayof_true" in TestConfiguration.errors));
        assert("test_arrayof_false" in TestConfiguration.errors);
    });

    await test.step("ConfigOption.required", () => {
        class TestConfiguration extends CheckedConfiguration {
            @ConfigOption({ env_variable: "DOLCE_TEST_BOOL_TRUE", required: true })
            static readonly test_required_true: string;

            @ConfigOption({ env_variable: "DOLCE_TEST_BOOL_FALSE", required: true })
            static readonly test_required_false: string;
        }
        assert(!("test_required_true" in TestConfiguration.errors));
        assert("test_required_false" in TestConfiguration.errors);
    });
});
