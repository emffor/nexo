"use client";
import type { Dispatch, SetStateAction } from "react";
import type { AppTheme } from "../../lib/preferences";
import type { UI_THEME } from "../../lib/uiTheme";
import type { ActiveEditor } from "../../types/databaseCanvas";

import type { KonvaEventObject } from "konva/lib/Node";
import {
  Group,
  Line,
  Rect,
  Text
} from "react-konva";
import { DatabaseCanvasIcon } from "./DatabaseCanvasIcon";
import type { DatabaseColorTarget } from "../../lib/dbml";
import type { DatabaseInspection } from "./DatabaseInspector";
import { databaseColorText } from "../../lib/databaseCanvas";
import { isRelationEndpoint } from "../../lib/databaseDiagramGeometry";
import {
  DB_HEADER_HEIGHT,
  DB_ROW_HEIGHT,
  DB_TABLE_WIDTH,
  computeDatabaseTableHeight
} from "../../lib/databaseLayout";
import { UI_CODE_FONT_FAMILY, UI_FONT_FAMILY, UI_RADIUS } from "../../lib/uiTheme";
import type {
  DatabaseEnum,
  DatabaseRelation,
  DatabaseTable,
  DatabaseTablePosition
} from "../../types/database";

interface DatabaseTablesProps {
  tables: DatabaseTable[];
  enums: DatabaseEnum[];
  onOpenColor?: (target: DatabaseColorTarget) => void;
  onInspect: (inspection: DatabaseInspection) => void;
  visualPositions: Record<string, DatabaseTablePosition>;
  selectedTableId: string | null;
  setSelectedTableId: Dispatch<SetStateAction<string | null>>;
  setSelectedRelationId: Dispatch<SetStateAction<string | null>>;
  setEditingRelationId: Dispatch<SetStateAction<string | null>>;
  handleTableDragMove: (id: string, event: KonvaEventObject<DragEvent>) => void;
  handleTableDragEnd: (id: string, event: KonvaEventObject<DragEvent>) => void;
  setHoveredTableId: Dispatch<SetStateAction<string | null>>;
  tableBg: string;
  selectedBorder: string;
  tableBorder: string;
  colors: (typeof UI_THEME)[AppTheme];
  isDark: boolean;
  headerBg: string;
  headerText: string;
  openTableEditor: (table: DatabaseTable) => void;
  setRecordsTableId: Dispatch<SetStateAction<string | null>>;
  relations: DatabaseRelation[];
  activeRelationIds: Set<string>;
  activeEditor: ActiveEditor | null;
  openColumnEditor: (table: DatabaseTable, columnName: string) => void;
  rowHighlight: string;
  rowText: string;
  typeText: string;
  badgeBg: string;
  badgeText: string;
}

export function DatabaseTables({
  tables,
  enums,
  onOpenColor,
  onInspect,
  visualPositions,
  selectedTableId,
  setSelectedTableId,
  setSelectedRelationId,
  setEditingRelationId,
  handleTableDragMove,
  handleTableDragEnd,
  setHoveredTableId,
  tableBg,
  selectedBorder,
  tableBorder,
  colors,
  isDark,
  headerBg,
  headerText,
  openTableEditor,
  setRecordsTableId,
  relations,
  activeRelationIds,
  activeEditor,
  openColumnEditor,
  rowHighlight,
  rowText,
  typeText,
  badgeBg,
  badgeText,
}: DatabaseTablesProps) {
  return <>
    {tables.map((table) => {
      const pos = visualPositions[table.id];
      if (!pos) {
        return null;
      }
      const height = computeDatabaseTableHeight(table.columns.length);
      const tableHeaderText = table.headerColor ? databaseColorText(table.headerColor) : headerText;
      const isTableSelected = selectedTableId === table.id;
      return (
        <Group
          key={table.id}
          x={pos.x}
          y={pos.y}
          draggable
          onClick={(event) => {
            event.cancelBubble = true;
            setSelectedTableId(table.id);
            setSelectedRelationId(null);
            setEditingRelationId(null);
          }}
          onDragMove={(event) => handleTableDragMove(table.id, event)}
          onDragEnd={(event) => handleTableDragEnd(table.id, event)}
          onMouseEnter={(event) => {
            setHoveredTableId(table.id);
            const stage = event.target.getStage();
            if (stage) {
              stage.container().style.cursor = "grab";
            }
          }}
          onMouseLeave={(event) => {
            setHoveredTableId((current) =>
              current === table.id ? null : current,
            );
            const stage = event.target.getStage();
            if (stage) {
              stage.container().style.cursor = "default";
            }
          }}
        >
          <Rect
            width={DB_TABLE_WIDTH}
            height={height}
            cornerRadius={8}
            fill={isDark ? "#18181b" : "#ffffff"}
            stroke={isTableSelected ? selectedBorder : isDark ? "#27272a" : "#e2e8f0"}
            strokeWidth={isTableSelected ? 1.5 : 1}
            shadowColor="#000000"
            shadowBlur={isTableSelected ? 12 : 6}
            shadowOpacity={isDark ? 0.35 : 0.08}
            shadowOffsetY={2}
            perfectDrawEnabled={false}
          />
          <Rect
            width={DB_TABLE_WIDTH}
            height={DB_HEADER_HEIGHT}
            cornerRadius={[8, 8, 0, 0]}
            fill={table.headerColor ?? (isDark ? "#27272a" : "#f1f5f9")}
            perfectDrawEnabled={false}
          />
          <Text
            x={32}
            y={13}
            width={DB_TABLE_WIDTH - (table.records ? 146 : 106)}
            text={table.name}
            fontSize={13}
            fontStyle="600"
            fontFamily={UI_CODE_FONT_FAMILY}
            fill={table.headerColor ? tableHeaderText : isDark ? "#f4f4f5" : "#1e293b"}
            ellipsis
            onClick={(event) => {
              event.cancelBubble = true;
              openTableEditor(table);
            }}
            onMouseEnter={(event) => {
              const stage = event.target.getStage();
              if (stage) {
                stage.container().style.cursor = "text";
              }
            }}
            onMouseLeave={(event) => {
              const stage = event.target.getStage();
              if (stage) {
                stage.container().style.cursor = "default";
              }
            }}
            perfectDrawEnabled={false}
          />
          <Text x={12} y={12} text="▦" fontSize={16} fill={tableHeaderText} listening={false} />
          {onOpenColor && <DatabaseCanvasIcon x={DB_TABLE_WIDTH - 34} y={6} color={tableHeaderText} kind="palette" onClick={() => onOpenColor({ kind: 'Table', name: table.name })} />}
          {table.note && <DatabaseCanvasIcon x={DB_TABLE_WIDTH - 64} y={6} color={tableHeaderText} kind="note" onClick={() => onInspect({ title: table.name, text: table.note })} />}
          {table.records && table.records.rows.length > 0 ? (
            <Text
              x={DB_TABLE_WIDTH - 108}
              y={14}
              width={40}
              align="right"
              text="REC"
              fontSize={10}
              fontStyle="700"
              fontFamily={UI_FONT_FAMILY}
              fill={colors.tag}
              onClick={(event) => {
                event.cancelBubble = true;
                setRecordsTableId(table.id);
              }}
              perfectDrawEnabled={false}
            />
          ) : null}
          {table.columns.map((column, colIdx) => {
            const y = DB_HEADER_HEIGHT + colIdx * DB_ROW_HEIGHT;
            const isLastRow = colIdx === table.columns.length - 1;
            const enumType = enums.find((entry) => entry.name === column.type || entry.name === `${table.name.includes('.') ? table.name.split('.').slice(0, -1).join('.') : 'public'}.${column.type}` || `public.${entry.name}` === column.type);
            const flagsX = DB_TABLE_WIDTH - (column.note ? 40 : 12);
            const badges = [
              column.isPrimaryKey ? "PK" : null,
              column.isForeignKey ? "FK" : null,
              column.isNotNull ? "NN" : null,
            ].filter((badge): badge is string => badge !== null);
            const isHighlighted = relations.some(
              (relation) =>
                activeRelationIds.has(relation.id) &&
                isRelationEndpoint(relation, table.id, column.name),
            );
            const isColumnEditing =
              activeEditor?.type === "column" &&
              activeEditor.tableId === table.id &&
              activeEditor.columnName === column.name;
            const reservedBadgeWidth =
              (badges.length > 0 ? badges.length * 26 - 4 : 0) + (column.note ? 28 : 0);
            return (
              <Group
                key={column.id}
                y={y}
                onClick={(event) => {
                  event.cancelBubble = true;
                  openColumnEditor(table, column.name);
                }}
              >
                {(isHighlighted || isColumnEditing) && (
                  <Rect
                    width={DB_TABLE_WIDTH}
                    height={DB_ROW_HEIGHT}
                    fill={rowHighlight}
                    opacity={isColumnEditing ? 0.9 : 0.7}
                    perfectDrawEnabled={false}
                  />
                )}
                {!isLastRow && (
                  <Line
                    points={[
                      8,
                      DB_ROW_HEIGHT,
                      DB_TABLE_WIDTH - 8,
                      DB_ROW_HEIGHT,
                    ]}
                    stroke={isDark ? "#27272a" : "#f1f5f9"}
                    strokeWidth={1}
                    perfectDrawEnabled={false}
                  />
                )}
                <Text
                  x={12}
                  y={(DB_ROW_HEIGHT - 12) / 2}
                  text={column.name}
                  fontSize={12}
                  width={DB_TABLE_WIDTH / 2 - 20}
                  ellipsis
                  fontStyle="600"
                  fontFamily={UI_CODE_FONT_FAMILY}
                  fill={isDark ? "#e4e4e7" : "#334155"}
                  onMouseEnter={(event) => {
                    const stage = event.target.getStage();
                    if (stage) {
                      stage.container().style.cursor = "text";
                    }
                  }}
                  onMouseLeave={(event) => {
                    const stage = event.target.getStage();
                    if (stage) {
                      stage.container().style.cursor = "default";
                    }
                  }}
                  perfectDrawEnabled={false}
                />
                <Text
                  x={DB_TABLE_WIDTH / 2}
                  y={(DB_ROW_HEIGHT - 12) / 2}
                  width={DB_TABLE_WIDTH / 2 - 16 - reservedBadgeWidth}
                  align="right"
                  text={column.type}
                  textDecoration={enumType ? 'underline' : undefined}
                  onClick={enumType ? (event) => { event.cancelBubble = true; onInspect({ title: enumType.name, values: enumType.values }); } : undefined}
                  onTap={enumType ? (event) => { event.cancelBubble = true; onInspect({ title: enumType.name, values: enumType.values }); } : undefined}
                  fontSize={11}
                  fontFamily={UI_CODE_FONT_FAMILY}
                  fill={isDark ? "#a1a1aa" : "#64748b"}
                  ellipsis
                  perfectDrawEnabled={false}
                />
                {column.note && <DatabaseCanvasIcon x={DB_TABLE_WIDTH - 34} y={2} color={isDark ? '#f2ba80' : '#b56d32'} kind="note" onClick={() => onInspect({ title: `${table.name}.${column.name}`, text: column.note })} />}
                {badges.map((badge, badgeIndex) => (
                  <Group
                    key={badge}
                    x={
                      flagsX -
                      badges.length * 22 -
                      (badges.length - 1) * 4 +
                      badgeIndex * 26
                    }
                    y={(DB_ROW_HEIGHT - 14) / 2}
                  >
                    <Rect
                      width={22}
                      height={14}
                      cornerRadius={3}
                      fill={
                        badge === "PK"
                          ? isDark
                            ? "#451a03"
                            : "#fef3c7"
                          : badge === "FK"
                            ? isDark
                              ? "#082f49"
                              : "#e0f2fe"
                            : isDark
                              ? "#27272a"
                              : "#f1f5f9"
                      }
                      perfectDrawEnabled={false}
                    />
                    <Text
                      x={0}
                      y={2}
                      width={22}
                      align="center"
                      text={badge}
                      fontSize={9}
                      fontStyle="700"
                      fontFamily={UI_FONT_FAMILY}
                      fill={
                        badge === "PK"
                          ? isDark
                            ? "#fde68a"
                            : "#b45309"
                          : badge === "FK"
                            ? isDark
                              ? "#7dd3fc"
                              : "#0369a1"
                            : isDark
                              ? "#a1a1aa"
                              : "#475569"
                      }
                      perfectDrawEnabled={false}
                    />
                  </Group>
                ))}
              </Group>
            );
          })}
        </Group>
      );
    })}
  </>;
}
