import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface DeleteAccountRequest {
  confirmation?: string;
}

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function getAdminKey(): string | null {
  const secretKeysJson = Deno.env.get("SUPABASE_SECRET_KEYS");

  if (secretKeysJson) {
    try {
      const secretKeys = JSON.parse(secretKeysJson) as Record<
        string,
        string
      >;

      if (secretKeys.default) {
        return secretKeys.default;
      }
    } catch {
      // Continue with the legacy service-role key.
    }
  }

  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? null;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const authorizationHeader = request.headers.get("Authorization");

  if (!authorizationHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Authentication required." }, 401);
  }

  let requestBody: DeleteAccountRequest;

  try {
    requestBody = (await request.json()) as DeleteAccountRequest;
  } catch {
    return jsonResponse({ error: "Invalid request body." }, 400);
  }

  if (requestBody.confirmation !== "DELETE") {
    return jsonResponse(
      { error: 'Type "DELETE" exactly to confirm account deletion.' },
      400,
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const adminKey = getAdminKey();

  if (!supabaseUrl || !adminKey) {
    return jsonResponse(
      { error: "The account deletion service is not configured." },
      500,
    );
  }

  const adminClient = createClient(supabaseUrl, adminKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const accessToken = authorizationHeader.slice("Bearer ".length);
  const {
    data: { user },
    error: userError,
  } = await adminClient.auth.getUser(accessToken);

  if (userError || !user) {
    return jsonResponse({ error: "The session is no longer valid." }, 401);
  }

  const { error: documentsError } = await adminClient
    .from("documents")
    .delete()
    .eq("user_id", user.id);

  if (documentsError) {
    return jsonResponse(
      { error: "Cloud documents could not be deleted." },
      500,
    );
  }

  const { error: deletionError } =
    await adminClient.auth.admin.deleteUser(user.id, false);

  if (deletionError) {
    return jsonResponse(
      { error: "The account could not be deleted." },
      500,
    );
  }

  return jsonResponse({ success: true });
});