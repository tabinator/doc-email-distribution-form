const REST_ENDPOINT = "";

const form = document.querySelector("#status-form");
const themeToggle = document.querySelector("#theme-toggle");
const reviewButton = document.querySelector("#review-button");
const submitButton = document.querySelector("#submit-button");
const payloadPreview = document.querySelector("#payload-preview");
const submitStatus = document.querySelector("#submit-status");
const actionField = form.elements.action;
const subjectField = form.elements.subject;
const distributionGroupInputs = [...form.querySelectorAll('input[name="distributionGroups"]')];

let currentPayload = null;

const actionSubjectMap = {
  activation: "DOC Activation Notice",
  deactivation: "DOC Deactivation Notice",
};

const subjectActionMap = Object.fromEntries(
  Object.entries(actionSubjectMap).map(([action, subject]) => [subject, action]),
);

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem("doc-status-theme", theme);
  } catch {
    // Storage can be blocked in strict browser settings.
  }
  themeToggle.textContent = theme === "dark" ? "Light mode" : "Dark mode";
  themeToggle.setAttribute("aria-pressed", String(theme === "dark"));
}

function getLocalDateTimeValue() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

function getFormPayload() {
  const data = new FormData(form);
  return {
    action: data.get("action"),
    statusLevel: data.get("statusLevel"),
    staffingLevel: data.get("staffingLevel"),
    stormEvent: data.get("stormEvent"),
    effectiveDateTime: data.get("effectiveDateTime"),
    incidentName: data.get("incidentName").trim(),
    docPosition: data.get("docPosition").trim(),
    name: data.get("name").trim(),
    subject: data.get("subject").trim(),
    messageBody: data.get("messageBody").trim(),
    distributionGroups: data.getAll("distributionGroups"),
    requestedAt: new Date().toISOString(),
  };
}

function renderPayload(payload) {
  payloadPreview.textContent = JSON.stringify(payload, null, 2);
}

function reviewPayload() {
  submitStatus.textContent = "";
  const hasDistributionGroup = distributionGroupInputs.some((input) => input.checked);
  distributionGroupInputs[0].setCustomValidity(
    hasDistributionGroup ? "" : "Select at least one distribution group.",
  );

  if (!form.reportValidity()) {
    currentPayload = null;
    submitButton.disabled = true;
    return;
  }

  currentPayload = getFormPayload();
  renderPayload(currentPayload);
  submitButton.disabled = false;
}

async function submitPayload() {
  if (!currentPayload) {
    reviewPayload();
  }

  if (!currentPayload) {
    return;
  }

  submitButton.disabled = true;
  submitStatus.textContent = "Submitting request...";

  if (!REST_ENDPOINT) {
    await new Promise((resolve) => {
      setTimeout(resolve, 450);
    });
    submitStatus.textContent = "Mock submit complete. Backend endpoint not configured.";
    submitButton.disabled = false;
    return;
  }

  try {
    const response = await fetch(REST_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(currentPayload),
    });

    if (!response.ok) {
      throw new Error(`Request failed with ${response.status}`);
    }

    submitStatus.textContent = "Request submitted.";
  } catch (error) {
    submitStatus.textContent = error.message;
    submitButton.disabled = false;
  }
}

function clearReviewedPayload() {
  currentPayload = null;
  submitButton.disabled = true;
  submitStatus.textContent = "";
}

function syncSubjectToAction() {
  subjectField.value = actionSubjectMap[actionField.value] || "";
  updateMessageBody();
  clearReviewedPayload();
}

function syncActionToSubject() {
  actionField.value = subjectActionMap[subjectField.value] || "";
  updateMessageBody();
  clearReviewedPayload();
}

function formatMessageDateTime(value) {
  if (!value) {
    return "{Date and Time}";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

function getFieldValue(name, fallback) {
  const value = form.elements[name].value.trim();
  return value || fallback;
}

function getActivationMessageBody() {
  const effectiveDateTime = formatMessageDateTime(form.elements.effectiveDateTime.value);
  const incidentName = getFieldValue("incidentName", "{Event/Incident Name}");
  const statusLevel = getFieldValue("statusLevel", "{Status Level}");
  const staffingLevel = getFieldValue("staffingLevel", "{Staffing Level}");
  const baseMessage = `The Department Operations Center (DOC) is activated beginning ${effectiveDateTime}. OCPW DOC is activated to support the ${incidentName}. OCPW is currently activated at a ${statusLevel} with ${staffingLevel} staffing.`;

  if (form.elements.stormEvent.value !== "Yes") {
    return baseMessage;
  }

  return `${baseMessage}

Increased emphasis is being placed on monitoring storm flows and inlet grates historically subject to plugging or overtopping. Resources are also focused on protecting the burn areas at the Canyons, Bond Fire Burn Area, Airport Burn Area, and Unincorporated areas of Orange County. Regularly scheduled work may be delated due to the reallocation of resources.

Report storm related problems to (714) 955-0333. This number is operational only when the DOC is open.`;
}

function getDeactivationMessageBody() {
  const effectiveDateTime = formatMessageDateTime(form.elements.effectiveDateTime.value);
  return `The Department Operations Center (DOC) is now deactivated on ${effectiveDateTime}.`;
}

function updateMessageBody() {
  if (actionField.value === "activation") {
    form.elements.messageBody.value = getActivationMessageBody();
    return;
  }

  if (actionField.value === "deactivation") {
    form.elements.messageBody.value = getDeactivationMessageBody();
  }
}

themeToggle.addEventListener("click", () => {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  setTheme(nextTheme);
});

actionField.addEventListener("change", syncSubjectToAction);
subjectField.addEventListener("change", syncActionToSubject);
reviewButton.addEventListener("click", reviewPayload);
submitButton.addEventListener("click", submitPayload);

["effectiveDateTime", "incidentName", "statusLevel", "staffingLevel", "stormEvent"].forEach((name) => {
  form.elements[name].addEventListener("input", () => {
    updateMessageBody();
    clearReviewedPayload();
  });
});

distributionGroupInputs.forEach((input) => {
  input.addEventListener("change", () => {
    distributionGroupInputs[0].setCustomValidity("");
    clearReviewedPayload();
  });
});

form.addEventListener("reset", () => {
  currentPayload = null;
  submitButton.disabled = true;
  submitStatus.textContent = "";
  payloadPreview.textContent = "Payload pending.";
  window.setTimeout(() => {
    form.elements.effectiveDateTime.value = getLocalDateTimeValue();
  }, 0);
});

form.elements.effectiveDateTime.value = getLocalDateTimeValue();
setTheme(document.documentElement.dataset.theme || "light");
