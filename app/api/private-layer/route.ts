import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      error: "Private layer requires authenticated trusted user and unlock session."
    },
    { status: 401 }
  );
}
