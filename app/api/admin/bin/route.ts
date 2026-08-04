import { NextRequest, NextResponse } from "next/server";
import {
  getDeletedItems,
  restoreDeletedItem,
  permanentlyDeleteItem,
} from "@/lib/data";
import {
  requireAdmin,
  handleRequireAdminError,
} from "@/lib/auth/require-admin";

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAdmin();
    const searchParams = request.nextUrl.searchParams;
    const itemTypeParam = searchParams.get("itemType");
    const itemType =
      itemTypeParam &&
      ["product", "review", "question", "answer", "category", "order"].includes(
        itemTypeParam,
      )
        ? (itemTypeParam as
            | "product"
            | "review"
            | "question"
            | "answer"
            | "category"
            | "order")
        : undefined;

    const deletedItems = await getDeletedItems(itemType, user.id);
    return NextResponse.json(deletedItems);
  } catch (error) {
    return handleRequireAdminError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { deletedItemId } = body;

    if (!deletedItemId) {
      return NextResponse.json(
        { error: "deletedItemId is required" },
        { status: 400 },
      );
    }

    const success = await restoreDeletedItem(deletedItemId);
    if (!success) {
      return NextResponse.json(
        { error: "Failed to restore item" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRequireAdminError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin();
    const deletedItemId = request.nextUrl.searchParams.get("id");

    if (!deletedItemId) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const success = await permanentlyDeleteItem(deletedItemId);
    if (!success) {
      return NextResponse.json(
        { error: "Failed to permanently delete item" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRequireAdminError(error);
  }
}
