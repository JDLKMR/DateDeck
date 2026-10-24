import { definePlugin } from "@decky/api";
import { DropdownItem, PanelSection, PanelSectionRow, ToggleField, staticClasses } from "@decky/ui";
import { useEffect, useState } from "react";
import { FaCalendarAlt } from "react-icons/fa";
import { DateOrder, Placement, Settings, YearFormat, formatDate } from "./format";
import { startHeader, stopHeader } from "./header";
import { getSettings, loadSettings, subscribe, updateSettings } from "./settings";

function Content() {
  const [settings, setSettings] = useState<Settings>(getSettings());
  useEffect(() => subscribe(setSettings), []);

  return (
    <PanelSection title="Date">
      <PanelSectionRow>
        <div style={{ textAlign: "center", opacity: 0.8, paddingBottom: "4px" }}>
          {formatDate(new Date(), settings)}
        </div>
      </PanelSectionRow>

      <PanelSectionRow>
        <DropdownItem
          label="Position"
          rgOptions={[
            { data: "left" as Placement, label: "Left of time" },
            { data: "right" as Placement, label: "Right of time" },
          ]}
          selectedOption={settings.placement}
          onChange={(o) => updateSettings({ placement: o.data })}
        />
      </PanelSectionRow>

      <PanelSectionRow>
        <DropdownItem
          label="Order"
          rgOptions={[
            { data: "month-day" as DateOrder, label: "Month, then day" },
            { data: "day-month" as DateOrder, label: "Day, then month" },
          ]}
          selectedOption={settings.order}
          onChange={(o) => updateSettings({ order: o.data })}
        />
      </PanelSectionRow>

      <PanelSectionRow>
        <ToggleField
          label="Abbreviate month"
          checked={settings.monthName}
          onChange={(monthName) => updateSettings({ monthName })}
        />
      </PanelSectionRow>

      <PanelSectionRow>
        <ToggleField
          label="Zero-pad numbers"
          checked={settings.padZero}
          onChange={(padZero) => updateSettings({ padZero })}
        />
      </PanelSectionRow>

      <PanelSectionRow>
        <ToggleField
          label="Show year"
          checked={settings.showYear}
          onChange={(showYear) => updateSettings({ showYear })}
        />
      </PanelSectionRow>

      {settings.showYear && (
        <PanelSectionRow>
          <DropdownItem
            label="Year format"
            rgOptions={[
              { data: "four" as YearFormat, label: "4 digits" },
              { data: "two" as YearFormat, label: "2 digits" },
            ]}
            selectedOption={settings.yearFormat}
            onChange={(o) => updateSettings({ yearFormat: o.data })}
          />
        </PanelSectionRow>
      )}
    </PanelSection>
  );
}

export default definePlugin(() => {
  let disposed = false;

  // Load saved settings first so the header doesn't flash the defaults.
  loadSettings().finally(() => {
    if (!disposed) startHeader();
  });

  return {
    name: "DateDeck",
    titleView: <div className={staticClasses.Title}>DateDeck</div>,
    content: <Content />,
    icon: <FaCalendarAlt />,
    onDismount() {
      disposed = true;
      stopHeader();
    },
  };
});
