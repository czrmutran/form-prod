// Aurora sign-up — replicates Amazon's 8-screen create-account flow with original UI.
// Element IDs mirror Amazon's real auth pages (ap_*, cvf-*, continue, auth-*-alert).
// Screens: 1 email -> 2 confirm-new -> 3 details -> 4 captcha-intro -> 5 captcha
//          -> 6 email OTP -> 7 add mobile -> 8 sms OTP -> 9 success
(function () {
  "use strict";

  var state = { login: "", name: "", phone: "", emailOtp: "", smsOtp: "" };
  function $(id) { return document.getElementById(id); }
  var screens = Array.prototype.slice.call(document.querySelectorAll(".card[data-screen]"));
  var PROGRESS = { 1: 12, 2: 25, 3: 40, 4: 52, 5: 64, 6: 76, 7: 88, 8: 96, 9: 100 };

  function show(n) {
    screens.forEach(function (s) {
      s.classList.toggle("hidden", +s.getAttribute("data-screen") !== n);
    });
    $("progress-fill").style.width = (PROGRESS[n] || 12) + "%";
    window.scrollTo(0, 0);
  }

  function setError(inputId, errId, msg) {
    var el = inputId ? $(inputId) : null, err = $(errId);
    if (msg) {
      if (el) el.classList.add("invalid");
      err.textContent = msg; err.classList.add("show");
      return false;
    }
    if (el) el.classList.remove("invalid");
    err.textContent = ""; err.classList.remove("show");
    return true;
  }

  var isEmail = function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); };
  var isPhone = function (v) { return /^[+]?[\d\s().-]{8,}$/.test(v); };
  function genOtp() { return String(Math.floor(100000 + Math.random() * 900000)); }

  // Generic "Alterar/Voltar" links via data-goto
  document.querySelectorAll("[data-goto]").forEach(function (el) {
    el.addEventListener("click", function (e) {
      e.preventDefault();
      show(+el.getAttribute("data-goto"));
    });
  });

  // ---------- Screen 1: email/mobile (ap_email_login) ----------
  $("ap_email_login_clear").addEventListener("click", function () {
    $("ap_email_login").value = ""; $("ap_email_login").focus();
    setError("ap_email_login", "auth-email-missing-alert", "");
  });
  $("ap_signin_form").addEventListener("submit", function (e) {
    e.preventDefault();
    var v = $("ap_email_login").value.trim();
    if (!v) return setError("ap_email_login", "auth-email-missing-alert", "Informe seu celular ou e-mail.");
    if (!isEmail(v) && !isPhone(v)) return setError("ap_email_login", "auth-email-missing-alert", "Endereço de e-mail ou celular inválido.");
    setError("ap_email_login", "auth-email-missing-alert", "");
    state.login = v;
    $("ap_email_display").textContent = v;
    $("ap_email").value = v;
    show(2);
  });

  // ---------- Screen 2: confirm new ----------
  $("ap_register_continue").addEventListener("click", function () { show(3); });

  // ---------- Screen 3: account details (ap_register_form) ----------
  $("ap_register_form").addEventListener("submit", function (e) {
    e.preventDefault();
    var login = $("ap_email").value.trim();
    var name = $("ap_customer_name").value.trim();
    var pw = $("ap_password").value;
    var pw2 = $("ap_password_check").value;
    var ok = true;

    if (!login) ok = setError("ap_email", "auth-email-invalid-email-alert", "Informe seu celular ou e-mail.") && ok;
    else if (!isEmail(login) && !isPhone(login)) ok = setError("ap_email", "auth-email-invalid-email-alert", "E-mail ou celular inválido.") && ok;
    else setError("ap_email", "auth-email-invalid-email-alert", "");

    ok = setError("ap_customer_name", "auth-customerName-missing-alert", !name ? "Digite seu nome." : "") && ok;

    if (!pw) ok = setError("ap_password", "auth-password-invalid-password-alert", "Crie uma senha.") && ok;
    else if (pw.length < 6) ok = setError("ap_password", "auth-password-invalid-password-alert", "A senha precisa de pelo menos 6 caracteres.") && ok;
    else setError("ap_password", "auth-password-invalid-password-alert", "");

    if (!pw2) ok = setError("ap_password_check", "auth-password-mismatch-alert", "Digite a senha novamente.") && ok;
    else if (pw !== pw2) ok = setError("ap_password_check", "auth-password-mismatch-alert", "As senhas não coincidem.") && ok;
    else setError("ap_password_check", "auth-password-mismatch-alert", "");

    if (!ok) return;
    state.login = login; state.name = name;
    show(4); // -> captcha intro
  });

  // ---------- Screen 4: captcha intro ----------
  $("amzn-captcha-verify-button").addEventListener("click", function () {
    buildCaptcha();
    show(5);
  });

  // ---------- Screen 5: captcha challenge ----------
  var ICONS = ["🏆", "🔔", "📷", "🎧", "🚀", "🎲", "🔑", "⭐"];
  var SLOTS = 8, RADIUS = 52, CENTER = 75;
  var captcha = { current: 0, target: 0 };

  function slotPos(i) {
    var ang = (-90 + i * (360 / SLOTS)) * Math.PI / 180;
    return { x: CENTER + RADIUS * Math.cos(ang), y: CENTER + RADIUS * Math.sin(ang) };
  }

  function buildCaptcha() {
    var orbit = $("captcha-orbit");
    orbit.querySelectorAll(".orbit-slot").forEach(function (n) { n.remove(); });

    captcha.target = Math.floor(Math.random() * SLOTS);
    captcha.current = (captcha.target + 3 + Math.floor(Math.random() * 3)) % SLOTS;
    var icon = ICONS[Math.floor(Math.random() * ICONS.length)];
    var num = Math.floor(10 + Math.random() * 89);

    $("target-icon").textContent = icon;
    $("orbit-icon").textContent = icon;
    $("target-num").textContent = num;

    for (var i = 0; i < SLOTS; i++) {
      var p = slotPos(i);
      var slot = document.createElement("div");
      slot.className = "orbit-slot" + (i === captcha.target ? " is-target" : "");
      slot.style.left = p.x + "px";
      slot.style.top = p.y + "px";
      slot.style.background = i === captcha.target ? "rgba(229,72,77,.15)" : "rgba(255,255,255,.06)";
      slot.textContent = i === captcha.target ? "◎" : "";
      orbit.appendChild(slot);
    }
    setError(null, "err-captcha", "");
    placeIcon();
  }

  function placeIcon() {
    var p = slotPos(captcha.current);
    $("orbit-icon").style.left = p.x + "px";
    $("orbit-icon").style.top = p.y + "px";
  }

  $("orbit-left").addEventListener("click", function () {
    captcha.current = (captcha.current - 1 + SLOTS) % SLOTS; placeIcon();
  });
  $("orbit-right").addEventListener("click", function () {
    captcha.current = (captcha.current + 1) % SLOTS; placeIcon();
  });
  $("amzn-captcha-refresh-button").addEventListener("click", buildCaptcha);

  $("amzn-btn-verify-internal").addEventListener("click", function () {
    if (captcha.current !== captcha.target) {
      setError(null, "err-captcha", "Posição incorreta. Mova o ícone até a órbita destacada.");
      return;
    }
    setError(null, "err-captcha", "");
    state.emailOtp = genOtp();
    $("cvf-account-claim").textContent = state.login;
    $("otp-email-debug").textContent = "Demo: seu código é " + state.emailOtp;
    show(6);
    $("cvf-input-code").focus();
  });

  // ---------- Screen 6: email OTP (cvf-input-code) ----------
  $("cvf-input-code").addEventListener("input", function () { this.value = this.value.replace(/\D/g, "").slice(0, 6); });
  $("verification-code-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var v = $("cvf-input-code").value.trim();
    if (v.length < 6) return setError("cvf-input-code", "cvf-input-code-alert", "Digite o código de 6 dígitos.");
    if (v !== state.emailOtp) return setError("cvf-input-code", "cvf-input-code-alert", "Código incorreto. Tente novamente.");
    setError("cvf-input-code", "cvf-input-code-alert", "");
    show(7);
  });
  $("cvf-resend-link").addEventListener("click", function (e) {
    e.preventDefault();
    state.emailOtp = genOtp();
    $("otp-email-debug").textContent = "Demo: novo código é " + state.emailOtp;
    $("cvf-input-code").value = "";
  });

  // ---------- Screen 7: add mobile (ap_phone_number) ----------
  $("ap_phone_number").addEventListener("input", function () { this.value = this.value.replace(/[^\d\s().-]/g, ""); });
  $("cvf-add-phone-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var num = $("ap_phone_number").value.trim();
    if (!num || num.replace(/\D/g, "").length < 8) return setError("ap_phone_number", "auth-phone-missing-alert", "Digite um número de celular válido.");
    setError("ap_phone_number", "auth-phone-missing-alert", "");
    state.phone = $("cvf-phone-country-code").value + " " + num;
    state.smsOtp = genOtp();
    $("cvf-phone-display").textContent = state.phone;
    $("sms-otp-debug").textContent = "Demo: seu OTP é " + state.smsOtp;
    show(8);
    $("cvf-input-code-phone").focus();
  });

  // ---------- Screen 8: sms OTP (cvf-input-code-phone) ----------
  $("cvf-input-code-phone").addEventListener("input", function () { this.value = this.value.replace(/\D/g, "").slice(0, 6); });
  $("cvf-verify-phone-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var v = $("cvf-input-code-phone").value.trim();
    if (v.length < 6) return setError("cvf-input-code-phone", "cvf-input-code-phone-alert", "Digite o código de 6 dígitos.");
    if (v !== state.smsOtp) return setError("cvf-input-code-phone", "cvf-input-code-phone-alert", "Código incorreto. Tente novamente.");
    setError("cvf-input-code-phone", "cvf-input-code-phone-alert", "");
    $("welcome-name").textContent = state.name.split(" ")[0] || state.name;
    show(9);
  });
  $("cvf-resend-link-phone").addEventListener("click", function (e) {
    e.preventDefault();
    state.smsOtp = genOtp();
    $("sms-otp-debug").textContent = "Demo: novo OTP é " + state.smsOtp;
    $("cvf-input-code-phone").value = "";
  });

  // ---------- restart ----------
  $("restart-btn").addEventListener("click", function () {
    document.querySelectorAll("form").forEach(function (f) { f.reset(); });
    state = { login: "", name: "", phone: "", emailOtp: "", smsOtp: "" };
    show(1);
  });

  show(1);
})();
