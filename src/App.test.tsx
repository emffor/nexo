import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "./App";
import { db } from "./lib/db";

async function createAndOpenProject(
  user: ReturnType<typeof userEvent.setup>,
  name = "Projeto teste",
) {
  await user.type(await screen.findByLabelText(/nome do projeto/i), name);
  await user.click(screen.getByRole("button", { name: /adicionar projeto/i }));
  const openButtons = await screen.findAllByRole("button", { name: /^abrir$/i });
  await user.click(openButtons[openButtons.length - 1]);
  await screen.findByRole("button", { name: /novo markdown/i });
}

async function openFirstProject(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: /^abrir$/i }));
  await screen.findByRole("button", { name: /novo markdown/i });
}

function mockDownload() {
  const blobs: Blob[] = [];
  Object.defineProperty(window.URL, "createObjectURL", {
    configurable: true,
    value: vi.fn((blob: Blob) => {
      blobs.push(blob);
      return "blob:backup";
    }),
  });
  Object.defineProperty(window.URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
  const clickSpy = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(() => undefined);

  return { blobs, clickSpy };
}

async function readBlobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsText(blob);
  });
}

describe("App", () => {
  it("cria projeto e abre o workspace isolado", async () => {
    const user = userEvent.setup();
    render(<App />);

    await createAndOpenProject(user, "Regularizacao");

    expect(
      screen.getByRole("heading", { name: "Regularizacao" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /projetos/i }),
    ).toBeInTheDocument();
  });

  it("mantem cards isolados entre projetos", async () => {
    const user = userEvent.setup();
    render(<App />);

    await createAndOpenProject(user, "Regularizacao");
    await user.click(screen.getByRole("button", { name: /novo markdown/i }));
    await user.type(screen.getByLabelText(/conteudo/i), "# Task Regularizacao");
    await user.click(screen.getByRole("button", { name: /salvar card/i }));

    await user.click(screen.getByRole("button", { name: /projetos/i }));
    await createAndOpenProject(user, "Doc Pronto");

    expect(screen.queryByText(/task regularizacao/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /novo markdown/i }));
    await user.type(screen.getByLabelText(/conteudo/i), "# Task Doc Pronto");
    await user.click(screen.getByRole("button", { name: /salvar card/i }));

    await user.click(screen.getByRole("button", { name: /projetos/i }));
    const openButtons = await screen.findAllByRole("button", {
      name: /^abrir$/i,
    });
    await user.click(openButtons[0]);

    expect(
      await screen.findByRole("heading", {
        name: "Task Regularizacao",
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/task doc pronto/i)).not.toBeInTheDocument();
  });

  it("exporta backup completo pela tela de projetos", async () => {
    const user = userEvent.setup();
    const { blobs, clickSpy } = mockDownload();
    render(<App />);

    await createAndOpenProject(user, "Regularizacao");
    await user.click(screen.getByRole("button", { name: /novo markdown/i }));
    await user.type(screen.getByLabelText(/conteudo/i), "# Exportavel");
    await user.click(screen.getByRole("button", { name: /salvar card/i }));
    await user.click(screen.getByRole("button", { name: /projetos/i }));
    await user.click(screen.getByRole("button", { name: /exportar tudo/i }));

    await waitFor(() => expect(blobs).toHaveLength(1));
    const parsed = JSON.parse(await readBlobText(blobs[0]));

    expect(parsed.version).toBe(2);
    expect(parsed.projects).toHaveLength(1);
    expect(parsed.projects[0].project.name).toBe("Regularizacao");
    expect(parsed.projects[0].items[0].content).toBe("# Exportavel");
    clickSpy.mockRestore();
  });

  it("exporta um projeto especifico pela tela de projetos", async () => {
    const user = userEvent.setup();
    const { blobs, clickSpy } = mockDownload();
    render(<App />);

    await createAndOpenProject(user, "Regularizacao");
    await user.click(screen.getByRole("button", { name: /novo markdown/i }));
    await user.type(screen.getByLabelText(/conteudo/i), "# Projeto A");
    await user.click(screen.getByRole("button", { name: /salvar card/i }));
    await user.click(screen.getByRole("button", { name: /projetos/i }));
    await user.click(
      screen.getByRole("button", { name: /exportar projeto/i }),
    );

    await waitFor(() => expect(blobs).toHaveLength(1));
    const parsed = JSON.parse(await readBlobText(blobs[0]));

    expect(parsed.version).toBe(2);
    expect(parsed.projects).toHaveLength(1);
    expect(parsed.projects[0].project.name).toBe("Regularizacao");
    expect(parsed.projects[0].items[0].content).toBe("# Projeto A");
    clickSpy.mockRestore();
  });

  it("importa backup completo pela tela de projetos", async () => {
    const user = userEvent.setup();
    render(<App />);

    const file = new File(
      [
        JSON.stringify({
          version: 2,
          exportedAt: "2026-05-01T00:00:00.000Z",
          projects: [
            {
              project: {
                id: "project-a",
                name: "Regularizacao",
                order: 0,
                createdAt: "2026-05-01T00:00:00.000Z",
                updatedAt: "2026-05-02T00:00:00.000Z",
              },
              items: [
                {
                  id: "item-a",
                  content: "# Importado",
                  order: 0,
                  createdAt: "2026-05-01T00:00:00.000Z",
                  updatedAt: "2026-05-02T00:00:00.000Z",
                },
              ],
            },
          ],
        }),
      ],
      "backup.txt",
      { type: "text/plain" },
    );

    await screen.findByRole("heading", { name: /projetos/i });
    await user.click(screen.getByRole("button", { name: /importar tudo/i }));
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();
    await user.upload(input as HTMLInputElement, file);

    expect(await screen.findByText("Regularizacao")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^abrir$/i }));
    expect(
      await screen.findByRole("heading", { name: "Importado", level: 1 }),
    ).toBeInTheDocument();
  });

  it("importa backup antigo como projeto com nome gerado", async () => {
    const user = userEvent.setup();
    render(<App />);

    const file = new File(
      [
        JSON.stringify({
          version: 1,
          exportedAt: "2026-05-01T00:00:00.000Z",
          items: [
            {
              id: "item-a",
              content: "# Sem nome original",
              order: 0,
              createdAt: "2026-05-01T00:00:00.000Z",
              updatedAt: "2026-05-02T00:00:00.000Z",
            },
          ],
        }),
      ],
      "backup-legado.txt",
      { type: "text/plain" },
    );

    await screen.findByRole("heading", { name: /projetos/i });
    await user.click(screen.getByRole("button", { name: /importar tudo/i }));
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();
    await user.upload(input as HTMLInputElement, file);

    expect(await screen.findByText(/^Projeto importado /i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^abrir$/i }));
    expect(
      await screen.findByRole("heading", {
        name: "Sem nome original",
        level: 1,
      }),
    ).toBeInTheDocument();
  });

  it("adiciona um markdown e reflete o conteudo nas duas colunas", async () => {
    const user = userEvent.setup();
    render(<App />);
    await createAndOpenProject(user);

    await user.click(screen.getByRole("button", { name: /novo markdown/i }));
    await user.type(
      screen.getByLabelText(/conteudo/i),
      "# Bloco A\n\nTexto do card",
    );
    await user.click(screen.getByRole("button", { name: /salvar card/i }));

    expect(
      await screen.findByRole("button", { name: "Bloco A" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Bloco A", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Texto do card")).toBeInTheDocument();
  });

  it("bloqueia o salvamento de conteudo vazio", async () => {
    const user = userEvent.setup();
    render(<App />);
    await createAndOpenProject(user);

    await user.click(screen.getByRole("button", { name: /novo markdown/i }));
    await user.click(screen.getByRole("button", { name: /salvar card/i }));

    expect(
      await screen.findByText(
        /cole algum conteudo em markdown para continuar/i,
      ),
    ).toBeInTheDocument();
  });

  it("mantem os cards apos remontar a aplicacao", async () => {
    const user = userEvent.setup();
    const firstRender = render(<App />);
    await createAndOpenProject(user);

    await user.click(screen.getByRole("button", { name: /novo markdown/i }));
    await user.type(screen.getByLabelText(/conteudo/i), "## Persistido");
    await user.click(screen.getByRole("button", { name: /salvar card/i }));

    expect(
      await screen.findByRole("heading", { name: "Persistido", level: 2 }),
    ).toBeInTheDocument();

    firstRender.unmount();
    render(<App />);
    await openFirstProject(user);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Persistido", level: 2 }),
      ).toBeInTheDocument();
    });
  });

  it("renderiza imagem quando o markdown contem sintaxe de imagem", async () => {
    const user = userEvent.setup();
    render(<App />);
    await createAndOpenProject(user);

    await user.click(screen.getByRole("button", { name: /novo markdown/i }));
    fireEvent.change(screen.getByLabelText(/conteudo/i), {
      target: {
        value: "## Figma\n\n![Tela](https://example.com/imagem.png)",
      },
    });
    await user.click(screen.getByRole("button", { name: /salvar card/i }));

    expect(await screen.findByRole("img", { name: "Tela" })).toHaveAttribute(
      "src",
      "https://example.com/imagem.png",
    );
  });

  it("troca caracteres corrompidos por icone de pin", async () => {
    const user = userEvent.setup();
    render(<App />);
    await createAndOpenProject(user);

    await user.click(screen.getByRole("button", { name: /novo markdown/i }));
    fireEvent.change(screen.getByLabelText(/conteudo/i), {
      target: {
        value: "## Regras\n\n O imovel selecionado deve pertencer ao cliente.",
      },
    });
    await user.click(screen.getByRole("button", { name: /salvar card/i }));

    expect(await screen.findByText(/📌/)).toBeInTheDocument();
    expect(
      await screen.findByText(
        /o imovel selecionado deve pertencer ao cliente/i,
      ),
    ).toBeInTheDocument();
  });

  it("alterna para o modo sem espacamentos", async () => {
    const user = userEvent.setup();
    render(<App />);
    await createAndOpenProject(user);

    const layout = document.querySelector('[data-layout-mode="default"]');
    expect(layout).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /usar tela inteira/i }),
    );

    expect(
      document.querySelector('[data-layout-mode="compact"]'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /restaurar espacamento/i }),
    ).toBeInTheDocument();
  });

  it("maximiza o preview escondendo a coluna esquerda", async () => {
    const user = userEvent.setup();
    render(<App />);
    await createAndOpenProject(user);

    expect(screen.getByText(/cards em ordem/i)).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /maximizar preview/i }),
    );

    expect(screen.queryByText(/cards em ordem/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /restaurar colunas/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/preview renderizado/i)).toBeInTheDocument();
  });

  it("alterna o tema pela toolbar", async () => {
    const user = userEvent.setup();
    render(<App />);
    await createAndOpenProject(user);

    await user.click(screen.getByRole("button", { name: /modo claro/i }));

    expect(
      screen.getByRole("button", { name: /modo escuro/i }),
    ).toBeInTheDocument();
    expect(document.querySelector('[data-theme="light"]')).toBeInTheDocument();
  });

  it("persiste o ajuste de fonte na toolbar", async () => {
    const user = userEvent.setup();
    render(<App />);
    await createAndOpenProject(user);

    await user.click(screen.getByRole("button", { name: "A+" }));

    expect(window.localStorage.getItem("organizar-markdown:font-scale")).toBe(
      "1.1",
    );
  });

  it("permite reduzir mais a fonte pela toolbar", async () => {
    const user = userEvent.setup();
    render(<App />);
    await createAndOpenProject(user);

    const decreaseButton = screen.getByRole("button", { name: "A-" });

    await user.click(decreaseButton);
    await user.click(decreaseButton);
    await user.click(decreaseButton);

    expect(window.localStorage.getItem("organizar-markdown:font-scale")).toBe(
      "0.7",
    );
  });

  it("alterna o botao de scroll sync na toolbar", async () => {
    const user = userEvent.setup();
    render(<App />);
    await createAndOpenProject(user);

    await user.click(screen.getByRole("button", { name: /scroll sync/i }));

    expect(
      screen.getByRole("button", { name: /scroll sync ligado/i }),
    ).toBeInTheDocument();
  });

  it("edita um card pelo botao de lapis", async () => {
    const user = userEvent.setup();
    render(<App />);
    await createAndOpenProject(user);

    await user.click(screen.getByRole("button", { name: /novo markdown/i }));
    await user.type(screen.getByLabelText(/conteudo/i), "# Card original");
    await user.click(screen.getByRole("button", { name: /salvar card/i }));

    await user.click(
      await screen.findByRole("button", { name: /editar card original/i }),
    );

    const textarea = screen.getByLabelText(/conteudo/i);
    await user.clear(textarea);
    await user.type(textarea, "# Card editado");
    await user.click(
      screen.getByRole("button", { name: /salvar alteracoes/i }),
    );

    expect(
      await screen.findByRole("heading", { name: "Card editado", level: 1 }),
    ).toBeInTheDocument();
  });

  it("alterna para modo indice e navega ate a secao do card", async () => {
    const user = userEvent.setup();
    const scrollSpy = vi.spyOn(HTMLElement.prototype, "scrollIntoView");
    render(<App />);
    await createAndOpenProject(user);

    await user.click(screen.getByRole("button", { name: /novo markdown/i }));
    await user.type(screen.getByLabelText(/conteudo/i), "# Primeiro");
    await user.click(screen.getByRole("button", { name: /salvar card/i }));

    await user.click(screen.getByRole("button", { name: /novo markdown/i }));
    await user.type(screen.getByLabelText(/conteudo/i), "# Segundo");
    await user.click(screen.getByRole("button", { name: /salvar card/i }));

    await user.click(screen.getByRole("button", { name: /modo indice/i }));
    await user.click(screen.getByRole("button", { name: /ir para segundo/i }));

    expect(
      screen.getByRole("button", { name: /modo cards/i }),
    ).toBeInTheDocument();
    expect(scrollSpy).toHaveBeenCalled();
  });

  it("alterna entre os modos normal, indice, cards e diagrama", async () => {
    const user = userEvent.setup();
    render(<App />);
    await createAndOpenProject(user);

    await user.click(screen.getByRole("button", { name: /modo indice/i }));

    expect(
      screen.getByRole("button", { name: /modo cards/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /modo cards/i }));

    expect(
      screen.getByRole("button", { name: /modo diagrama/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/cards em ordem/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /modo diagrama/i }));

    expect(
      screen.getByRole("button", { name: /modo normal/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /modo normal/i }));

    expect(
      screen.getByRole("button", { name: /modo indice/i }),
    ).toBeInTheDocument();
  });

  it("abre o modo banco com editor DBML", async () => {
    const user = userEvent.setup();
    render(<App />);
    await createAndOpenProject(user);

    await user.click(screen.getByRole("button", { name: /modo banco/i }));

    expect(await screen.findByLabelText(/editor dbml/i)).toBeInTheDocument();
    expect(screen.getByText("DBML")).toBeInTheDocument();
  });

  it("permite ocultar e exibir os cards laterais no modo diagrama", async () => {
    const user = userEvent.setup();
    render(<App />);
    await createAndOpenProject(user);

    await user.click(screen.getByRole("button", { name: /modo diagrama/i }));

    expect(screen.getByText(/cards no diagrama/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /ocultar cards/i }));

    expect(screen.queryByText(/cards no diagrama/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /exibir cards/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /exibir cards/i }));

    expect(screen.getByText(/cards no diagrama/i)).toBeInTheDocument();
  });

  it("permite ocultar e exibir cards individuais no canvas do diagrama", async () => {
    const user = userEvent.setup();
    render(<App />);
    await createAndOpenProject(user);

    await user.click(screen.getByRole("button", { name: /novo markdown/i }));
    await user.type(screen.getByLabelText(/conteudo/i), "# Card ocultavel");
    await user.click(screen.getByRole("button", { name: /salvar card/i }));
    await user.click(screen.getByRole("button", { name: /modo diagrama/i }));

    const visibilityCheckbox = screen.getByRole("checkbox", {
      name: /ocultar card card ocultavel no diagrama/i,
    });

    expect(visibilityCheckbox).toBeChecked();

    await user.click(visibilityCheckbox);

    expect(
      screen.getByRole("checkbox", {
        name: /exibir card card ocultavel no diagrama/i,
      }),
    ).not.toBeChecked();
  });

  it("persiste cards ocultos do diagrama ao remontar a aplicacao", async () => {
    const user = userEvent.setup();
    const firstRender = render(<App />);
    await createAndOpenProject(user);

    await user.click(screen.getByRole("button", { name: /novo markdown/i }));
    await user.type(screen.getByLabelText(/conteudo/i), "# Card persistido");
    await user.click(screen.getByRole("button", { name: /salvar card/i }));
    await user.click(screen.getByRole("button", { name: /modo diagrama/i }));
    await user.click(
      screen.getByRole("checkbox", {
        name: /ocultar card card persistido no diagrama/i,
      }),
    );

    await waitFor(async () => {
      const project = await db.projects.toCollection().first();
      expect(project?.hiddenDiagramItemIds).toHaveLength(1);
    });

    firstRender.unmount();
    render(<App />);
    await openFirstProject(user);
    await user.click(screen.getByRole("button", { name: /modo diagrama/i }));

    expect(
      await screen.findByRole("checkbox", {
        name: /exibir card card persistido no diagrama/i,
      }),
    ).not.toBeChecked();
  });

  it("permite alternar e persistir o estilo das linhas do diagrama", async () => {
    const user = userEvent.setup();
    const firstRender = render(<App />);
    await createAndOpenProject(user);

    await user.click(screen.getByRole("button", { name: /modo diagrama/i }));

    const edgeStyleButton = screen.getByRole("button", {
      name: /linha curva/i,
    });
    await user.click(edgeStyleButton);

    expect(
      window.localStorage.getItem("organizar-markdown:diagram-edge-style"),
    ).toBe("square");
    expect(
      screen.getByRole("button", { name: /linha quadrada/i }),
    ).toBeInTheDocument();

    firstRender.unmount();
    render(<App />);
    await openFirstProject(user);
    await user.click(screen.getByRole("button", { name: /modo diagrama/i }));

    expect(
      await screen.findByRole("button", { name: /linha quadrada/i }),
    ).toBeInTheDocument();
  });

  it("mantem estilos de linha isolados entre diagrama e banco", async () => {
    const user = userEvent.setup();
    render(<App />);
    await createAndOpenProject(user);

    await user.click(screen.getByRole("button", { name: /modo diagrama/i }));
    await user.click(screen.getByRole("button", { name: /linha curva/i }));

    expect(
      window.localStorage.getItem("organizar-markdown:diagram-edge-style"),
    ).toBe("square");
    expect(
      window.localStorage.getItem("organizar-markdown:database-edge-style"),
    ).toBe("square");

    await user.click(screen.getByRole("button", { name: /modo banco/i }));
    expect(
      await screen.findByRole("button", { name: /linha quadrada/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /linha quadrada/i }));

    expect(
      window.localStorage.getItem("organizar-markdown:database-edge-style"),
    ).toBe("curve");
    expect(
      window.localStorage.getItem("organizar-markdown:diagram-edge-style"),
    ).toBe("square");

    await user.click(screen.getByRole("button", { name: /modo diagrama/i }));
    expect(
      await screen.findByRole("button", { name: /linha quadrada/i }),
    ).toBeInTheDocument();
  });

  it("mantem compatibilidade com o modo indice antigo ao recarregar", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem("organizar-markdown:outline-mode", "true");

    render(<App />);
    await createAndOpenProject(user);

    expect(
      await screen.findByRole("button", { name: /modo cards/i }),
    ).toBeInTheDocument();
    expect(window.localStorage.getItem("organizar-markdown:view-mode")).toBe(
      "index",
    );
  });

  it("persiste o modo cards apos alternar a visualizacao", async () => {
    const user = userEvent.setup();
    render(<App />);
    await createAndOpenProject(user);

    await user.click(screen.getByRole("button", { name: /modo indice/i }));
    await user.click(screen.getByRole("button", { name: /modo cards/i }));

    expect(window.localStorage.getItem("organizar-markdown:view-mode")).toBe(
      "cards",
    );
  });

  it("renderiza cards de markdown no grid do preview", async () => {
    const user = userEvent.setup();
    render(<App />);
    await createAndOpenProject(user);

    await user.click(screen.getByRole("button", { name: /novo markdown/i }));
    await user.type(screen.getByLabelText(/conteudo/i), "# Primeiro");
    await user.click(screen.getByRole("button", { name: /salvar card/i }));

    await user.click(screen.getByRole("button", { name: /novo markdown/i }));
    await user.type(screen.getByLabelText(/conteudo/i), "## Segundo");
    await user.click(screen.getByRole("button", { name: /salvar card/i }));

    await user.click(screen.getByRole("button", { name: /modo indice/i }));
    await user.click(screen.getByRole("button", { name: /modo cards/i }));

    expect(screen.getByText(/preview em cards/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /selecionar card primeiro/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /selecionar card segundo/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /mostrar completo/i }),
    ).not.toBeInTheDocument();
  });

  it("abre um card em preview maximizado e volta para o grid", async () => {
    const user = userEvent.setup();
    render(<App />);
    await createAndOpenProject(user);

    await user.click(screen.getByRole("button", { name: /novo markdown/i }));
    await user.type(
      screen.getByLabelText(/conteudo/i),
      "# Card longo\n\nTexto em markdown para validar expansao.",
    );
    await user.click(screen.getByRole("button", { name: /salvar card/i }));

    await user.click(screen.getByRole("button", { name: /modo indice/i }));
    await user.click(screen.getByRole("button", { name: /modo cards/i }));
    await user.click(
      screen.getByRole("button", { name: /selecionar card card longo/i }),
    );

    expect(
      screen.getByRole("button", { name: /voltar aos cards/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/preview renderizado/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /selecionar card card longo/i }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /voltar aos cards/i }));

    expect(
      screen.getByRole("button", { name: /selecionar card card longo/i }),
    ).toBeInTheDocument();
  });
});
