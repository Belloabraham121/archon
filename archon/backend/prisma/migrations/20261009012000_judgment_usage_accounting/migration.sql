ALTER TABLE "Decision"
  ADD COLUMN "judgmentInputTokens" INTEGER,
  ADD COLUMN "judgmentOutputTokens" INTEGER,
  ADD COLUMN "judgmentCostUsd" DOUBLE PRECISION;
