import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "./App";

describe("App", () => {
  it("adiciona um markdown e reflete o conteudo nas duas colunas", async () => {
    const user = userEvent.setup();
    render(<App />);

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

    await user.click(screen.getByRole("button", { name: /novo markdown/i }));
    await user.type(screen.getByLabelText(/conteudo/i), "## Persistido");
    await user.click(screen.getByRole("button", { name: /salvar card/i }));

    expect(
      await screen.findByRole("heading", { name: "Persistido", level: 2 }),
    ).toBeInTheDocument();

    firstRender.unmount();
    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Persistido", level: 2 }),
      ).toBeInTheDocument();
    });
  });

  it("renderiza imagem quando o markdown contem sintaxe de imagem", async () => {
    const user = userEvent.setup();
    render(<App />);

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

    await user.click(screen.getByRole("button", { name: /modo claro/i }));

    expect(
      screen.getByRole("button", { name: /modo escuro/i }),
    ).toBeInTheDocument();
    expect(document.querySelector('[data-theme="light"]')).toBeInTheDocument();
  });

  it("persiste o ajuste de fonte na toolbar", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "A+" }));

    expect(window.localStorage.getItem("organizar-markdown:font-scale")).toBe(
      "1.1",
    );
  });

  it("permite reduzir mais a fonte pela toolbar", async () => {
    const user = userEvent.setup();
    render(<App />);

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

    await user.click(screen.getByRole("button", { name: /scroll sync/i }));

    expect(
      screen.getByRole("button", { name: /scroll sync ligado/i }),
    ).toBeInTheDocument();
  });

  it("edita um card pelo botao de lapis", async () => {
    const user = userEvent.setup();
    render(<App />);

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

  it("mantem compatibilidade com o modo indice antigo ao recarregar", async () => {
    window.localStorage.setItem("organizar-markdown:outline-mode", "true");

    render(<App />);

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

    await user.click(screen.getByRole("button", { name: /modo indice/i }));
    await user.click(screen.getByRole("button", { name: /modo cards/i }));

    expect(window.localStorage.getItem("organizar-markdown:view-mode")).toBe(
      "cards",
    );
  });

  it("renderiza cards de markdown no grid do preview", async () => {
    const user = userEvent.setup();
    render(<App />);

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
