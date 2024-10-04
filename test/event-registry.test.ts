import { assert } from "https://deno.land/std@0.204.0/assert/mod.ts";
import {
    add_event_for_delivery,
    clear_registry,
    flush_state_changes_not_delivered,
    register,
    track_container_state_change,
} from "../lib/event_registry.ts";
import { ulid } from "@std/ulid/ulid";
import { assertStrictEquals } from "https://deno.land/std@0.204.0/assert/assert_strict_equals.ts";

const test_event_start = {
    id: ulid(),
    status: "start" as const,
    Action: "start" as const,
    Type: "container" as const,
    scope: "local" as const,
    actor_name: "test",
    time: Date.now(),
    timeNano: Date.now() * 1000,
    from: "test",
    Actor: {
        ID: "test",
        Attributes: {
            name: "test",
            image: "test",
        },
    },
};

const test_event_stop = {
    ...test_event_start,
    status: "stop" as const,
    Action: "stop" as const,
};

Deno.test("event registry", async (test) => {
    const tmp_dir = Deno.makeTempDirSync();
    const event_registry = await register(
        tmp_dir,
        (_events, _earliest_next_update) => {
            assert(false, "event registry callback was called");
        },
        {
            min_timeout: 10,
            max_timeout: 100,
            multiplier: 2,
        },
    );

    await test.step("no state changes are reported if all events are notified", async () => {
        await add_event_for_delivery(event_registry, test_event_start);
        await add_event_for_delivery(event_registry, test_event_stop);
        const state_changes = await flush_state_changes_not_delivered(event_registry);
        assert(state_changes.length === 0);
        await clear_registry(event_registry);
    });

    await test.step("state changes are tracked", async () => {
        await track_container_state_change(event_registry, test_event_start, { registered_for_delivery: true });
        await track_container_state_change(event_registry, test_event_stop, { registered_for_delivery: false });
        const state_changes = await flush_state_changes_not_delivered(event_registry);
        assert(state_changes.length === 1);
        const [from_event, to_event] = state_changes[0];
        assert(from_event !== null, "state change event has start event");
        assertStrictEquals(from_event.status, "start", "from event has last notified action");
        assertStrictEquals(to_event.status, "stop", "to event has last observed action");
        await clear_registry(event_registry);
    });

    await test.step("state changes to unseen containers are reported", async () => {
        await track_container_state_change(event_registry, test_event_stop, { registered_for_delivery: false });
        const state_changes = await flush_state_changes_not_delivered(event_registry);
        assert(state_changes.length === 1);
        const [from_event, to_event] = state_changes[0];
        assert(from_event === null, "state change event has no start event");
        assertStrictEquals(to_event.status, "stop", "to event has last observed action");
        await clear_registry(event_registry);
    });

    await test.step("state changes are only reported if the state changes", async () => {
        await track_container_state_change(event_registry, test_event_start, { registered_for_delivery: true });
        await track_container_state_change(event_registry, test_event_stop, { registered_for_delivery: false });
        await track_container_state_change(event_registry, test_event_start, { registered_for_delivery: false });
        const state_changes = await flush_state_changes_not_delivered(event_registry);
        assert(state_changes.length === 0);
        await clear_registry(event_registry);
    });

    event_registry.db.close();
    Deno.removeSync(tmp_dir, { recursive: true });
});
