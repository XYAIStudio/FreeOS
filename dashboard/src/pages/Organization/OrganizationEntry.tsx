import OrganizationPage from "./index";

/**
 * Organization home is the native workbench. Desktop managed Node + iframe
 * remains a transitional preview for unmigrated App verticals, not this route.
 */
export default function OrganizationEntry() {
  return <OrganizationPage />;
}
