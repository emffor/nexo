"use client";
import { useProjectWorkspace } from "../hooks/useProjectWorkspace";

import dynamic from "next/dynamic";
import { AddMarkdownModal } from "../components/AddMarkdownModal";
import { AppShell } from "../components/AppShell";
import { CombinedOutputPanel } from "../components/CombinedOutputPanel";
import { ConfirmModal } from "../components/ConfirmModal";
import { DbmlEditor } from "../components/database/DbmlEditor";
import { DiagramSidebar } from "../components/DiagramSidebar";
import { SortableCardsPanel } from "../components/SortableCardsPanel";
import { ToastContainer } from "../components/Toast";
import { getDisplayTitle } from "../lib/items";

import {
  clampFontScale,
  FONT_SCALE
} from "../lib/preferences";
import type { DiagramState } from "../types/diagram";
import type { Project } from "../types/project";

const DiagramPanel = dynamic(() => import("../components/DiagramPanel"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[480px] w-full items-center justify-center rounded-2xl border border-[var(--ui-line)] bg-[var(--ui-surface)] text-sm text-[var(--ui-muted)]">
      <div className="nexo-loading flex items-center gap-3">Carregando diagrama...</div>
    </div>
  ),
});

const DatabaseDiagramPanel = dynamic(
  () => import("../components/database/DatabaseDiagramPanel"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[480px] w-full items-center justify-center rounded-2xl border border-[var(--ui-line)] bg-[var(--ui-surface)] text-sm text-[var(--ui-muted)]">
        <div className="nexo-loading flex items-center gap-3">Carregando diagrama de banco...</div>
      </div>
    ),
  },
);
const EMPTY_DIAGRAM_STATE: DiagramState = {
  positions: {},
  edges: [],
};

interface ProjectWorkspaceProps {
  project: Project;
  onBackToProjects: () => void;
}

export function ProjectWorkspace({
  project,
  onBackToProjects,
}: ProjectWorkspaceProps) {
  const {
    workspaceProject,
    diagramStateRef,
    isModalOpen,
    setIsModalOpen,
    isSaving,
    editingItem,
    setEditingItem,
    isScrollSyncEnabled,
    setIsScrollSyncEnabled,
    theme,
    setTheme,
    viewMode,
    diagramEdgeStyle,
    setDiagramEdgeStyle,
    databaseEdgeStyle,
    setDatabaseEdgeStyle,
    fontScale,
    setFontScale,
    isPreviewMaximized,
    setIsPreviewMaximized,
    isDiagramSidebarVisible,
    setIsDiagramSidebarVisible,
    hiddenDiagramItemIds,
    fileInputRef,
    items,
    updateItemStatus,
    updateItemObservation,
    reorderItems,
    isLoading,
    loadError,
    retryLoad,
    leftScrollRef,
    rightScrollRef,
    diagramResetSignal,
    diagramClearEdgesSignal,
    diagramReloadStateSignal,
    messages,
    dismissToast,
    reportActionError,
    databaseDiagram,
    databaseParseResult,
    databaseResetSignal,
    canUndoDatabase,
    canRedoDatabase,
    undoDatabase,
    redoDatabase,
    databaseSaveStatus,
    databaseLoadError,
    retryDatabaseLoad,
    onDatabaseContentChange,
    onDatabaseStateChange,
    onRenameDatabaseTable,
    onRenameDatabaseColumn,
    confirmClearAll,
    setConfirmClearAll,
    deletingItem,
    setDeletingItem,
    activeItemId,
    handleSave,
    handleClearAll,
    executeClearAll,
    handleExport,
    handleDiagramStateChange,
    handleImportClick,
    handleImportFile,
    handleDeleteItem,
    executeDeleteItem,
    handleCopyAll,
    isMac,
    handleSelectItem,
    handleSelectItemFromList,
    handleTogglePreviewStrikethrough,
    handleSetViewMode,
    storedDataSizeBytes,
    handleResetDatabaseLayout,
    handleSelectDiagramItem,
    handleToggleDiagramItemVisibility,
    handleResetDiagramLayout,
    handleClearDiagramEdges,
  } = useProjectWorkspace(project);
  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,text/plain,application/json"
        className="hidden"
        onChange={handleImportFile}
      />

      {loadError ? <div role="alert" className="nexo-ui flex items-center justify-center gap-3 p-4">
        <p>{loadError}</p>
        <button type="button" className="toolbar-button" onClick={retryLoad}>Tentar novamente</button>
      </div> : null}

      {databaseLoadError ? <div role="alert" className="nexo-ui flex items-center justify-center gap-3 p-4">
        <p>{databaseLoadError}</p>
        <button type="button" className="toolbar-button" onClick={retryDatabaseLoad}>Recarregar diagrama</button>
      </div> : null}

      <AppShell
        itemsCount={items.length}
        isPreviewMaximized={isPreviewMaximized}
        isDiagramSidebarVisible={isDiagramSidebarVisible}
        diagramEdgeStyle={diagramEdgeStyle}
        databaseEdgeStyle={databaseEdgeStyle}
        viewMode={viewMode}
        isScrollSyncEnabled={isScrollSyncEnabled}
        theme={theme}
        fontScale={fontScale}
        onOpenModal={() => setIsModalOpen(true)}
        onTogglePreviewMaximized={() =>
          setIsPreviewMaximized((current) => !current)
        }
        isSidebarToggleVisible={
          viewMode === "normal" ||
          viewMode === "index" ||
          viewMode === "diagram"
        }
        isSidebarHidden={isPreviewMaximized}
        isStrikethroughVisible={
          items.length > 0 &&
          (viewMode === "normal" ||
            viewMode === "index" ||
            viewMode === "cards")
        }
        onToggleStrikethrough={() => {
          void handleTogglePreviewStrikethrough().catch(reportActionError);
        }}
        onToggleDiagramSidebar={() =>
          setIsDiagramSidebarVisible((current) => !current)
        }
        onSetDiagramEdgeStyle={setDiagramEdgeStyle}
        onSetDatabaseEdgeStyle={setDatabaseEdgeStyle}
        onSetViewMode={handleSetViewMode}
        onResetDiagramLayout={handleResetDiagramLayout}
        onResetDatabaseLayout={handleResetDatabaseLayout}
        databaseInfo={
          viewMode === "database"
            ? {
              tables: databaseParseResult.tables.length,
              relations: databaseParseResult.relations.length,
              errors: databaseParseResult.errors.length,
            }
            : undefined
        }
        projectName={workspaceProject.name}
        storedDataSizeBytes={storedDataSizeBytes}
        onBackToProjects={onBackToProjects}
        onToggleScrollSync={() => setIsScrollSyncEnabled((current) => !current)}
        onToggleTheme={() =>
          setTheme((current) => (current === "dark" ? "light" : "dark"))
        }
        onClearAll={handleClearAll}
        onDecreaseFont={() =>
          setFontScale((current) => clampFontScale(current - FONT_SCALE.step))
        }
        onIncreaseFont={() =>
          setFontScale((current) => clampFontScale(current + FONT_SCALE.step))
        }
        onExport={() => {
          void handleExport().catch(reportActionError);
        }}
        onImport={handleImportClick}
        onCopyAll={() => {
          void handleCopyAll();
        }}
        isMac={isMac}
        leftPanel={
          viewMode === "database" ? (
            <DbmlEditor
              value={databaseDiagram?.content ?? ""}
              theme={theme}
              onChange={onDatabaseContentChange}
              errors={databaseParseResult.errors}
              onUndo={undoDatabase}
              onRedo={redoDatabase}
              canUndo={canUndoDatabase}
              canRedo={canRedoDatabase}
              saveStatus={databaseSaveStatus}
            />
          ) : viewMode === "diagram" ? (
            <DiagramSidebar
              items={items}
              theme={theme}
              activeItemId={activeItemId}
              hiddenItemIds={hiddenDiagramItemIds}
              onSelectItem={handleSelectDiagramItem}
              onToggleItemVisibility={handleToggleDiagramItemVisibility}
              onChangeStatus={(itemId, status) => {
                void updateItemStatus(itemId, status).catch(reportActionError);
              }}
              onChangeObservation={(itemId, observation) => {
                void updateItemObservation(itemId, observation).catch(reportActionError);
              }}
              onResetLayout={handleResetDiagramLayout}
              onClearEdges={handleClearDiagramEdges}
            />
          ) : (
            <SortableCardsPanel
              items={items}
              isLoading={isLoading}
              isOutlineMode={viewMode === "index"}
              onToggleOutlineMode={() => {
                handleSetViewMode(viewMode === "index" ? "normal" : "index");
              }}
              activeItemId={activeItemId}
              scrollContainerRef={leftScrollRef}
              theme={theme}
              onReorder={(activeId, overId) => reorderItems(activeId, overId).catch(reportActionError)}
              onSelect={handleSelectItemFromList}
              onEdit={(item) => {
                setEditingItem(item);
                setIsModalOpen(true);
              }}
              onDelete={(item) => {
                void handleDeleteItem(item);
              }}
              onChangeStatus={(itemId, status) => {
                void updateItemStatus(itemId, status).catch(reportActionError);
              }}
            />
          )
        }
        rightPanel={
          viewMode === "database" ? (
            <DatabaseDiagramPanel
              groups={databaseParseResult.groups}
              notes={databaseParseResult.notes}
              enums={databaseParseResult.enums}
              content={databaseDiagram?.content ?? ""}
              onContentChange={onDatabaseContentChange}
              tables={databaseParseResult.tables}
              relations={databaseParseResult.relations}
              theme={theme}
              state={databaseDiagram?.state ?? { positions: {} }}
              onStateChange={onDatabaseStateChange}
              onRenameTable={onRenameDatabaseTable}
              onRenameColumn={onRenameDatabaseColumn}
              edgeStyle={databaseEdgeStyle}
              resetSignal={databaseResetSignal}
              editor={
                <DbmlEditor
                  value={databaseDiagram?.content ?? ""}
                  theme={theme}
                  onChange={onDatabaseContentChange}
                  errors={databaseParseResult.errors}
                  onUndo={undoDatabase}
                  onRedo={redoDatabase}
                  canUndo={canUndoDatabase}
                  canRedo={canRedoDatabase}
                  saveStatus={databaseSaveStatus}
                />
              }
              onUndo={undoDatabase}
              onRedo={redoDatabase}
              canUndo={canUndoDatabase}
              canRedo={canRedoDatabase}
            />
          ) : viewMode === "diagram" ? (
            <DiagramPanel
              items={items}
              theme={theme}
              activeItemId={activeItemId}
              hiddenItemIds={hiddenDiagramItemIds}
              edgeStyle={diagramEdgeStyle}
              onSelectItem={handleSelectDiagramItem}
              onChangeStatus={(itemId, status) => {
                void updateItemStatus(itemId, status).catch(reportActionError);
              }}
              scrollContainerRef={rightScrollRef}
              resetLayoutSignal={diagramResetSignal}
              clearEdgesSignal={diagramClearEdgesSignal}
              reloadStateSignal={diagramReloadStateSignal}
              initialState={diagramStateRef.current ?? workspaceProject.diagramState ?? EMPTY_DIAGRAM_STATE}
              onDiagramStateChange={handleDiagramStateChange}
            />
          ) : (
            <CombinedOutputPanel
              items={items}
              isLoading={isLoading}
              theme={theme}
              viewMode={viewMode}
              activeItemId={activeItemId}
              scrollContainerRef={rightScrollRef}
              onSelect={handleSelectItem}
              onReorder={(activeId, overId) => reorderItems(activeId, overId).catch(reportActionError)}
              onChangeStatus={(itemId, status) => {
                void updateItemStatus(itemId, status).catch(reportActionError);
              }}
            />
          )
        }
      />

      <AddMarkdownModal
        open={isModalOpen}
        isSaving={isSaving}
        mode={editingItem ? "edit" : "create"}
        initialValue={editingItem?.content ?? ""}
        initialTitle={editingItem?.title ?? ""}
        theme={theme}
        isMac={isMac}
        onClose={() => {
          if (!isSaving) {
            setIsModalOpen(false);
            setEditingItem(null);
          }
        }}
        onSave={handleSave}
      />

      <ConfirmModal
        open={confirmClearAll}
        title="Remover todos os cards"
        description="Deseja remover todos os cards salvos? Essa acao nao pode ser desfeita."
        confirmLabel="Remover tudo"
        cancelLabel="Cancelar"
        variant="danger"
        theme={theme}
        onConfirm={() => {
          void executeClearAll().catch(reportActionError);
        }}
        onCancel={() => setConfirmClearAll(false)}
      />

      <ConfirmModal
        open={deletingItem !== null}
        title="Remover card"
        description={`Deseja remover o card "${deletingItem ? getDisplayTitle(deletingItem, 40) : ""}"?`}
        confirmLabel="Remover"
        cancelLabel="Cancelar"
        variant="danger"
        theme={theme}
        onConfirm={() => {
          void executeDeleteItem().catch(reportActionError);
        }}
        onCancel={() => setDeletingItem(null)}
      />

      <ToastContainer
        messages={messages}
        theme={theme}
        onDismiss={dismissToast}
      />
    </>
  );
}
