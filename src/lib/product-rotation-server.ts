import "server-only";

import { connection } from "next/server";
import { getProductRotationDay } from "./product-rotation";

export async function getCurrentProductRotationDay(): Promise<number> {
  // Read the date at request time, outside the shared catalog cache. Pass this
  // single value to client components so hydration and filter changes agree.
  await connection();
  return getProductRotationDay(new Date());
}
