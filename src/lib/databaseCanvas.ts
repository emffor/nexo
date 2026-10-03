import type { DatabaseAutoLayoutAlgorithm } from "./databaseLayout";

export const AUTO_LAYOUT_OPTIONS: {
  id: DatabaseAutoLayoutAlgorithm;
  label: string;
  description: string;
  shortcut: string;
  icon: "flow" | "snowflake" | "grid";
}[] = [
    {
      id: "left-right",
      label: "Esquerda-direita",
      description:
        "Organiza tabelas da esquerda para a direita com base na direção dos relacionamentos.",
      shortcut: "1",
      icon: "flow",
    },
    {
      id: "snowflake",
      label: "Floco de neve",
      description:
        "Mantém as tabelas mais conectadas no centro e distribui as demais ao redor.",
      shortcut: "2",
      icon: "snowflake",
    },
    {
      id: "compact",
      label: "Compacto",
      description:
        "Organiza tabelas em uma grade retangular curta para diagramas menores.",
      shortcut: "3",
      icon: "grid",
    },
  ];
