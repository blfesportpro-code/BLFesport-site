(() => {
  "use strict";
  const API = "https://blfesport-assistant.enzo-reuziault.workers.dev";
  const root = document.createElement("div");
  root.id = "blf-assistant";
  root.innerHTML = `
    <button class="blf-ai-launch" type="button" aria-label="Ouvrir l'assistant BLFesport"><span class="blf-ai-mark">BLF</span><span class="blf-ai-launch-label">Assistant</span></button>
    <section class="blf-ai-panel" aria-label="Assistant BLFesport" hidden>
      <header class="blf-ai-head"><div><strong>BLF Assistant</strong><small>Assistant officiel BLFesport</small></div><button class="blf-ai-close" type="button" aria-label="Fermer">×</button></header>
      <div class="blf-ai-messages" aria-live="polite"><div class="blf-ai-msg bot">Salut ! Je suis l'assistant BLFesport. Que veux-tu savoir sur nos équipes, nos matchs ou notre organisation ?</div></div>
      <form class="blf-ai-form"><input maxlength="1000" autocomplete="off" placeholder="Écris ton message..." aria-label="Ton message" required><button type="submit" aria-label="Envoyer">➤</button></form>
      <div class="blf-ai-foot">Les réponses peuvent contenir des erreurs. Vérifie les informations importantes sur notre Discord.</div>
    </section>`;
  document.body.appendChild(root);
  const panel = root.querySelector(".blf-ai-panel");
  const launch = root.querySelector(".blf-ai-launch");
  const close = root.querySelector(".blf-ai-close");
  const form = root.querySelector("form");
  const input = form.querySelector("input");
  const messages = root.querySelector(".blf-ai-messages");
  let busy = false;
  let clientId = "";
  try {
    clientId = localStorage.getItem("blf-ai-client") || "";
    if (!clientId) {
      clientId = (crypto.randomUUID ? crypto.randomUUID() : "blf-" + Math.random().toString(36).slice(2) + Date.now().toString(36));
      localStorage.setItem("blf-ai-client", clientId);
    }
  } catch {
    clientId = "blf-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
  function renderFormattedText(node, text) {
    const pattern = /(\*\*([^*]+)\*\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<]+))/g;
    let lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (match.index > lastIndex) node.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
      if (match[2] !== undefined) {
        const strong = document.createElement("strong");
        strong.textContent = match[2];
        node.appendChild(strong);
      } else {
        const label = match[3] || match[4] || match[5];
        const href = match[4] || match[5];
        const cleanHref = href.replace(/[.,!?;:]+$/, "");
        const link = document.createElement("a");
        link.href = cleanHref;
        link.textContent = label.replace(/[.,!?;:]+$/, "");
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        node.appendChild(link);
        const trailing = label.slice(link.textContent.length);
        if (trailing) node.appendChild(document.createTextNode(trailing));
      }
      lastIndex = pattern.lastIndex;
    }
    if (lastIndex < text.length) node.appendChild(document.createTextNode(text.slice(lastIndex)));
  }
  function add(text, type) {
    const node = document.createElement("div");
    node.className = "blf-ai-msg " + type;
    String(text).split("\n").forEach((line, index) => {
      if (index) node.appendChild(document.createElement("br"));
      renderFormattedText(node, line);
    });
    messages.appendChild(node);
    messages.scrollTop = messages.scrollHeight;
    return node;
  }
  launch.addEventListener("click", () => { panel.hidden = false; launch.hidden = true; input.focus(); });
  close.addEventListener("click", () => { panel.hidden = true; launch.hidden = false; });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const message = input.value.trim();
    if (!message || busy) return;
    add(message, "user");
    input.value = "";
    busy = true;
    const send = form.querySelector("button");
    send.disabled = true;
    const pending = add("Je réfléchis…", "bot pending");
    try {
      if (API.includes("YOUR-SUBDOMAIN")) {
        throw new Error("L'assistant n'est pas encore connecté à son serveur Cloudflare. La configuration du serveur reste à terminer.");
      }
      const response = await fetch(API + "/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-BLF-Client": clientId },
        body: JSON.stringify({ message })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Impossible d'obtenir une réponse (erreur " + response.status + ").");
      pending.remove();
      add(data.answer || "Je n'ai pas réussi à formuler une réponse.", "bot");
    } catch (error) {
      pending.remove();
      add(error.message || "Le serveur est momentanément indisponible.", "bot error");
    } finally {
      busy = false;
      send.disabled = false;
      input.focus();
    }
  });
})();