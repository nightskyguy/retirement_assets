/* The feedback Worker's entry point. Every check it makes, the daily count, and the email it
   writes are in logic.cjs, which feedback.tests.js in the repo root covers on every commit. This
   file only supplies the pieces that exist on Cloudflare and nowhere else. Setup: ../README.md. */
import { EmailMessage } from 'cloudflare:email';
import { DurableObject } from 'cloudflare:workers';
import logic from './logic.cjs';

// One instance, named "daily", holds the day's count. A Durable Object handles one call at a time,
// so the count stays exact however many messages arrive together.
export class DailyCounter extends DurableObject {
    take(day, limit) {
        return logic.takeFromStore(this.ctx.storage, day, limit);
    }
}

export default {
    fetch(request, env) {
        return logic.handle(request, env, {
            EmailMessage,
            fetch: (url, init) => fetch(url, init),
            uuid: () => crypto.randomUUID(),
            now: () => new Date(),
        });
    },
};
