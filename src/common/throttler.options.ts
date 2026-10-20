import type { ThrottlerModuleOptions } from "@nestjs/throttler";

// ponytail: in-memory counters, per instance. Add a shared store (Redis) before running more than one instance.
export const throttlerOptions: ThrottlerModuleOptions = [{ ttl: 60_000, limit: 100 }];

export const LOGIN_THROTTLE = { default: { ttl: 60_000, limit: 5 } };
