import { time_until_end_of_window, timestamp_in_window } from "../lib/chrono.ts";
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

Deno.test("time_until_end_of_window", async (test) => {
    await test.step("`time_until_end_of_window` works", () => {
        const now = Temporal.Now.plainTimeISO();
        const window_end = now.add(Temporal.Duration.from({ hours: 1 }));
        const duration = time_until_end_of_window([new Temporal.PlainTime(), window_end]);
        const rounded_time = duration.round({ smallestUnit: "second" });
        assert(Temporal.Duration.compare(rounded_time, Temporal.Duration.from({ hours: 1 })) === 0);
    });

    await test.step("`time_until_end_of_window` clamps", () => {
        const now = Temporal.Now.plainTimeISO();
        const window_end = now.subtract(Temporal.Duration.from({ hours: 1 }));
        const duration = time_until_end_of_window([new Temporal.PlainTime(), window_end]);
        assert(Temporal.Duration.compare(duration, new Temporal.Duration()) === 0);
    });
});
