import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HomepageStructuredData } from "@/components/seo/HomepageStructuredData";
import { getPortfolioContent } from "@/lib/content/getPortfolioContent";
import {
  HOMEPAGE_STRUCTURED_DATA_IDS,
  createHomepageStructuredData
} from "@/lib/seo/createHomepageStructuredData";
import { serializeJsonLd } from "@/lib/seo/jsonLd";

const content = getPortfolioContent();

describe("homepage structured data", () => {
  it("creates one linked WebSite, ProfilePage, and Person graph node", () => {
    const data = createHomepageStructuredData(content);
    const websiteNodes = data["@graph"].filter((node) => node["@type"] === "WebSite");
    const profilePageNodes = data["@graph"].filter((node) => node["@type"] === "ProfilePage");
    const personNodes = data["@graph"].filter((node) => node["@type"] === "Person");

    expect(data["@context"]).toBe("https://schema.org");
    expect(data["@graph"]).toHaveLength(3);
    expect(websiteNodes).toHaveLength(1);
    expect(profilePageNodes).toHaveLength(1);
    expect(personNodes).toHaveLength(1);

    const website = websiteNodes[0];
    const profilePage = profilePageNodes[0];
    const person = personNodes[0];

    expect(website).toMatchObject({
      "@id": HOMEPAGE_STRUCTURED_DATA_IDS.website,
      url: "https://nicolasmgioanni.dev/",
      name: "Nicolas Gioanni",
      alternateName: ["Nicolas Gioanni Portfolio", "nicolasmgioanni.dev"],
      inLanguage: "en-US",
      author: { "@id": HOMEPAGE_STRUCTURED_DATA_IDS.person },
      about: { "@id": HOMEPAGE_STRUCTURED_DATA_IDS.person }
    });
    expect(profilePage).toMatchObject({
      "@id": HOMEPAGE_STRUCTURED_DATA_IDS.profilePage,
      url: "https://nicolasmgioanni.dev/",
      isPartOf: { "@id": HOMEPAGE_STRUCTURED_DATA_IDS.website },
      mainEntity: { "@id": HOMEPAGE_STRUCTURED_DATA_IDS.person }
    });
    expect(person).toMatchObject({
      "@id": HOMEPAGE_STRUCTURED_DATA_IDS.person,
      name: "Nicolas Gioanni",
      url: "https://nicolasmgioanni.dev/",
      image: "https://nicolasmgioanni.dev/favicon/favicon.png",
      jobTitle: content.profile.currentTitle,
      worksFor: { "@type": "Organization", name: content.profile.currentCompany },
      alumniOf: { "@type": "CollegeOrUniversity", name: content.profile.university },
      homeLocation: { "@type": "Place", name: content.profile.location }
    });
  });

  it("uses only existing HTTPS GitHub and LinkedIn profiles in sameAs", () => {
    const person = createHomepageStructuredData(content)["@graph"].find((node) => node["@type"] === "Person");

    expect(person?.sameAs).toEqual([
      "https://github.com/nicolasgioanni",
      "https://www.linkedin.com/in/nicolas-gioanni"
    ]);
    expect(person?.sameAs?.every((url) => url.startsWith("https://"))).toBe(true);
    expect(person?.sameAs?.some((url) => url.startsWith("mailto:"))).toBe(false);
  });

  it("does not publish reviews, ratings, fabricated dates, or interaction counts", () => {
    const serializedData = JSON.stringify(createHomepageStructuredData(content));

    expect(serializedData).not.toMatch(/Review|AggregateRating|ratingValue|reviewCount/);
    expect(serializedData).not.toMatch(/dateCreated|dateModified|interactionStatistic|interactionCount|follower/);
  });

  it("serializes valid JSON while escaping script-closing content", () => {
    const unsafeContent = {
      ...content,
      profile: {
        ...content.profile,
        shortBio: "Visible text </script><script>alert('unsafe')</script>"
      }
    };
    const data = createHomepageStructuredData(unsafeContent);
    const serializedData = serializeJsonLd(data);

    expect(serializedData).not.toContain("<");
    expect(serializedData).toContain("\\u003c/script>");
    expect(JSON.parse(serializedData)).toEqual(data);

    const { container } = render(<HomepageStructuredData content={unsafeContent} />);
    const scripts = container.querySelectorAll("script");
    const script = scripts[0];

    expect(scripts).toHaveLength(1);
    expect(script).toHaveAttribute("type", "application/ld+json");
    expect(script?.textContent).not.toContain("<");
    expect(JSON.parse(script?.textContent ?? "")).toEqual(data);
  });
});
