import { DEFAULT_MODEL } from "@/lib/investigator/gemini";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    serverKey: !!process.env.GEMINI_API_KEY,
    mock: process.env.INVESTIGATOR_MOCK === "1",
    model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
  });
}
