import { describe, expect, it } from "vitest";
import { siteRoutes } from "@/components/navigation/siteRoutes";
import { createPageMetadata } from "@/lib/content/createPageMetadata";
import { getPortfolioContent } from "@/lib/content/getPortfolioContent";

const content = getPortfolioContent();
const defaultDescription = content.siteSettings.siteDescription;
const googleBotIndexingDirectives = {
  index: true,
  follow: true,
  "max-image-preview": "large",
  "max-snippet": -1,
  "max-video-preview": -1
};

describe("createPageMetadata", () => {
  it("preserves homepage title and description behavior with a self-referencing canonical", () => {
    const metadata = createPageMetadata(content, { pathname: siteRoutes.home });

    expect(metadata.metadataBase).toEqual(new URL("https://nicolasmgioanni.dev"));
    expect(metadata.title).toEqual({
      default: "Nicolas Gioanni Portfolio",
      template: "Nicolas Gioanni | %s"
    });
    expect(metadata.description).toBe(defaultDescription);
    expect(metadata.alternates).toEqual({ canonical: "https://nicolasmgioanni.dev/" });
    expect(metadata.applicationName).toBe("Nicolas Gioanni");
    expect(metadata.authors).toEqual([{ name: "Nicolas Gioanni", url: "https://nicolasmgioanni.dev/" }]);
    expect(metadata.creator).toBe("Nicolas Gioanni");
    expect(metadata.publisher).toBe("Nicolas Gioanni");
    expect(metadata.icons).toEqual([{ rel: "icon", url: content.profile.faviconImage }]);
    expect(metadata.robots).toEqual({
      index: true,
      follow: true,
      googleBot: googleBotIndexingDirectives
    });
  });

  it("preserves detail title and description behavior with its own canonical and social metadata", () => {
    const description = "Professional, research, teaching, and leadership experience with detailed context.";
    const metadata = createPageMetadata(content, {
      pathname: siteRoutes.experience,
      title: "Experience",
      description
    });
    const resolvedTitle = "Nicolas Gioanni | Experience";
    const profileImage = "https://nicolasmgioanni.dev/favicon/favicon.png";

    expect(metadata.title).toEqual({ absolute: resolvedTitle });
    expect(metadata.description).toBe(description);
    expect(metadata.alternates).toEqual({ canonical: "https://nicolasmgioanni.dev/experience" });
    expect(metadata.openGraph).toEqual({
      type: "website",
      locale: "en_US",
      url: "https://nicolasmgioanni.dev/experience",
      siteName: "Nicolas Gioanni",
      title: resolvedTitle,
      description,
      images: [{ url: profileImage, alt: "Nicolas Gioanni profile portrait" }]
    });
    expect(metadata.twitter).toEqual({
      card: "summary",
      title: resolvedTitle,
      description,
      images: [{ url: profileImage, alt: "Nicolas Gioanni profile portrait" }]
    });
  });

  it("makes contact crawlable but non-indexable while retaining its own canonical", () => {
    const metadata = createPageMetadata(content, {
      pathname: siteRoutes.contact,
      title: "Contact",
      description: "Send Nicolas Gioanni a prioritized professional contact request."
    });

    expect(metadata.alternates).toEqual({ canonical: "https://nicolasmgioanni.dev/contact" });
    expect(metadata.robots).toEqual({
      index: false,
      follow: true,
      googleBot: {
        ...googleBotIndexingDirectives,
        index: false
      }
    });
    expect(metadata.openGraph).toMatchObject({ url: "https://nicolasmgioanni.dev/contact" });
  });
});
