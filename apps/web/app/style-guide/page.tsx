import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "../components/Brand";

export const metadata: Metadata = {
  title: "fly.ae — Style guide",
  description:
    "The visual language and interface system used across the fly.ae product.",
};

const colors = [
  {
    name: "Flight navy",
    token: "--color-ink",
    hex: "#101A3A",
    usage: "Brand, primary actions, navigation",
  },
  {
    name: "Sky blue",
    token: "--color-sky",
    hex: "#258FE0",
    usage: "Category cards and selected states",
  },
  {
    name: "Signal green",
    token: "--color-success",
    hex: "#35C63F",
    usage: "Completed and successful states",
  },
  {
    name: "Alert coral",
    token: "--color-danger",
    hex: "#E34C61",
    usage: "Required, error and destructive states",
  },
  {
    name: "Cloud",
    token: "--color-canvas",
    hex: "#F4F6FA",
    usage: "Page and grouped-content background",
  },
  {
    name: "Steel",
    token: "--color-muted",
    hex: "#6F7A91",
    usage: "Secondary copy and metadata",
  },
];

const spacing = [
  ["04", "4 px"],
  ["08", "8 px"],
  ["12", "12 px"],
  ["16", "16 px"],
  ["24", "24 px"],
  ["32", "32 px"],
  ["48", "48 px"],
  ["64", "64 px"],
];

export default function StyleGuide() {
  return (
    <div className="style-guide">
      <header className="topbar guide-topbar">
        <Link className="guide-brand-link" href="/" aria-label="fly.ae home">
          <Brand />
        </Link>
        <nav className="guide-nav" aria-label="Style guide sections">
          <a href="#foundation">Foundation</a>
          <a href="#components">Components</a>
          <a href="#patterns">Patterns</a>
        </nav>
        <Link className="button button-secondary button-small" href="/">
          View product
        </Link>
      </header>

      <main className="guide-main">
        <section className="guide-hero">
          <div>
            <p className="eyebrow">Design system · v1.0</p>
            <h1>Clear by design.<br />Built for aviation.</h1>
          </div>
          <div className="guide-intro">
            <p>
              The fly.ae interface is precise, compact and calm. It uses strong
              hierarchy, technical navy, generous white space and explicit status
              colours so every action stays easy to scan.
            </p>
            <div className="guide-tags" aria-label="Design characteristics">
              <span>Precise</span>
              <span>Secure</span>
              <span>Efficient</span>
            </div>
          </div>
        </section>

        <section className="guide-section" id="foundation">
          <div className="guide-section-title">
            <p className="eyebrow">01 · Foundation</p>
            <h2>Brand and colour</h2>
            <p>
              Navy carries the brand and primary actions. Supporting colours are
              functional: green confirms, coral warns, and sky blue identifies
              structured aircraft content.
            </p>
          </div>

          <div className="brand-stage">
            <Brand className="brand-display" />
            <div>
              <span className="spec-label">Primary lockup</span>
              <p>
                Use the fly/infinity loop mark from the UI Kit. The legacy airplane
                mark is not part of the product. Keep clear space equal to the height
                of the “f”.
              </p>
            </div>
          </div>

          <div className="colour-grid">
            {colors.map((color) => (
              <article className="colour-card" key={color.token}>
                <div className="colour-swatch" style={{ background: color.hex }} />
                <div>
                  <strong>{color.name}</strong>
                  <code>{color.token}</code>
                  <span>{color.hex}</span>
                  <p>{color.usage}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="guide-section typography-section">
          <div className="guide-section-title">
            <p className="eyebrow">02 · Typography</p>
            <h2>Condensed and direct</h2>
            <p>
              Use a condensed sans-serif voice with tight display tracking and
              comfortable body copy. Sentence case keeps technical screens human.
            </p>
          </div>

          <div className="type-specimens">
            <div className="type-row type-display">
              <span>Display · 56/56</span>
              <strong>Aircraft records</strong>
            </div>
            <div className="type-row type-h1">
              <span>Heading 1 · 40/44</span>
              <strong>Share documentation</strong>
            </div>
            <div className="type-row type-h2">
              <span>Heading 2 · 32/36</span>
              <strong>Technical specification</strong>
            </div>
            <div className="type-row type-body">
              <span>Body · 16/24</span>
              <p>Text PDF aviation documents up to 100 MB.</p>
            </div>
            <div className="type-row type-caption">
              <span>Caption · 12/16</span>
              <p>UPDATED 24 JUL 2026 · 4 FILES</p>
            </div>
          </div>
        </section>

        <section className="guide-section">
          <div className="guide-section-title">
            <p className="eyebrow">03 · Layout</p>
            <h2>Four-pixel rhythm</h2>
            <p>
              Compose screens on a four-pixel base. Use compact radii for controls
              and larger values only for grouped surfaces and dialogs.
            </p>
          </div>
          <div className="layout-demo">
            <div className="spacing-scale">
              {spacing.map(([name, value]) => (
                <div className="spacing-token" key={name}>
                  <span style={{ width: value }} />
                  <strong>{name}</strong>
                  <small>{value}</small>
                </div>
              ))}
            </div>
            <div className="radius-demo">
              <div className="radius-card radius-control">
                <span>6 px</span>
                <p>Controls</p>
              </div>
              <div className="radius-card radius-surface">
                <span>10 px</span>
                <p>Surfaces</p>
              </div>
              <div className="radius-card radius-dialog">
                <span>14 px</span>
                <p>Dialogs</p>
              </div>
            </div>
          </div>
        </section>

        <section className="guide-section" id="components">
          <div className="guide-section-title">
            <p className="eyebrow">04 · Components</p>
            <h2>Controls and states</h2>
            <p>
              Actions are rectangular and compact. Every state is visible without
              relying on motion alone.
            </p>
          </div>

          <div className="component-grid">
            <article className="component-panel">
              <div className="component-heading">
                <h3>Buttons</h3>
                <span>44 px height</span>
              </div>
              <div className="button-showcase">
                <button className="button button-primary">Primary action</button>
                <button className="button button-success">Success action</button>
                <button className="button button-primary" disabled>
                  Disabled
                </button>
                <button className="button button-secondary">Secondary</button>
                <button className="button button-tertiary">Tertiary action</button>
                <button className="button button-icon" aria-label="Add item">+</button>
              </div>
            </article>

            <article className="component-panel">
              <div className="component-heading">
                <h3>Form fields</h3>
                <span>Label + explicit state</span>
              </div>
              <div className="field-showcase">
                <label className="field">
                  <span>Aircraft <i>*</i></span>
                  <input placeholder="SELECT AIRCRAFT" />
                </label>
                <label className="field">
                  <span>Serial number</span>
                  <input value="P-123456" readOnly />
                </label>
                <label className="field field-error">
                  <span>MSN <i>*</i></span>
                  <input value="12" readOnly aria-invalid="true" />
                  <small>Enter a valid manufacturer serial number.</small>
                </label>
              </div>
            </article>
          </div>

          <div className="message-grid">
            <div className="message message-info">
              <strong>Information</strong>
              <p>The share link remains active until the document is deleted.</p>
            </div>
            <div className="message message-warning">
              <strong>Verification required</strong>
              <p>Upload only materials related to aviation components.</p>
            </div>
            <div className="message message-success">
              <strong>Upload complete</strong>
              <p>The approved PDF is ready to share.</p>
            </div>
          </div>
        </section>

        <section className="guide-section" id="patterns">
          <div className="guide-section-title">
            <p className="eyebrow">05 · Patterns</p>
            <h2>Product building blocks</h2>
            <p>
              Navigation, identity and content cards share the same scale, colour
              hierarchy and clear action language.
            </p>
          </div>

          <div className="pattern-grid">
            <article className="pattern-browser">
              <div className="pattern-nav">
                <Brand />
                <nav>
                  <span>Upload</span>
                  <span>My Documents</span>
                </nav>
                <span className="avatar" aria-label="User initials">AK</span>
              </div>
              <div className="pattern-content">
                <div className="folder-card">
                  <div className="folder-card-top">
                    <span>Aircraft</span>
                    <strong>⋮</strong>
                  </div>
                  <h3>737-800</h3>
                  <p>4 documents</p>
                </div>
                <div className="pattern-copy">
                  <span className="spec-label">Category card</span>
                  <h3>Use colour to orient, not decorate.</h3>
                  <p>
                    Pair a short category, a clear identifier and one metadata line.
                  </p>
                </div>
              </div>
            </article>

            <aside className="usage-card">
              <p className="eyebrow">Usage rules</p>
              <div>
                <strong>Do</strong>
                <p>Use one primary action per surface and keep labels verb-led.</p>
              </div>
              <div>
                <strong>Do</strong>
                <p>Reserve green, coral and blue for meaning and system feedback.</p>
              </div>
              <div className="usage-dont">
                <strong>Don’t</strong>
                <p>Introduce pill buttons, oversized radii or decorative shadows.</p>
              </div>
            </aside>
          </div>
        </section>
      </main>

      <footer className="guide-footer">
        <Brand />
        <p>One system for every fly.ae screen.</p>
        <Link href="/">Back to product</Link>
      </footer>
    </div>
  );
}
