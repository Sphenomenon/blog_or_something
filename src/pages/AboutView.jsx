import React from "react";
import { about } from "../data/yaml-loader.js";

export function AboutView() {
  return (
    <section className="page-panel page-panel--about about-panel reveal" aria-labelledby="about-title">
      <p className="hero-code">{about.code_header}</p>
      <div className="page-panel-header page-panel-header--stacked">
        <div>
          <h1 id="about-title">{about.page_title}</h1>
          <p className="page-panel-lead">{about.lead_text}</p>
        </div>
      </div>
      <p>{about.body_text}</p>
      <dl>
        {about.design_system.map((entry, i) => (
          <div key={i}>
            <dt>{entry.term}</dt>
            <dd>{entry.description}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
