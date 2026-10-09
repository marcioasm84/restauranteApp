import nodemailer from 'nodemailer'

const SMTP_HOST = process.env.SMTP_HOST
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 587)
const SMTP_USER = process.env.SMTP_USER
const SMTP_PASSWORD = process.env.SMTP_PASSWORD
const SMTP_FROM = process.env.SMTP_FROM ?? 'Meu Restaurante <nao-responda@meurestaurante.app>'
const PLATFORM_URL = process.env.PLATFORM_URL ?? 'http://localhost:8090'

// Any standard SMTP account works here (Gmail, SES, SendGrid, Postmark,
// Mailgun, your own mail server, ...) — nodemailer doesn't lock the
// platform into one specific provider. Without SMTP_HOST configured
// (typical for local dev), emails are logged to the console instead of
// actually sent, so the rest of the flow keeps working without a real
// mail account.
const transporter = SMTP_HOST
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: SMTP_USER && SMTP_PASSWORD ? { user: SMTP_USER, pass: SMTP_PASSWORD } : undefined,
    })
  : null

async function send(to: string, subject: string, text: string, html: string) {
  if (!transporter) {
    console.log(`[email] SMTP não configurado — e-mail não enviado de verdade.\nPara: ${to}\nAssunto: ${subject}\n\n${text}`)
    return
  }
  try {
    await transporter.sendMail({ from: SMTP_FROM, to, subject, text, html })
  } catch (err) {
    console.error('[email] falha ao enviar:', err instanceof Error ? err.message : err)
  }
}

function tenantUrl(slug: string): string {
  try {
    const url = new URL(PLATFORM_URL)
    return `${url.protocol}//${slug}.${url.host}`
  } catch {
    return PLATFORM_URL
  }
}

export async function sendWelcomeEmail(
  tenant: { name: string; slug: string; email: string | null; responsibleName: string | null },
  credentials: { admin: string; garcom: string; cozinha: string },
) {
  if (!tenant.email) return
  const loginUrl = `${tenantUrl(tenant.slug)}/login`
  const greeting = tenant.responsibleName ? `Olá, ${tenant.responsibleName}!` : 'Olá!'

  const text = `${greeting}

O restaurante "${tenant.name}" já está liberado na plataforma Meu Restaurante.

Acesse: ${loginUrl}

Credenciais de acesso:
- Administrador — usuário: admin / senha: ${credentials.admin}
- Garçom — usuário: garcom / senha: ${credentials.garcom}
- Cozinha — usuário: cozinha / senha: ${credentials.cozinha}

Recomendamos trocar essas senhas assim que possível.`

  const html = `
    <p>${greeting}</p>
    <p>O restaurante <strong>${tenant.name}</strong> já está liberado na plataforma Meu Restaurante.</p>
    <p><a href="${loginUrl}">${loginUrl}</a></p>
    <p><strong>Credenciais de acesso:</strong></p>
    <ul>
      <li>Administrador — usuário: <code>admin</code> / senha: <code>${credentials.admin}</code></li>
      <li>Garçom — usuário: <code>garcom</code> / senha: <code>${credentials.garcom}</code></li>
      <li>Cozinha — usuário: <code>cozinha</code> / senha: <code>${credentials.cozinha}</code></li>
    </ul>
    <p>Recomendamos trocar essas senhas assim que possível.</p>
  `

  await send(tenant.email, `Acesso liberado — ${tenant.name}`, text, html)
}
