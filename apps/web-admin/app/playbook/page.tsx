import { allowPage } from "../../lib/auth";
import { getPlaybookData } from "../../lib/playbook";
import { Forbidden } from "../Forbidden";
import { PlaybookView } from "./PlaybookView";

export const dynamic = "force-dynamic";

export default async function PlaybookPage() {
  if (!(await allowPage("playbook.view"))) return <Forbidden />;
  const data = await getPlaybookData();
  return <PlaybookView {...data} />;
}
