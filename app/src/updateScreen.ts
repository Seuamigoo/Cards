export type UpdateView =
  | { readonly phase: "checking" }
  | { readonly phase: "mandatory"; readonly progress: number }
  | { readonly phase: "visual"; readonly progress: number }
  | { readonly phase: "current" }
  | { readonly phase: "offline" };

/**
 * Stub no lugar do plugin updater do Tauri, que fica com o Engine Cards.
 * No dev o app segue para a entrada. `preview` só existe para revisar os estados.
 */
export function stubUpdateView(input: { readonly dev: boolean; readonly online: boolean; readonly preview: string | null }): UpdateView {
  if (input.dev && (input.preview === null || input.preview.length === 0)) {
    return { phase: "current" };
  }
  switch (input.preview) {
    case "checking":
      return { phase: "checking" };
    case "mandatory":
      return { phase: "mandatory", progress: 0.4 };
    case "visual":
      return { phase: "visual", progress: 0.7 };
    case "offline":
      return { phase: "offline" };
    case "current":
      return { phase: "current" };
    default:
      break;
  }
  if (!input.online) {
    return { phase: "offline" };
  }
  return { phase: "current" };
}

export function renderUpdateScreen(
  view: UpdateView,
  actions: { readonly enter: () => void; readonly guest: () => void },
): HTMLElement {
  const main = document.createElement("main");
  main.className = "update-screen";
  const title = document.createElement("h1");
  title.textContent = "Verificando atualizações";
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  const actionsRow = document.createElement("div");
  actionsRow.className = "gate-nav";
  switch (view.phase) {
    case "checking":
      status.textContent = "Procurando uma versão nova…";
      break;
    case "mandatory":
      status.textContent = "Atualização obrigatória. Baixando e reiniciando…";
      actionsRow.append(progressBar(view.progress));
      break;
    case "visual":
      status.textContent = "Atualização de visual. Baixando, e em seguida você segue.";
      actionsRow.append(progressBar(view.progress));
      actionsRow.append(button("Seguir", actions.enter));
      break;
    case "current":
      status.textContent = "Você já está na versão atual.";
      actionsRow.append(button("Seguir", actions.enter));
      break;
    case "offline":
      title.textContent = "Sem conexão";
      status.textContent = "Sem conexão. Dá para entrar como convidado e jogar J x IA.";
      actionsRow.append(button("Entrar como convidado", actions.guest));
      break;
    default: {
      const unexpected: never = view;
      status.textContent = String(unexpected);
    }
  }
  main.append(title, status, actionsRow);
  return main;
}

function progressBar(progress: number): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "update-progress";
  wrap.setAttribute("role", "progressbar");
  wrap.setAttribute("aria-valuemin", "0");
  wrap.setAttribute("aria-valuemax", "100");
  wrap.setAttribute("aria-valuenow", String(Math.round(progress * 100)));
  const bar = document.createElement("span");
  bar.style.width = `${Math.round(progress * 100)}%`;
  wrap.append(bar);
  return wrap;
}

function button(label: string, onClick: () => void): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "button";
  element.textContent = label;
  element.addEventListener("click", onClick);
  return element;
}
