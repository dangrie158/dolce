import { deadline } from "@std/async";

export function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

type ThrottledFunction<T extends Array<void>> = {
    (...args: T): Promise<void>;
};

export function throttle<T extends Array<void>>(
    fn: (this: ThrottledFunction<T>, ...args: T) => Promise<void>,
    delay: number,
): ThrottledFunction<T> {
    let is_cooling_down: boolean;
    let last_args: T | undefined;
    const throttled_fn = async (...args: T) => {
        if (!is_cooling_down) {
            await fn.call(throttled_fn, ...args);
            is_cooling_down = true;
            await wait(delay);
            is_cooling_down = false;
            if (last_args !== undefined) {
                fn.call(throttled_fn, ...last_args);
            }
        } else {
            last_args = args;
            return Promise.resolve();
        }
    };
    return throttled_fn;
}

export function DeadlinedReader<T>(
    reader: ReadableStreamDefaultReader<T>,
    timeout: number,
): ReadableStreamDefaultReader<T> {
    return {
        ...reader,
        read: async () => {
            try {
                return await deadline(reader.read(), timeout);
            } catch (error) {
                if (error instanceof DOMException && error.name === "TimeoutError") {
                    reader.cancel();
                    return { done: true, value: undefined };
                }
                throw error;
            }
        },
    };
}

export function timestamp_in_window(timestamp: number, window: [Temporal.PlainTime, Temporal.PlainTime]): boolean {
    const timestamp_date = new Date(timestamp);
    const timestamp_time = new Temporal.PlainTime(
        timestamp_date.getHours(),
        timestamp_date.getMinutes(),
        timestamp_date.getSeconds(),
    );
    if (Temporal.PlainTime.compare(window[0], window[1]) < 0) {
        return (
            Temporal.PlainTime.compare(timestamp_time, window[0]) >= 0 &&
            Temporal.PlainTime.compare(timestamp_time, window[1]) <= 0
        );
    } else {
        return (
            Temporal.PlainTime.compare(timestamp_time, window[0]) >= 0 ||
            Temporal.PlainTime.compare(timestamp_time, window[1]) <= 0
        );
    }
}
