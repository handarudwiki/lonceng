import { and, asc, desc, eq } from "drizzle-orm";
import { academicYears, announcements, classGroups } from "@lonceng/db";
import { FormDialog } from "@/components/app/form-dialog";
import { Badge, Card, EmptyState, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { publishAction } from "@/lib/actions/comms";
import { requireSchool } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";

const AUDIENCES = { all: "Semua", teachers: "Guru", guardians: "Wali murid", class_group: "Wali murid satu rombel" };

export default async function AnnouncementsPage() {
  const { schoolId, school } = await requireSchool("manageAnnouncements");
  const rows = await db().select().from(announcements).where(eq(announcements.schoolId, schoolId)).orderBy(desc(announcements.createdAt)).limit(50);
  const [year] = await db().select().from(academicYears).where(and(eq(academicYears.schoolId, schoolId), eq(academicYears.isActive, true)));
  const groups = year ? await db().select().from(classGroups).where(eq(classGroups.academicYearId, year.id)).orderBy(asc(classGroups.name)) : [];
  return (
    <>
      <PageHeader
        title="Pengumuman"
        subtitle="Terkirim sebagai notifikasi ke aplikasi mobile."
        actions={
          <FormDialog label="Buat pengumuman" title="Buat pengumuman" action={publishAction}>
            <Field label="Judul">
              <Input name="title" required />
            </Field>
            <Field label="Isi">
              <Textarea name="body" required />
            </Field>
            <Field label="Tujuan">
              <Select name="audience" defaultValue="all">
                {Object.entries(AUDIENCES).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Rombel" hint="Hanya untuk tujuan satu rombel">
              <Select name="classGroupId" defaultValue="">
                <option value="">-</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Gambar atau lampiran (opsional)">
              <Input type="file" name="attachment" accept="image/*,application/pdf" className="py-2" />
            </Field>
          </FormDialog>
        }
      />
      {rows.length === 0 ? (
        <EmptyState title="Belum ada pengumuman" />
      ) : (
        <div className="space-y-3">
          {rows.map((a) => (
            <Card key={a.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-extrabold">{a.title}</h2>
                <Badge tone="brand">{AUDIENCES[a.audience]}</Badge>
              </div>
              <p className="mt-1 text-sm whitespace-pre-line text-ink-2">{a.body}</p>
              <p className="mt-2 text-xs text-ink-3">
                {formatDate(a.createdAt, school.timezone)}
                {a.attachmentPath && (
                  <>
                    {" · "}
                    <a href={`/api/files/${a.attachmentPath}`} target="_blank" rel="noreferrer" className="font-semibold text-brand-text">
                      Lampiran
                    </a>
                  </>
                )}
              </p>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
