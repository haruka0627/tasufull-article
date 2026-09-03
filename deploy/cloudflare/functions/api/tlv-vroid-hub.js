/**
 * GET/POST /api/tlv-vroid-hub — status alias
 */
import { handleTlvVroidHubRequest } from "../_shared/tlv-vroid-hub-core.mjs";

export async function onRequest(context) {
  return handleTlvVroidHubRequest(context);
}
