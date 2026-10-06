CREATE TABLE "search_usage" (
  "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "day" DATE NOT NULL,
  "searched" BOOLEAN NOT NULL DEFAULT false,
  "opened" BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY ("userId", "day")
);
