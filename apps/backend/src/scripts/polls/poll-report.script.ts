import { PrismaService } from '@/core/prisma/prisma.service';
import { generatePollReport, parseLaunchTime } from './poll-report';

async function main(): Promise<void> {
  const start = parseLaunchTime(process.argv[2]);
  if (process.argv.length !== 3)
    throw new Error('Usage: pnpm backend polls:report <launch-time-UTC>');
  const prisma = new PrismaService();
  try {
    await prisma.$connect();
    console.log(
      JSON.stringify(await generatePollReport(prisma, start), null, 2),
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : 'Could not generate poll report',
  );
  process.exitCode = 1;
});
