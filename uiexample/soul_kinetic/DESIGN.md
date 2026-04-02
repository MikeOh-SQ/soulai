# Design System Strategy: The Supportive Sculptor

## 1. Overview & Creative North Star
The "Creative North Star" for this design system is **The Supportive Sculptor**. In the context of ADHD screening and management, the UI must do more than display data; it must shape focus, reduce cognitive load, and provide a tactile, high-end environment that feels both playground-playful and clinic-professional.

This system moves beyond the "grid-and-container" status quo by embracing **Intentional Asymmetry**. By using overlapping elements, circular image masks, and high-contrast typography, we create an editorial experience that guides the eye through a rhythmic flow. This isn't just an app; it’s a high-performance workspace designed for neurodivergent minds, where hierarchy is signaled through tonal depth and "vibe" rather than rigid, overwhelming lines.

---

## 2. Colors & Surface Soul
The palette is a high-contrast interplay between deep, grounding neutrals (`surface`: `#131313`) and "electric" therapeutic accents.

### The "No-Line" Rule
To keep the interface from feeling clinical or cluttered, **1px solid borders are strictly prohibited for sectioning.** Boundaries between different content areas must be achieved through:
- **Tonal Shifts:** Placing a `surface-container-low` (#1B1B1B) section against the main `background`.
- **Positive Space:** Using the Spacing Scale (specifically `12` to `20`) to let the background breathe.

### Surface Hierarchy & Nesting
Think of the UI as layers of "digital matte." 
- **The Base:** `surface` (#131313).
- **The Secondary Stage:** `surface-container` (#1F1F1F) for large content areas.
- **The Interactive Layer:** `surface-container-highest` (#353535) for elevated elements like cards.
- **Nesting:** To create focus, place a `surface-container-highest` card inside a `surface-container-low` section. This provides natural lift without a single line being drawn.

### The "Glass & Gradient" Rule
For floating elements (modals, fixed navigation), use **Glassmorphism**:
- **Background:** Semi-transparent `primary-container` (e.g., #F67ADF at 80% opacity).
- **Effect:** `backdrop-filter: blur(20px)`.
- **Signature Texture:** Use a subtle linear gradient on main CTAs—transitioning from `primary` (#FFACEA) to `primary-container` (#F67ADF)—to give buttons a 3D, "tactile candy" feel.

---

## 3. Typography: Editorial Authority
Typography is the voice of the system. We use a high-contrast mix of bold, expressive shapes and clinical clarity.

- **Display & Headline (Plus Jakarta Sans):** These are our "bold anchors." They should be used with tight letter-spacing and generous line-height to feel modern and supportive. These fonts represent the "Playful" side of the brand.
- **Body & Titles (Inter):** Used for all functional reading. Inter provides the "Professional" grounding needed for ADHD management tools, ensuring that dense information is highly legible.
- **Labels (Space Grotesk):** Specifically for technical data and visualizations. The monospaced lean of Space Grotesk provides a "scientific" feel to screening results.

---

## 4. Elevation & Depth
Depth is emotional, not just structural. We avoid the "floating card" look of 2014 and move toward **Ambient Dimension**.

- **The Layering Principle:** Use the Material `surface-container` tiers (Lowest to Highest) to create stackable depth. A "Low" surface feels further back; a "Highest" surface feels like it’s reaching toward the user.
- **Ambient Shadows:** Shadows must be invisible. Use a 48px blur with only 6% opacity, using a tint of `on-surface` (#E2E2E2). Avoid pure black shadows; they look "dirty" on dark backgrounds.
- **The "Ghost Border" Fallback:** If a border is required for high-contrast accessibility (e.g., a focused input), use `outline-variant` (#52424D) at **15% opacity**. It should be felt, not seen.
- **Circular Silhouettes:** Referencing the brand's aesthetic, use `roundedness.full` (circles) for profile images and secondary decorative elements to break the "squareness" of digital screens.

---

## 5. Components

### Buttons: The Kinetic Core
- **Primary:** Background: `secondary` (#C2C1FF); Text: `on-secondary` (#1900A7). Use `roundedness.full`.
- **Secondary:** Background: `surface-container-highest`; Text: `primary`. 
- **Interaction:** On hover, primary buttons should scale by 1.05x to provide instant kinetic feedback.

### Interactive Cards & Lists
- **Forbid Dividers:** Do not use horizontal lines between list items. Use a 1.7rem (`spacing.5`) vertical gap or alternating `surface-container` tints.
- **Cards:** Use `roundedness.lg` (2rem) for a friendly, approachable feel. Content inside should have a minimum of `spacing.6` (2rem) padding.

### Intake Forms
- **The "Single Focus" Input:** Input fields should use `surface-container-highest` with `roundedness.md`. 
- **Focus State:** Instead of a heavy border, a focused field should trigger a soft outer glow (the Ghost Border) and the label should shift to `primary` (#FFACEA).

### Data Visualization (ADHD Screening)
- Use `tertiary` (#C1D03F) for positive progress and `primary` (#FFACEA) for attention-required areas.
- Visuals should be large and "chunky," using the `roundedness.full` token for bar charts and progress rings to maintain the playful-professional balance.

---

## 6. Do's and Don'ts

### Do:
- **Do** use `display-lg` typography for provocative, supportive headers.
- **Do** overlap elements (e.g., a circular image slightly hanging off a card) to create a sense of bespoke, editorial design.
- **Do** use high-contrast color pairings for buttons (e.g., Pink on Dark Purple) to aid users with visual processing difficulties.
- **Do** prioritize white space. For ADHD tools, "less" is the ultimate feature.

### Don't:
- **Don't** use 1px dividers or "traditional" card shadows. It creates visual "noise."
- **Don't** use pure black (#000000) for text. Always use `on-background` (#E2E2E2) for a softer, more premium contrast.
- **Don't** cram multiple calls to action into one view. Use the surface hierarchy to highlight only one "Highest" priority action per screen.
- **Don't** use small, "whispering" font sizes. If it’s important enough to be on the screen, it’s important enough to be legible at a glance.