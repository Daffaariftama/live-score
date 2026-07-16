import { EventEmitter } from "events";

const globalForEmitter = globalThis as unknown as {
  scoreEmitter: EventEmitter | undefined;
};

export const scoreEmitter = globalForEmitter.scoreEmitter ?? new EventEmitter();

if (process.env.NODE_ENV !== "production") {
  globalForEmitter.scoreEmitter = scoreEmitter;
}
