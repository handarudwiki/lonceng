import { and, asc, desc, eq, ne } from "drizzle-orm";
import { Paperclip } from "lucide-react";
import { leaveRequests, people } from "@lonceng/db";
import { LEAVE_LABELS } from "@lonceng/core";
import { FormDialog } from "@/components/app/form-dialog";
import { ReviewButtons } from "@/components/app/review-buttons";
import { Badge, Card, EmptyState, Field, Input, PageHeader, Select, TableWrap, Textarea } from "@/components/ui";
import { createLeaveAction, reviewLeaveAction } from "@/lib/actions/review";
import { requireSchool } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";

const PERSON_TYPES = { student: "Siswa", teacher: "Guru", staff: "Tendik" };

export default async function LeavePage() {
  const ctx = await requireSchool("reviewStaffLeave");
  const { schoolId } = ctx;
  const select = { leave: leaveRequests, name: people.name, type: people.type };
  const base = () => db().select(select).from(leaveRequests).innerJoin(people, eq(people.id, leaveRequests.personId));
  const [pendingRows, done, persons] = await Promise.all([
    base().where(and(eq(leaveRequests.schoolId, schoolId), eq(leaveRequests.status, "pending"))).orderBy(asc(leaveRequests.createdAt)),
    base().where(and(eq(leaveRequests.schoolId, schoolId), ne(leaveRequests.status, "pending"))).orderBy(desc(leaveRequests.reviewedAt)).limit(50),
    db().select({ id: people.id, name: people.name, type: people.type }).from(people).where(and(eq(people.schoolId, schoolId), eq(people.isActive, true))).orderBy(asc(people.name)),
  ]);
  const visible = pendingRows.filter((r) => r.type !== "student" || ctx.can("reviewStudentLeave"));
  const label = (l: typeof leaveRequests.$inferSelect) => (l.startDate === l.endDate ? formatDate(l.startDate) : `${formatDate(l.startDate)} - ${formatDate(l.endDate)}`);
  const Attachment = ({ path }: { path: string | null }) =>
    path && (
      <a href={`/api/files/${path}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-brand-text">
        <Paperclip size={14} aria-hidden /> Lihat
      </a>
    );
  return (
    <>
      <PageHeader
        title="Izin"
        subtitle="Izin yang disetujui menggantikan Alpha pada rentang tanggalnya."
        actions={
          ctx.can("manageAttendance") && (
            <FormDialog label="Catat izin" title="Catat izin" action={createLeaveAction}>
              <Field label="Nama">
                <Select name="personId" required defaultValue="">
                  <option value="" disabled>
                    Pilih
                  </option>
                  {persons.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({PERSON_TYPES[p.type]})
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Jenis">
                <Select name="type" defaultValue="permit">
                  {Object.entries(LEAVE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Mulai">
                  <Input type="date" name="startDate" required />
                </Field>
                <Field label="Selesai">
                  <Input type="date" name="endDate" required />
                </Field>
              </div>
              <Field label="Alasan">
                <Textarea name="reason" required />
              </Field>
              <Field label="Lampiran (opsional)" hint="JPG, PNG, WEBP, atau PDF, maksimal 5 MB">
                <Input type="file" name="attachment" accept="image/*,application/pdf" className="py-2" />
              </Field>
            </FormDialog>
          )
        }
      />
      <Card className="mb-4">
        <h2 className="mb-3 text-lg font-extrabold">Menunggu verifikasi</h2>
        {visible.length === 0 ? (
          <EmptyState title="Tidak ada permohonan baru" />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <th>Nama</th>
                <th>Jenis</th>
                <th>Tanggal</th>
                <th>Alasan</th>
                <th>Lampiran</th>
                <th aria-label="Aksi" />
              </tr>
            </thead>
            <tbody>
              {visible.map(({ leave, name, type }) => (
                <tr key={leave.id}>
                  <td className="font-medium">
                    {name} <span className="text-ink-3">({PERSON_TYPES[type]})</span>
                  </td>
                  <td>{LEAVE_LABELS[leave.type]}</td>
                  <td>{label(leave)}</td>
                  <td>{leave.reason}</td>
                  <td>
                    <Attachment path={leave.attachmentPath} />
                  </td>
                  <td>
                    <ReviewButtons review={reviewLeaveAction.bind(null, leave.id)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>
      <Card>
        <h2 className="mb-3 text-lg font-extrabold">Riwayat</h2>
        {done.length === 0 ? (
          <EmptyState title="Belum ada riwayat" />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <th>Nama</th>
                <th>Jenis</th>
                <th>Tanggal</th>
                <th>Status</th>
                <th>Lampiran</th>
              </tr>
            </thead>
            <tbody>
              {done.map(({ leave, name }) => (
                <tr key={leave.id}>
                  <td className="font-medium">{name}</td>
                  <td>{LEAVE_LABELS[leave.type]}</td>
                  <td>{label(leave)}</td>
                  <td>
                    <Badge tone={leave.status === "approved" ? "good" : "bad"}>{leave.status === "approved" ? "Disetujui" : "Ditolak"}</Badge>
                  </td>
                  <td>
                    <Attachment path={leave.attachmentPath} />
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>
    </>
  );
}
