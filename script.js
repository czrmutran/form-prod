// Aurora sign-up — replicates Amazon's 8-screen create-account flow with original UI.
// Element IDs mirror Amazon's real auth pages (ap_*, cvf-*, continue, auth-*-alert).
// Screens: 1 email -> 2 confirm-new -> 3 details -> 4 captcha-intro -> 5 captcha
//          -> 6 email OTP -> 7 add mobile -> 8 sms OTP -> 9 success
(function () {
  "use strict";

  var state = { login: "", name: "", phone: "", emailOtp: "", smsOtp: "" };
  function $(id) { return document.getElementById(id); }
  var PROGRESS = { 1: 12, 2: 25, 3: 40, 4: 52, 5: 64, 6: 76, 7: 88, 8: 96, 9: 100 };

  // Render ONE screen at a time in the DOM — like Amazon's page-per-step.
  // This keeps generic selectors (input[type=submit], getByText, ...) unambiguous,
  // exactly as they would be on a real single-page-per-step server flow.
  var cardWrap = document.querySelector(".card-wrap");
  var screenNodes = {};
  Array.prototype.slice.call(document.querySelectorAll(".card[data-screen]")).forEach(function (s) {
    screenNodes[+s.getAttribute("data-screen")] = s;
  });

  // Fill a screen's dynamic fields from state, AFTER it is attached to the DOM.
  function populate(n) {
    if (n === 2) { $("ap_email_display").textContent = state.login; }
    if (n === 3) { $("ap_email").value = state.login; }
    if (n === 6) {
      $("cvf-account-claim").textContent = state.login;
      $("otp-email-debug").textContent = state.emailOtp ? "Demo: seu código é " + state.emailOtp : "";
    }
    if (n === 8) {
      $("cvf-phone-display").textContent = state.phone;
      $("sms-otp-debug").textContent = state.smsOtp ? "Demo: seu OTP é " + state.smsOtp : "";
    }
    if (n === 9) { $("welcome-name").textContent = state.name.split(" ")[0] || state.name; }
  }

  function show(n) {
    Object.keys(screenNodes).forEach(function (k) {
      var node = screenNodes[k];
      if (+k === n) {
        node.classList.remove("hidden"); // drop the static initial-hidden class
        if (!node.parentNode) cardWrap.appendChild(node);
      } else if (node.parentNode) {
        node.parentNode.removeChild(node);
      }
    });
    populate(n);
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

  // ---------- Screen 1: literal Amazon claim-collection (ap_login_form) ----------
  // Amazon shows/hides separate inline alert boxes via the aok-hidden class.
  var CLAIM_ALERTS = ["empty-claim-alert", "invalid-phone-alert", "invalid-email-alert", "error-alert"];
  function hideClaimAlerts() {
    CLAIM_ALERTS.forEach(function (id) { $(id).classList.add("aok-hidden"); });
  }
  $("claim-input-clear-button").addEventListener("click", function () {
    $("ap_email_login").value = ""; $("ap_email_login").focus();
    hideClaimAlerts();
  });
  $("ap_login_form").addEventListener("submit", function (e) {
    e.preventDefault();
    hideClaimAlerts();
    var v = $("ap_email_login").value.trim();
    if (!v) { $("empty-claim-alert").classList.remove("aok-hidden"); return; }
    if (!isEmail(v) && !isPhone(v)) {
      $(v.indexOf("@") > -1 ? "invalid-email-alert" : "invalid-phone-alert").classList.remove("aok-hidden");
      return;
    }
    state.login = v;
    show(2); // populate() fills ap_email_display / ap_email from state
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

  // ---------- Screen 4: Arkose (aacb) captcha relay — mirrors Amazon's /ap/cvf/request ----------
  // The challenge runs inside the nested iframe (#aacb-arkose-frame) and posts
  // challenge-* events; this parent relays them as aa-challenge-* (postChallengeEvent),
  // exactly like the official page, and advances the flow on challenge-complete.
  function postChallengeEvent(eventId, payload) {
    var message = payload
      ? JSON.stringify({ eventId: eventId, payload: payload })
      : JSON.stringify({ eventId: eventId });
    window.postMessage(message, "*");
    if (window !== parent) parent.postMessage(message, "*");
  }

  function generateCustomerSupportPage() {
    var link = $("aa_arkose_customer_support_link");
    if (link) link.addEventListener("click", function (e) { e.preventDefault(); });
    return false;
  }
  generateCustomerSupportPage();

  window.addEventListener("message", function (event) {
    var data;
    try { data = JSON.parse(event.data); } catch (ex) { return; }
    if (!data || !data.eventId) return;
    switch (data.eventId) {
      case "challenge-shown":
        postChallengeEvent("aa-challenge-shown", data.payload);
        break;
      case "challenge-loaded": {
        var sp = $("aacb-arkose-spinner");
        if (sp) sp.style.display = "none";
        postChallengeEvent("aa-challenge-loaded", data.payload);
        break;
      }
      case "challenge-complete":
        postChallengeEvent("aa-challenge-complete", data.payload);
        // Advance the create-account flow (the real flow would carry the Arkose token).
        state.emailOtp = genOtp();
        show(6); // populate() fills cvf-account-claim / otp-email-debug from state
        $("cvf-input-code").focus();
        break;
    }
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
    show(8); // populate() fills cvf-phone-display / sms-otp-debug from state
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
    show(9); // populate() fills welcome-name from state
  });
  $("cvf-resend-link-phone").addEventListener("click", function (e) {
    e.preventDefault();
    state.smsOtp = genOtp();
    $("sms-otp-debug").textContent = "Demo: novo OTP é " + state.smsOtp;
    $("cvf-input-code-phone").value = "";
  });

  // ---------- restart ----------
  $("restart-btn").addEventListener("click", function () {
    // Reset forms across all screens, including detached ones.
    Object.keys(screenNodes).forEach(function (k) {
      screenNodes[k].querySelectorAll("form").forEach(function (f) { f.reset(); });
    });
    state = { login: "", name: "", phone: "", emailOtp: "", smsOtp: "" };
    show(1);
  });

  show(1);
})();
