"use client";

import { useEffect, useState } from "react";

const KEY = "oauth-guide:gemini-key";

export function getUserKey(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

type Status = { serverKey: boolean; mock: boolean; model: string };

export function useStatus() {
  const [status, setStatus] = useState<Status | null>(null);
  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);
  return status;
}

export function SettingsButton() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState(false);
  const status = useStatus();

  return (
    <>
      <button
        type="button"
        onClick={() => {
          const k = getUserKey();
          setValue(k ?? "");
          setSaved(!!k);
          setOpen(true);
        }} className="rounded-md border border-line px-2.5 py-1 text-xs font-medium hover:bg-surface-2">
        Settings
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-24" onClick={() => setOpen(false)}>
          <div className="card w-full max-w-md p-5" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Settings">
            <h2 className="text-base font-semibold">Live investigator settings</h2>
            <p className="mt-2 text-sm text-muted">
              {status?.mock
                ? "This server runs the investigator in mock mode (no API calls)."
                : status?.serverKey
                  ? `This server has a Gemini key configured (model ${status.model}). You can still use your own key — it bypasses the shared rate limit.`
                  : "This server has no Gemini key. Paste your own to run live investigations."}
            </p>
            <label className="mt-4 block text-xs font-medium" htmlFor="gemini-key">
              Your Gemini API key (optional)
            </label>
            <input
              id="gemini-key"
              type="password"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setSaved(false);
              }}
              placeholder="AIza…"
              className="mt-1 w-full rounded-md border border-line bg-bg px-3 py-2 font-mono text-sm outline-none focus:border-accent"
            />
            <p className="mt-2 text-xs text-muted">
              Stored only in this browser and sent only to this app&apos;s own API with each investigation. Get one at
              aistudio.google.com/apikey.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              {saved && <span className="mr-auto text-xs text-[var(--ev-tested)]">Saved ✓</span>}
              <button
                type="button"
                className="rounded-md px-3 py-1.5 text-sm text-muted hover:bg-surface-2"
                onClick={() => {
                  try {
                    localStorage.removeItem(KEY);
                  } catch {}
                  setValue("");
                  setSaved(false);
                }}
              >
                Clear
              </button>
              <button
                type="button"
                className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white"
                onClick={() => {
                  try {
                    if (value.trim()) localStorage.setItem(KEY, value.trim());
                    else localStorage.removeItem(KEY);
                  } catch {}
                  setSaved(!!value.trim());
                  setOpen(false);
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
