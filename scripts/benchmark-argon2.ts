/**
 * Argon2id parameter benchmark for the password-hashing migration.
 *
 * Usage:
 *   pnpm exec ts-node scripts/benchmark-argon2.ts
 *
 * Measures hash and verify latency for candidate parameter sets plus a
 * concurrent throughput sample under the production configuration, and prints
 * a small report. Results are documented in docs/password-hashing.md.
 */
import * as argon2 from 'argon2';
import * as bcrypt from 'bcrypt';

const PASSWORD = 'CorrectHorseBatteryStaple!2026';

interface Candidate {
  label: string;
  memoryCost: number;
  timeCost: number;
  parallelism: number;
  hashLength: number;
}

const CANDIDATES: Candidate[] = [
  {
    label: 'production (m=65536, t=3, p=4)',
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
    hashLength: 32
  },
  {
    label: 'OWASP-minimum (m=19456, t=2, p=1)',
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
    hashLength: 32
  },
  {
    label: 'test-env (m=8192, t=1, p=1)',
    memoryCost: 8192,
    timeCost: 1,
    parallelism: 1,
    hashLength: 32
  }
];

function options(candidate: Candidate): argon2.HashOptions {
  return {
    type: argon2.argon2id,
    memoryCost: candidate.memoryCost,
    timeCost: candidate.timeCost,
    parallelism: candidate.parallelism,
    hashLength: candidate.hashLength
  };
}

function stats(samples: number[]): { min: number; p50: number; p95: number } {
  const sorted = [...samples].sort((a, b) => a - b);
  const p = (q: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];

  return {
    min: sorted[0],
    p50: p(0.5),
    p95: p(0.95)
  };
}

function fmt(ms: number): string {
  return `${ms.toFixed(1)} ms`;
}

async function measureHash(
  candidate: Candidate,
  iterations = 7
): Promise<void> {
  await argon2.hash(PASSWORD, options(candidate));

  const samples: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await argon2.hash(PASSWORD, options(candidate));
    samples.push(performance.now() - start);
  }

  const { min, p50, p95 } = stats(samples);
  console.log(
    `  hash    min=${fmt(min)} p50=${fmt(p50)} p95=${fmt(p95)} (n=${iterations})`
  );
}

async function measureVerify(
  candidate: Candidate,
  iterations = 7
): Promise<void> {
  const digest = await argon2.hash(PASSWORD, options(candidate));
  await argon2.verify(digest, PASSWORD);

  const samples: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await argon2.verify(digest, PASSWORD);
    samples.push(performance.now() - start);
  }

  const { min, p50, p95 } = stats(samples);
  console.log(
    `  verify  min=${fmt(min)} p50=${fmt(p50)} p95=${fmt(p95)} (n=${iterations})`
  );
}

async function measureConcurrentHash(candidate: Candidate): Promise<void> {
  const count = 16;
  const start = performance.now();

  await Promise.all(
    Array.from({ length: count }, () =>
      argon2.hash(PASSWORD, options(candidate))
    )
  );

  const total = performance.now() - start;
  const perOp = total / count;

  console.log(
    `  concurrent (${count} parallel hashes) total=${fmt(total)} avg=${fmt(perOp)}`
  );
}

async function measureBcryptBaseline(): Promise<void> {
  await bcrypt.hash(PASSWORD, 10);

  const samples: number[] = [];
  for (let i = 0; i < 7; i++) {
    const start = performance.now();
    await bcrypt.hash(PASSWORD, 10);
    samples.push(performance.now() - start);
  }

  const { min, p50, p95 } = stats(samples);
  console.log(
    `  bcrypt cost 10 (legacy baseline) hash min=${fmt(min)} p50=${fmt(p50)} p95=${fmt(p95)}`
  );
}

async function main(): Promise<void> {
  console.log(
    `Benchmarking Argon2id (${process.version}, ${process.platform})\n`
  );

  for (const candidate of CANDIDATES) {
    console.log(candidate.label);
    await measureHash(candidate);
    await measureVerify(candidate);
    console.log();
  }

  console.log('Concurrency under production parameters:');
  await measureConcurrentHash(CANDIDATES[0]);
  console.log();

  console.log('Legacy baseline:');
  await measureBcryptBaseline();
  console.log();

  console.log(
    'Peak memory per concurrent hash: production config allocates 64 MiB per hash.'
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
