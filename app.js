const fmtMoney = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const fmtNum = new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 });

const state = {
  rows: [],
  warning: ""
};

const els = {
  originalPrincipal: document.getElementById("originalPrincipal"),
  startDate: document.getElementById("startDate"),
  termMonths: document.getElementById("termMonths"),
  billingCycleDays: document.getElementById("billingCycleDays"),
  monthlyExtraPrincipal: document.getElementById("monthlyExtraPrincipal"),
  rateTableBody: document.getElementById("rateTableBody"),
  extraTableBody: document.getElementById("extraTableBody"),
  principalChangeTableBody: document.getElementById("principalChangeTableBody"),
  addRateRow: document.getElementById("addRateRow"),
  addExtraRow: document.getElementById("addExtraRow"),
  addPrincipalChangeRow: document.getElementById("addPrincipalChangeRow"),
  calculateBtn: document.getElementById("calculateBtn"),
  exportBtn: document.getElementById("exportBtn"),
  importInput: document.getElementById("importInput"),
  resetBtn: document.getElementById("resetBtn"),
  summaryGrid: document.getElementById("summaryGrid"),
  comparisonGrid: document.getElementById("comparisonGrid"),
  resultBody: document.getElementById("resultBody"),
  warningText: document.getElementById("warningText"),
  principalChart: document.getElementById("principalChart"),
  paymentChart: document.getElementById("paymentChart")
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateObj, days) {
  const d = new Date(dateObj);
  d.setDate(d.getDate() + days);
  return d;
}

function toISODate(dateObj) {
  return dateObj.toISOString().slice(0, 10);
}

function formatShortDate(isoDate) {
  const d = parseDate(isoDate);
  if (!d) return isoDate;
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function daysBetween(fromDateObj, toDateObj) {
  return (toDateObj - fromDateObj) / 86400000;
}

function formatDurationFromDays(days) {
  if (!Number.isFinite(days) || days <= 0) return "0 months";
  const totalMonths = Math.round(days / 30.4368);
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const parts = [];
  if (years > 0) parts.push(`${years} yr${years === 1 ? "" : "s"}`);
  if (months > 0 || !parts.length) parts.push(`${months} mo${months === 1 ? "" : "s"}`);
  return parts.join(" ");
}

function parseNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function parseDate(value) {
  const d = new Date(value + "T00:00:00");
  return Number.isNaN(d.getTime()) ? null : d;
}

function monthlyPayment(principal, aprPercent, remainingMonths) {
  if (principal <= 0 || remainingMonths <= 0) return 0;
  const r = (aprPercent / 100) / 12;
  if (r === 0) return principal / remainingMonths;
  return (principal * r) / (1 - Math.pow(1 + r, -remainingMonths));
}

function rateForDate(sortedRates, dateObj) {
  let chosen = sortedRates[0];
  for (const r of sortedRates) {
    if (r.dateObj <= dateObj) chosen = r;
    if (r.dateObj > dateObj) break;
  }
  const hasDpr = rNum(chosen.dpr) > 0;
  const hasApr = rNum(chosen.apr) > 0;
  const dpr = hasDpr ? rNum(chosen.dpr) : (hasApr ? rNum(chosen.apr) / 100 / 365 : 0);
  const apr = hasApr ? rNum(chosen.apr) : dpr * 365 * 100;
  return { apr, dpr, date: chosen.date };
}

function rNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function monthlyExtraForDate(sortedChanges, dateObj, baseAmount) {
  let chosen = baseAmount;
  for (const c of sortedChanges) {
    if (c.dateObj <= dateObj) chosen = c.amount;
    else break;
  }
  return chosen;
}

function makeRateRow(data = {}) {
  const tpl = document.getElementById("rateRowTemplate");
  const tr = tpl.content.firstElementChild.cloneNode(true);
  tr.querySelector(".rate-date").value = data.date || todayISO();
  tr.querySelector(".rate-apr").value = data.apr ?? "";
  tr.querySelector(".rate-dpr").value = data.dpr ?? "";
  tr.querySelector(".remove-row").addEventListener("click", () => {
    tr.remove();
  });
  els.rateTableBody.appendChild(tr);
}

function makeExtraRow(data = {}) {
  const tpl = document.getElementById("extraRowTemplate");
  const tr = tpl.content.firstElementChild.cloneNode(true);
  tr.querySelector(".extra-date").value = data.date || todayISO();
  tr.querySelector(".extra-amount").value = data.amount ?? "";
  tr.querySelector(".remove-row").addEventListener("click", () => {
    tr.remove();
  });
  els.extraTableBody.appendChild(tr);
}

function makePrincipalChangeRow(data = {}) {
  const tpl = document.getElementById("principalChangeRowTemplate");
  const tr = tpl.content.firstElementChild.cloneNode(true);
  tr.querySelector(".pc-date").value = data.date || todayISO();
  tr.querySelector(".pc-amount").value = data.amount ?? "";
  tr.querySelector(".remove-row").addEventListener("click", () => {
    tr.remove();
  });
  els.principalChangeTableBody.appendChild(tr);
}

function collectInputs() {
  const rates = Array.from(els.rateTableBody.querySelectorAll("tr"))
    .map((tr) => ({
      date: tr.querySelector(".rate-date").value,
      apr: parseNumber(tr.querySelector(".rate-apr").value),
      dpr: parseNumber(tr.querySelector(".rate-dpr").value)
    }))
    .filter((r) => r.date);

  const extras = Array.from(els.extraTableBody.querySelectorAll("tr"))
    .map((tr) => ({
      date: tr.querySelector(".extra-date").value,
      amount: parseNumber(tr.querySelector(".extra-amount").value)
    }))
    .filter((e) => e.date && e.amount > 0);

  const principalChanges = Array.from(els.principalChangeTableBody.querySelectorAll("tr"))
    .map((tr) => ({
      date: tr.querySelector(".pc-date").value,
      amount: Math.max(0, parseNumber(tr.querySelector(".pc-amount").value))
    }))
    .filter((c) => c.date);

  return {
    originalPrincipal: parseNumber(els.originalPrincipal.value),
    startDate: els.startDate.value,
    termMonths: Math.max(1, Math.floor(parseNumber(els.termMonths.value))),
    billingCycleDays: Math.max(1, Math.floor(parseNumber(els.billingCycleDays.value))),
    monthlyExtraPrincipal: Math.max(0, parseNumber(els.monthlyExtraPrincipal.value)),
    rates,
    extras,
    principalChanges
  };
}

function validate(input) {
  if (input.originalPrincipal <= 0) return "Original principal must be greater than 0.";
  if (!input.startDate) return "Start date is required.";
  if (!input.rates.length) return "At least one rate row is required.";
  for (const r of input.rates) {
    if (!r.date) return "Each rate row needs a Rate Date.";
    if (r.apr <= 0 && r.dpr <= 0) return "Each rate row needs APR or Daily Periodic Rate.";
    if (r.apr > 0 && r.dpr > 0) {
      const impliedApr = r.dpr * 365 * 100;
      const ratio = impliedApr / r.apr;
      if (ratio > 1.5 || ratio < 0.67) {
        const correctDpr = (r.apr / 100 / 365).toFixed(8);
        return `Rate row dated ${r.date}: DPR ${r.dpr} implies an APR of ${impliedApr.toFixed(2)}%, `
          + `but you entered APR ${r.apr}%. For ${r.apr}% APR the DPR should be ${correctDpr} (APR / 100 / 365). `
          + `Fix the DPR, or leave it blank to derive it from APR automatically.`;
      }
    }
  }
  return "";
}

function simulate(input) {
  let principal = input.originalPrincipal;
  const startDate = parseDate(input.startDate);

  const rates = input.rates
    .map((r) => ({ ...r, dateObj: parseDate(r.date) }))
    .filter((r) => r.dateObj)
    .sort((a, b) => a.dateObj - b.dateObj);

  const extraMap = new Map();
  for (const e of input.extras) {
    extraMap.set(e.date, (extraMap.get(e.date) || 0) + e.amount);
  }

  const principalChanges = (input.principalChanges || [])
    .map((c) => ({ ...c, dateObj: parseDate(c.date) }))
    .filter((c) => c.dateObj)
    .sort((a, b) => a.dateObj - b.dateObj);

  const rows = [];
  let totalInterest = 0;
  let totalPrincipalPaid = 0;
  let totalScheduledPaid = 0;
  let totalMonthlyExtra = 0;
  let totalOneTimeExtra = 0;
  let warning = "";

  const maxCycles = input.termMonths * 4;
  let cycleStart = new Date(startDate);

  for (let cycle = 1; cycle <= maxCycles; cycle += 1) {
    if (principal <= 0.01) break;

    const remainingMonths = Math.max(1, input.termMonths - cycle + 1);
    const startRate = rateForDate(rates, cycleStart);
    const scheduledPayment = monthlyPayment(principal, startRate.apr, remainingMonths);

    let interestAccrued = 0;
    let sumDailyBalance = 0;
    let sumDailyRate = 0;
    let oneTimeExtraInCycle = 0;

    for (let day = 0; day < input.billingCycleDays; day += 1) {
      const d = addDays(cycleStart, day);
      const iso = toISODate(d);

      const extraPayment = extraMap.get(iso) || 0;
      if (extraPayment > 0) {
        const applied = Math.min(principal, extraPayment);
        principal -= applied;
        oneTimeExtraInCycle += applied;
      }

      const dailyRate = rateForDate(rates, d).dpr;
      sumDailyBalance += principal;
      sumDailyRate += dailyRate;
      interestAccrued += principal * dailyRate;

      if (principal <= 0.01) break;
    }

    const avgDailyBalance = sumDailyBalance / input.billingCycleDays;
    const avgDailyRate = sumDailyRate / input.billingCycleDays;

    const scheduledApplied = Math.min(principal + interestAccrued, scheduledPayment);
    const interestPaid = Math.min(interestAccrued, scheduledApplied);
    const principalFromScheduled = Math.max(0, scheduledApplied - interestPaid);
    principal -= principalFromScheduled;

    const monthlyExtraAmount = monthlyExtraForDate(principalChanges, cycleStart, input.monthlyExtraPrincipal);
    const monthlyExtraApplied = Math.min(principal, monthlyExtraAmount);
    principal -= monthlyExtraApplied;

    const cyclePrincipalPaid = principalFromScheduled + monthlyExtraApplied + oneTimeExtraInCycle;

    totalInterest += interestAccrued;
    totalPrincipalPaid += cyclePrincipalPaid;
    totalScheduledPaid += scheduledApplied;
    totalMonthlyExtra += monthlyExtraApplied;
    totalOneTimeExtra += oneTimeExtraInCycle;

    const cycleEnd = addDays(cycleStart, input.billingCycleDays - 1);

    rows.push({
      cycle,
      cycleEnd: toISODate(cycleEnd),
      apr: startRate.apr,
      dpr: avgDailyRate,
      adb: avgDailyBalance,
      interest: interestAccrued,
      scheduledPayment: scheduledApplied,
      monthlyExtra: monthlyExtraApplied,
      oneTimeExtra: oneTimeExtraInCycle,
      principalPaid: cyclePrincipalPaid,
      endingBalance: Math.max(0, principal)
    });

    if (scheduledApplied <= interestAccrued && monthlyExtraApplied <= 0 && oneTimeExtraInCycle <= 0) {
      warning = "Warning: payment is not covering interest in this cycle. Balance may not amortize without extra principal.";
      break;
    }

    cycleStart = addDays(cycleStart, input.billingCycleDays);
  }

  if (rows.length >= maxCycles && principal > 0.01 && !warning) {
    warning = "Reached cycle limit before payoff. Increase term or payment amount.";
  }

  const paidOff = principal <= 0.01;

  return {
    rows,
    warning,
    totals: {
      cycles: rows.length,
      totalInterest,
      totalPrincipalPaid,
      totalScheduledPaid,
      totalMonthlyExtra,
      totalOneTimeExtra,
      paidOff,
      payoffDate: paidOff && rows.length ? rows[rows.length - 1].cycleEnd : "Not paid off",
      finalBalance: rows.length ? rows[rows.length - 1].endingBalance : input.originalPrincipal
    }
  };
}

function renderSummary(totals) {
  const entries = [
    ["Cycles", totals.cycles],
    ["Payoff Date", totals.payoffDate],
    ["Total Interest", fmtMoney.format(totals.totalInterest)],
    ["Total Principal Paid", fmtMoney.format(totals.totalPrincipalPaid)],
    ["Scheduled Payments", fmtMoney.format(totals.totalScheduledPaid)],
    ["Monthly Extra Total", fmtMoney.format(totals.totalMonthlyExtra)],
    ["One-Time Extras Total", fmtMoney.format(totals.totalOneTimeExtra)],
    ["Final Balance", fmtMoney.format(totals.finalBalance)]
  ];

  els.summaryGrid.innerHTML = entries
    .map(([k, v]) => `<div class="kpi"><span class="label">${k}</span><span class="value">${v}</span></div>`)
    .join("");
}

function renderComparison(planTotals, baselineTotals) {
  const bothPaidOff = planTotals.paidOff && baselineTotals.paidOff;
  const planPayoff = parseDate(planTotals.payoffDate);
  const baselinePayoff = parseDate(baselineTotals.payoffDate);

  const interestSaved = baselineTotals.totalInterest - planTotals.totalInterest;
  const timeSavedDays = (bothPaidOff && planPayoff && baselinePayoff) ? daysBetween(planPayoff, baselinePayoff) : 0;

  const entries = [
    ["Minimum-Payment Payoff Date", baselineTotals.payoffDate],
    ["Your Plan Payoff Date", planTotals.payoffDate],
    ["Time Saved", timeSavedDays > 0 ? formatDurationFromDays(timeSavedDays) : "—"],
    ["Minimum-Payment Total Interest", baselineTotals.paidOff ? fmtMoney.format(baselineTotals.totalInterest) : "—"],
    ["Your Plan Total Interest", planTotals.paidOff ? fmtMoney.format(planTotals.totalInterest) : "—"],
    ["Interest Saved", bothPaidOff ? fmtMoney.format(Math.max(0, interestSaved)) : "—"]
  ];

  let note = "";
  if (!planTotals.paidOff && planTotals.cycles > 0) {
    note = "Your plan does not pay off the balance — payments are not covering interest. Check rate inputs and payment amounts.";
  } else if (!baselineTotals.paidOff && baselineTotals.cycles > 0) {
    note = "Minimum payments alone never pay off this balance, so interest/time saved cannot be computed.";
  }

  els.comparisonGrid.innerHTML = entries
    .map(([k, v]) => `<div class="kpi"><span class="label">${k}</span><span class="value">${v}</span></div>`)
    .join("")
    + (note ? `<p class="warning" style="grid-column: 1 / -1; margin: 4px 0 0;">${note}</p>` : "");
}

function renderTable(rows) {
  els.resultBody.innerHTML = rows
    .map((r) => `
      <tr>
        <td>${r.cycle}</td>
        <td>${r.cycleEnd}</td>
        <td>${fmtNum.format(r.apr)}</td>
        <td>${fmtNum.format(r.dpr)}</td>
        <td>${fmtMoney.format(r.adb)}</td>
        <td>${fmtMoney.format(r.interest)}</td>
        <td>${fmtMoney.format(r.scheduledPayment)}</td>
        <td>${fmtMoney.format(r.monthlyExtra)}</td>
        <td>${fmtMoney.format(r.oneTimeExtra)}</td>
        <td>${fmtMoney.format(r.principalPaid)}</td>
        <td>${fmtMoney.format(r.endingBalance)}</td>
      </tr>
    `)
    .join("");
}

function drawAxes(ctx, width, height, pad) {
  ctx.strokeStyle = "#cad8cf";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, pad);
  ctx.lineTo(pad, height - pad);
  ctx.lineTo(width - pad, height - pad);
  ctx.stroke();
}

function drawIndexTicks(ctx, rows, width, height, pad, tickCount = 5) {
  if (!rows.length) return;
  const count = Math.min(Math.max(2, tickCount), rows.length);
  const maxIndex = rows.length - 1;
  ctx.fillStyle = "#617077";
  ctx.strokeStyle = "#cad8cf";
  ctx.lineWidth = 1;
  ctx.font = "11px Trebuchet MS";
  ctx.textAlign = "center";

  for (let i = 0; i < count; i += 1) {
    const idx = Math.round((i * maxIndex) / (count - 1));
    const x = pad + ((idx / Math.max(1, maxIndex)) * (width - pad * 2));
    const label = formatShortDate(rows[idx].cycleEnd);
    ctx.beginPath();
    ctx.moveTo(x, height - pad);
    ctx.lineTo(x, height - pad + 6);
    ctx.stroke();
    ctx.fillText(label, x, height - pad + 18);
  }
}

function drawDateTicks(ctx, width, height, pad, startObj, endObj, tickCount = 6) {
  const totalDays = Math.max(1, daysBetween(startObj, endObj));
  const count = Math.max(2, tickCount);
  ctx.fillStyle = "#617077";
  ctx.strokeStyle = "#cad8cf";
  ctx.lineWidth = 1;
  ctx.font = "11px Trebuchet MS";
  ctx.textAlign = "center";

  for (let i = 0; i < count; i += 1) {
    const days = (i / (count - 1)) * totalDays;
    const x = pad + (days / totalDays) * (width - pad * 2);
    const label = formatShortDate(toISODate(addDays(startObj, Math.round(days))));
    ctx.beginPath();
    ctx.moveTo(x, height - pad);
    ctx.lineTo(x, height - pad + 6);
    ctx.stroke();
    ctx.fillText(label, x, height - pad + 18);
  }
}

function drawSeriesLine(ctx, rows, startObj, totalDays, maxY, w, h, pad) {
  ctx.beginPath();
  rows.forEach((r, i) => {
    const days = daysBetween(startObj, parseDate(r.cycleEnd));
    const x = pad + (days / totalDays) * (w - pad * 2);
    const y = h - pad - ((r.endingBalance / maxY) * (h - pad * 2));
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function drawPrincipalChart(planRows, baselineRows, startDateIso) {
  const canvas = els.principalChart;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const pad = 40;
  ctx.clearRect(0, 0, w, h);
  drawAxes(ctx, w, h, pad);
  if (!planRows.length && !baselineRows.length) return;

  const startObj = parseDate(startDateIso);
  const allRows = [...planRows, ...baselineRows];
  const maxY = Math.max(...allRows.map((r) => r.endingBalance), 1);
  const maxEndObj = allRows.reduce((max, r) => {
    const d = parseDate(r.cycleEnd);
    return d > max ? d : max;
  }, startObj);
  const totalDays = Math.max(1, daysBetween(startObj, maxEndObj));

  if (baselineRows.length) {
    ctx.save();
    ctx.strokeStyle = "#d97706";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    drawSeriesLine(ctx, baselineRows, startObj, totalDays, maxY, w, h, pad);
    ctx.restore();
  }

  if (planRows.length) {
    ctx.strokeStyle = "#0f766e";
    ctx.lineWidth = 2.5;
    drawSeriesLine(ctx, planRows, startObj, totalDays, maxY, w, h, pad);
  }

  ctx.fillStyle = "#0f766e";
  ctx.fillRect(pad + 8, pad + 4, 10, 10);
  ctx.fillStyle = "#35505f";
  ctx.font = "12px Trebuchet MS";
  ctx.fillText("Your Plan", pad + 22, pad + 12);
  ctx.fillStyle = "#d97706";
  ctx.fillRect(pad + 100, pad + 4, 10, 10);
  ctx.fillStyle = "#35505f";
  ctx.fillText("Minimum Payments", pad + 114, pad + 12);

  drawDateTicks(ctx, w, h, pad, startObj, maxEndObj, 6);
}

function drawPaymentChart(rows) {
  const canvas = els.paymentChart;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const pad = 40;
  ctx.clearRect(0, 0, w, h);
  drawAxes(ctx, w, h, pad);
  if (!rows.length) return;

  const maxVal = Math.max(
    ...rows.map((r) => Math.max(r.interest, r.principalPaid)),
    1
  );

  const bars = Math.min(rows.length, 36);
  const sampled = rows.filter((_, i) => i % Math.ceil(rows.length / bars) === 0).slice(0, bars);
  const barGap = 3;
  const slot = (w - pad * 2) / sampled.length;
  const barW = Math.max(2, (slot - barGap) / 2);

  sampled.forEach((r, i) => {
    const x0 = pad + i * slot;
    const intH = (r.interest / maxVal) * (h - pad * 2);
    const prinH = (r.principalPaid / maxVal) * (h - pad * 2);

    ctx.fillStyle = "#d97706";
    ctx.fillRect(x0, h - pad - intH, barW, intH);
    ctx.fillStyle = "#0f766e";
    ctx.fillRect(x0 + barW + barGap, h - pad - prinH, barW, prinH);
  });

  ctx.fillStyle = "#35505f";
  ctx.font = "12px Trebuchet MS";
  ctx.fillText("Interest", pad + 8, pad + 12);
  ctx.fillStyle = "#0f766e";
  ctx.fillRect(pad + 65, pad + 4, 10, 10);
  ctx.fillStyle = "#d97706";
  ctx.fillRect(pad + 8, pad + 4, 10, 10);
  ctx.fillStyle = "#35505f";
  ctx.fillText("Principal", pad + 80, pad + 12);
  drawIndexTicks(ctx, sampled, w, h, pad, 6);
}

function renderAll(result, baselineResult, startDateIso) {
  state.rows = result.rows;
  state.warning = result.warning;
  renderSummary(result.totals);
  renderComparison(result.totals, baselineResult.totals);
  renderTable(result.rows);
  drawPrincipalChart(result.rows, baselineResult.rows, startDateIso);
  drawPaymentChart(result.rows);
  els.warningText.textContent = result.warning;
}

function exportScenario() {
  const input = collectInputs();
  const payload = {
    schema: "heloc-amortization-v1",
    exportedAt: new Date().toISOString(),
    ...input
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "heloc-scenario.json";
  a.click();
  URL.revokeObjectURL(url);
}

function normalizeImportedData(data) {
  return {
    originalPrincipal: parseNumber(data.originalPrincipal ?? data.originalMortgage ?? data.originalBalance),
    startDate: String(data.startDate ?? data.loanStartDate ?? ""),
    termMonths: Math.max(1, Math.floor(parseNumber(data.termMonths ?? data.loanTermMonths ?? 360))),
    billingCycleDays: Math.max(1, Math.floor(parseNumber(data.billingCycleDays ?? data.daysInBillingCycle ?? 30))),
    monthlyExtraPrincipal: Math.max(0, parseNumber(data.monthlyExtraPrincipal ?? data.monthlyAdditionalPrincipal ?? data.monthlyExtra ?? 0)),
    rates: Array.isArray(data.rates) ? data.rates : (Array.isArray(data.rateChanges) ? data.rateChanges : []),
    extras: Array.isArray(data.extras)
      ? data.extras
      : (Array.isArray(data.additionalPayments)
        ? data.additionalPayments
        : (Array.isArray(data.extraPayments) ? data.extraPayments : [])),
    principalChanges: Array.isArray(data.principalChanges)
      ? data.principalChanges
      : (Array.isArray(data.monthlyExtraChanges) ? data.monthlyExtraChanges : [])
  };
}

function importScenario(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const raw = String(reader.result ?? "");
      const parsed = JSON.parse(raw.replace(/^\uFEFF/, "").trim());
      const data = normalizeImportedData(parsed);

      els.originalPrincipal.value = data.originalPrincipal || 0;
      els.startDate.value = data.startDate || todayISO();
      els.termMonths.value = data.termMonths;
      els.billingCycleDays.value = data.billingCycleDays;
      els.monthlyExtraPrincipal.value = data.monthlyExtraPrincipal;

      els.rateTableBody.innerHTML = "";
      els.extraTableBody.innerHTML = "";
      els.principalChangeTableBody.innerHTML = "";

      const rates = Array.isArray(data.rates) ? data.rates : [];
      const extras = Array.isArray(data.extras) ? data.extras : [];
      const principalChanges = Array.isArray(data.principalChanges) ? data.principalChanges : [];
      if (!rates.length) makeRateRow({ date: todayISO(), apr: 7.0 });
      else rates.forEach((r) => makeRateRow(r));
      extras.forEach((e) => makeExtraRow(e));
      principalChanges.forEach((c) => makePrincipalChangeRow(c));

      runCalculation();
    } catch (_err) {
      window.alert("Invalid JSON/JASON file.");
    }
  };
  reader.readAsText(file);
}

function offerRateRowAutoFix() {
  const badRows = [];
  for (const tr of els.rateTableBody.querySelectorAll("tr")) {
    const apr = parseNumber(tr.querySelector(".rate-apr").value);
    const dpr = parseNumber(tr.querySelector(".rate-dpr").value);
    if (apr > 0 && dpr > 0) {
      const impliedApr = dpr * 365 * 100;
      const ratio = impliedApr / apr;
      if (ratio > 1.5 || ratio < 0.67) badRows.push({ tr, apr });
    }
  }
  if (!badRows.length) return true;

  const ok = window.confirm(
    `${badRows.length} rate row(s) have a Daily Periodic Rate that doesn't match their APR `
    + `(this usually happens when DPR is computed as APR / 365 instead of APR / 100 / 365).\n\n`
    + `Click OK to auto-correct the DPR values from the APR, or Cancel to fix them manually.`
  );
  if (ok) {
    for (const { tr, apr } of badRows) {
      tr.querySelector(".rate-dpr").value = (apr / 100 / 365).toFixed(8);
    }
  }
  return ok;
}

function runCalculation() {
  if (!offerRateRowAutoFix()) return;
  const input = collectInputs();
  const error = validate(input);
  if (error) {
    window.alert(error);
    return;
  }
  const result = simulate(input);
  const baselineInput = { ...input, monthlyExtraPrincipal: 0, extras: [], principalChanges: [] };
  const baselineResult = simulate(baselineInput);
  renderAll(result, baselineResult, input.startDate);
}

function resetAll() {
  els.originalPrincipal.value = 350000;
  els.startDate.value = todayISO();
  els.termMonths.value = 360;
  els.billingCycleDays.value = 30;
  els.monthlyExtraPrincipal.value = 0;
  els.rateTableBody.innerHTML = "";
  els.extraTableBody.innerHTML = "";
  els.principalChangeTableBody.innerHTML = "";
  makeRateRow({ date: todayISO(), apr: 7.0 });
  const emptyResult = {
    rows: [],
    warning: "",
    totals: {
      cycles: 0,
      totalInterest: 0,
      totalPrincipalPaid: 0,
      totalScheduledPaid: 0,
      totalMonthlyExtra: 0,
      totalOneTimeExtra: 0,
      payoffDate: "N/A",
      finalBalance: parseNumber(els.originalPrincipal.value)
    }
  };
  renderAll(emptyResult, emptyResult, els.startDate.value);
}

function init() {
  if (!els.startDate.value) {
    els.startDate.value = todayISO();
  }
  makeRateRow({ date: els.startDate.value || todayISO(), apr: 7.0 });

  els.addRateRow.addEventListener("click", () => makeRateRow({ date: todayISO() }));
  els.addExtraRow.addEventListener("click", () => makeExtraRow({ date: todayISO(), amount: 0 }));
  els.addPrincipalChangeRow.addEventListener("click", () => makePrincipalChangeRow({ date: todayISO(), amount: 0 }));
  els.calculateBtn.addEventListener("click", runCalculation);
  els.exportBtn.addEventListener("click", exportScenario);
  els.importInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) importScenario(file);
    e.target.value = "";
  });
  els.resetBtn.addEventListener("click", resetAll);

  runCalculation();
}

init();
