
type ThrottledFunction<T extends Array<unknown>> = {
    (...args: T): void;
};

export function throttle<T extends Array<unknown>>(fn: (this: ThrottledFunction<T>, ...args: T) => void, wait: number): ThrottledFunction<T> {
    let timer: number | undefined;
    let last_args: T | undefined;
    const throttled_fn = (...args: T) => {
        if (timer === undefined) {
            fn.call(throttled_fn, ...args);
            timer = setTimeout(() => {
                if (last_args !== undefined) {
                    fn.call(throttled_fn, ...last_args);
                }
                timer = undefined;
                last_args = undefined;
            }, wait);
        } else {
            last_args = args;
        }
    };
    return throttled_fn;
}
