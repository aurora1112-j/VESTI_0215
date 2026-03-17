import {
  connectToNotion as connectToNotionOAuth,
  disconnectNotion,
  formatNotionErrorMessage,
  getNotionSettings,
  isNotionConnected,
  isNotionExportConfigured,
  listNotionDatabases,
  setNotionSettings,
  selectNotionDatabase,
} from "~vendor/vesti-ui";
import type { NotionDatabaseOption, NotionSettings } from "~vendor/vesti-ui";

export type { NotionDatabaseOption, NotionSettings };

export {
  disconnectNotion,
  formatNotionErrorMessage,
  getNotionSettings,
  isNotionConnected,
  isNotionExportConfigured,
  listNotionDatabases,
  setNotionSettings,
  selectNotionDatabase,
};

export async function connectToNotion(): Promise<NotionSettings> {
  return connectToNotionOAuth();
}
