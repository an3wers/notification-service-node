// Cron job которая запускается при старте приложения и срабатывает раз в день
import { CronJob } from "cron";
import type { EmailCleanupJob } from "./jobs/email-cleanup.ts";

export class Scheduler {
  private readonly emailCleanupJob: EmailCleanupJob;

  private readonly tasks: CronJob[] = [];

  constructor(emailCleanupJob: EmailCleanupJob) {
    this.emailCleanupJob = emailCleanupJob;
  }

  initializeCronJobs(): void {
    // start soft and hard delete emails every day at 2:00 AM
    const emailCleanupJob = new CronJob(
      "0 2 * * *",
      async () => {
        await this.emailCleanupJob.softDeleteEmails();
        await this.emailCleanupJob.hardDeleteEmails();
      },
      null,
      true,
    );

    this.tasks.push(emailCleanupJob);

    // test cron job start every 10 seconds
    // const testCronJob = new CronJob(
    //   "*/10 * * * * *",
    //   async () => {
    //     console.log("Test cron job started");
    //   },
    //   null,
    //   true,
    // );

    // this.tasks.push(testCronJob);
  }

  stopAll() {
    this.tasks.forEach((task) => task.stop());
  }
}
