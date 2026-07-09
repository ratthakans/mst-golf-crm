import { getPlaybookData } from "../../lib/playbook";
import { PlaybookView } from "./PlaybookView";

export default async function PlaybookPage() {
  const data = await getPlaybookData();
  return <PlaybookView {...data} />;
}
