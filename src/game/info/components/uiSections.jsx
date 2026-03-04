import { useMemo, useState } from "react";
import Button, { BUTTON_VARIANT } from "../../../engine/ui/button/button";
import { useModal } from "../../../engine/ui/modal/modalContext";
import { MODAL_BUTTONS } from "../../../engine/ui/modal/modalContext";
import { useToast, TOAST_TYPE } from "../../../engine/ui/toast/toast";
import Bars from "../../../engine/ui/bars/bars";
import Tooltip, { TOOLTIP_TYPE } from "../../../engine/ui/tooltip/tooltip";
import SlidePanel, { SLIDE_PANEL_EDGE } from "../../../engine/ui/slidePanel/slidePanel";

/*
  NOTE:
  - Global SCSS variables + typography are applied globally via SCSS imports (not via JS).
  - This UI Catalog section demonstrates how to *use* them (CSS classes / theme variables),
    not how to "import" them into this JS file.

  Requirements assumed:
  - assets/scss/ui/_import.scss exists and includes colours + typography (and anything else)
  - index.scss imports assets/scss/ui/_import.scss once (global)
  - index.html includes the Google Font <link> already (Geom)
*/

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircleInfo,
  faTriangleExclamation,
  faGear,
  faArrowRight,
  faXmark,
  faPalette,
  faFont,
  faCheckCircle,
  faCircleXmark,
  faStar,
  faLeaf,
  faFeather,
} from "@fortawesome/free-solid-svg-icons";

import { InputText } from "primereact/inputtext";
import { Checkbox } from "primereact/checkbox";
import { RadioButton } from "primereact/radiobutton";
import { ColorPicker } from "primereact/colorpicker";
import { Dropdown } from "primereact/dropdown";
import { InputSwitch } from "primereact/inputswitch";
import { Slider } from "primereact/slider";

/* ------------------------------
   Section components
-------------------------------- */

const ThemeExamples = () => {
  return (
    <div className="info__examplesRow">
      <div className="info__example info__example--full">
        <div className="info__exampleMeta">
          <div className="info__exampleTitle">
            <FontAwesomeIcon icon={faPalette} style={{ marginRight: "0.5rem" }} />
            Global colour variables (SCSS)
          </div>
          <div className="info__exampleDesc">
            These come from <code>assets/scss/ui/colours.scss</code> and are pulled in via{" "}
            <code>assets/scss/ui/_import.scss</code>. Use them in SCSS like{" "}
            <code>background: $primaryBackground;</code>.
          </div>
        </div>

        <div className="info__themeRow">
          <div className="info__themeSwatch info__themeSwatch--primary">
            <div className="info__themeSwatchTitle">Primary</div>
            <div className="info__themeSwatchMeta">$primaryBackground / $primaryForeground</div>
          </div>

          <div className="info__themeSwatch info__themeSwatch--secondary">
            <div className="info__themeSwatchTitle">Secondary</div>
            <div className="info__themeSwatchMeta">$secondaryBackground / $secondaryForeground</div>
          </div>

          <div className="info__themeSwatch info__themeSwatch--tertiary">
            <div className="info__themeSwatchTitle">Tertiary</div>
            <div className="info__themeSwatchMeta">$tertiaryBackground / $tertiaryForeground</div>
          </div>
        </div>

        <div className="info__exampleBody">
          <div className="info__exampleDesc" style={{ marginTop: "0.75rem" }}>
            Example usage in a component (Button already uses these variables):
          </div>

          <div className="info__buttonRow">
            <Button variant={BUTTON_VARIANT.PRIMARY} onClick={() => console.log("Primary theme")}>
              Primary Button
            </Button>
            <Button
              variant={BUTTON_VARIANT.SECONDARY}
              onClick={() => console.log("Secondary theme")}
            >
              Secondary Button
            </Button>
            <Button variant={BUTTON_VARIANT.TERTIARY} onClick={() => console.log("Tertiary theme")}>
              Tertiary Button
            </Button>
          </div>
        </div>
      </div>

      <div className="info__example info__example--full">
        <div className="info__exampleMeta">
          <div className="info__exampleTitle">
            <FontAwesomeIcon icon={faFont} style={{ marginRight: "0.5rem" }} />
            Typography (Google Font)
          </div>
          <div className="info__exampleDesc">
            The Google Font is loaded in <code>index.html</code>. Your typography SCSS applies it
            globally to headings, paragraphs, links, etc. This section simply demonstrates those
            global styles.
          </div>
        </div>

        <div className="info__typographyDemo">
          <h1>Heading 1 - Geom</h1>
          <h2>Heading 2 - Geom</h2>
          <p>
            This paragraph should be using your global typography rules. You can validate font,
            line-height, and default spacing here.
          </p>
          <p>
            <a href="#theme">Example anchor link</a> (styled via typography.scss)
          </p>
        </div>
      </div>
    </div>
  );
};

const ButtonExamples = () => {
  const imageUrl = new URL("../../../assets/images/button_example.png", import.meta.url).href;
  const hoverUrl = new URL("../../../assets/images/button_hover_example.png", import.meta.url).href;

  return (
    <div className="info__examplesRow">
      {/* Primary – navigation */}
      <div className="info__example">
        <div className="info__exampleMeta">
          <div className="info__exampleTitle">Primary (navigation)</div>
          <div className="info__exampleDesc">Renders a Link when `to` is provided.</div>
        </div>

        <div className="info__buttonRow">
          <Button variant={BUTTON_VARIANT.PRIMARY} to="/">
            Back to Home
          </Button>

          <Button variant={BUTTON_VARIANT.PRIMARY} disabled={true} to="/">
            Disabled: Back to Home
          </Button>
        </div>
      </div>

      {/* Secondary – action */}
      <div className="info__example">
        <div className="info__exampleMeta">
          <div className="info__exampleTitle">Secondary (action)</div>
          <div className="info__exampleDesc">Runs a function via `onClick`.</div>
        </div>

        <div className="info__buttonRow">
          <Button
            variant={BUTTON_VARIANT.SECONDARY}
            onClick={() => console.log("Secondary button clicked")}
          >
            Console Action
          </Button>

          <Button
            variant={BUTTON_VARIANT.SECONDARY}
            disabled={true}
            onClick={() => console.log("This should not fire")}
          >
            Disabled: Console Action
          </Button>
        </div>
      </div>

      {/* Tertiary – navigation */}
      <div className="info__example">
        <div className="info__exampleMeta">
          <div className="info__exampleTitle">Tertiary</div>
          <div className="info__exampleDesc">Lightweight button/link styling.</div>
        </div>

        <div className="info__buttonRow">
          <Button variant={BUTTON_VARIANT.TERTIARY} to="/">
            Tertiary Link
          </Button>

          <Button variant={BUTTON_VARIANT.TERTIARY} disabled={true} to="/">
            Disabled: Tertiary Link
          </Button>
        </div>
      </div>

      {/* Image button */}
      <div className="info__example">
        <div className="info__exampleMeta">
          <div className="info__exampleTitle">Image Button</div>
          <div className="info__exampleDesc">
            Uses `image` by default and `hoverImage` on hover. Supports `to` and `onClick`. Shown in
            enabled + disabled states.
          </div>
        </div>

        <div className="info__buttonRow">
          <Button
            variant={BUTTON_VARIANT.IMAGE}
            onClick={() => console.log("Image button clicked")}
            image={imageUrl}
            hoverImage={hoverUrl}
            width={100}
            height={100}
            alt="Example image button"
          />

          <Button
            variant={BUTTON_VARIANT.IMAGE}
            disabled={true}
            onClick={() => console.log("This should not fire")}
            image={imageUrl}
            hoverImage={hoverUrl}
            width={100}
            height={100}
            alt="Disabled example image button"
          />
        </div>
      </div>
    </div>
  );
};

const ModalExamples = () => {
  const { openModal } = useModal();

  return (
    <div className="info__examplesRow">
      <div className="info__example">
        <div className="info__exampleMeta">
          <div className="info__exampleTitle">Buttons: Ok (default)</div>
          <div className="info__exampleDesc">Single OK button, defaults to close.</div>
        </div>
        <Button
          variant={BUTTON_VARIANT.PRIMARY}
          onClick={() =>
            openModal({
              modalTitle: "OK Modal",
              modalContent: (
                <div>
                  <p>This modal uses the default OK button configuration.</p>
                </div>
              ),
              buttons: MODAL_BUTTONS.OK,
            })
          }
        >
          Open OK Modal
        </Button>
      </div>

      <div className="info__example">
        <div className="info__exampleMeta">
          <div className="info__exampleTitle">Buttons: YesNo</div>
          <div className="info__exampleDesc">Two buttons: Yes and No.</div>
        </div>
        <Button
          variant={BUTTON_VARIANT.SECONDARY}
          onClick={() =>
            openModal({
              modalTitle: "Confirm Action",
              modalContent: (
                <div>
                  <p>Would you like to proceed?</p>
                </div>
              ),
              buttons: MODAL_BUTTONS.YES_NO,
              onYes: () => {
                console.log("Yes clicked");
              },
              onNo: () => {
                console.log("No clicked");
              },
            })
          }
        >
          Open Yes/No Modal
        </Button>
      </div>

      <div className="info__example">
        <div className="info__exampleMeta">
          <div className="info__exampleTitle">Buttons: None</div>
          <div className="info__exampleDesc">No footer buttons (close via X/backdrop/Esc).</div>
        </div>
        <Button
          variant={BUTTON_VARIANT.TERTIARY}
          onClick={() =>
            openModal({
              modalTitle: "Info Only",
              modalContent: (
                <div>
                  <p>This modal has no footer buttons.</p>
                  <p>Close it using the X, Escape, or clicking the backdrop.</p>
                </div>
              ),
              buttons: MODAL_BUTTONS.NONE,
            })
          }
        >
          Open No-Buttons Modal
        </Button>
      </div>

      <div className="info__example">
        <div className="info__exampleMeta">
          <div className="info__exampleTitle">Buttons: CustomText</div>
          <div className="info__exampleDesc">Single button with custom label.</div>
        </div>
        <Button
          variant={BUTTON_VARIANT.PRIMARY}
          onClick={() =>
            openModal({
              modalTitle: "Submit Example",
              modalContent: (
                <div>
                  <p>This modal uses a custom submit button label.</p>
                </div>
              ),
              buttons: MODAL_BUTTONS.CUSTOM_TEXT,
              customButtonText: "Submit",
              onClick: () => {
                console.log("Submit clicked");
              },
            })
          }
        >
          Open Custom Button Modal
        </Button>
      </div>
    </div>
  );
};

const ToastExamples = () => {
  const { showToast, log, clearLog } = useToast();
  const [message, setMessage] = useState("Hello toast!");

  const durationMs = 3000;

  const fire = (type) => {
    showToast(type, message || "(empty message)", { durationMs });
  };

  return (
    <div className="info__examplesRow">
      <div className="info__example info__example--full">
        <div className="info__exampleMeta">
          <div className="info__exampleTitle">Trigger toasts</div>
          <div className="info__exampleDesc">
            Enter a message and click a button to emit a toast. Clicking the toast dismisses it
            early. Auto-dismiss is set to {durationMs / 1000}s for this demo.
          </div>
        </div>

        <div className="info__formGrid">
          <div className="info__formRow">
            <label className="info__formLabel" htmlFor="toast-message">
              Message
            </label>
            <InputText
              id="toast-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type a toast message..."
            />
          </div>

          <div className="info__buttonRow">
            <Button variant={BUTTON_VARIANT.PRIMARY} onClick={() => fire(TOAST_TYPE.SUCCESS)}>
              Success
            </Button>
            <Button variant={BUTTON_VARIANT.SECONDARY} onClick={() => fire(TOAST_TYPE.WARNING)}>
              Warning
            </Button>
            <Button variant={BUTTON_VARIANT.SECONDARY} onClick={() => fire(TOAST_TYPE.ERROR)}>
              Error
            </Button>
            <Button variant={BUTTON_VARIANT.TERTIARY} onClick={() => fire(TOAST_TYPE.INFO)}>
              Info
            </Button>
          </div>
        </div>

        <div className="info__toastLog">
          <div className="info__toastLogHeader">
            <div className="info__toastLogTitle">Toast log</div>
            <Button variant={BUTTON_VARIANT.TERTIARY} onClick={clearLog}>
              Clear
            </Button>
          </div>

          <div className="info__toastLogList" role="log" aria-label="Toast log">
            {log.length === 0 ? (
              <div className="info__toastLogEmpty">No toasts yet.</div>
            ) : (
              log.map((entry) => (
                <div key={entry.id} className="info__toastLogItem">
                  <div className={`info__toastLogBadge info__toastLogBadge--${entry.type}`}>
                    {entry.type.toUpperCase()}
                  </div>
                  <div className="info__toastLogMsg">{entry.message}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const BarsExamples = () => {
  const [unsegCurrent, setUnsegCurrent] = useState(35);
  const [segCurrent, setSegCurrent] = useState(4);

  return (
    <div className="info__examplesRow">
      <div className="info__example info__example--full">
        <div className="info__exampleMeta">
          <div className="info__exampleTitle">Bars</div>
          <div className="info__exampleDesc">
            Unsegmented bar (0-100) and segmented bar (0-10 split into 10). Both animate when the
            current value changes.
          </div>
        </div>

        <div className="info__barsGrid">
          {/* Unsegmented */}
          <div className="info__barsCol">
            <div className="info__barsLabel">Unsegmented (0-100)</div>
            <Bars min={0} max={100} current={unsegCurrent} />

            <div className="info__barsSliderRow">
              <Slider
                value={unsegCurrent}
                min={0}
                max={100}
                step={1}
                onChange={(e) => setUnsegCurrent(e.value)}
              />
              <div className="info__barsValue">{unsegCurrent}</div>
            </div>
          </div>

          {/* Segmented */}
          <div className="info__barsCol">
            <div className="info__barsLabel">Segmented (0-10, 10 segments)</div>
            <Bars min={0} max={10} current={segCurrent} segments={10} />

            <div className="info__barsSliderRow">
              <Slider
                value={segCurrent}
                min={0}
                max={10}
                step={1}
                onChange={(e) => setSegCurrent(e.value)}
              />
              <div className="info__barsValue">{segCurrent}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const SlidePanelExamples = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [edge, setEdge] = useState(SLIDE_PANEL_EDGE.RIGHT);

  const edgeOptions = [
    { label: "Right", value: SLIDE_PANEL_EDGE.RIGHT },
    { label: "Left", value: SLIDE_PANEL_EDGE.LEFT },
    { label: "Top", value: SLIDE_PANEL_EDGE.TOP },
    { label: "Bottom", value: SLIDE_PANEL_EDGE.BOTTOM },
  ];

  const panelContent = (
    <div className="info__panelContent">
      <h3 className="info__panelTitle">Slide Panel</h3>
      <p className="info__panelDesc">Basic buttons inside the panel (no actions yet).</p>

      <div className="info__panelButtons">
        <Button variant={BUTTON_VARIANT.PRIMARY} onClick={() => console.log("Action 1")}>
          Action 1
        </Button>
        <Button variant={BUTTON_VARIANT.SECONDARY} onClick={() => console.log("Action 2")}>
          Action 2
        </Button>
        <Button variant={BUTTON_VARIANT.TERTIARY} onClick={() => console.log("Action 3")}>
          Action 3
        </Button>
      </div>
    </div>
  );

  return (
    <div className="info__examplesRow">
      <div className="info__example info__example--full">
        <div className="info__exampleMeta">
          <div className="info__exampleTitle">Slide Panel</div>
          <div className="info__exampleDesc">
            A panel that slides in from an edge. Choose the edge and open/close it. Top/bottom use
            default height/width.
          </div>
        </div>

        <div className="info__panelControls">
          <div className="info__panelControl">
            <label className="info__formLabel">Edge</label>
            <Dropdown value={edge} options={edgeOptions} onChange={(e) => setEdge(e.value)} />
          </div>

          <Button variant={BUTTON_VARIANT.PRIMARY} onClick={() => setIsOpen(true)}>
            Open Slide Panel
          </Button>
        </div>

        <SlidePanel
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          edge={edge}
          content={panelContent}
        />
      </div>
    </div>
  );
};

const TooltipExamples = () => {
  const exampleText = (
    <span>
      This is a <strong>tooltip</strong>
    </span>
  );

  const items = [
    { type: TOOLTIP_TYPE.SUCCESS, label: "Success", icon: faCheckCircle },
    { type: TOOLTIP_TYPE.WARNING, label: "Warning", icon: faTriangleExclamation },
    { type: TOOLTIP_TYPE.ERROR, label: "Error", icon: faCircleXmark },
    { type: TOOLTIP_TYPE.INFO, label: "Info", icon: faCircleInfo },

    { type: TOOLTIP_TYPE.PRIMARY, label: "Primary", icon: faStar },
    { type: TOOLTIP_TYPE.SECONDARY, label: "Secondary", icon: faLeaf },
    { type: TOOLTIP_TYPE.TERTIARY, label: "Tertiary", icon: faFeather },
  ];

  return (
    <div className="info__examplesRow">
      <div className="info__example info__example--full">
        <div className="info__exampleMeta">
          <div className="info__exampleTitle">Tooltip types</div>
          <div className="info__exampleDesc">
            Hover or focus the icons to see tooltips. Types include success/warning/error/info and
            theme-mapped primary/secondary/tertiary.
          </div>
        </div>

        <div className="info__tooltipGrid">
          {items.map((x) => (
            <div key={x.type} className="info__tooltipItem">
              <Tooltip type={x.type} text={exampleText} icon={<FontAwesomeIcon icon={x.icon} />} />
              <div className="info__tooltipLabel">{x.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const FontAwesomeExamples = () => {
  return (
    <div className="info__examplesRow">
      <div className="info__example">
        <div className="info__exampleMeta">
          <div className="info__exampleTitle">Basic usage</div>
          <div className="info__exampleDesc">Import the icon and pass it to `icon`.</div>
        </div>

        <div className="info__iconRow">
          <FontAwesomeIcon icon={faCircleInfo} />
          <FontAwesomeIcon icon={faTriangleExclamation} />
          <FontAwesomeIcon icon={faGear} />
          <FontAwesomeIcon icon={faXmark} />
        </div>
      </div>

      <div className="info__example">
        <div className="info__exampleMeta">
          <div className="info__exampleTitle">Sizing</div>
          <div className="info__exampleDesc">
            Use `size` (sm, lg, 2x, 3x, etc.) or `style.fontSize`.
          </div>
        </div>

        <div className="info__iconRow">
          <FontAwesomeIcon icon={faGear} size="sm" />
          <FontAwesomeIcon icon={faGear} size="lg" />
          <FontAwesomeIcon icon={faGear} size="2x" />
          <FontAwesomeIcon icon={faGear} style={{ fontSize: "40px" }} />
        </div>
      </div>

      <div className="info__example">
        <div className="info__exampleMeta">
          <div className="info__exampleTitle">Colour</div>
          <div className="info__exampleDesc">Set colour with inline style or CSS.</div>
        </div>

        <div className="info__iconRow">
          <FontAwesomeIcon icon={faCircleInfo} style={{ color: "#17c482ff" }} />
          <FontAwesomeIcon icon={faTriangleExclamation} style={{ color: "#f59e0b" }} />
          <FontAwesomeIcon icon={faXmark} style={{ color: "#ef4444" }} />
        </div>
      </div>

      <div className="info__example">
        <div className="info__exampleMeta">
          <div className="info__exampleTitle">Icons inside buttons</div>
          <div className="info__exampleDesc">Use icons as children.</div>
        </div>

        <div className="info__buttonRow">
          <Button variant={BUTTON_VARIANT.PRIMARY} onClick={() => console.log("Info clicked")}>
            <span className="info__btnIcon">
              <FontAwesomeIcon icon={faCircleInfo} />
            </span>
            Info
          </Button>

          <Button
            variant={BUTTON_VARIANT.SECONDARY}
            onClick={() => console.log("Continue clicked")}
          >
            Continue
            <span className="info__btnIcon info__btnIcon--right">
              <FontAwesomeIcon icon={faArrowRight} />
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
};

const PrimeReactExamples = () => {
  const [name, setName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [difficulty, setDifficulty] = useState("normal");
  const [color, setColor] = useState("22c55e"); // hex without #
  const [soundEnabled, setSoundEnabled] = useState(true);

  const [fruit, setFruit] = useState("apple");
  const fruitOptions = [
    { label: "Apple", value: "apple" },
    { label: "Banana", value: "banana" },
    { label: "Cherry", value: "cherry" },
  ];

  return (
    <div className="info__formGrid">
      <div className="info__formRow">
        <label className="info__formLabel" htmlFor="pr-name">
          InputText
        </label>
        <InputText
          id="pr-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Type a name..."
        />
        <div className="info__formHint">Value: {name || "(empty)"}</div>
      </div>

      <div className="info__formRow">
        <label className="info__formLabel">Checkbox</label>
        <div className="info__formInline">
          <Checkbox inputId="pr-agree" checked={agreed} onChange={(e) => setAgreed(!!e.checked)} />
          <label htmlFor="pr-agree">I agree</label>
        </div>
        <div className="info__formHint">Checked: {agreed ? "true" : "false"}</div>
      </div>

      <div className="info__formRow">
        <label className="info__formLabel">RadioButton</label>
        <div className="info__formInline">
          <RadioButton
            inputId="pr-diff-easy"
            name="difficulty"
            value="easy"
            onChange={(e) => setDifficulty(e.value)}
            checked={difficulty === "easy"}
          />
          <label htmlFor="pr-diff-easy">Easy</label>

          <RadioButton
            inputId="pr-diff-normal"
            name="difficulty"
            value="normal"
            onChange={(e) => setDifficulty(e.value)}
            checked={difficulty === "normal"}
          />
          <label htmlFor="pr-diff-normal">Normal</label>

          <RadioButton
            inputId="pr-diff-hard"
            name="difficulty"
            value="hard"
            onChange={(e) => setDifficulty(e.value)}
            checked={difficulty === "hard"}
          />
          <label htmlFor="pr-diff-hard">Hard</label>
        </div>
        <div className="info__formHint">Selected: {difficulty}</div>
      </div>

      <div className="info__formRow">
        <label className="info__formLabel">ColorPicker</label>
        <div className="info__formInline">
          <ColorPicker value={color} onChange={(e) => setColor(e.value)} />
          <span className="info__formHint">#{color}</span>
        </div>
      </div>

      <div className="info__formRow">
        <label className="info__formLabel">Dropdown</label>
        <Dropdown
          value={fruit}
          options={fruitOptions}
          onChange={(e) => setFruit(e.value)}
          placeholder="Pick one"
        />
        <div className="info__formHint">Selected: {fruit}</div>
      </div>

      <div className="info__formRow">
        <label className="info__formLabel">InputSwitch</label>
        <div className="info__formInline">
          <InputSwitch checked={soundEnabled} onChange={(e) => setSoundEnabled(!!e.value)} />
          <span className="info__formHint">Sound: {soundEnabled ? "on" : "off"}</span>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------
   Main hook
-------------------------------- */

const UiSections = () => {
  const sections = useMemo(
    () => [
      {
        id: "theme",
        navLabel: "Theme",
        title: "Theme (Colours + Typography)",
        description:
          "Global SCSS variables (colours) and global typography (Google Font) are applied once and then reused everywhere via classnames and component styles.",
        render: () => <ThemeExamples />,
      },
      {
        id: "buttons",
        navLabel: "Buttons",
        title: "Button",
        description:
          "Reusable button component that supports both route navigation (Link) and onClick actions. Variants control styling: primary, secondary, tertiary, image. Each example is shown in enabled + disabled states.",
        render: () => <ButtonExamples />,
      },
      {
        id: "modals",
        navLabel: "Modals",
        title: "Modal",
        description:
          "Global modal system powered by ModalContext. Open modals from anywhere with configurable titles, content, and button layouts.",
        render: () => <ModalExamples />,
      },
      {
        id: "toasts",
        navLabel: "Toasts",
        title: "Toast",
        description:
          "Global toast system powered by ToastProvider. Click a toast to dismiss early. Auto-dismiss is configurable per toast (default 3s).",
        render: () => <ToastExamples />,
      },
      {
        id: "bars",
        navLabel: "Bars",
        title: "Bars",
        description:
          "Progress bars that support custom min/max scales and optional segmentation. Bars animate smoothly when the current value updates.",
        render: () => <BarsExamples />,
      },
      {
        id: "slidepanels",
        navLabel: "Slide Panel",
        title: "Slide Panel",
        description:
          "A lightweight slide-out panel for side drawers, settings panels, inventories, etc. Supports top/bottom/left/right edges and configurable sizing.",
        render: () => <SlidePanelExamples />,
      },
      {
        id: "tooltips",
        navLabel: "Tooltips",
        title: "Tooltip",
        description:
          "A lightweight tooltip component for hover/focus hints. Accepts React content for rich formatting and supports multiple visual types.",
        render: () => <TooltipExamples />,
      },
      {
        id: "fontawesome",
        navLabel: "Font Awesome",
        title: "Font Awesome",
        description:
          "Icons are imported where they are used. Control size via the `size` prop or via `style.fontSize`, and control colour via `style.color` (or CSS).",
        render: () => <FontAwesomeExamples />,
      },
      {
        id: "primereact",
        navLabel: "PrimeReact",
        title: "PrimeReact",
        description:
          "PrimeReact provides production-ready form controls and UI primitives. These examples cover common input types for game settings screens and admin UIs.",
        render: () => (
          <div className="info__examplesRow">
            <div className="info__example info__example--full">
              <div className="info__exampleMeta">
                <div className="info__exampleTitle">Common inputs</div>
                <div className="info__exampleDesc">
                  InputText, Checkbox, RadioButton, ColorPicker, Dropdown, InputSwitch.
                </div>
              </div>

              <PrimeReactExamples />
            </div>
          </div>
        ),
      },
    ],
    []
  );

  return { sections };
};

export default UiSections;
