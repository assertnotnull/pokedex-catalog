import { injectable } from "@needle-di/core";

@injectable()
export class Clock {
  now(): number {
    return Date.now();
  }
}
