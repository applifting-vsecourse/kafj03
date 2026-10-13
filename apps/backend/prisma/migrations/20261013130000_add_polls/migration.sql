-- CreateTable
CREATE TABLE "poll" (
    "id" TEXT NOT NULL,
    "quackId" TEXT NOT NULL,
    "question" VARCHAR(280) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revision" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "poll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poll_option" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "text" VARCHAR(100) NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "poll_option_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poll_vote" (
    "pollId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "poll_vote_pkey" PRIMARY KEY ("pollId","userId")
);

-- CreateTable
CREATE TABLE "poll_usage" (
    "pollId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstVotedAt" TIMESTAMP(3),

    CONSTRAINT "poll_usage_pkey" PRIMARY KEY ("pollId")
);

-- CreateTable
CREATE TABLE "poll_voter_usage" (
    "userId" TEXT NOT NULL,
    "firstVotedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "poll_voter_usage_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "poll_quackId_key" ON "poll"("quackId");

-- CreateIndex
CREATE UNIQUE INDEX "poll_option_pollId_id_key" ON "poll_option"("pollId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "poll_option_pollId_position_key" ON "poll_option"("pollId", "position");

-- CreateIndex
CREATE INDEX "poll_vote_pollId_optionId_idx" ON "poll_vote"("pollId", "optionId");

-- CreateIndex
CREATE INDEX "poll_vote_userId_idx" ON "poll_vote"("userId");

-- CreateIndex
CREATE INDEX "poll_usage_createdAt_idx" ON "poll_usage"("createdAt");

-- CreateIndex
CREATE INDEX "poll_voter_usage_firstVotedAt_idx" ON "poll_voter_usage"("firstVotedAt");

-- AddForeignKey
ALTER TABLE "poll" ADD CONSTRAINT "poll_quackId_fkey" FOREIGN KEY ("quackId") REFERENCES "quack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_option" ADD CONSTRAINT "poll_option_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_vote" ADD CONSTRAINT "poll_vote_pollId_optionId_fkey" FOREIGN KEY ("pollId", "optionId") REFERENCES "poll_option"("pollId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_vote" ADD CONSTRAINT "poll_vote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
