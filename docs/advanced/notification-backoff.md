---
title: Notification Backoff
icon: material/speedometer-slow
---

# Configure Notification Backoff

| Name                | Type     | Default            | Description                                          |
| ------------------- | -------- | ------------------ | ---------------------------------------------------- |
| `DOLCE_MIN_TIMEOUT` | `number` | `10`               | Minimum number of seconds between notifications      |
| `DOLCE_MAX_TIMEOUT` | `number` | `60*60*24` (1 day) | Maximum number of seconds between notifications      |
| `DOLCE_MULTIPLIER`  | `number` | `10`               | Multiplier to increase the timeout with each message |

The delay between notifications is calculated as $delay(n) = min(m * f ^ n, M)$ where $n$ is the current iteration of
the backoff algorithm.

If you assume you have a container that has a problem and repeatetly restarts every second starting $t=0$, you will
receive the following notifications with the default settings

| $n$ |        $delay$ |        |             $t$ | $t_n = t_(n-1) + delay$ |
| --- | -------------: | ------ | --------------: | ----------------------- |
| 1   |  $10 * 10 ^ 0$ | 10     |     $0 + delay$ | 10                      |
| 2   |  $10 * 10 ^ 1$ | 100    |    $10 + delay$ | 110                     |
| 3   |  $10 * 10 ^ 2$ | 1_000  |   $110 + delay$ | 1110                    |
| 4   |  $10 * 10 ^ 3$ | 10_000 |  $1110 + delay$ | 11110                   |
| 5   | $60 * 60 * 24$ | 86_400 | $11110 + delay$ | 97510                   |
| 6   | $60 * 60 * 24$ | 86_400 | $97510 + delay$ | 97510                   |

From this moment nothing changes anymore and you will receive a new message every 24h. $n$ wil be reset if the delay for
the next notification passes and no events happen that would require a new notification. This means: if you fix the
problem and everything is quiet for the next 24 hours and breaks again after that time, you will be notified within
`DOLCE_MIN_TIMEOUT` seconds again.
