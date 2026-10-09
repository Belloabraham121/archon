import { Injectable } from '@nestjs/common';
import { JudgmentPriority } from './budget';

type Work = { priority: JudgmentPriority; run: () => Promise<void> };

/** In-process inference scheduler. Live work always drains before background,
 * and background work cannot occupy the final concurrency slot. */
@Injectable()
export class JudgmentPriorityQueue {
  private readonly live: Work[] = [];
  private readonly background: Work[] = [];
  private running = 0;
  private runningBackground = 0;

  constructor(private readonly concurrency = 4) {}

  enqueue<T>(priority: JudgmentPriority, job: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const work: Work = {
        priority,
        run: async () => {
          try { resolve(await job()); } catch (error) { reject(error); }
        },
      };
      (priority === 'live' ? this.live : this.background).push(work);
      this.drain();
    });
  }

  private drain() {
    while (this.running < this.concurrency) {
      const work = this.live.shift() ??
        (this.runningBackground < Math.max(1, this.concurrency - 1) ? this.background.shift() : undefined);
      if (!work) return;
      this.running += 1;
      if (work.priority === 'background') this.runningBackground += 1;
      void work.run().finally(() => {
        this.running -= 1;
        if (work.priority === 'background') this.runningBackground -= 1;
        this.drain();
      });
    }
  }
}
