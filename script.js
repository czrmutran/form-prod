// Aurora sign-up — replicates Amazon's 8-screen create-account flow with original UI.
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

  // ---------- Screen 1: email/mobile ----------
  $("clear-login").addEventListener("click", function () {
    $("login").value = ""; $("login").focus(); setError("login", "err-login", "");
  });
  $("form-1").addEventListener("submit", function (e) {
    e.preventDefault();
    var v = $("login").value.trim();
    if (!v) return setError("login", "err-login", "Informe seu celular ou e-mail.");
    if (!isEmail(v) && !isPhone(v)) return setError("login", "err-login", "Endereço de e-mail ou celular inválido.");
    setError("login", "err-login", "");
    state.login = v;
    $("confirm-email").textContent = v;
    $("login3").value = v;
    show(2);
  });

  // ---------- Screen 2: confirm new ----------
  $("proceed-create").addEventListener("click", function () { show(3); });

  // ---------- Screen 3: account details ----------
  $("form-3").addEventListener("submit", function (e) {
    e.preventDefault();
    var login = $("login3").value.trim();
    var name = $("name").value.trim();
    var pw = $("password").value;
    var pw2 = $("password2").value;
    var ok = true;

    if (!login) ok = setError("login3", "err-login3", "Informe seu celular ou e-mail.") && ok;
    else if (!isEmail(login) && !isPhone(login)) ok = setError("login3", "err-login3", "E-mail ou celular inválido.") && ok;
    else setError("login3", "err-login3", "");

    ok = setError("name", "err-name", !name ? "Digite seu nome." : "") && ok;

    if (!pw) ok = setError("password", "err-password", "Crie uma senha.") && ok;
    else if (pw.length < 6) ok = setError("password", "err-password", "A senha precisa de pelo menos 6 caracteres.") && ok;
    else setError("password", "err-password", "");

    if (!pw2) ok = setError("password2", "err-password2", "Digite a senha novamente.") && ok;
    else if (pw !== pw2) ok = setError("password2", "err-password2", "As senhas não coincidem.") && ok;
    else setError("password2", "err-password2", "");

    if (!ok) return;
    state.login = login; state.name = name;
    show(4); // -> captcha intro
  });

  // ---------- Screen 4: captcha intro ----------
  $("start-puzzle").addEventListener("click", function () {
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
    // remove previously rendered slots
    orbit.querySelectorAll(".orbit-slot").forEach(function (n) { n.remove(); });

    captcha.target = Math.floor(Math.random() * SLOTS);
    captcha.current = (captcha.target + 3 + Math.floor(Math.random() * 3)) % SLOTS; // start away from target
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
  $("refresh-puzzle").addEventListener("click", buildCaptcha);

  $("submit-puzzle").addEventListener("click", function () {
    if (captcha.current !== captcha.target) {
      setError(null, "err-captcha", "Posição incorreta. Mova o ícone até a órbita destacada.");
      return;
    }
    setError(null, "err-captcha", "");
    // captcha solved -> send email OTP
    state.emailOtp = genOtp();
    $("otp-email-target").textContent = state.login;
    $("otp-email-debug").textContent = "Demo: seu código é " + state.emailOtp;
    show(6);
    $("email-otp").focus();
  });

  // ---------- Screen 6: email OTP ----------
  $("email-otp").addEventListener("input", function () { this.value = this.value.replace(/\D/g, "").slice(0, 6); });
  $("form-6").addEventListener("submit", function (e) {
    e.preventDefault();
    var v = $("email-otp").value.trim();
    if (v.length < 6) return setError("email-otp", "err-email-otp", "Digite o código de 6 dígitos.");
    if (v !== state.emailOtp) return setError("email-otp", "err-email-otp", "Código incorreto. Tente novamente.");
    setError("email-otp", "err-email-otp", "");
    show(7);
  });
  $("resend-email").addEventListener("click", function (e) {
    e.preventDefault();
    state.emailOtp = genOtp();
    $("otp-email-debug").textContent = "Demo: novo código é " + state.emailOtp;
    $("email-otp").value = "";
  });

  // ---------- Screen 7: add mobile ----------
  $("mobile").addEventListener("input", function () { this.value = this.value.replace(/[^\d\s().-]/g, ""); });
  $("form-7").addEventListener("submit", function (e) {
    e.preventDefault();
    var num = $("mobile").value.trim();
    if (!num || num.replace(/\D/g, "").length < 8) return setError("mobile", "err-mobile", "Digite um número de celular válido.");
    setError("mobile", "err-mobile", "");
    state.phone = $("country").value + " " + num;
    state.smsOtp = genOtp();
    $("phone-target").textContent = state.phone;
    $("sms-otp-debug").textContent = "Demo: seu OTP é " + state.smsOtp;
    show(8);
    $("sms-otp").focus();
  });

  // ---------- Screen 8: sms OTP ----------
  $("sms-otp").addEventListener("input", function () { this.value = this.value.replace(/\D/g, "").slice(0, 6); });
  $("form-8").addEventListener("submit", function (e) {
    e.preventDefault();
    var v = $("sms-otp").value.trim();
    if (v.length < 6) return setError("sms-otp", "err-sms-otp", "Digite o código de 6 dígitos.");
    if (v !== state.smsOtp) return setError("sms-otp", "err-sms-otp", "Código incorreto. Tente novamente.");
    setError("sms-otp", "err-sms-otp", "");
    $("welcome-name").textContent = state.name.split(" ")[0] || state.name;
    show(9);
  });
  $("resend-sms").addEventListener("click", function (e) {
    e.preventDefault();
    state.smsOtp = genOtp();
    $("sms-otp-debug").textContent = "Demo: novo OTP é " + state.smsOtp;
    $("sms-otp").value = "";
  });

  // ---------- restart ----------
  $("restart-btn").addEventListener("click", function () {
    document.querySelectorAll("form").forEach(function (f) { f.reset(); });
    state = { login: "", name: "", phone: "", emailOtp: "", smsOtp: "" };
    show(1);
  });

  show(1);
})();
