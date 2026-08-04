import { NextRequest, NextResponse } from "next/server";
import {
  getDeletedItems,
  restoreDeletedItem,
  permanentlyDeleteItem,
} from "@/lib/data";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const itemTypeParam = searchParams.get("type");
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

    const deletedItems = await getDeletedItems(itemType);
    return NextResponse.json(deletedItems);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch deleted items" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, deletedItemId } = body;

    if (action === "restore") {
      const success = await restoreDeletedItem(deletedItemId);
      if (success) {
        return NextResponse.json({
          success: true,
          message: "Item restored successfully",
        });
      } else {
        return NextResponse.json(
          { error: "Failed to restore item" },
          { status: 500 },
        );
      }
    } else if (action === "permanent-delete") {
      const success = await permanentlyDeleteItem(deletedItemId);
      if (success) {
        return NextResponse.json({
          success: true,
          message: "Item permanently deleted",
        });
      } else {
        return NextResponse.json(
          { error: "Failed to permanently delete item" },
          { status: 500 },
        );
      }
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 },
    );
  }
}
