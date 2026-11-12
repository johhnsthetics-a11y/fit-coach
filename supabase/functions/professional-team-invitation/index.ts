import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]!);
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json(405, { error: "Método não permitido." });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromAddress = Deno.env.get("COACHFIT_TEAM_INVITE_FROM");
  const appUrl = (Deno.env.get("COACHFIT_APP_URL") || "https://app.coachfitpro.com.br").replace(/\/$/, "");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json(503, { error: "Serviço de convite indisponível." });
  if (!resendApiKey || !fromAddress) return json(503, { error: "Envio de e-mail ainda não configurado. Configure RESEND_API_KEY e COACHFIT_TEAM_INVITE_FROM." });

  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return json(401, { error: "Entre na conta responsável para enviar o convite." });
  const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: authorization },
  });
  if (!authResponse.ok) return json(401, { error: "Sessão profissional inválida ou expirada." });
  const actor = await authResponse.json();

  let inviteId = "";
  try {
    const body = await request.json();
    inviteId = typeof body?.inviteId === "string" ? body.inviteId : "";
  } catch {
    return json(400, { error: "Informe um convite válido." });
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(inviteId)) return json(400, { error: "Convite inválido." });

  const payloadResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/get_professional_team_invite_email_payload`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ selected_invite_id: inviteId, caller_id: actor.id }),
  });
  if (!payloadResponse.ok) return json(403, { error: "Este convite não está pendente ou não pertence à sua equipe." });
  const invite = await payloadResponse.json();
  const existingAccount = invite.hasAccount === true;
  const role = invite.role === "nutritionist" ? "Nutricionista" : "Treinador";
  const action = existingAccount ? "Entrar e aceitar convite" : "Criar conta e aceitar convite";
  const query = new URLSearchParams({
    mode: existingAccount ? "signin" : "signup",
    team_invite: inviteId,
    role: invite.role === "nutritionist" ? "nutritionist" : "trainer",
  });
  const link = `${appUrl}/login?${query.toString()}`;
  const teamName = escapeHtml(invite.teamName || "equipe profissional");
  const inviterName = escapeHtml(invite.inviterName || "Um profissional");
  const area = escapeHtml(invite.area || (invite.role === "trainer" ? "Treinos" : "Nutrição"));
  const recipient = String(invite.email || "").trim();
  if (!recipient) return json(400, { error: "O convite não possui um e-mail de destino." });

  const accountInstructions = existingAccount
    ? `Entre com sua conta Coach Fit Pro usando <strong>${escapeHtml(recipient)}</strong>.`
    : `Crie sua conta Coach Fit Pro como <strong>${role}</strong>, usando exatamente <strong>${escapeHtml(recipient)}</strong>. Não é necessário contratar uma assinatura para participar da equipe.`;
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#07110f;color:#e8f2ef;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 12px;background:#07110f"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#101d19;border:1px solid #24483e;border-radius:20px;padding:32px"><tr><td><p style="color:#69e1bb;font-size:12px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase">Coach Fit Pro · Equipes</p><h1 style="font-size:26px;line-height:1.25;margin:12px 0">Você recebeu um convite</h1><p style="font-size:16px;line-height:1.6">${inviterName} convidou você para participar da equipe <strong>${teamName}</strong>.</p><p style="font-size:15px;line-height:1.7">Seu perfil será <strong>${role}</strong>, com acesso somente a <strong>${area}</strong> para <strong>${Number(invite.patientCount) || 0} paciente(s) selecionado(s)</strong>. Suas outras equipes, seus pacientes e sua assinatura permanecem independentes.</p><p style="font-size:14px;line-height:1.7">${accountInstructions}</p><p style="margin:26px 0"><a href="${escapeHtml(link)}" style="display:inline-block;padding:14px 22px;border-radius:10px;background:#53dfb3;color:#082018;text-decoration:none;font-weight:bold">${action}</a></p><p style="font-size:12px;line-height:1.6;color:#9db1aa">O acesso só será ativado quando você entrar na conta correta e aceitar o convite. Não compartilhe este e-mail com outra pessoa.</p></td></tr></table></td></tr></table></body></html>`;

  const mailResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: fromAddress,
      to: [recipient],
      subject: `${inviterName} convidou você para a equipe ${String(invite.teamName || "Coach Fit Pro")}`,
      html,
    }),
  });
  if (!mailResponse.ok) return json(502, { error: "O convite foi criado, mas o serviço de e-mail não confirmou o envio." });
  const result = await mailResponse.json();
  return json(200, { sent: true, messageId: result?.id || null });
});
