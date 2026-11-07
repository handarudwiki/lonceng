import { ApiError, handler, requireApiSchool } from "@/lib/api";
import { saveUpload, UploadError } from "@/lib/files";

export const POST = handler(async (request) => {
  const { schoolId } = await requireApiSchool(request);
  const file = (await request.formData()).get("file");
  if (!(file instanceof File)) throw new ApiError(400, "Berkas tidak ada");
  try {
    return { path: await saveUpload(schoolId, file) };
  } catch (error) {
    if (error instanceof UploadError) throw new ApiError(400, error.message);
    throw error;
  }
});
