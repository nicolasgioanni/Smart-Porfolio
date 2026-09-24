import { expect, type Locator, type Page } from "./browserTest";
import { settleDetailPanelMotion } from "./detailOverlay";

type OutlineFrame = {
  firstSection: boolean;
  ownSeparatorOpacity: number;
  panelOpacity: number;
  precedingOwner: "list" | "previous";
  precedingSeparatorOpacity: number;
  precedingSeparatorY: number;
  sideBottomY: number;
  sideOpacity: number;
  sideScale: number;
  sideTransformOriginY: number;
  sideUsedHeight: number;
  topOpacity: number;
  topStrokeY: number;
  topTransform: string;
  triggerPaddingBottomY: number;
};

type OutlineAction = "open" | "close";
type EarlyCloseSample = { closing: OutlineFrame[]; opening: OutlineFrame[] };
type AdjacentSwitchFrame = { first: OutlineFrame; second: OutlineFrame };

const opacityTolerance = 0.08;
const geometryTolerance = 0.25;

function selectedIndexes(count: number) {
  return [...new Set([0, Math.floor((count - 1) / 2), count - 1])];
}

function expectOutlineGeometry(frames: OutlineFrame[], minimumFrames = 3) {
  expect(frames.length).toBeGreaterThanOrEqual(minimumFrames);
  for (const frame of frames) {
    expect(Math.abs(frame.topStrokeY - frame.precedingSeparatorY)).toBeLessThanOrEqual(geometryTolerance);
    expect(Math.abs(frame.sideTransformOriginY - frame.sideUsedHeight)).toBeLessThanOrEqual(geometryTolerance);
    expect(Math.abs(frame.sideBottomY - frame.triggerPaddingBottomY)).toBeLessThanOrEqual(geometryTolerance);
    expect(frame.topTransform).toBe("none");
  }
}

function expectComplementaryOpacity(frames: OutlineFrame[]) {
  for (const frame of frames) {
    expect(Math.abs(frame.topOpacity + frame.precedingSeparatorOpacity - 1)).toBeLessThanOrEqual(opacityTolerance);
    expect(Math.abs(frame.sideOpacity + frame.precedingSeparatorOpacity - 1)).toBeLessThanOrEqual(opacityTolerance);
  }
}

function expectMonotonicScale(frames: OutlineFrame[], direction: "increasing" | "decreasing") {
  const values = frames.map((frame) => frame.sideScale);
  expect(values.some((value, index) => index > 0 && (direction === "increasing" ? value > values[index - 1]! + 0.02 : value < values[index - 1]! - 0.02))).toBe(true);
  for (let index = 1; index < values.length; index += 1) {
    expect(direction === "increasing" ? values[index]! >= values[index - 1]! - 0.002 : values[index]! <= values[index - 1]! + 0.002).toBe(true);
  }
}

function expectIntermediateOpening(frames: OutlineFrame[]) {
  const last = frames.at(-1)!;
  expectOutlineGeometry(frames);
  expectComplementaryOpacity(frames);
  expect(frames.some((frame) => frame.topOpacity > 0.02 && frame.topOpacity < 0.98)).toBe(true);
  expect(frames.some((frame) => frame.sideOpacity > 0.02 && frame.sideOpacity < 0.98)).toBe(true);
  expect(frames.some((frame) => frame.sideScale > 0.02 && frame.sideScale < 0.98)).toBe(true);
  expectMonotonicScale(frames, "increasing");
  expect(last.topOpacity).toBeGreaterThan(0.98);
  expect(last.sideOpacity).toBeGreaterThan(0.98);
  expect(last.sideScale).toBeGreaterThan(0.98);
  expect(last.precedingSeparatorOpacity).toBeLessThan(0.02);
  expect(last.ownSeparatorOpacity).toBeLessThan(0.02);
}

function expectPartialOpening(frames: OutlineFrame[]) {
  expect(frames.length).toBeGreaterThan(0);
  expectOutlineGeometry(frames, 1);
  expectComplementaryOpacity(frames);
  expect(frames.some((frame) => frame.topOpacity > 0.02 && frame.topOpacity < 0.98)).toBe(true);
  expect(frames.some((frame) => frame.sideScale > 0.02 && frame.sideScale < 0.98)).toBe(true);
}

function expectClosingRecovery(frames: OutlineFrame[]) {
  const last = frames.at(-1)!;
  expectOutlineGeometry(frames);
  expectComplementaryOpacity(frames);
  expect(frames.some((frame) => frame.topOpacity > 0.02 && frame.topOpacity < 0.98)).toBe(true);
  expect(frames.some((frame) => frame.sideOpacity > 0.02 && frame.sideOpacity < 0.98)).toBe(true);
  expect(frames.some((frame) => frame.sideScale > 0.02 && frame.sideScale < 0.98)).toBe(true);
  expectMonotonicScale(frames, "decreasing");
  expect(last.panelOpacity).toBeLessThan(0.02);
  expect(last.topOpacity).toBeLessThan(0.02);
  expect(last.sideOpacity).toBeLessThan(0.02);
  expect(last.sideScale).toBeLessThan(0.02);
  expect(last.precedingSeparatorOpacity).toBeGreaterThan(0.98);
  expect(last.ownSeparatorOpacity).toBeGreaterThan(0.98);
  const panelFadedFrames = frames.filter((frame) => frame.panelOpacity <= 0.01);
  expect(panelFadedFrames.length).toBeGreaterThan(0);
  expect(panelFadedFrames.every((frame) => frame.topOpacity <= 0.01 && frame.sideOpacity <= 0.01)).toBe(true);
}

async function sampleOutline(trigger: Locator, action: OutlineAction, duration = 380): Promise<OutlineFrame[]> {
  return trigger.evaluate(
    (element, options) =>
      new Promise<OutlineFrame[]>((resolve) => {
        if (!(element instanceof HTMLButtonElement)) throw new Error("A detail outline needs a button trigger.");
        const button = element;
        const section = button.parentElement;
        const panel = button.nextElementSibling;
        const list = section?.parentElement;
        if (!(section instanceof HTMLElement) || !(panel instanceof HTMLElement) || !(list instanceof HTMLElement)) throw new Error("A detail outline needs its section, panel, and list.");
        const number = (value: string) => Number.parseFloat(value) || 0;
        const read = (): OutlineFrame => {
          const top = getComputedStyle(button, "::before");
          const sides = getComputedStyle(button, "::after");
          const owner = section.previousElementSibling ?? list;
          const ownerRect = owner.getBoundingClientRect();
          const buttonRect = button.getBoundingClientRect();
          const ownerBefore = getComputedStyle(owner, "::before");
          const buttonStyle = getComputedStyle(button);
          const ownerStyle = getComputedStyle(owner);
          const containingTop = buttonRect.top + number(buttonStyle.borderTopWidth);
          const containingBottom = buttonRect.bottom - number(buttonStyle.borderBottomWidth);
          const separatorPaddingTop = ownerRect.top + number(ownerStyle.borderTopWidth);
          const separatorPaddingBottom = ownerRect.bottom - number(ownerStyle.borderBottomWidth);
          const separatorTop = owner === list
            ? separatorPaddingTop + number(ownerBefore.top)
            : separatorPaddingBottom - number(ownerBefore.bottom) - number(ownerBefore.height);
          const separatorBottom = separatorTop + number(ownerBefore.height);
          const sideTop = containingTop + number(sides.top);
          const sideBottom = containingBottom - number(sides.bottom);
          const origin = sides.transformOrigin.split(" ").map(number);
          const matrix = new DOMMatrix(sides.transform === "none" ? undefined : sides.transform);
          return {
            firstSection: section.matches(":first-child"),
            ownSeparatorOpacity: number(getComputedStyle(section, "::before").opacity),
            panelOpacity: number(getComputedStyle(panel).opacity),
            precedingOwner: owner === list ? "list" : "previous",
            precedingSeparatorOpacity: number(ownerBefore.opacity),
            precedingSeparatorY: (separatorTop + separatorBottom) / 2,
            sideBottomY: sideTop + matrix.m42 + origin[1]! + (sideBottom - sideTop - origin[1]!) * matrix.m22,
            sideOpacity: number(sides.opacity),
            sideScale: matrix.m22,
            sideTransformOriginY: origin[1]!,
            sideUsedHeight: sideBottom - sideTop,
            topOpacity: number(top.opacity),
            topStrokeY: containingTop + number(top.top) + number(top.borderTopWidth) / 2,
            topTransform: top.transform,
            triggerPaddingBottomY: containingBottom
          };
        };
        const frames: OutlineFrame[] = [];
        const startedAt = performance.now();
        const capture = () => {
          frames.push(read());
          if (performance.now() - startedAt >= options.duration) resolve(frames);
          else window.requestAnimationFrame(capture);
        };
        if (options.action === "open" ? button.getAttribute("aria-expanded") === "false" : button.getAttribute("aria-expanded") === "true") button.click();
        window.requestAnimationFrame(capture);
      }),
    { action, duration }
  );
}

async function sampleEarlyClose(trigger: Locator, duration = 380): Promise<EarlyCloseSample> {
  return trigger.evaluate(
    (element, closeDuration) =>
      new Promise<EarlyCloseSample>((resolve, reject) => {
        if (!(element instanceof HTMLButtonElement)) throw new Error("A detail outline needs a button trigger.");
        const button = element;
        const section = button.parentElement;
        const panel = button.nextElementSibling;
        const list = section?.parentElement;
        if (!(section instanceof HTMLElement) || !(panel instanceof HTMLElement) || !(list instanceof HTMLElement)) throw new Error("A detail outline needs its section, panel, and list.");
        const number = (value: string) => Number.parseFloat(value) || 0;
        const read = (): OutlineFrame => {
          const top = getComputedStyle(button, "::before");
          const sides = getComputedStyle(button, "::after");
          const owner = section.previousElementSibling ?? list;
          const ownerRect = owner.getBoundingClientRect();
          const buttonRect = button.getBoundingClientRect();
          const ownerBefore = getComputedStyle(owner, "::before");
          const buttonStyle = getComputedStyle(button);
          const ownerStyle = getComputedStyle(owner);
          const containingTop = buttonRect.top + number(buttonStyle.borderTopWidth);
          const containingBottom = buttonRect.bottom - number(buttonStyle.borderBottomWidth);
          const separatorPaddingTop = ownerRect.top + number(ownerStyle.borderTopWidth);
          const separatorPaddingBottom = ownerRect.bottom - number(ownerStyle.borderBottomWidth);
          const separatorTop = owner === list
            ? separatorPaddingTop + number(ownerBefore.top)
            : separatorPaddingBottom - number(ownerBefore.bottom) - number(ownerBefore.height);
          const separatorBottom = separatorTop + number(ownerBefore.height);
          const sideTop = containingTop + number(sides.top);
          const sideBottom = containingBottom - number(sides.bottom);
          const origin = sides.transformOrigin.split(" ").map(number);
          const matrix = new DOMMatrix(sides.transform === "none" ? undefined : sides.transform);
          return {
            firstSection: section.matches(":first-child"), ownSeparatorOpacity: number(getComputedStyle(section, "::before").opacity), panelOpacity: number(getComputedStyle(panel).opacity), precedingOwner: owner === list ? "list" : "previous", precedingSeparatorOpacity: number(ownerBefore.opacity), precedingSeparatorY: (separatorTop + separatorBottom) / 2, sideBottomY: sideTop + matrix.m42 + origin[1]! + (sideBottom - sideTop - origin[1]!) * matrix.m22, sideOpacity: number(sides.opacity), sideScale: matrix.m22, sideTransformOriginY: origin[1]!, sideUsedHeight: sideBottom - sideTop, topOpacity: number(top.opacity), topStrokeY: containingTop + number(top.top) + number(top.borderTopWidth) / 2, topTransform: top.transform, triggerPaddingBottomY: containingBottom
          };
        };
        const opening: OutlineFrame[] = [];
        const closing: OutlineFrame[] = [];
        let closeStartedAt: number | undefined;
        let openingFrames = 0;
        const capture = () => {
          const frame = read();
          if (closeStartedAt === undefined) {
            opening.push(frame);
            openingFrames += 1;
            if (frame.topOpacity > 0.02 && frame.topOpacity < 0.98 && frame.sideScale > 0.02 && frame.sideScale < 0.98) {
              closeStartedAt = performance.now();
              button.click();
            } else if (openingFrames > 60) {
              reject(new Error("The disclosure did not expose a partial opening frame."));
              return;
            }
          } else {
            closing.push(frame);
            if (performance.now() - closeStartedAt >= closeDuration) return resolve({ closing, opening });
          }
          window.requestAnimationFrame(capture);
        };
        if (button.getAttribute("aria-expanded") !== "false") throw new Error("Early close must begin from a closed disclosure.");
        button.click();
        window.requestAnimationFrame(capture);
      }),
    duration
  );
}

async function sampleAdjacentSwitch(second: Locator, duration = 380): Promise<AdjacentSwitchFrame[]> {
  return second.evaluate(
    (element, sampleDuration) =>
      new Promise<AdjacentSwitchFrame[]>((resolve) => {
        if (!(element instanceof HTMLButtonElement)) throw new Error("A detail outline needs a button trigger.");
        const secondButton = element;
        const secondSection = secondButton.parentElement;
        const firstSection = secondSection?.previousElementSibling;
        const firstButton = firstSection?.querySelector("button.detail-section__trigger");
        if (!(firstButton instanceof HTMLButtonElement) || !(firstSection instanceof HTMLElement) || !(secondSection instanceof HTMLElement)) throw new Error("Adjacent disclosure controls are missing.");
        const read = (button: HTMLButtonElement): OutlineFrame => {
          const section = button.parentElement!;
          const panel = button.nextElementSibling!;
          const list = section.parentElement!;
          const number = (value: string) => Number.parseFloat(value) || 0;
          const top = getComputedStyle(button, "::before");
          const sides = getComputedStyle(button, "::after");
          const owner = section.previousElementSibling ?? list;
          const ownerRect = owner.getBoundingClientRect();
          const buttonRect = button.getBoundingClientRect();
          const ownerBefore = getComputedStyle(owner, "::before");
          const buttonStyle = getComputedStyle(button);
          const ownerStyle = getComputedStyle(owner);
          const containingTop = buttonRect.top + number(buttonStyle.borderTopWidth);
          const containingBottom = buttonRect.bottom - number(buttonStyle.borderBottomWidth);
          const separatorPaddingTop = ownerRect.top + number(ownerStyle.borderTopWidth);
          const separatorPaddingBottom = ownerRect.bottom - number(ownerStyle.borderBottomWidth);
          const separatorTop = owner === list
            ? separatorPaddingTop + number(ownerBefore.top)
            : separatorPaddingBottom - number(ownerBefore.bottom) - number(ownerBefore.height);
          const separatorBottom = separatorTop + number(ownerBefore.height);
          const sideTop = containingTop + number(sides.top);
          const sideBottom = containingBottom - number(sides.bottom);
          const origin = sides.transformOrigin.split(" ").map(number);
          const matrix = new DOMMatrix(sides.transform === "none" ? undefined : sides.transform);
          return {
            firstSection: section.matches(":first-child"), ownSeparatorOpacity: number(getComputedStyle(section, "::before").opacity), panelOpacity: number(getComputedStyle(panel).opacity), precedingOwner: owner === list ? "list" : "previous", precedingSeparatorOpacity: number(ownerBefore.opacity), precedingSeparatorY: (separatorTop + separatorBottom) / 2, sideBottomY: sideTop + matrix.m42 + origin[1]! + (sideBottom - sideTop - origin[1]!) * matrix.m22, sideOpacity: number(sides.opacity), sideScale: matrix.m22, sideTransformOriginY: origin[1]!, sideUsedHeight: sideBottom - sideTop, topOpacity: number(top.opacity), topStrokeY: containingTop + number(top.top) + number(top.borderTopWidth) / 2, topTransform: top.transform, triggerPaddingBottomY: containingBottom
          };
        };
        const frames: AdjacentSwitchFrame[] = [];
        const startedAt = performance.now();
        const capture = () => {
          frames.push({ first: read(firstButton), second: read(secondButton) });
          if (performance.now() - startedAt >= sampleDuration) resolve(frames);
          else window.requestAnimationFrame(capture);
        };
        secondButton.click();
        window.requestAnimationFrame(capture);
      }),
    duration
  );
}

async function findAdjacentExpandablePair(triggers: Locator): Promise<[Locator, Locator] | undefined> {
  for (let index = 0; index < (await triggers.count()) - 1; index += 1) {
    const first = triggers.nth(index);
    const second = first.locator("..").locator("+ .detail-section button.detail-section__trigger");
    if (await second.count()) return [first, second];
  }
  return undefined;
}

async function expectEarlyCloseCycle(trigger: Locator) {
  const section = trigger.locator("..");
  const sample = await sampleEarlyClose(trigger);
  expectPartialOpening(sample.opening);
  expectClosingRecovery(sample.closing);
  await expect(section).toHaveAttribute("data-visual-state", "closed");
}

async function expectRapidReopen(trigger: Locator) {
  const section = trigger.locator("..");
  const panelId = await trigger.getAttribute("aria-controls");
  if (!panelId) throw new Error("The rapid-reopen disclosure needs an aria-controls target.");
  const panel = trigger.page().locator(`#${panelId}`);
  await trigger.click();
  await expect(section).toHaveAttribute("data-visual-state", "open");
  await settleDetailPanelMotion(panel);
  const closing = await sampleOutline(trigger, "close", 120);
  expect(closing.some((frame) => frame.topOpacity > 0.02 && frame.topOpacity < 0.98 && frame.sideOpacity > 0.02 && frame.sideOpacity < 0.98 && frame.sideScale > 0.02 && frame.sideScale < 0.98)).toBe(true);
  const reopening = await sampleOutline(trigger, "open", 380);
  const last = reopening.at(-1)!;
  expectOutlineGeometry(reopening);
  expect(reopening.some((frame) => frame.topOpacity < 0.98 && frame.sideOpacity < 0.98)).toBe(true);
  expect(last.topOpacity).toBeGreaterThan(0.98);
  expect(last.sideOpacity).toBeGreaterThan(0.98);
  expect(last.sideScale).toBeGreaterThan(0.98);
  expect(last.precedingSeparatorOpacity).toBeLessThan(0.02);
  expect(last.ownSeparatorOpacity).toBeLessThan(0.02);
  await expect(section).toHaveAttribute("data-visual-state", "open");
  expectClosingRecovery(await sampleOutline(trigger, "close"));
  await expect(section).toHaveAttribute("data-visual-state", "closed");
}

async function expectAdjacentSwitch(triggers: Locator) {
  const pair = await findAdjacentExpandablePair(triggers);
  if (!pair) return;
  const [first, second] = pair;
  const firstPanelId = await first.getAttribute("aria-controls");
  const secondPanelId = await second.getAttribute("aria-controls");
  if (!firstPanelId || !secondPanelId) throw new Error("Adjacent disclosures need panel ids.");
  const firstPanel = first.page().locator(`#${firstPanelId}`);
  const secondPanel = second.page().locator(`#${secondPanelId}`);
  await first.click();
  await settleDetailPanelMotion(firstPanel);
  const frames = await sampleAdjacentSwitch(second);
  const last = frames.at(-1)!;
  expect(frames.length).toBeGreaterThan(2);
  expect(last.first.topOpacity).toBeLessThan(0.02);
  expect(last.first.sideOpacity).toBeLessThan(0.02);
  expect(last.second.topOpacity).toBeGreaterThan(0.98);
  expect(last.second.sideOpacity).toBeGreaterThan(0.98);
  expect(last.second.sideScale).toBeGreaterThan(0.98);
  expect(frames.every((frame) => frame.first.ownSeparatorOpacity <= 0.02)).toBe(true);
  await expect(first).toHaveAttribute("aria-expanded", "false");
  await expect(second).toHaveAttribute("aria-expanded", "true");
  await settleDetailPanelMotion(secondPanel);
  expectClosingRecovery(await sampleOutline(second, "close"));
  await expect(second.locator("..")).toHaveAttribute("data-visual-state", "closed");
}

export async function expectDetailOutlineMotion(page: Page, cardSelector: string): Promise<boolean> {
  const lists = page.locator(`${cardSelector} .detail-list`);
  let selectedList: Locator | undefined;
  let largestCount = 0;
  for (let index = 0; index < (await lists.count()); index += 1) {
    const list = lists.nth(index);
    const count = await list.locator("button.detail-section__trigger").count();
    if (count > largestCount) {
      largestCount = count;
      selectedList = list;
    }
  }
  if (!selectedList) return false;
  const triggers = selectedList.locator("button.detail-section__trigger");
  const count = await triggers.count();
  const beginsExpandable = await triggers.first().locator("..").evaluate((section) => section.matches(":first-child"));
  const separatorOwners = new Set<OutlineFrame["precedingOwner"]>();
  for (const index of selectedIndexes(count)) {
    const trigger = triggers.nth(index);
    const section = trigger.locator("..");
    const opening = await sampleOutline(trigger, "open");
    await expect(section).toHaveAttribute("data-visual-state", "open");
    expectIntermediateOpening(opening);
    separatorOwners.add(opening.at(-1)!.precedingOwner);
    expectClosingRecovery(await sampleOutline(trigger, "close"));
    await expect(section).toHaveAttribute("data-visual-state", "closed");
  }
  if (beginsExpandable && count > 1) expect(separatorOwners).toEqual(new Set(["list", "previous"]));
  await expectEarlyCloseCycle(triggers.first());
  await expectRapidReopen(triggers.first());
  await expectAdjacentSwitch(triggers);
  return true;
}

export async function expectReducedMotionDetailOutline(trigger: Locator) {
  const section = trigger.locator("..");
  const read = () => trigger.evaluate((button) => {
    const section = button.parentElement;
    const list = section?.parentElement;
    if (!(section instanceof HTMLElement) || !(list instanceof HTMLElement)) throw new Error("The detail outline is missing its section.");
    const owner = section.previousElementSibling ?? list;
    const top = getComputedStyle(button, "::before");
    const sides = getComputedStyle(button, "::after");
    const matrix = new DOMMatrix(sides.transform === "none" ? undefined : sides.transform);
    return { ownSeparatorOpacity: Number.parseFloat(getComputedStyle(section, "::before").opacity), precedingSeparatorOpacity: Number.parseFloat(getComputedStyle(owner, "::before").opacity), sideOpacity: Number.parseFloat(sides.opacity), sideScale: matrix.m22, topOpacity: Number.parseFloat(top.opacity) };
  });
  if ((await trigger.getAttribute("aria-expanded")) === "false") await trigger.click();
  await expect(section).toHaveAttribute("data-visual-state", "open");
  const open = await read();
  expect(open.topOpacity).toBeGreaterThan(0.98);
  expect(open.sideOpacity).toBeGreaterThan(0.98);
  expect(open.sideScale).toBeGreaterThan(0.98);
  expect(open.ownSeparatorOpacity).toBeLessThan(0.02);
  expect(open.precedingSeparatorOpacity).toBeLessThan(0.02);
  await trigger.press("Escape");
  await expect(section).toHaveAttribute("data-visual-state", "closed");
  const closed = await read();
  expect(closed.topOpacity).toBeLessThan(0.02);
  expect(closed.sideOpacity).toBeLessThan(0.02);
  expect(closed.sideScale).toBeLessThan(0.02);
  expect(closed.ownSeparatorOpacity).toBeGreaterThan(0.98);
  expect(closed.precedingSeparatorOpacity).toBeGreaterThan(0.98);
}
