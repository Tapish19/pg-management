// Minimal gradient boosting classifier implemented from scratch (no external ML deps).
// Trains an ensemble of shallow regression trees on the negative gradient of the
// binomial log-loss (standard GBM-for-classification formulation), the same
// approach used by libraries like XGBoost / LightGBM / GradientBoostingClassifier,
// just without the C++ engine underneath.

export type Sample = { x: number[]; y: number };

type StumpNode = {
  featureIndex: number;
  threshold: number;
  left: number; // predicted value if x[featureIndex] <= threshold
  right: number; // predicted value if x[featureIndex] > threshold
};

// A depth-limited regression tree (CART) fit on residuals.
class RegressionTree {
  private root: TreeNode;

  constructor(x: number[][], residuals: number[], maxDepth: number, minLeafSize: number) {
    const indices = x.map((_, i) => i);
    this.root = this.buildNode(x, residuals, indices, maxDepth, minLeafSize);
  }

  private buildNode(
    x: number[][],
    residuals: number[],
    indices: number[],
    depth: number,
    minLeafSize: number
  ): TreeNode {
    const mean = indices.reduce((s, i) => s + residuals[i], 0) / indices.length;

    if (depth === 0 || indices.length < minLeafSize * 2) {
      return { isLeaf: true, value: mean };
    }

    const split = this.bestSplit(x, residuals, indices, minLeafSize);
    if (!split) {
      return { isLeaf: true, value: mean };
    }

    const leftIdx = indices.filter((i) => x[i][split.featureIndex] <= split.threshold);
    const rightIdx = indices.filter((i) => x[i][split.featureIndex] > split.threshold);

    return {
      isLeaf: false,
      featureIndex: split.featureIndex,
      threshold: split.threshold,
      left: this.buildNode(x, residuals, leftIdx, depth - 1, minLeafSize),
      right: this.buildNode(x, residuals, rightIdx, depth - 1, minLeafSize),
    };
  }

  // Exhaustive split search minimizing sum of squared errors (variance reduction).
  private bestSplit(
    x: number[][],
    residuals: number[],
    indices: number[],
    minLeafSize: number
  ): { featureIndex: number; threshold: number } | null {
    const numFeatures = x[0].length;
    let best: { featureIndex: number; threshold: number; sse: number } | null = null;

    for (let f = 0; f < numFeatures; f++) {
      const values = Array.from(new Set(indices.map((i) => x[i][f]))).sort((a, b) => a - b);
      for (let t = 0; t < values.length - 1; t++) {
        const threshold = (values[t] + values[t + 1]) / 2;
        const leftIdx = indices.filter((i) => x[i][f] <= threshold);
        const rightIdx = indices.filter((i) => x[i][f] > threshold);
        if (leftIdx.length < minLeafSize || rightIdx.length < minLeafSize) continue;

        const sse = this.sseOf(leftIdx, residuals) + this.sseOf(rightIdx, residuals);
        if (!best || sse < best.sse) {
          best = { featureIndex: f, threshold, sse };
        }
      }
    }

    return best ? { featureIndex: best.featureIndex, threshold: best.threshold } : null;
  }

  private sseOf(indices: number[], residuals: number[]): number {
    if (indices.length === 0) return 0;
    const mean = indices.reduce((s, i) => s + residuals[i], 0) / indices.length;
    return indices.reduce((s, i) => s + (residuals[i] - mean) ** 2, 0);
  }

  predict(row: number[]): number {
    let node = this.root;
    while (!node.isLeaf) {
      node = row[node.featureIndex] <= node.threshold ? node.left : node.right;
    }
    return node.value;
  }
}

type TreeNode =
  | { isLeaf: true; value: number }
  | { isLeaf: false; featureIndex: number; threshold: number; left: TreeNode; right: TreeNode };

export interface GBMConfig {
  numTrees: number;
  learningRate: number;
  maxDepth: number;
  minLeafSize: number;
}

const DEFAULT_CONFIG: GBMConfig = {
  numTrees: 40,
  learningRate: 0.15,
  maxDepth: 3,
  minLeafSize: 3,
};

function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z));
}

// Gradient Boosted binary classifier: additive ensemble of regression trees
// fit stage-wise on the negative gradient of log-loss, exactly the classic
// "Gradient Boosting Machine" recipe (Friedman, 2001).
export class GradientBoostedClassifier {
  private trees: RegressionTree[] = [];
  private initLogOdds = 0;
  private config: GBMConfig;

  constructor(config: Partial<GBMConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  fit(samples: Sample[]): void {
    const x = samples.map((s) => s.x);
    const y = samples.map((s) => s.y);
    const n = y.length;

    const positiveRate = Math.min(Math.max(y.reduce((a, b) => a + b, 0) / n, 1e-6), 1 - 1e-6);
    this.initLogOdds = Math.log(positiveRate / (1 - positiveRate));

    let predictions = new Array(n).fill(this.initLogOdds);

    for (let t = 0; t < this.config.numTrees; t++) {
      const probs = predictions.map(sigmoid);
      const residuals = y.map((yi, i) => yi - probs[i]); // negative gradient of log-loss

      const tree = new RegressionTree(x, residuals, this.config.maxDepth, this.config.minLeafSize);
      this.trees.push(tree);

      predictions = predictions.map((p, i) => p + this.config.learningRate * tree.predict(x[i]));
    }
  }

  predictProba(row: number[]): number {
    let logOdds = this.initLogOdds;
    for (const tree of this.trees) {
      logOdds += this.config.learningRate * tree.predict(row);
    }
    return sigmoid(logOdds);
  }

  toJSON() {
    return { trees: this.trees, initLogOdds: this.initLogOdds, config: this.config };
  }
}
