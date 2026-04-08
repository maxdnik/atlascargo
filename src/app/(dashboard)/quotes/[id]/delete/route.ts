import { redirect } from "next/navigation";
import { deleteQuoteDirectAction } from "@/app/(dashboard)/quotes/actions";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const formData = new FormData();
  formData.set("id", id);
  await deleteQuoteDirectAction(formData);
  redirect("/quotes");
}
