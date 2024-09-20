import { DockerApiContainerEvent } from "./docker-api.ts";
import { path, ulid } from "../deps.ts";

type DockerContainerEvent = DockerApiContainerEvent & {
    actor_name: string;
};

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

const MESSAGES_PREFIX = "messages";
const NEXT_DELIVERY_KEY = ["next_delivery"];

function exponential_backoff(iteration: number, options: BackoffSettings) {
    return Math.floor(Math.min(options.max_timeout, options.min_timeout * options.multiplier ** iteration));
}

export async function register(
    run_directory: string,
    delivery_callback: DeliveryCallback,
    backoff_settings: BackoffSettings,
): Promise<EventRegistry> {
    const db_path = path.join(run_directory, "dolce.db");
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

export async function add_event(registry: EventRegistry, event: DockerContainerEvent): Promise<void> {
    await registry.db.set([MESSAGES_PREFIX, ulid()], event);
    await schedule_next_delivery(registry);
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

async function flush_events(registry: EventRegistry): Promise<DockerContainerEvent[]> {
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
