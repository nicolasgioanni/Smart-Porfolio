import { expect, type Locator } from "./browserTest";

type DetailOverlaySample = {
  cards: Array<{ bottom: number; height: number; top: number }>;
  resources: number[];
  rows: Array<{ height: number; top: number }>;
};

type DetailOverlaySelectors = {
  card: string;
  resource: string;
};

export async function getDetailOverlaySample(root: Locator, selectors: DetailOverlaySelectors): Promise<DetailOverlaySample> {
  return root.evaluate((element, options) => {
    const rootTop = element.getBoundingClientRect().top;
    const readRect = (candidate: Element) => {
      const rect = candidate.getBoundingClientRect();
      return {
        bottom: rect.bottom - rootTop,
        height: rect.height,
        top: rect.top - rootTop
      };
    };

    return {
      cards: Array.from(element.querySelectorAll(options.card)).map(readRect),
      resources: Array.from(element.querySelectorAll(options.resource)).map(
        (resource) => resource.getBoundingClientRect().top - rootTop
      ),
      rows: Array.from(element.querySelectorAll(".detail-section__trigger")).map((row) => {
        const rect = row.getBoundingClientRect();
        return { height: rect.height, top: rect.top - rootTop };
      })
    };
  }, selectors);
}

export async function sampleDetailOverlay(
  root: Locator,
  selectors: DetailOverlaySelectors,
  durationMs = 620
): Promise<DetailOverlaySample[]> {
  return root.evaluate(
    (element, options) =>
      new Promise<DetailOverlaySample[]>((resolve) => {
        const samples: DetailOverlaySample[] = [];
        const startedAt = performance.now();
        const readSample = () => {
          const rootTop = element.getBoundingClientRect().top;
          const readRect = (candidate: Element) => {
            const rect = candidate.getBoundingClientRect();
            return {
              bottom: rect.bottom - rootTop,
              height: rect.height,
              top: rect.top - rootTop
            };
          };

          return {
            cards: Array.from(element.querySelectorAll(options.selectors.card)).map(readRect),
            resources: Array.from(element.querySelectorAll(options.selectors.resource)).map(
              (resource) => resource.getBoundingClientRect().top - rootTop
            ),
            rows: Array.from(element.querySelectorAll(".detail-section__trigger")).map((row) => {
              const rect = row.getBoundingClientRect();
              return { height: rect.height, top: rect.top - rootTop };
            })
          };
        };

        const sample = () => {
          samples.push(readSample());

          if (performance.now() - startedAt >= options.durationMs) {
            resolve(samples);
            return;
          }

          window.requestAnimationFrame(sample);
        };

        window.requestAnimationFrame(sample);
      }),
    { durationMs, selectors }
  );
}

export async function settleDetailOverlayMotion(root: Locator) {
  await root.evaluate(async (element) => {
    const animatedElements = Array.from(
      element.querySelectorAll<HTMLElement>(
        ".experience-card-wrap, .experience-card, .experience-card__body, .research-project-wrap, .research-project, .research-project__body"
      )
    );

    await Promise.all(
      animatedElements.flatMap((animatedElement) =>
        animatedElement.getAnimations().map((animation) => animation.finished.catch(() => undefined))
      )
    );
  });
}

export async function settleDetailPanelMotion(panel: Locator) {
  await panel.evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished.catch(() => undefined)));
  });
}

export function expectStableDetailOverlay(
  samples: DetailOverlaySample[],
  expected: DetailOverlaySample,
  tolerance = 1
) {
  expect(samples.length).toBeGreaterThan(2);

  for (const sample of samples) {
    expect(sample.cards).toHaveLength(expected.cards.length);
    expect(sample.rows).toHaveLength(expected.rows.length);
    expect(sample.resources).toHaveLength(expected.resources.length);

    sample.cards.forEach((card, index) => {
      const expectedCard = expected.cards[index]!;
      expect(Math.abs(card.top - expectedCard.top)).toBeLessThanOrEqual(tolerance);
      expect(Math.abs(card.bottom - expectedCard.bottom)).toBeLessThanOrEqual(tolerance);
      expect(Math.abs(card.height - expectedCard.height)).toBeLessThanOrEqual(tolerance);
    });
    sample.rows.forEach((row, index) => {
      const expectedRow = expected.rows[index]!;
      expect(Math.abs(row.top - expectedRow.top)).toBeLessThanOrEqual(tolerance);
      expect(Math.abs(row.height - expectedRow.height)).toBeLessThanOrEqual(tolerance);
    });
    sample.resources.forEach((top, index) => {
      expect(Math.abs(top - expected.resources[index]!)).toBeLessThanOrEqual(tolerance);
    });
  }
}
