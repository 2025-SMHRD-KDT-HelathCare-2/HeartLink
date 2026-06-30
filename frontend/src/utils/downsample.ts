// src/utils/downsample.ts
// =============================================================================
// 큰 파형 데이터를 "화면에 보이는 만큼만" 줄여주는 다운샘플링 유틸
//
// [왜 필요한가요?]
//   - ECG 는 1초에 250개(250Hz) 점이 들어옵니다. 10초면 2,500개,
//     30초면 7,500개입니다.
//   - 그런데 그래프의 가로 폭은 보통 600~900픽셀밖에 안 됩니다.
//     점 2,500개를 900픽셀에 그리면, 픽셀 하나에 점이 여러 개 겹쳐
//     "눈에 보이지도 않는 점"까지 그리느라 느려집니다.
//   - 그래서 "모양은 거의 그대로 유지하면서 점 개수만 줄이는" 방법을 씁니다.
//
// [어떤 방법인가요? — LTTB]
//   - LTTB(Largest-Triangle-Three-Buckets)는 그래프 다운샘플링의 표준 기법입니다.
//   - 단순히 "몇 개 건너뛰기"가 아니라, 봉우리(R파처럼 뾰족한 부분)를
//     최대한 살리도록 "가장 면적이 큰 삼각형을 만드는 점"을 고릅니다.
//   - 덕분에 점을 크게 줄여도 심전도의 뾰족한 모양이 뭉개지지 않습니다.
// =============================================================================

export interface Point {
  x: number;
  y: number;
}

/**
 * LTTB 다운샘플링
 * @param data       원본 점 배열 (x 오름차순 가정)
 * @param threshold  목표 점 개수 (예: 화면 폭 픽셀 수 정도)
 * @returns          threshold 개수에 가깝게 줄인 점 배열
 */
export function lttbDownsample(data: Point[], threshold: number): Point[] {
  const n = data.length;

  // 줄일 필요가 없으면(이미 충분히 작으면) 원본 그대로 돌려줍니다.
  if (threshold >= n || threshold <= 2) return data;

  const sampled: Point[] = [];

  // 첫 점은 항상 포함합니다.
  sampled.push(data[0]);

  // 가운데 점들을 담을 "버킷(구간)"의 크기.
  // (처음과 끝 점을 빼고 나머지를 threshold-2 개의 구간으로 나눕니다.)
  const bucketSize = (n - 2) / (threshold - 2);

  let a = 0; // 직전에 선택된 점의 인덱스

  for (let i = 0; i < threshold - 2; i++) {
    // 다음 버킷의 평균 좌표(삼각형의 세 번째 꼭짓점 후보)를 구합니다.
    let avgX = 0;
    let avgY = 0;
    let avgStart = Math.floor((i + 1) * bucketSize) + 1;
    let avgEnd = Math.floor((i + 2) * bucketSize) + 1;
    avgEnd = avgEnd < n ? avgEnd : n;

    const avgCount = avgEnd - avgStart;
    for (; avgStart < avgEnd; avgStart++) {
      avgX += data[avgStart].x;
      avgY += data[avgStart].y;
    }
    avgX /= avgCount;
    avgY /= avgCount;

    // 현재 버킷 안에서 "가장 큰 삼각형"을 만드는 점을 찾습니다.
    let rangeStart = Math.floor(i * bucketSize) + 1;
    const rangeEnd = Math.floor((i + 1) * bucketSize) + 1;

    const pointA = data[a];
    let maxArea = -1;
    let nextA = rangeStart;

    for (; rangeStart < rangeEnd; rangeStart++) {
      // 삼각형 면적(절댓값) — 클수록 모양을 잘 대표하는 점입니다.
      const area = Math.abs(
        (pointA.x - avgX) * (data[rangeStart].y - pointA.y) -
        (pointA.x - data[rangeStart].x) * (avgY - pointA.y)
      ) * 0.5;

      if (area > maxArea) {
        maxArea = area;
        nextA = rangeStart;
      }
    }

    sampled.push(data[nextA]); // 선택된 점 추가
    a = nextA;                 // 다음 계산의 기준점으로 삼음
  }

  // 마지막 점도 항상 포함합니다.
  sampled.push(data[n - 1]);

  return sampled;
}
