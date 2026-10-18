import { connectDatabase, disconnectDatabase } from '../db/connect.js';
import { User } from '../models/User.js';
import { Roadmap } from '../models/Roadmap.js';
import { ModuleModel } from '../models/Module.js';
import { Topic } from '../models/Topic.js';
import { Task } from '../models/Task.js';
import { Enrollment } from '../models/Enrollment.js';
import { TaskProgress } from '../models/TaskProgress.js';
import { ActivityLog } from '../models/ActivityLog.js';
import { DailyActivity } from '../models/DailyActivity.js';
import { Achievement } from '../models/Achievement.js';
import { Notification } from '../models/Notification.js';
import { PasswordResetToken } from '../models/PasswordResetToken.js';
import { TaskSubmission } from '../models/TaskSubmission.js';

const models = [
  User,
  Roadmap,
  ModuleModel,
  Topic,
  Task,
  Enrollment,
  TaskProgress,
  ActivityLog,
  DailyActivity,
  Achievement,
  Notification,
  PasswordResetToken,
  TaskSubmission,
];

async function main() {
  await connectDatabase();
  for (const model of models) {
    await model.syncIndexes();
    console.log(`[indexes] synced ${model.modelName}`);
  }
  await disconnectDatabase();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
