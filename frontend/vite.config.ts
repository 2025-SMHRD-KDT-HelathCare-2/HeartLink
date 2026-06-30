// vite.config.ts
// =============================================================================
// Vite 빌드 설정
//
// [번들/로딩 최적화 포인트]
//   1) visualizer: 빌드 후 "어떤 라이브러리가 번들을 얼마나 차지하는지"를
//      그림(treemap)으로 보여줍니다. (dist/stats.html)
//      → 최적화는 "추측"이 아니라 "측정"부터 하는 게 정석입니다.
//   2) manualChunks: 자주 안 바뀌는 큰 라이브러리(react, 차트, pdf 등)를
//      별도 파일(청크)로 분리합니다.
//      → 내 코드만 바뀌면 라이브러리 청크는 브라우저 캐시를 그대로 재사용해
//        재방문 시 다운로드가 줄어듭니다.
//
// [설치 필요]
//   npm i -D rollup-plugin-visualizer
// =============================================================================

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // 빌드(build) 시에만 동작. dist/stats.html 을 자동으로 엽니다.
    visualizer({
      filename: "dist/stats.html",
      open: true,        // 빌드 끝나면 브라우저로 분석 결과 자동 열기
      gzipSize: true,    // gzip 압축 기준 크기도 함께 표시
      brotliSize: true,  // brotli 압축 기준 크기도 함께 표시
    }),
  ],

  build: {
    // 청크 하나가 너무 크면 경고가 뜨는데, 그 기준(KB)을 살짝 올려둡니다.
    chunkSizeWarningLimit: 1000,

    rollupOptions: {
      output: {
        // -------------------------------------------------------------------
        // [수동 청크 분리]
        //   - node_modules 안의 큰 라이브러리들을 "용도별 파일"로 나눕니다.
        //   - 이렇게 하면 라이브러리는 거의 안 바뀌므로(=캐시 유지),
        //     내 소스만 수정해 배포해도 사용자는 라이브러리를 다시
        //     내려받지 않아 재방문 속도가 빨라집니다.
        // -------------------------------------------------------------------
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;

          // PDF 생성 관련(무겁고 특정 화면에서만 씀) → 별도 청크
          if (id.includes("jspdf") || id.includes("html2canvas")) {
            return "vendor-pdf";
          }
          // 차트 라이브러리(리포트/ECG 화면에서만 씀) → 별도 청크
          if (id.includes("recharts") || id.includes("d3")) {
            return "vendor-charts";
          }
          // 아이콘 묶음 → 별도 청크
          if (id.includes("lucide-react")) {
            return "vendor-icons";
          }
          // 라우터 → 별도 청크
          if (id.includes("react-router")) {
            return "vendor-router";
          }
          // 그 외 react 핵심 → 별도 청크
          if (id.includes("react") || id.includes("scheduler")) {
            return "vendor-react";
          }
          // 나머지 모든 라이브러리는 공통 vendor 로
          return "vendor";
        },
      },
    },
  },
});
