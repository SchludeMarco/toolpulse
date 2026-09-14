const REGION = "us-central1";

function functionUrl(name: string): string | null {
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  if (!projectId) return null;
  return `https://${REGION}-${projectId}.cloudfunctions.net/${name}`;
}

export async function triggerCurationNow(): Promise<void> {
  const url = functionUrl("runCurationNow");
  if (!url) {
    throw new Error(
      "Manuelle Aktualisierung erfordert ein verbundenes Firebase-Projekt."
    );
  }
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error((await res.text()) || `Fehlgeschlagen (${res.status}).`);
  }
}
