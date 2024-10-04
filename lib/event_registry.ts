import { ulid } from "@std/ulid";
import { join as join_path } from "@std/path";
import { DockerApiContainerEvent } from "./docker-api.ts";

export type DockerContainerEvent = DockerApiContainerEvent & {
    actor_name: string;
};

export type DockerStateChangeEvent = [DockerContainerEvent | null, DockerContainerEvent];

type EventRegistry = {
    db: Deno.Kv;
    backoff_settings: BackoffSettings;
};

type DeliveryCallback = (_: DockerContainerEvent[], earliest_next_update: Date) => Promise<void>;
type DeliveryEvent = {
    backoff_iteration: number;
};

type ScheduleResult = {
    ok: boolean;
    earliest_next_update: Date;
};

type BackoffSettings = {
    min_timeout: number;
    max_timeout: number;
    multiplier: number;
};

// contains all messages that are waiting to be delivered
const MESSAGES_PREFIX = "messages";
// contains the last event for any container that the user was or will be notified about
const CONTAINER_LAST_NOTIFIED_EVENT_PREFIX = "last_event_notified";
// contains the last event for any container that was observed even if the user
// did not get notified about it (maybe because of an active blackout window at
// the event time)
const CONTAINER_LAST_OBSERVED_EVENT_PREFIX = "last_event_observed";
const NEXT_DELIVERY_KEY = ["next_delivery"];

function exponential_backoff(iteration: number, options: BackoffSettings) {
    return Math.floor(Math.min(options.max_timeout, options.min_timeout * options.multiplier ** iteration));
}

export async function register(
    run_directory: string,
    delivery_callback: DeliveryCallback,
    backoff_settings: BackoffSettings,
): Promise<EventRegistry> {
    const db_path = join_path(run_directory, "dolce.db");
    const db = await Deno.openKv(db_path);
    const registry: EventRegistry = { db, backoff_settings };

    db.listenQueue(async (value) => {
        const delivery_event = value as DeliveryEvent;
        const events = await flush_events(registry);
        if (events.length > 0) {
            const { earliest_next_update } = await schedule_next_delivery(
                registry,
                delivery_event.backoff_iteration + 1,
            );
            await delivery_callback(events, earliest_next_update);
        }
    });
    return registry;
}

export async function get_next_delivery(registry: EventRegistry): Promise<Date | null> {
    const next_delivery_entry = await registry.db.get<Date>(NEXT_DELIVERY_KEY);
    return next_delivery_entry.value;
}

export async function add_event_for_delivery(registry: EventRegistry, event: DockerContainerEvent): Promise<void> {
    await registry.db.set([MESSAGES_PREFIX, ulid()], event);
    await schedule_next_delivery(registry);
}

export async function track_container_state_change(
    registry: EventRegistry,
    event: DockerContainerEvent,
    options: { registered_for_delivery: boolean },
): Promise<void> {
    if (options.registered_for_delivery) {
        await registry.db.set([CONTAINER_LAST_NOTIFIED_EVENT_PREFIX, event.actor_name], event);
    } else {
        await registry.db.set([CONTAINER_LAST_OBSERVED_EVENT_PREFIX, event.actor_name], event);
    }
}

export async function flush_state_changes_not_delivered(registry: EventRegistry): Promise<DockerStateChangeEvent[]> {
    const last_notified_entries = registry.db.list<DockerContainerEvent>({
        prefix: [CONTAINER_LAST_NOTIFIED_EVENT_PREFIX],
    });

    const changes: DockerStateChangeEvent[] = [];

    // check if the status of the last observed event is different from the last notified event
    for await (const last_notified_entry of last_notified_entries) {
        const last_observed_entry = await registry.db.get<DockerContainerEvent>([
            CONTAINER_LAST_OBSERVED_EVENT_PREFIX,
            last_notified_entry.key[1],
        ]);

        if (
            last_observed_entry.value !== null &&
            last_observed_entry.value.status !== last_notified_entry.value.status
        ) {
            changes.push([last_notified_entry.value, last_observed_entry.value]);
        }
    }

    const cleanup_operations: Deno.KvMutation[] = [];
    const last_observed_entries = registry.db.list<DockerContainerEvent>({
        prefix: [CONTAINER_LAST_OBSERVED_EVENT_PREFIX],
    });
    // check if there are any observed containers where the last known state is unknown
    for await (const last_observed_entry of last_observed_entries) {
        const last_notified_entry = await registry.db.get<DockerContainerEvent>([
            CONTAINER_LAST_NOTIFIED_EVENT_PREFIX,
            last_observed_entry.key[1],
        ]);

        if (last_notified_entry.value === null) {
            changes.push([null, last_observed_entry.value]);
        }
        cleanup_operations.push({ type: "delete", key: last_observed_entry.key });
    }

    await registry.db
        .atomic()
        .mutate(...cleanup_operations)
        .commit();

    return changes;
}

async function schedule_next_delivery(registry: EventRegistry, backoff_iteration = 0): Promise<ScheduleResult> {
    const next_delay = exponential_backoff(backoff_iteration, registry.backoff_settings) * 1000;
    const earliest_next_update = new Date(Date.now() + next_delay);
    const delivery_event: DeliveryEvent = { backoff_iteration };

    // enqueue the event in an atomic operation with a check that NEXT_DELIVERY_KEY is unset. If NEXT_DELIVERY_KEY is set,
    // this is a noop and `ok` will be false, so it is safe to call this method all the time as long as NEXT_DELIVERY_KEY
    // is deleted once the messages are sent
    const { ok, ..._ } = await registry.db
        .atomic()
        .check({ key: NEXT_DELIVERY_KEY, versionstamp: null })
        .enqueue(delivery_event, { delay: next_delay })
        .set(NEXT_DELIVERY_KEY, earliest_next_update)
        .commit();
    return { ok, earliest_next_update };
}

export async function flush_events(registry: EventRegistry): Promise<DockerContainerEvent[]> {
    const event_entries = registry.db.list<DockerContainerEvent>({ prefix: [MESSAGES_PREFIX] });
    const events: DockerContainerEvent[] = [];
    const cleanup_operations: Deno.KvMutation[] = [];
    for await (const event_entry of event_entries) {
        events.push(event_entry.value);
        cleanup_operations.push({ type: "delete", key: event_entry.key });
    }
    await registry.db
        .atomic()
        .delete(NEXT_DELIVERY_KEY)
        .mutate(...cleanup_operations)
        .commit();
    return events;
}

export async function clear_registry(registry: EventRegistry): Promise<void> {
    const cleanup_operations: Deno.KvMutation[] = [];

    await Promise.all(
        [MESSAGES_PREFIX, CONTAINER_LAST_NOTIFIED_EVENT_PREFIX, CONTAINER_LAST_OBSERVED_EVENT_PREFIX].map(
            async (prefix) => {
                for await (const event of registry.db.list<DockerContainerEvent>({ prefix: [prefix] })) {
                    cleanup_operations.push({ type: "delete", key: event.key });
                }
            },
        ),
    );
    await registry.db
        .atomic()
        .delete(NEXT_DELIVERY_KEY)
        .mutate(...cleanup_operations)
        .commit();
}
