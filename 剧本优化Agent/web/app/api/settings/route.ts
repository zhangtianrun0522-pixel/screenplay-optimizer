import { NextRequest, NextResponse } from "next/server";
import type { Settings } from "@/lib/types";
import { readServerSettings, toPublicSettings, writeServerSettings } from "@/lib/server-settings";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(toPublicSettings(readServerSettings()));
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json() as Partial<Settings>;
    const current = readServerSettings();
    const apiKey = typeof body.apiKey === "string" && body.apiKey.trim().length > 0
      ? body.apiKey
      : current.apiKey;
    const next = writeServerSettings({
      apiUrl: typeof body.apiUrl === "string" ? body.apiUrl : current.apiUrl,
      apiKey,
      model: typeof body.model === "string" ? body.model : current.model,
    });
    return NextResponse.json(toPublicSettings(next));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "保存设置失败" },
      { status: 400 },
    );
  }
}
