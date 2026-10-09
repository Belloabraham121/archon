-- AlterTable
ALTER TABLE "Decision" ADD COLUMN     "judgmentConfidence" DOUBLE PRECISION,
ADD COLUMN     "judgmentFallback" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "judgmentFallbackReason" TEXT,
ADD COLUMN     "judgmentLatencyMs" INTEGER,
ADD COLUMN     "judgmentModel" TEXT,
ADD COLUMN     "judgmentProvider" TEXT,
ADD COLUMN     "judgmentShadow" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "judgmentStrategy" TEXT;
