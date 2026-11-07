"use client";

import { Camera, CameraOff, CheckCircle2, Keyboard, ScanLine, XCircle } from "lucide-react";
import jsQR from "jsqr";
import { useCallback, useEffect, useRef, useState } from "react";
import { cx } from "@/components/ui";
import type { ScanResult } from "@lonceng/core";

type Log = ScanResult & { key: number; time: string };

/** A hand-held wedge reader types a whole code in well under this gap between keys. */
const WEDGE_KEY_GAP_MS = 60;
const SAME_CODE_MS = 3000;

function beep(ok: boolean) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = ok ? 880 : 220;
    gain.gain.value = 0.15;
    osc.start();
    osc.stop(ctx.currentTime + (ok ? 0.15 : 0.4));
  } catch {}
}

export function ScannerScreen({ schoolName, deviceName }: { schoolName: string; deviceName: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const wedge = useRef<HTMLInputElement>(null);
  const lastCode = useRef({ code: "", at: 0 });
  const keyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const counter = useRef(0);
  const [camera, setCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [latest, setLatest] = useState<Log | null>(null);
  const [history, setHistory] = useState<Log[]>([]);
  const [clock, setClock] = useState("");

  useEffect(() => {
    const update = () => setClock(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }).replace(".", ":"));
    update();
    const id = setInterval(update, 10_000);
    return () => clearInterval(id);
  }, []);

  const submit = useCallback(async (code: string, method: "qr" | "rfid") => {
    const now = Date.now();
    // The camera reads the same QR many times a second; only the first read is a scan.
    if (lastCode.current.code === code && now - lastCode.current.at < SAME_CODE_MS) return;
    lastCode.current = { code, at: now };
    let result: ScanResult;
    try {
      const res = await fetch("/api/scanner/scan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code, method }) });
      result = res.ok ? await res.json() : { ok: false, reason: "http", message: res.status === 401 ? "Perangkat dicabut" : "Server bermasalah", person: null };
    } catch {
      result = { ok: false, reason: "offline", message: "Tidak ada koneksi. Scan belum tercatat.", person: null };
    }
    beep(result.ok);
    const entry: Log = { ...result, key: ++counter.current, time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }).replace(".", ":") };
    setLatest(entry);
    setHistory((h) => [entry, ...h].slice(0, 8));
  }, []);

  useEffect(() => {
    if (!camera) return;
    let stream: MediaStream | null = null;
    let frame = 0;
    let stopped = false;
    const scan = () => {
      if (stopped) return;
      const v = video.current;
      const c = canvas.current;
      if (v && c && v.readyState === v.HAVE_ENOUGH_DATA) {
        c.width = 480;
        c.height = Math.round((480 * v.videoHeight) / v.videoWidth);
        const context = c.getContext("2d", { willReadFrequently: true })!;
        context.drawImage(v, 0, 0, c.width, c.height);
        const code = jsQR(context.getImageData(0, 0, c.width, c.height).data, c.width, c.height, { inversionAttempts: "dontInvert" });
        if (code?.data) void submit(code.data, "qr");
      }
      frame = requestAnimationFrame(scan);
    };
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((s) => {
        stream = s;
        if (video.current) {
          video.current.srcObject = s;
          void video.current.play();
        }
        frame = requestAnimationFrame(scan);
      })
      .catch(() => {
        setCameraError("Kamera tidak bisa dibuka. Periksa izin browser, atau pakai reader USB.");
        setCamera(false);
      });
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [camera, submit]);

  // Reader input must land in the hidden field even after someone taps the screen.
  useEffect(() => {
    const refocus = () => wedge.current?.focus();
    refocus();
    window.addEventListener("click", refocus);
    return () => window.removeEventListener("click", refocus);
  }, []);

  const flushWedge = () => {
    const input = wedge.current;
    const value = input?.value.trim();
    if (input) input.value = "";
    if (value) void submit(value, "rfid");
  };

  const ok = latest?.ok;
  return (
    <main className="flex min-h-dvh flex-col bg-bg p-4 lg:p-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">{schoolName}</h1>
          <p className="text-sm text-ink-2">{deviceName}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-3xl font-extrabold tabular-nums">{clock}</span>
          <button type="button" onClick={() => { setCameraError(null); setCamera(!camera); }} className="flex h-12 items-center gap-2 rounded-xl border border-line bg-surface px-4 font-semibold">
            {camera ? <CameraOff size={20} aria-hidden /> : <Camera size={20} aria-hidden />}
            {camera ? "Matikan kamera" : "Nyalakan kamera"}
          </button>
        </div>
      </header>

      <input
        ref={wedge}
        aria-label="Input reader"
        autoComplete="off"
        className="absolute size-px opacity-0"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (keyTimer.current) clearTimeout(keyTimer.current);
            flushWedge();
          }
        }}
        onChange={() => {
          // Some readers send no Enter suffix, so a pause also ends the code.
          if (keyTimer.current) clearTimeout(keyTimer.current);
          keyTimer.current = setTimeout(flushWedge, WEDGE_KEY_GAP_MS * 5);
        }}
      />

      <div className="grid flex-1 gap-4 lg:grid-cols-[1fr_380px]">
        <section
          aria-live="assertive"
          className={cx(
            "flex min-h-[55vh] flex-col items-center justify-center rounded-3xl p-6 text-center transition-colors",
            latest === null ? "bg-surface" : ok ? "bg-good-soft" : "bg-bad-soft",
          )}
        >
          {latest === null ? (
            <>
              <ScanLine size={96} className="text-ink-3" aria-hidden />
              <p className="mt-4 text-4xl font-extrabold">Siap memindai</p>
              <p className="mt-2 flex items-center gap-2 text-lg text-ink-2">
                <Keyboard size={20} aria-hidden /> Tempel kartu atau tunjukkan kode QR
              </p>
            </>
          ) : (
            <>
              {ok ? <CheckCircle2 size={96} className="text-good" aria-hidden /> : <XCircle size={96} className="text-bad" aria-hidden />}
              <div className="mt-4 flex size-32 items-center justify-center overflow-hidden rounded-full bg-surface text-5xl font-extrabold text-brand-text">
                {latest.person?.photoPath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/files/${latest.person.photoPath}`} alt="" className="size-full object-cover" />
                ) : (
                  (latest.person?.name[0] ?? "?")
                )}
              </div>
              <p className="mt-4 text-5xl font-extrabold">{latest.person?.name ?? "Tidak dikenal"}</p>
              {latest.person?.classGroup && <p className="mt-1 text-2xl text-ink-2">{latest.person.classGroup}</p>}
              <p className={cx("mt-3 text-4xl font-bold", ok ? "text-good" : "text-bad")}>{latest.ok ? latest.label : latest.message}</p>
            </>
          )}
        </section>

        <aside className="flex flex-col gap-4">
          {camera && (
            <div className="overflow-hidden rounded-2xl bg-black">
              <video ref={video} muted playsInline className="aspect-video w-full object-cover" />
            </div>
          )}
          <canvas ref={canvas} hidden />
          {cameraError && <p className="rounded-xl bg-warn-soft px-4 py-3 text-sm font-medium text-warn">{cameraError}</p>}
          <div className="flex-1 rounded-2xl border border-line bg-surface p-4">
            <h2 className="mb-2 font-extrabold">Terakhir</h2>
            {history.length === 0 ? (
              <p className="text-sm text-ink-3">Belum ada scan.</p>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {history.map((h) => (
                  <li key={h.key} className="flex items-center gap-2 py-2">
                    <span className={cx("size-2 shrink-0 rounded-full", h.ok ? "bg-good" : "bg-bad")} />
                    <span className="flex-1 truncate font-medium">{h.person?.name ?? "Tidak dikenal"}</span>
                    <span className="text-ink-3 tabular-nums">{h.time}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
