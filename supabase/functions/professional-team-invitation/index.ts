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
    ? `Entre com sua conta Coach Fit Pro usando ${recipient}.`
    : `Crie sua conta Coach Fit Pro como ${role}, usando exatamente ${recipient}. Não é necessário contratar uma assinatura para participar da equipe.`;
  const templateData: Record<string, string> = {
    INVITER_NAME: inviterName,
    TEAM_NAME: teamName,
    ROLE: escapeHtml(role),
    AREA: area,
    PATIENT_COUNT: String(Number(invite.patientCount) || 0),
    INVITEE_EMAIL: escapeHtml(recipient),
    ACCOUNT_INSTRUCTIONS: escapeHtml(accountInstructions),
    INVITE_URL: escapeHtml(link),
    ACTION_LABEL: escapeHtml(action),
  };
  const htmlTemplate = "<!doctype html>\n<html lang=\"pt-BR\">\n<head>\n  <meta charset=\"utf-8\">\n  <meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n  <meta name=\"color-scheme\" content=\"dark light\">\n  <meta name=\"supported-color-schemes\" content=\"dark light\">\n  <title>Convite de equipe · Coach Fit Pro</title>\n  <style>\n    @media screen and (max-width: 600px) {\n      .outer { padding: 22px 12px !important; }\n      .card { padding: 28px 21px !important; border-radius: 20px !important; }\n      .title { font-size: 29px !important; }\n      .detail-cell { display: block !important; width: auto !important; padding: 0 0 14px !important; }\n      .detail-cell:last-child { padding-bottom: 0 !important; }\n      .cta { display: block !important; text-align: center !important; }\n      .brand-sub { display: none !important; }\n    }\n\n    @media (prefers-color-scheme: light) {\n      body, .email-bg { background-color:#f3f6f4 !important; color:#172720 !important; }\n      .outer { background-color:#f3f6f4 !important; }\n      .card { background-color:#ffffff !important; border-color:#dce7e0 !important; }\n      .detail-card { background-color:#f6f9f7 !important; border-color:#dce7e0 !important; }\n      .privacy-card { background-color:#edf7f2 !important; border-color:#cfe6d9 !important; }\n      .title, .value, .team-name, .brand-name, .card strong { color:#172720 !important; }\n      .copy { color:#4b5b52 !important; }\n      .label, .muted, .footer { color:#64736a !important; }\n      .detail-divider { border-color:#dce7e0 !important; }\n      .privacy-copy { color:#405249 !important; }\n      .brand-sub { color:#64736a !important; }\n    }\n  </style>\n</head>\n<body class=\"email-body\" style=\"margin:0;padding:0;background-color:#000000;color:#f3f8f5;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;\">\n  <div style=\"display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;\">\n    {{INVITER_NAME}} convidou você para a equipe {{TEAM_NAME}}. Confira o acesso selecionado e aceite o convite.\n  </div>\n  <table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" border=\"0\" bgcolor=\"#000000\" class=\"email-bg\" style=\"background-color:#000000;\">\n    <tr>\n      <td class=\"outer\" align=\"center\" style=\"padding:46px 16px;background-color:#000000;\">\n        <table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" border=\"0\" style=\"max-width:600px;\">\n          <tr>\n            <td style=\"padding:0 8px 20px;\">\n              <table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" border=\"0\">\n                <tr>\n                  <td align=\"left\" valign=\"middle\">\n                    <table role=\"presentation\" cellspacing=\"0\" cellpadding=\"0\" border=\"0\">\n                      <tr>\n                        <td valign=\"middle\" style=\"padding-right:12px;\">\n                          <a href=\"https://app.coachfitpro.com.br\" target=\"_blank\" style=\"text-decoration:none;\">\n                            <img src=\"https://files.manuscdn.com/user_upload_by_module/session_file/310519663058662305/vWeSJIQCYHYLpQyW.png\" width=\"52\" height=\"52\" alt=\"Logo Coach Fit Pro\" style=\"display:block;width:52px;height:52px;border:1px solid #1d2a24;border-radius:14px;background-color:#06110e;object-fit:contain;\">\n                          </a>\n                        </td>\n                        <td valign=\"middle\" class=\"brand-name\" style=\"color:#f3f8f5;font-size:14px;font-weight:800;letter-spacing:1.5px;\">\n                          COACH FIT <span style=\"color:#6ae7bd;\">PRO</span>\n                        </td>\n                      </tr>\n                    </table>\n                  </td>\n                  <td class=\"brand-sub\" align=\"right\" valign=\"middle\" style=\"color:#718078;font-size:10px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;\">\n                    PERFORMANCE · PARCERIA\n                  </td>\n                </tr>\n              </table>\n            </td>\n          </tr>\n          <tr>\n            <td class=\"card\" style=\"padding:38px;background-color:#080a09;border:1px solid #1d2a24;border-top:3px solid #54dcae;border-radius:24px;\">\n              <p style=\"display:inline-block;margin:0 0 19px;padding:7px 10px;border:1px solid #244237;border-radius:999px;color:#72e8bd;font-size:10px;font-weight:700;letter-spacing:1.7px;text-transform:uppercase;\">\n                Convite de equipe\n              </p>\n              <h1 class=\"title\" style=\"margin:0 0 16px;color:#f4f8f6;font-size:34px;line-height:1.16;font-weight:750;letter-spacing:-0.7px;\">\n                Seu próximo passo é em equipe.\n              </h1>\n              <p class=\"copy\" style=\"margin:0 0 27px;color:#aab5af;font-size:16px;line-height:1.75;\">\n                {{INVITER_NAME}} convidou você para integrar a equipe <strong style=\"color:#f4f8f6;\">{{TEAM_NAME}}</strong> no Coach Fit Pro.\n              </p>\n\n              <table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" border=\"0\" bgcolor=\"#0d100e\" class=\"detail-card\" style=\"margin:0 0 23px;background-color:#0d100e;border:1px solid #202d26;border-radius:16px;\">\n                <tr>\n                  <td style=\"padding:19px 20px 13px;\">\n                    <p class=\"label\" style=\"margin:0 0 7px;color:#75837b;font-size:10px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;\">Equipe</p>\n                    <p class=\"team-name\" style=\"margin:0;color:#f4f8f6;font-size:18px;font-weight:700;line-height:1.45;\">{{TEAM_NAME}}</p>\n                  </td>\n                </tr>\n                <tr>\n                  <td style=\"padding:0 20px 19px;\">\n                    <table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" border=\"0\">\n                      <tr>\n                        <td class=\"detail-cell\" width=\"43%\" valign=\"top\" style=\"padding-top:14px;border-top:1px solid #1d2923;padding-right:10px;\">\n                          <p class=\"label\" style=\"margin:0 0 7px;color:#75837b;font-size:10px;font-weight:700;letter-spacing:1.35px;text-transform:uppercase;\">Seu perfil</p>\n                          <p class=\"value\" style=\"margin:0;color:#e7efeb;font-size:14px;font-weight:700;line-height:1.5;\">{{ROLE}}</p>\n                        </td>\n                        <td class=\"detail-cell\" width=\"57%\" valign=\"top\" style=\"padding-top:14px;border-top:1px solid #1d2923;padding-left:10px;\">\n                          <p class=\"label\" style=\"margin:0 0 7px;color:#75837b;font-size:10px;font-weight:700;letter-spacing:1.35px;text-transform:uppercase;\">Área compartilhada</p>\n                          <p class=\"value\" style=\"margin:0;color:#e7efeb;font-size:14px;font-weight:700;line-height:1.5;\">{{AREA}} <span style=\"color:#65736c;font-weight:400;\">·</span> {{PATIENT_COUNT}} selecionado(s)</p>\n                        </td>\n                      </tr>\n                    </table>\n                  </td>\n                </tr>\n              </table>\n\n              <p class=\"copy\" style=\"margin:0 0 20px;color:#aab5af;font-size:14px;line-height:1.75;\">\n                Este convite foi enviado para <strong style=\"color:#f4f8f6;\">{{INVITEE_EMAIL}}</strong>. {{ACCOUNT_INSTRUCTIONS}}\n              </p>\n\n              <table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" border=\"0\" bgcolor=\"#0e1713\" class=\"privacy-card\" style=\"margin:0 0 19px;background-color:#0e1713;border:1px solid #234133;border-radius:13px;\">\n                <tr>\n                  <td style=\"padding:16px 17px;\">\n                    <p class=\"info-title\" style=\"margin:0 0 5px;color:#70e7bb;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;\">Privacidade em primeiro lugar</p>\n                    <p class=\"privacy-copy\" style=\"margin:0;color:#bbc7c0;font-size:13px;line-height:1.7;\">\n                      Ao aceitar, você terá acesso somente à área e aos pacientes selecionados pelo responsável da equipe. Esse acesso será ativado após o aceite do convite.\n                    </p>\n                  </td>\n                </tr>\n              </table>\n\n              <p class=\"muted\" style=\"margin:0 0 25px;color:#87938c;font-size:13px;line-height:1.7;\">\n                Sua conta, sua assinatura e os demais pacientes que não foram selecionados continuam independentes.\n              </p>\n\n              <table role=\"presentation\" cellspacing=\"0\" cellpadding=\"0\" border=\"0\" style=\"margin:0 0 22px;\">\n                <tr>\n                  <td align=\"center\" bgcolor=\"#62e2b5\" style=\"border-radius:11px;box-shadow:0 8px 24px rgba(74,220,172,.16);\">\n                    <a class=\"cta\" href=\"{{INVITE_URL}}\" target=\"_blank\" style=\"display:inline-block;padding:16px 24px;border:1px solid #62e2b5;border-radius:11px;color:#06150f;font-size:14px;font-weight:800;letter-spacing:.2px;text-decoration:none;\">\n                      {{ACTION_LABEL}}&nbsp; →\n                    </a>\n                  </td>\n                </tr>\n              </table>\n\n              <p class=\"muted\" style=\"margin:0;color:#78857e;font-size:12px;line-height:1.7;\">\n                Se o botão não abrir, copie o endereço abaixo para o navegador:<br>\n                <a href=\"{{INVITE_URL}}\" style=\"color:#70e7bb;word-break:break-all;text-decoration:underline;\">{{INVITE_URL}}</a>\n              </p>\n            </td>\n          </tr>\n          <tr>\n            <td class=\"footer\" align=\"center\" style=\"padding:23px 12px 0;color:#65726b;font-size:11px;line-height:1.8;\">\n              Este convite é pessoal. Não encaminhe este e-mail.<br>\n              Se não esperava recebê-lo, ignore esta mensagem.<br><br>\n              <strong style=\"color:#9aa79f;letter-spacing:1.7px;\">COACH FIT PRO</strong><br>\n              Treino e nutrição, em colaboração.\n            </td>\n          </tr>\n        </table>\n      </td>\n    </tr>\n  </table>\n</body>\n</html>\n";
  const html = htmlTemplate.replace(/{{([A-Z_]+)}}/g, (token, key: string) => templateData[key] ?? token);

  const emailPayload: Record<string, unknown> = {
    from: fromAddress,
    to: [recipient],
    subject: `${String(invite.inviterName || "Um profissional")} convidou você para a equipe ${String(invite.teamName || "Coach Fit Pro")}`,
    html,
  };

  const sendEmail = (payload: Record<string, unknown>) => fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const mailResponse = await sendEmail(emailPayload);
  if (!mailResponse.ok) {
    const responseText = await mailResponse.text().catch(() => "");
    let errorCode = "";
    try {
      const responseBody = JSON.parse(responseText);
      errorCode = String(responseBody?.name || responseBody?.code || "").slice(0, 80);
    } catch {
      // Keep the response safe and avoid exposing provider payloads to the client.
    }
    console.error("Resend rejected the team invitation", { status: mailResponse.status, errorCode });
    return json(502, { error: `O Resend recusou o envio (HTTP ${mailResponse.status}${errorCode ? `, ${errorCode}` : ""}).` });
  }
  const result = await mailResponse.json();
  return json(200, { sent: true, messageId: result?.id || null });
});
