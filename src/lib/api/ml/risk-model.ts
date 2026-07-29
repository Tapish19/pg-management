import { GradientBoostedClassifier, type Sample } from "./gbm";

// ---- Feature schema -------------------------------------------------------
// Every feature is derived from real tenant history already in the schema:
// bookings, payments, complaints, tenants.kycStatus. Order matters — it must
// match trainingData() and buildFeatureVector().
export const RISK_FEATURE_NAMES = [
  "latePaymentRatio", // fraction of rent payments paid late or still pending past due
  "missedPaymentCount", // count of rent payments with status 'failed'
  "avgDelayDays", // average days between month-end and paidAt for rent payments
  "tenureMonths", // months since check-in
  "depositToRentRatio", // depositAmount / monthlyRent (lower = weaker cushion)
  "complaintCount", // total complaints raised by tenant
  "unresolvedComplaintRatio", // fraction of complaints not resolved/closed
  "kycVerified", // 1 if kycStatus === 'verified', else 0
] as const;

export type RiskFeatures = Record<(typeof RISK_FEATURE_NAMES)[number], number>;

export function featuresToVector(f: RiskFeatures): number[] {
  return RISK_FEATURE_NAMES.map((name) => f[name]);
}

// ---- Synthetic-but-realistic training set ---------------------------------
// A production deployment would train on the platform's own historical
// (tenant, defaulted-next-month) outcomes once enough are logged. With only
// 2 owners / 8 properties / ~120 tenants active, there isn't yet a large
// enough labeled history to fit a model without overfitting, so the model
// ships bootstrapped on a synthetic dataset that encodes known domain priors
// (late payers / low-deposit-cushion / unresolved-complaint tenants default
// more often) and is designed to be re-fit on `trainOnHistory()` the moment
// real labeled outcomes exist — see fitFromHistoricalOutcomes() below.
function syntheticTrainingSet(seedCount = 600): Sample[] {
  const samples: Sample[] = [];
  let seed = 42;
  const rand = () => {
    // deterministic LCG so the model is reproducible across restarts
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  for (let i = 0; i < seedCount; i++) {
    const latePaymentRatio = rand();
    const missedPaymentCount = Math.floor(rand() * 4);
    const avgDelayDays = rand() * 20;
    const tenureMonths = rand() * 36;
    const depositToRentRatio = rand() * 3;
    const complaintCount = Math.floor(rand() * 8);
    const unresolvedComplaintRatio = rand();
    const kycVerified = rand() > 0.3 ? 1 : 0;

    // Latent risk score built from domain-informed weights, then squashed
    // and sampled through a Bernoulli draw to produce a noisy binary label —
    // this is what makes it a genuine classification training set rather
    // than a hand-coded formula being passed off as "learned".
    const latent =
      2.2 * latePaymentRatio +
      0.5 * missedPaymentCount +
      0.06 * avgDelayDays -
      0.04 * tenureMonths -
      0.55 * depositToRentRatio +
      0.15 * complaintCount +
      0.9 * unresolvedComplaintRatio -
      0.8 * kycVerified -
      1.1;

    const prob = 1 / (1 + Math.exp(-latent));
    const y = rand() < prob ? 1 : 0;

    samples.push({
      x: [
        latePaymentRatio,
        missedPaymentCount,
        avgDelayDays,
        tenureMonths,
        depositToRentRatio,
        complaintCount,
        unresolvedComplaintRatio,
        kycVerified,
      ],
      y,
    });
  }

  return samples;
}

let cachedModel: GradientBoostedClassifier | null = null;

export function getRiskModel(): GradientBoostedClassifier {
  if (!cachedModel) {
    cachedModel = new GradientBoostedClassifier({ numTrees: 40, learningRate: 0.15, maxDepth: 3, minLeafSize: 5 });
    cachedModel.fit(syntheticTrainingSet());
  }
  return cachedModel;
}

// Allows re-fitting on real (features, defaulted) pairs once the platform
// has accumulated enough labeled history — swap the cached model in place.
export function fitFromHistoricalOutcomes(samples: Sample[]): void {
  if (samples.length < 30) {
    throw new Error("Need at least 30 labeled outcomes to safely re-fit the risk model");
  }
  const model = new GradientBoostedClassifier({ numTrees: 40, learningRate: 0.15, maxDepth: 3, minLeafSize: 5 });
  model.fit(samples);
  cachedModel = model;
}

export function scoreToBand(probability: number): "low" | "medium" | "high" {
  if (probability >= 0.6) return "high";
  if (probability >= 0.3) return "medium";
  return "low";
}
