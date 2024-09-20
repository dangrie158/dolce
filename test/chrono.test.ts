import { timestamp_in_window } from "../lib/chrono.ts";
import { assert } from "https://deno.land/std@0.204.0/assert/mod.ts";

Deno.test("timestamp_in_window", async (test) => {
    await test.step("`timestamp_in_window` works", () => {
        const test_time = new Date(0, 0, 0, 21, 12, 0).getTime();
        assert(timestamp_in_window(test_time, [new Temporal.PlainTime(21, 12), new Temporal.PlainTime(21, 12, 1)]));
        assert(!timestamp_in_window(test_time, [new Temporal.PlainTime(21, 12, 1), new Temporal.PlainTime(21, 12, 2)]));
    });

    await test.step("`timestamp_in_window` wraps around", () => {
        const test_time = new Date(0, 0, 0, 0, 0, 0).getTime();
        assert(timestamp_in_window(test_time, [new Temporal.PlainTime(22), new Temporal.PlainTime(2)]));
        assert(!timestamp_in_window(test_time, [new Temporal.PlainTime(2), new Temporal.PlainTime(22)]));
    });
});
