"use client";

export type MesaTabId = "pedidos" | "participantes" | "admin";

type MesaTabBarProps = {
  activeTab: MesaTabId;
  onChange: (tab: MesaTabId) => void;
  showAdmin: boolean;
};

const TABS: { id: MesaTabId; label: string; icon: string }[] = [
  { id: "pedidos", label: "Pedidos", icon: "pi-shopping-bag" },
  { id: "participantes", label: "Pessoas", icon: "pi-users" },
  { id: "admin", label: "Admin", icon: "pi-cog" },
];

export default function MesaTabBar({
  activeTab,
  onChange,
  showAdmin,
}: MesaTabBarProps) {
  const visibleTabs = showAdmin
    ? TABS
    : TABS.filter((tab) => tab.id !== "admin");

  return (
    <div
      className="grid rounded-[30px] bg-[#367050] p-1"
      style={{
        gridTemplateColumns: `repeat(${visibleTabs.length}, minmax(0, 1fr))`,
        gap: "var(--spacing-fluid-1)",
      }}
      role="tablist"
      aria-label="Seções da mesa"
    >
      {visibleTabs.map((tab) => {
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`font-poppins flex flex-col items-center justify-center rounded-[24px] transition ${
              isActive
                ? "bg-[#cde9da] text-[#418964] shadow-sm"
                : "bg-[#418964] text-white hover:bg-[#367050]"
            }`}
            style={{
              minHeight: "var(--height-control-sm)",
              paddingBlock: "var(--spacing-fluid-2)",
              fontSize: "var(--text-fluid-xs)",
              gap: "0.125rem",
            }}
          >
            <i aria-hidden="true" className={`pi ${tab.icon}`} />
            <span className="font-semibold">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
