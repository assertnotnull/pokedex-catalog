export abstract class Clock {
  abstract now(): number;
}

export class SystemClock extends Clock {
  now(): number {
    return Date.now();
  }
}

export class FixedClock extends Clock {
  constructor(private current: number) {
    super();
  }

  now(): number {
    return this.current;
  }

  advance(milliseconds: number): void {
    this.current += milliseconds;
  }
}
