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
import { isRelationEndpoint } from "../../lib/databaseDiagramGeometry";
import {
  DB_HEADER_HEIGHT,
  DB_ROW_HEIGHT,
  DB_TABLE_WIDTH,
  computeDatabaseTableHeight
} from "../../lib/databaseLayout";
import { UI_CODE_FONT_FAMILY, UI_FONT_FAMILY, UI_RADIUS } from "../../lib/uiTheme";
import type {
  DatabaseRelation,
  DatabaseTable,
  DatabaseTablePosition
} from "../../types/database";

interface DatabaseTablesProps {
  tables: DatabaseTable[];
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
            cornerRadius={UI_RADIUS}
            fill={tableBg}
            stroke={isTableSelected ? selectedBorder : tableBorder}
            strokeWidth={isTableSelected ? 1.5 : 1}
            shadowColor={colors.shadowColor}
            shadowBlur={isTableSelected ? 10 : 6}
            shadowOpacity={isTableSelected ? 0.28 : isDark ? 0.4 : 0.15}
            shadowOffsetY={2}
            perfectDrawEnabled={false}
          />
          <Rect
            width={DB_TABLE_WIDTH}
            height={DB_HEADER_HEIGHT}
            cornerRadius={[UI_RADIUS, UI_RADIUS, 0, 0]}
            fill={headerBg}
            perfectDrawEnabled={false}
          />
          <Text
            x={12}
            y={9}
            width={DB_TABLE_WIDTH - (table.records ? 72 : 24)}
            text={table.name}
            fontSize={13}
            fontStyle="600"
            fontFamily={UI_FONT_FAMILY}
            fill={headerText}
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
          {table.records && table.records.rows.length > 0 ? (
            <Text
              x={DB_TABLE_WIDTH - 52}
              y={9}
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
            const flagsX = DB_TABLE_WIDTH - 12;
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
              badges.length > 0 ? badges.length * 26 - 4 : 0;
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
                    stroke={tableBorder}
                    strokeWidth={0.5}
                    opacity={0.6}
                    perfectDrawEnabled={false}
                  />
                )}
                <Text
                  x={12}
                  y={(DB_ROW_HEIGHT - 12) / 2}
                  text={column.name}
                  fontSize={12}
                  fontStyle={column.isPrimaryKey ? "600" : "400"}
                  fontFamily={UI_FONT_FAMILY}
                  fill={rowText}
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
                  fontSize={11}
                  fontFamily={UI_CODE_FONT_FAMILY}
                  fill={typeText}
                  ellipsis
                  perfectDrawEnabled={false}
                />
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
                      cornerRadius={UI_RADIUS}
                      fill={badgeBg}
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
                      fill={badgeText}
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
