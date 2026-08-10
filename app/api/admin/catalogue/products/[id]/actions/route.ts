import { NextResponse } from "next/server";
import { withCatalogueAuth, jsonError } from "@/lib/catalogue/api-guard";
import {
  replaceVariants,
  upsertProductMedia,
  upsertSeedOffer,
} from "@/lib/catalogue/admin-store";
import type { CatalogueDraft } from "@/lib/catalogue/product-draft";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const action = String(body.action || "");

    if (action === "media") {
      const gate = await withCatalogueAuth("products:manage_media");
      await upsertProductMedia(id, body.media as CatalogueDraft["media"], {
        userId: gate.user.id,
        email: gate.user.email,
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "variants") {
      const gate = await withCatalogueAuth("products:manage_variants");
      const variants = await replaceVariants(
        id,
        {
          name: "",
          optionAxes: body.optionAxes,
          variants: body.variants,
        },
        { userId: gate.user.id, email: gate.user.email },
      );
      return NextResponse.json({ variants });
    }

    if (action === "offer") {
      const gate = await withCatalogueAuth("offers:manage");
      const offer = await upsertSeedOffer(id, body.offer, {
        userId: gate.user.id,
        email: gate.user.email,
      });
      return NextResponse.json({ offer });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return jsonError(err);
  }
}
