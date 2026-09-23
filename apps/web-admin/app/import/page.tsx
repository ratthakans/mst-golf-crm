import { allowPage } from "../../lib/auth";
import { Forbidden } from "../Forbidden";
import { ImportView } from "./ImportView";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  if (!(await allowPage("import.run"))) return <Forbidden />;
  return <ImportView />;
}
