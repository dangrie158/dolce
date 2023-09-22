
type ThrottledFunction<T extends Array<void>> = {
    (...args: T): Promise<void>;
};

export function throttle<T extends Array<void>>(fn: (this: ThrottledFunction<T>, ...args: T) => Promise<void>, wait: number): ThrottledFunction<T> {
    let timer: number | undefined;
    let last_args: T | undefined;
    const throttled_fn = async (...args: T) => {
        if (timer === undefined) {
            await fn.call(throttled_fn, ...args);
            timer = setTimeout(() => {
                if (last_args !== undefined) {
                    fn.call(throttled_fn, ...last_args);
                }
                timer = undefined;
                last_args = undefined;
            }, wait);
        } else {
            last_args = args;
            return Promise.resolve();
        }
    };
    return throttled_fn;
}
