const React = window.__OCTOP_REACT__;
const { jsx: _jsx, jsxs: _jsxs } = window.__OCTOP_JSX__;

function OrgOsCard(props) {
  const data = props.data || {};
  const enabled = Boolean(data.enabled);
  const sidecar = Boolean(data.sidecar_reachable);
  const caps = Array.isArray(data.capabilities) ? data.capabilities : [];
  return _jsxs("div", {
    style: {
      border: "1px solid var(--fn-border-primary, #e5e7eb)",
      borderRadius: 12,
      padding: 16,
      background: "var(--fn-bg-elevated, #fff)",
      maxWidth: 420,
    },
    children: [
      _jsx("div", {
        style: { fontWeight: 600, marginBottom: 8 },
        children: "FreeOS Organization OS",
      }),
      _jsx("div", {
        style: { fontSize: 13, color: "#64748b", marginBottom: 8 },
        children: enabled
          ? sidecar
            ? "Module on · sidecar reachable"
            : "Module on · start the sidecar to open org APIs"
          : "Module off — enable it from Organization in the sidebar",
      }),
      _jsx("div", {
        style: { fontSize: 12, lineHeight: 1.6 },
        children: caps
          .map(function (item) {
            return item.label || item.key;
          })
          .join(" · "),
      }),
    ],
  });
}

export default {
  org_os_card: OrgOsCard,
};
