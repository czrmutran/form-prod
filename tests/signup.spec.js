const { test, expect } = require("@playwright/test");
const path = require("path");

const FILE_URL = "file://" + path.resolve(__dirname, "..", "index.html");

// ---- helpers ---------------------------------------------------------------

function screen(page, n) {
  return page.locator(`.card[data-screen="${n}"]`);
}

// Click the submit/button input inside an Amazon-style a-button wrapper.
function aButton(page, wrapperId) {
  return page.locator(`#${wrapperId} input.a-button-input`);
}

// Read the demo OTP that the page renders (e.g. "Demo: seu código é 123456").
async function readDemoOtp(page, debugId) {
  const text = await page.locator(`#${debugId}`).textContent();
  const m = text && text.match(/(\d{6})/);
  if (!m) throw new Error(`OTP não encontrado em #${debugId}: "${text}"`);
  return m[1];
}

// Solve the orbit captcha by moving the icon onto the highlighted target slot.
async function solveCaptcha(page) {
  const center = async (loc) => {
    const b = await loc.boundingBox();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };
  const targetC = await center(page.locator(".orbit-slot.is-target"));
  for (let i = 0; i < 8; i++) {
    const iconC = await center(page.locator("#orbit-icon"));
    if (Math.abs(iconC.x - targetC.x) < 6 && Math.abs(iconC.y - targetC.y) < 6) return;
    await page.locator("#orbit-right").click();
    await page.waitForTimeout(60);
  }
  throw new Error("Não consegui alinhar o ícone do captcha ao alvo");
}

// Walk screens 1 -> 6 (email/details/captcha/email-OTP) for reuse.
async function reachEmailOtpVerified(page) {
  await page.goto(FILE_URL);

  // Screen 1
  await page.fill("#ap_email_login", "teste@email.com");
  await aButton(page, "continue").click();
  await expect(screen(page, 2)).toBeVisible();

  // Screen 2
  await aButton(page, "ap_register_continue").click();
  await expect(screen(page, 3)).toBeVisible();

  // Screen 3
  await expect(page.locator("#ap_email")).toHaveValue("teste@email.com");
  await page.fill("#ap_customer_name", "Maria Silva");
  await page.fill("#ap_password", "segredo123");
  await page.fill("#ap_password_check", "segredo123");
  await aButton(page, "continue-register").click();
  await expect(screen(page, 4)).toBeVisible();

  // Screen 4 -> captcha
  await aButton(page, "amzn-captcha-verify-button").click();
  await expect(screen(page, 5)).toBeVisible();

  // Screen 5 captcha
  await solveCaptcha(page);
  await aButton(page, "amzn-btn-verify-internal").click();
  await expect(screen(page, 6)).toBeVisible();

  // Screen 6 email OTP
  const emailOtp = await readDemoOtp(page, "otp-email-debug");
  await page.fill("#cvf-input-code", emailOtp);
  await aButton(page, "cvf-submit-otp-button").click();
  await expect(screen(page, 7)).toBeVisible();
}

// ---- happy path ------------------------------------------------------------

test("fluxo completo: 8 etapas até a conta criada", async ({ page }) => {
  await reachEmailOtpVerified(page);

  // Screen 7 add mobile
  await page.selectOption("#cvf-phone-country-code", "+55");
  await page.fill("#ap_phone_number", "11999998888");
  await aButton(page, "cvf-submit-phone-button").click();
  await expect(screen(page, 8)).toBeVisible();
  await expect(page.locator("#cvf-phone-display")).toContainText("+55");

  // Screen 8 SMS OTP
  const smsOtp = await readDemoOtp(page, "sms-otp-debug");
  await page.fill("#cvf-input-code-phone", smsOtp);
  await aButton(page, "cvf-submit-create-account").click();

  // Screen 9 success
  await expect(screen(page, 9)).toBeVisible();
  await expect(page.locator("#welcome-name")).toHaveText("Maria");
});

test("barra de progresso avança ao longo do fluxo", async ({ page }) => {
  await page.goto(FILE_URL);
  const width = () => page.locator("#progress-fill").evaluate((el) => parseFloat(el.style.width));
  const w1 = await width();
  await page.fill("#ap_email_login", "teste@email.com");
  await aButton(page, "continue").click();
  await expect(screen(page, 2)).toBeVisible();
  expect(await width()).toBeGreaterThan(w1);
});

// ---- validation / negative cases ------------------------------------------

test("etapa 1: e-mail vazio mostra erro e não avança", async ({ page }) => {
  await page.goto(FILE_URL);
  await aButton(page, "continue").click();
  await expect(page.locator("#empty-claim-alert")).toBeVisible();
  await expect(screen(page, 1)).toBeVisible();
  await expect(screen(page, 2)).toBeHidden();
});

test("etapa 1: e-mail inválido mostra erro", async ({ page }) => {
  await page.goto(FILE_URL);
  await page.fill("#ap_email_login", "naoeh@email");
  await aButton(page, "continue").click();
  await expect(page.locator("#invalid-email-alert")).toBeVisible();
  await expect(page.locator("#invalid-email-alert")).toContainText("Invalid email");
  await expect(screen(page, 2)).toBeHidden();
});

test("etapa 1: botão limpar (✕) esvazia o campo", async ({ page }) => {
  await page.goto(FILE_URL);
  await page.fill("#ap_email_login", "teste@email.com");
  await page.locator("#claim-input-clear-button").click();
  await expect(page.locator("#ap_email_login")).toHaveValue("");
});

test("etapa 3: senha curta e senhas diferentes mostram erros", async ({ page }) => {
  await page.goto(FILE_URL);
  await page.fill("#ap_email_login", "teste@email.com");
  await aButton(page, "continue").click();
  await aButton(page, "ap_register_continue").click();

  // senha curta
  await page.fill("#ap_customer_name", "Maria");
  await page.fill("#ap_password", "123");
  await page.fill("#ap_password_check", "123");
  await aButton(page, "continue-register").click();
  await expect(page.locator("#auth-password-invalid-password-alert")).toContainText("6 caracteres");

  // senhas diferentes
  await page.fill("#ap_password", "segredo123");
  await page.fill("#ap_password_check", "diferente123");
  await aButton(page, "continue-register").click();
  await expect(page.locator("#auth-password-mismatch-alert")).toContainText("não coincidem");
  await expect(screen(page, 4)).toBeHidden();
});

test("etapa 5: captcha na posição errada mostra erro", async ({ page }) => {
  await page.goto(FILE_URL);
  await page.fill("#ap_email_login", "teste@email.com");
  await aButton(page, "continue").click();
  await aButton(page, "ap_register_continue").click();
  await page.fill("#ap_customer_name", "Maria");
  await page.fill("#ap_password", "segredo123");
  await page.fill("#ap_password_check", "segredo123");
  await aButton(page, "continue-register").click();
  await aButton(page, "amzn-captcha-verify-button").click();
  await expect(screen(page, 5)).toBeVisible();

  // submete sem alinhar (estado inicial começa longe do alvo)
  await aButton(page, "amzn-btn-verify-internal").click();
  await expect(page.locator("#err-captcha")).toContainText("incorreta");
  await expect(screen(page, 6)).toBeHidden();
});

test("etapa 6: OTP de e-mail incorreto é rejeitado", async ({ page }) => {
  // chega até a etapa 6 mas digita um OTP errado
  await page.goto(FILE_URL);
  await page.fill("#ap_email_login", "teste@email.com");
  await aButton(page, "continue").click();
  await aButton(page, "ap_register_continue").click();
  await page.fill("#ap_customer_name", "Maria Silva");
  await page.fill("#ap_password", "segredo123");
  await page.fill("#ap_password_check", "segredo123");
  await aButton(page, "continue-register").click();
  await aButton(page, "amzn-captcha-verify-button").click();
  await solveCaptcha(page);
  await aButton(page, "amzn-btn-verify-internal").click();
  await expect(screen(page, 6)).toBeVisible();

  await page.fill("#cvf-input-code", "000000");
  await aButton(page, "cvf-submit-otp-button").click();
  await expect(page.locator("#cvf-input-code-alert")).toContainText("incorreto");
  await expect(screen(page, 7)).toBeHidden();
});

// ---- structure check: every primary button is a valid a-button -------------

test("todos os a-button seguem a estrutura da Amazon", async ({ page }) => {
  await page.goto(FILE_URL);
  // Primary a-buttons only (the country-code a-button-dropdown is a different widget)
  const wrappers = page.locator("span.a-button.a-button-primary");
  const count = await wrappers.count();
  expect(count).toBe(9);

  for (let i = 0; i < count; i++) {
    const w = wrappers.nth(i);
    const id = await w.getAttribute("id");
    expect(id, "wrapper deve ter id").toBeTruthy();
    // input sem id, com aria-labelledby = {id}-announce
    const input = w.locator("input.a-button-input");
    await expect(input).toHaveCount(1);
    expect(await input.getAttribute("id")).toBeNull();
    expect(await input.getAttribute("aria-labelledby")).toBe(`${id}-announce`);
    // texto com id {id}-announce
    const textSpan = w.locator("span.a-button-text");
    await expect(textSpan).toHaveCount(1);
    expect(await textSpan.getAttribute("id")).toBe(`${id}-announce`);
  }
});
