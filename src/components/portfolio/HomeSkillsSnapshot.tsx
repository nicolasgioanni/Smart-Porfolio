"use client";

import { useState } from "react";
import type { SkillGroup } from "@/content/types";
import { GlassChip } from "@/components/glass/GlassChip";
import { GlassLink } from "@/components/glass/GlassLink";
import { SkillsCloud } from "@/components/portfolio/SkillsCloud";
import type { HomeSkillStory } from "@/components/portfolio/homeSkillStories";

type HomeSkillsSnapshotProps = {
  skillGroups: SkillGroup[];
  stories: HomeSkillStory[];
  toolkit: string[];
};

export function HomeSkillsSnapshot({ skillGroups, stories, toolkit }: HomeSkillsSnapshotProps) {
  const [selectedStoryId, setSelectedStoryId] = useState(stories[0]?.id ?? "");
  const selectedStory = stories.find((story) => story.id === selectedStoryId) ?? stories[0];

  if (!selectedStory) {
    return <SkillsCloud compact groups={skillGroups} />;
  }

  return (
    <div className="skill-stories">
      {toolkit.length > 0 ? (
        <div className="skill-stories__toolkit" aria-label="Core technical toolkit">
          <p className="skill-stories__toolkit-label">Core toolkit</p>
          <div className="skill-stories__toolkit-list">
            {toolkit.map((skill) => (
              <GlassChip key={skill} tone="accent">
                {skill}
              </GlassChip>
            ))}
          </div>
        </div>
      ) : null}

      <div className="skill-stories__explorer">
        <div className="skill-stories__selector">
          <div className="skill-stories__selector-heading">
            <p className="skill-stories__kicker">Explore a capability</p>
            <p>Choose one to see where I put it into practice.</p>
          </div>
          <div className="skill-stories__choices" aria-label="Skill capabilities" role="group">
            {stories.map((story) => {
              const isSelected = story.id === selectedStory.id;

              return (
                <button
                  aria-controls="skill-story-panel"
                  aria-pressed={isSelected}
                  className="skill-stories__choice hover-base-1 hover-base-1--compact"
                  id={`skill-story-${story.id}-trigger`}
                  key={story.id}
                  onClick={() => setSelectedStoryId(story.id)}
                  type="button"
                >
                  <span>{story.label}</span>
                  <span className="skill-stories__choice-count">
                    {story.evidence.length} {story.evidence.length === 1 ? "example" : "examples"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <section
          aria-labelledby={`skill-story-${selectedStory.id}-trigger`}
          className="skill-stories__panel"
          id="skill-story-panel"
          key={selectedStory.id}
        >
          <header className="skill-stories__panel-header">
            <p className="skill-stories__kicker">Where I&apos;ve demonstrated it</p>
            <h3>{selectedStory.label}</h3>
            <p>{selectedStory.summary}</p>
            <div className="skill-stories__panel-tools" aria-label={`${selectedStory.label} tools`}>
              {selectedStory.tools.map((tool) => (
                <GlassChip key={tool}>{tool}</GlassChip>
              ))}
            </div>
          </header>

          <div className="skill-stories__evidence-list">
            {selectedStory.evidence.map((evidence) => (
              <article className="skill-stories__evidence" key={evidence.id}>
                <div className="skill-stories__evidence-heading">
                  <div>
                    <p className="skill-stories__evidence-kind">{evidence.kind}</p>
                    <h4>{evidence.title}</h4>
                    {evidence.context ? <p className="skill-stories__evidence-context">{evidence.context}</p> : null}
                  </div>
                  <GlassLink aria-label={`View ${evidence.title} ${evidence.kind.toLowerCase()}`} href={evidence.href}>
                    View {evidence.kind.toLowerCase()}
                  </GlassLink>
                </div>
                <p className="skill-stories__evidence-proof">{evidence.proof}</p>
                {evidence.outcome ? (
                  <p className="skill-stories__evidence-outcome">
                    <span>Result</span>
                    {evidence.outcome}
                  </p>
                ) : null}
                {evidence.tools.length > 0 ? (
                  <div className="skill-stories__evidence-tools" aria-label={`${evidence.title} relevant tools`}>
                    {evidence.tools.map((tool) => (
                      <GlassChip key={tool} tone="muted">
                        {tool}
                      </GlassChip>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
