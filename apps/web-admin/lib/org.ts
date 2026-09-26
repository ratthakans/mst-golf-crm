import "server-only";
import { cache } from "react";
import { getOrgBySlug, type OrgRecord } from "@mstgolf/core";

/** The org this deployment serves (ORG_SLUG), read once per request. */
export const currentOrg: () => Promise<OrgRecord> = cache(() => getOrgBySlug());
