import "~style.css";

import { VestiDashboard } from "@vesti/ui";
import { LOGO_BASE64 } from "~lib/ui/logo";
import { getConversations, getTopics, runGardener } from "~lib/services/storageService";

export default function VestiDashboard() {
  return (
    <VestiDashboard
      logoSrc={LOGO_BASE64}
      rootClassName="vesti-options"
      storage={{ getConversations, getTopics, runGardener }}
    />
  );
}
