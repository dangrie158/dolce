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
