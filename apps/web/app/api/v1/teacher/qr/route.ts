import { issueDynamicQr } from "@lonceng/core";
import { handler, requireTeacher } from "@/lib/api";

/** MG-02 / BR-10. */
export const GET = handler(async (request) => {
  const { person } = await requireTeacher(request);
  return issueDynamicQr(person.id);
});
