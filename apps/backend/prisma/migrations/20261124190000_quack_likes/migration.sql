CREATE TABLE "quack_like" (
  "quackId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  CONSTRAINT "quack_like_pkey" PRIMARY KEY ("quackId", "userId"),
  CONSTRAINT "quack_like_quackId_fkey"
    FOREIGN KEY ("quackId") REFERENCES "quack"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "quack_like_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "quack_like_userId_idx" ON "quack_like"("userId");
