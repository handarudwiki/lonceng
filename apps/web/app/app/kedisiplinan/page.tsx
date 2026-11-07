import { and, asc, desc, eq, ne, sum } from "drizzle-orm";
import { Paperclip } from "lucide-react";
import { disciplineRecords, disciplineTypes, people } from "@lonceng/db";
import { ReviewButtons } from "@/components/app/review-buttons";
import { EntityManager } from "@/components/entity-manager";
import { Badge, Card, EmptyState, PageHeader, TableWrap } from "@/components/ui";
import { deleteDisciplineType, reviewViolationAction, saveDisciplineType } from "@/lib/actions/review";
import { requireSchool } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";

export default async function DisciplinePage() {
  const ctx = await requireSchool("viewDiscipline");
  const { schoolId } = ctx;
  const canReview = ctx.can("reviewDiscipline");
  const select = { record: disciplineRecords, student: people.name, type: disciplineTypes.name };
  const base = () =>
    db()
      .select(select)
      .from(disciplineRecords)
      .innerJoin(people, eq(people.id, disciplineRecords.studentId))
      .innerJoin(disciplineTypes, eq(disciplineTypes.id, disciplineRecords.typeId));
  const [queue, recent, types, totals] = await Promise.all([
    base().where(and(eq(disciplineRecords.schoolId, schoolId), eq(disciplineRecords.status, "pending"))).orderBy(asc(disciplineRecords.createdAt)),
    base().where(and(eq(disciplineRecords.schoolId, schoolId), ne(disciplineRecords.status, "pending"))).orderBy(desc(disciplineRecords.reviewedAt)).limit(30),
    db().select().from(disciplineTypes).where(eq(disciplineTypes.schoolId, schoolId)).orderBy(asc(disciplineTypes.kind), asc(disciplineTypes.category)),
    db()
      .select({ id: people.id, name: people.name, points: sum(disciplineRecords.points) })
      .from(disciplineRecords)
      .innerJoin(people, eq(people.id, disciplineRecords.studentId))
      .innerJoin(disciplineTypes, eq(disciplineTypes.id, disciplineRecords.typeId))
      .where(and(eq(disciplineRecords.schoolId, schoolId), eq(disciplineRecords.status, "approved"), eq(disciplineTypes.kind, "violation")))
      .groupBy(people.id, people.name),
  ]);
  const ranked = totals.map((t) => ({ ...t, points: Number(t.points) })).sort((a, b) => b.points - a.points).slice(0, 10);
  return (
    <div className="space-y-4">
      <PageHeader title="Kedisiplinan" subtitle="Poin dan notifikasi wali baru berlaku setelah laporan diverifikasi." />
      <Card>
        <h2 className="mb-3 text-lg font-extrabold">Antrean verifikasi</h2>
        {queue.length === 0 ? (
          <EmptyState title="Tidak ada laporan menunggu" hint="Laporan guru dari aplikasi mobile masuk ke sini." />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <th>Siswa</th>
                <th>Pelanggaran</th>
                <th>Poin</th>
                <th>Tanggal</th>
                <th>Catatan</th>
                {canReview && <th aria-label="Aksi" />}
              </tr>
            </thead>
            <tbody>
              {queue.map(({ record, student, type }) => (
                <tr key={record.id}>
                  <td className="font-medium">{student}</td>
                  <td>{type}</td>
                  <td className="tabular-nums">{record.points}</td>
                  <td>{formatDate(record.occurredOn)}</td>
                  <td>
                    {record.note ?? "-"}{" "}
                    {record.photoPath && (
                      <a href={`/api/files/${record.photoPath}`} target="_blank" rel="noreferrer" aria-label="Lihat foto" className="inline-flex text-brand-text">
                        <Paperclip size={14} />
                      </a>
                    )}
                  </td>
                  {canReview && (
                    <td>
                      <ReviewButtons review={reviewViolationAction.bind(null, record.id)} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-lg font-extrabold">Akumulasi poin tertinggi</h2>
          {ranked.length === 0 ? (
            <p className="text-sm text-ink-3">Belum ada poin.</p>
          ) : (
            <ol className="divide-y divide-line text-sm">
              {ranked.map((r, i) => (
                <li key={r.id} className="flex items-center gap-3 py-2">
                  <span className="w-5 font-bold text-ink-3 tabular-nums">{i + 1}</span>
                  <span className="flex-1 font-medium">{r.name}</span>
                  <span className="font-bold tabular-nums">{r.points} poin</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
        <Card>
          <h2 className="mb-3 text-lg font-extrabold">Riwayat verifikasi</h2>
          {recent.length === 0 ? (
            <p className="text-sm text-ink-3">Belum ada riwayat.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {recent.map(({ record, student, type }) => (
                <li key={record.id} className="flex items-center gap-2 py-2">
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{student}</span> <span className="text-ink-2">{type}</span>
                  </span>
                  <Badge tone={record.status === "approved" ? "good" : "neutral"}>{record.status === "approved" ? "Diverifikasi" : "Ditolak"}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <section>
        <h2 className="mb-2 text-lg font-extrabold">Jenis pelanggaran & penghargaan</h2>
        <EntityManager
          noun="jenis"
          canEdit={canReview}
          rows={types.map((t) => ({ id: t.id, kind: t.kind, kindLabel: t.kind === "violation" ? "Pelanggaran" : "Penghargaan", category: t.category, name: t.name, points: t.points }))}
          columns={[
            { key: "kindLabel", label: "Tipe" },
            { key: "category", label: "Kategori" },
            { key: "name", label: "Nama" },
            { key: "points", label: "Poin" },
          ]}
          fields={[
            { name: "kind", label: "Tipe", type: "select", required: true, options: [{ value: "violation", label: "Pelanggaran" }, { value: "award", label: "Penghargaan" }] },
            { name: "category", label: "Kategori", required: true },
            { name: "name", label: "Nama", required: true },
            { name: "points", label: "Poin", type: "number", required: true },
          ]}
          save={canReview ? saveDisciplineType : undefined}
          remove={canReview ? deleteDisciplineType : undefined}
        />
      </section>
    </div>
  );
}
