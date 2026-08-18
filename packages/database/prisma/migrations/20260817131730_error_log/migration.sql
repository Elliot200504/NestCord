-- CreateTable
CREATE TABLE "ErrorLog" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "detail" TEXT NOT NULL,
    "stack" TEXT,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ErrorLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ErrorLog_reference_key" ON "ErrorLog"("reference");

-- CreateIndex
CREATE INDEX "ErrorLog_createdAt_idx" ON "ErrorLog"("createdAt");
